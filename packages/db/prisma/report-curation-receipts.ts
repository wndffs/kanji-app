import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient, type ImportRunStatus, type Prisma } from "@prisma/client";
import { withNeonConnectionDefaults } from "../src/connection-defaults";
import { CURATION_SOURCE_NAMES } from "../src/curation-source-names";
import {
  buildEditorialRegistryInventory,
  type EditorialRegistryInventory,
} from "../src/editorial-registry-inventory";

type Manifest = Pick<
  EditorialRegistryInventory["batches"][number],
  "id" | "kind" | "checksumSha256" | "version" | "sourceFile"
>;

const receiptSelect = {
  checksumSha256: true,
  sourceVersion: true,
  sourceFileName: true,
  status: true,
  finishedAt: true,
  dataSource: { select: { name: true } },
} as const satisfies Prisma.ImportRunSelect;

type Receipt = Prisma.ImportRunGetPayload<{ select: typeof receiptSelect }>;
type ReceiptStatus = "COMPLETE" | "MISSING" | "INCONSISTENT" | Exclude<ImportRunStatus, "SUCCESS">;
type ReceiptExpectation = "unfinished" | "complete";

export function parseCurationReceiptSelection(args: readonly string[]): {
  kanji: readonly string[];
  word: readonly string[];
  expect?: ReceiptExpectation;
} {
  const { values } = parseArgs({
    args: [...args],
    options: {
      "kanji-batch": { type: "string", multiple: true },
      "word-batch": { type: "string", multiple: true },
      expect: { type: "string" },
    },
  });
  const kanji = values["kanji-batch"] ?? [];
  const word = values["word-batch"] ?? [];
  const ids = [...kanji, ...word];
  const expect = values.expect;
  if (
    ids.length === 0 ||
    kanji.length > 1 ||
    word.length > 40 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !/^[a-z][a-z0-9-]{0,79}$/u.test(id)) ||
    (expect !== undefined && expect !== "unfinished" && expect !== "complete")
  )
    throw new Error("Select one kanji manifest and/or up to 40 distinct word manifests.");
  return { kanji, word, ...(expect === undefined ? {} : { expect }) };
}

export function summarizeCurationReceipts(
  manifests: readonly Manifest[],
  receipts: readonly Receipt[],
) {
  const counts: Record<ReceiptStatus, number> = {
    COMPLETE: 0,
    MISSING: 0,
    INCONSISTENT: 0,
    PENDING: 0,
    FAILED: 0,
  };
  const batches = manifests.map((manifest) => {
    const matches = receipts.filter(
      (receipt) =>
        receipt.checksumSha256 === manifest.checksumSha256 &&
        receipt.dataSource.name === CURATION_SOURCE_NAMES[manifest.kind],
    );
    const receipt = matches[0];
    let status: ReceiptStatus;
    if (!receipt) status = "MISSING";
    else if (
      matches.length !== 1 ||
      receipt.sourceFileName !== manifest.sourceFile ||
      receipt.sourceVersion !== manifest.version ||
      (receipt.status === "SUCCESS" && receipt.finishedAt === null)
    )
      status = "INCONSISTENT";
    else status = receipt.status === "SUCCESS" ? "COMPLETE" : receipt.status;
    counts[status]++;
    return { id: manifest.id, kind: manifest.kind, status };
  });
  return { counts, batches };
}

export function receiptGateFailure(
  report: ReturnType<typeof summarizeCurationReceipts>,
  expectation?: ReceiptExpectation,
): string | null {
  if (report.counts.INCONSISTENT > 0)
    return "Selected manifests have inconsistent receipt metadata.";
  if (expectation === "unfinished" && report.counts.COMPLETE > 0)
    return "Remove already complete manifests before applying the selected release.";
  if (expectation === "complete" && report.counts.COMPLETE !== report.batches.length)
    return "The selected release does not have a complete receipt for every manifest.";
  return null;
}

export function resolveCurationReceiptManifests(args: readonly string[]): readonly Manifest[] {
  const selection = parseCurationReceiptSelection(args);
  const inventory = buildEditorialRegistryInventory();
  if (!inventory.validation.valid) throw new Error("The editorial registry must be valid.");
  return (["kanji", "word"] as const).flatMap((kind) =>
    selection[kind].map((id) => {
      const manifest = inventory.batches.find((batch) => batch.kind === kind && batch.id === id);
      if (manifest?.reviewStatus !== "reviewed")
        throw new Error("Select registered, reviewed manifests.");
      return manifest;
    }),
  );
}

export function formatReceiptDatabaseError(error: unknown): string {
  const codes =
    typeof error === "object" && error !== null
      ? ["code" in error ? error.code : null, "errorCode" in error ? error.errorCode : null]
      : [];
  // Prisma diagnostics can include connection material. Log only codes, never the error text.
  const code = codes.find((value) => typeof value === "string" && /^P[0-9]{4}$/u.test(value));
  return typeof code === "string"
    ? `Unable to read curation receipts from the database (${code}).`
    : "Unable to read curation receipts from the database (no Prisma error code).";
}

async function main() {
  let manifests: readonly Manifest[];
  let expectation: ReceiptExpectation | undefined;
  try {
    const args = process.argv.slice(2);
    expectation = parseCurationReceiptSelection(args).expect;
    manifests = resolveCurationReceiptManifests(args);
  } catch {
    console.error(
      "Curation receipt selection failed. Select explicit registered, reviewed manifests.",
    );
    process.exitCode = 1;
    return;
  }

  let prisma: PrismaClient | undefined;
  try {
    const url = process.env.DATABASE_URL;
    prisma = new PrismaClient(url ? { datasourceUrl: withNeonConnectionDefaults(url) } : undefined);
    const receipts = await prisma.importRun.findMany({
      where: {
        OR: manifests.map((manifest) => ({
          checksumSha256: manifest.checksumSha256,
          dataSource: { name: CURATION_SOURCE_NAMES[manifest.kind] },
        })),
      },
      select: receiptSelect,
    });
    const report = summarizeCurationReceipts(manifests, receipts);
    console.log(JSON.stringify(report, null, 2));
    const failure = receiptGateFailure(report, expectation);
    if (failure !== null) {
      console.error(failure);
      process.exitCode = 1;
    }
  } catch (error: unknown) {
    console.error(formatReceiptDatabaseError(error));
    process.exitCode = 1;
  } finally {
    await prisma?.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error: unknown) => {
    console.error(formatReceiptDatabaseError(error));
    process.exitCode = 1;
  });
}
