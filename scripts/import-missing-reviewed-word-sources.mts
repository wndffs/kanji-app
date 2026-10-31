import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatches,
  type MainCourseWordBatch,
} from "../packages/db/src/main-course-word-content.ts";
import {
  importJmDictXml,
  parseJmDictXml,
  type JmDictImportDatabase,
} from "../packages/content-importers/src/jmdict.ts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { verifyLocalSnapshot, type LocalSource } from "./local-source-manifest.mts";
import { scanSourceXml, serializeNode, textOf } from "./local-source-xml.mts";

type Candidate = { expression: string; reading: string; jmdictEntryId: string };
type Observed = {
  expression: string;
  reading: string;
  jmdictEntryId: string | null;
};
const pairKey = (item: { expression: string; reading: string }) =>
  JSON.stringify([item.expression, item.reading]);

export function reviewedSourceCandidates(
  batches: readonly MainCourseWordBatch[],
): readonly Candidate[] {
  if (validateMainCourseWordBatches(batches).length || batches.some((batch) => !batch.reviewedAt))
    throw new Error(
      "Only valid, editorially reviewed word manifests can request source supplements.",
    );
  return batches.flatMap((batch) =>
    batch.words.flatMap((word) =>
      [word.reading, ...(word.acceptedReadings ?? [])].map((reading) => ({
        expression: word.expression,
        reading,
        jmdictEntryId: word.jmdictEntryId,
      })),
    ),
  );
}

export function missingReviewedSources(
  candidates: readonly Candidate[],
  observed: readonly Observed[],
): readonly Candidate[] {
  const existing = new Map(observed.map((item) => [pairKey(item), item]));
  const missing = candidates.filter((candidate) => {
    const item = existing.get(pairKey(candidate));
    if (item && item.jmdictEntryId !== candidate.jmdictEntryId)
      throw new Error("Existing word has a conflicting source identity; automatic repair refused.");
    // Existing rows are never repaired or declared source-verified here.
    // The full curator remains authoritative for their licensed provenance and RU/EN senses.
    return !item;
  });
  if (missing.length > 100)
    throw new Error("Missing source set exceeds the bounded supplement limit (100 pairs).");
  return missing;
}

export function requireAbsentSupplementAliases(existing: readonly unknown[]): void {
  if (existing.length)
    throw new Error(
      "Supplement would touch an existing word or alias; insert-only import refused.",
    );
}

export async function buildReviewedSourceSupplement(
  source: LocalSource,
  candidates: readonly Candidate[],
) {
  if (!candidates.length || candidates.length > 100)
    throw new Error("A supplement needs 1-100 explicit pairs.");
  const evidence = await inspectLocalWords(source, candidates);
  if (
    evidence.items.some(
      (item, index) =>
        item.status !== "matched" ||
        !item.bilingual ||
        item.sourceRecordId !== candidates[index]!.jmdictEntryId,
    )
  )
    throw new Error(
      "Supplement requires exact, unique bilingual source matches for every requested pair.",
    );
  const ids = new Set(candidates.map((item) => item.jmdictEntryId.replace(/^jmdict:/u, "")));
  const records = new Map<string, string>();
  await scanSourceXml(source, "JMdict", "entry", (node) => {
    const id = textOf(node, "ent_seq")[0];
    if (!id || !ids.has(id)) return;
    if (records.has(id)) throw new Error("Duplicate source record.");
    records.set(id, serializeNode(node));
  });
  if (records.size !== ids.size) throw new Error("Source supplement is incomplete.");
  const xml = `<JMdict>${[...records]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([, value]) => value)
    .join("")}</JMdict>`;
  if (Buffer.byteLength(xml, "utf8") > 8_388_608)
    throw new Error("Source supplement exceeds its byte budget.");
  const touchedPairs = parseJmDictXml(xml).entries.flatMap((entry) =>
    entry.words.map(({ expression, reading }) => ({ expression, reading })),
  );
  if (touchedPairs.length > 400)
    throw new Error("Source supplement exceeds its word-variant budget.");
  return {
    xml,
    touchedPairs,
    entryCount: records.size,
    checksumSha256: createHash("sha256").update(xml).digest("hex"),
  };
}

export function parseSourceSupplementArgs(args: readonly string[]) {
  const apply = args.includes("--apply");
  const values = args.filter((arg) => arg !== "--apply");
  if (
    new Set(args).size !== args.length ||
    values.length !== 2 ||
    values[0] !== "--snapshot-dir" ||
    !isAbsolute(values[1]!)
  )
    throw new Error(
      "Usage: import-missing-reviewed-word-sources --snapshot-dir ABSOLUTE_DIRECTORY [--apply]",
    );
  return { directory: values[1]!, apply };
}

async function main(args: readonly string[]) {
  const options = parseSourceSupplementArgs(args);
  const candidates = reviewedSourceCandidates(buildMainCourseWordBatches());
  const snapshot = await verifyLocalSnapshot(options.directory);
  const source = snapshot.sources.find((item) => item.id === "jmdict")!;
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    const readObserved = () =>
      db.word.findMany({
        where: { OR: candidates.map(({ expression, reading }) => ({ expression, reading })) },
        select: {
          expression: true,
          reading: true,
          jmdictEntryId: true,
        },
      });
    const missing = missingReviewedSources(candidates, await readObserved());
    if (!missing.length) {
      console.log(
        JSON.stringify({
          status: "no-absent-word-pairs",
          importedEntries: 0,
          existingRowsNotRevalidated: true,
        }),
      );
      return;
    }
    const supplement = await buildReviewedSourceSupplement(source, missing);
    // Protect every alias, including unpublished words and rows with missing source IDs.
    const existing = await db.word.findMany({
      where: {
        OR: [
          { jmdictEntryId: { in: [...new Set(missing.map((item) => item.jmdictEntryId))] } },
          ...supplement.touchedPairs,
        ],
      },
      select: { id: true },
    });
    requireAbsentSupplementAliases(existing);
    const summary = {
      snapshotVersion: snapshot.snapshotVersion,
      parentContentSha256: source.contentSha256,
      derivedContentSha256: supplement.checksumSha256,
      missingPairs: missing.length,
      entries: supplement.entryCount,
      existingRowsNotRevalidated: true,
    };
    if (!options.apply) {
      console.log(JSON.stringify({ status: "supplement-plan", ...summary }));
      return;
    }
    const { createPrismaJmDictBatchWriter } =
      await import("../packages/content-importers/src/jmdict-prisma-batch.ts");
    const result = await importJmDictXml(db as unknown as JmDictImportDatabase, supplement.xml, {
      sourceFileName: `JMdict-${snapshot.snapshotVersion}-derived-from-${source.contentSha256}.xml`,
      sourceVersion: snapshot.snapshotVersion,
      sourceDownloadedAt: new Date(source.downloadedAt),
      checksumSha256: supplement.checksumSha256,
      batchWriter: createPrismaJmDictBatchWriter(db, { insertOnly: true }),
    });
    if (missingReviewedSources(candidates, await readObserved()).length)
      throw new Error("Source supplement did not satisfy the requested source evidence.");
    console.log(
      JSON.stringify({ status: result.status, importedEntries: result.entryCount, ...summary }),
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch(() => {
    console.error(
      "REVIEWED_SOURCE_SUPPLEMENT_FAILED: check pinned source evidence, exact identities and published-target guard. No teaching content is published by this command.",
    );
    process.exitCode = 1;
  });
}
