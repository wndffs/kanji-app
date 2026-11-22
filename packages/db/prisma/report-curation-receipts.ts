import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { PrismaClient, type ImportRunStatus, type Prisma } from "@prisma/client";
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

export function parseCurationReceiptSelection(args: readonly string[]) {
  const { values } = parseArgs({
    args: [...args],
    options: {
      "kanji-batch": { type: "string", multiple: true },
      "word-batch": { type: "string", multiple: true },
    },
  });
  const kanji = values["kanji-batch"] ?? [];
  const word = values["word-batch"] ?? [];
  const ids = [...kanji, ...word];
  if (
    ids.length === 0 ||
    kanji.length > 1 ||
    word.length > 40 ||
    new Set(ids).size !== ids.length ||
    ids.some((id) => !/^[a-z][a-z0-9-]{0,79}$/u.test(id))
  )
    throw new Error("Select one kanji manifest and/or up to 40 distinct word manifests.");
  return { kanji, word };
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

async function main() {
  const selection = parseCurationReceiptSelection(process.argv.slice(2));
  const inventory = buildEditorialRegistryInventory();
  if (!inventory.validation.valid) throw new Error("The editorial registry must be valid.");
  const manifests = (Object.keys(selection) as Array<keyof typeof selection>).flatMap((kind) =>
    selection[kind].map((id) => {
      const manifest = inventory.batches.find((batch) => batch.kind === kind && batch.id === id);
      if (manifest?.reviewStatus !== "reviewed")
        throw new Error("Select registered, reviewed manifests.");
      return manifest;
    }),
  );
  const prisma = new PrismaClient();
  try {
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
    if (report.counts.INCONSISTENT > 0) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(() => {
    console.error(
      "Receipt check failed. Verify the database connection and explicit reviewed manifest IDs.",
    );
    process.exitCode = 1;
  });
}
