import { createHash } from "node:crypto";
import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  buildMainCourseWordBatches,
  mainCourseWordBatchChecksum,
  mainCourseWordReadingEntryId,
  validateMainCourseWordBatches,
  type MainCourseWordBatch,
} from "../packages/db/src/main-course-word-content.ts";
import {
  importJmDictXml,
  type JmDictExactPair,
  type JmDictImportDatabase,
} from "../packages/content-importers/src/jmdict.ts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { verifyLocalSnapshot, type LocalSource } from "./local-source-manifest.mts";
import { scanSourceXml, serializeNode, textOf } from "./local-source-xml.mts";
import { reviewedLexicalPairSeal } from "./reviewed-lexical-evidence.mts";
import { reviewedRefreshManifests } from "./reviewed-source-pins.mjs";
import {
  buildReadingNoteProofPlans,
  planOrApplyReadingNoteProofs,
} from "./jmdict-reading-note-proofs.mts";

type Candidate = { expression: string; reading: string; jmdictEntryId: string };
type Observed = {
  expression: string;
  reading: string;
  jmdictEntryId: string | null;
  importStatus?: string | null;
};
const pairKey = (item: { expression: string; reading: string }) =>
  JSON.stringify([item.expression, item.reading]);

const MAX_BATCH_IDS = 40;
const MAX_SOURCE_PAIRS = 100;
class IncompleteExistingSourceError extends Error {}
class ChangedReviewedSourceError extends Error {
  constructor(readonly mismatchedPairs: number) {
    super("Refreshed JMdict evidence differs from reviewed lexical evidence.");
  }
}

export function selectReviewedSourceBatches(
  batches: readonly MainCourseWordBatch[],
  ids: readonly string[],
): readonly MainCourseWordBatch[] {
  if (
    !ids.length ||
    ids.length > MAX_BATCH_IDS ||
    ids.some((id) => !/^[a-z][a-z0-9-]{0,79}$/u.test(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new Error("Source supplementation requires 1-40 distinct registered word batch IDs.");

  const selected = new Set(ids);
  const scoped = batches.filter((batch) => selected.has(batch.id));
  if (scoped.length !== ids.length || scoped.some((batch) => !batch.reviewedAt))
    throw new Error("Source supplementation requires existing, editorially reviewed word batches.");
  return scoped;
}

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
        jmdictEntryId: mainCourseWordReadingEntryId(word, reading),
      })),
    ),
  );
}

function findAbsentReviewedSources(
  candidates: readonly Candidate[],
  observed: readonly Observed[],
): readonly Candidate[] {
  const existing = new Map(observed.map((item) => [pairKey(item), item]));
  return candidates.filter((candidate) => {
    const item = existing.get(pairKey(candidate));
    if (item && item.jmdictEntryId !== candidate.jmdictEntryId)
      throw new Error("Existing word has a conflicting source identity; automatic repair refused.");
    if (item?.importStatus !== undefined && item.importStatus !== "SUCCESS")
      throw new IncompleteExistingSourceError(
        "Existing word pairs have incomplete import provenance; automatic repair refused.",
      );
    // Existing rows are never repaired or declared source-verified here.
    // The full curator remains authoritative for their licensed provenance and RU/EN senses.
    return !item;
  });
}

export function planReviewedSourceWindow(
  candidates: readonly Candidate[],
  observed: readonly Observed[],
  maxPairs?: number,
) {
  const missing = findAbsentReviewedSources(candidates, observed);
  if (maxPairs === undefined && missing.length > MAX_SOURCE_PAIRS)
    throw new Error("Missing source set exceeds the bounded supplement limit (100 pairs).");
  if (
    maxPairs !== undefined &&
    (!Number.isInteger(maxPairs) || maxPairs < 1 || maxPairs > MAX_SOURCE_PAIRS)
  )
    throw new Error("Source-only windows are limited to 1-100 pairs.");
  const selected = missing.slice(0, maxPairs ?? MAX_SOURCE_PAIRS);
  return { selected, totalMissingPairs: missing.length };
}

export function requireAbsentSupplementPairs(existing: readonly unknown[]): void {
  if (existing.length)
    throw new Error(
      "Supplement would touch an existing exact word pair; insert-only import refused.",
    );
}

export function reviewedSourcePairSeals(
  batches: readonly MainCourseWordBatch[],
  manifests: Readonly<Record<string, { manifestSha256: string; pairs: readonly string[] }>>,
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();
  for (const batch of batches) {
    const candidates = reviewedSourceCandidates([batch]);
    const reviewed = manifests[batch.id];
    if (
      !Object.hasOwn(manifests, batch.id) ||
      reviewed?.manifestSha256 !== mainCourseWordBatchChecksum(batch) ||
      reviewed.pairs.length !== candidates.length ||
      reviewed.pairs.some((seal) => !/^[a-f0-9]{64}$/u.test(seal))
    )
      throw new Error("The refreshed archive requires the exact sealed teaching manifests.");
    candidates.forEach((candidate, index) =>
      result.set(pairKey(candidate), reviewed.pairs[index]!),
    );
  }
  return result;
}

export async function buildReviewedSourceSupplement(
  source: LocalSource,
  candidates: readonly Candidate[],
  reviewedSeals?: ReadonlyMap<string, string>,
) {
  if (!candidates.length || candidates.length > MAX_SOURCE_PAIRS)
    throw new Error("A supplement needs 1-100 explicit pairs.");
  const evidence = await inspectLocalWords(source, candidates, {
    includeLexicalMetadata: reviewedSeals !== undefined,
  });
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
  if (reviewedSeals !== undefined) {
    const mismatched = candidates.filter((candidate, index) => {
      const expected = reviewedSeals.get(pairKey(candidate));
      return !expected || reviewedLexicalPairSeal(candidate, evidence.items[index]!) !== expected;
    });
    if (mismatched.length) throw new ChangedReviewedSourceError(mismatched.length);
  }
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
  const exactPairs = candidates.map(
    ({ expression, reading, jmdictEntryId }): JmDictExactPair => ({
      expression,
      reading,
      sourceRecordId: jmdictEntryId,
    }),
  );
  return {
    xml,
    exactPairs,
    entryCount: records.size,
    checksumSha256: createHash("sha256").update(xml).digest("hex"),
  };
}

export function parseSourceSupplementArgs(args: readonly string[]) {
  const usage =
    "Usage: import-missing-reviewed-word-sources --snapshot-dir ABSOLUTE_DIRECTORY --batch ID [--batch ID ...] [--max-pairs 1-100] [--apply]";
  let directory: string | undefined;
  let apply = false;
  let maxPairs: number | undefined;
  const batchIds: string[] = [];
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--apply" && !apply) apply = true;
    else if (arg === "--snapshot-dir" && directory === undefined && args[i + 1]) {
      directory = args[++i];
    } else if (arg === "--batch" && /^[a-z][a-z0-9-]{0,79}$/u.test(args[i + 1] ?? "")) {
      batchIds.push(args[++i]!);
    } else if (
      arg === "--max-pairs" &&
      maxPairs === undefined &&
      /^(?:[1-9][0-9]?|100)$/u.test(args[i + 1] ?? "")
    ) {
      maxPairs = Number(args[++i]);
    } else throw new Error(usage);
  }
  if (
    !directory ||
    !isAbsolute(directory) ||
    !batchIds.length ||
    batchIds.length > MAX_BATCH_IDS ||
    new Set(batchIds).size !== batchIds.length
  )
    throw new Error(usage);
  return { directory, apply, batchIds, ...(maxPairs === undefined ? {} : { maxPairs }) };
}

async function main(args: readonly string[]) {
  const options = parseSourceSupplementArgs(args);
  const batches = selectReviewedSourceBatches(buildMainCourseWordBatches(), options.batchIds);
  const candidates = reviewedSourceCandidates(batches);
  const counts = { selectedBatchCount: batches.length, candidatePairCount: candidates.length };
  const snapshot = await verifyLocalSnapshot(options.directory);
  const source = snapshot.sources.find((item) => item.id === "jmdict")!;
  const reviewedManifests = reviewedRefreshManifests(
    snapshot.snapshotVersion,
    source.archiveSha256,
  );
  const reviewedSeals =
    reviewedManifests === null ? undefined : reviewedSourcePairSeals(batches, reviewedManifests);
  const proofPlans = await buildReadingNoteProofPlans(
    source,
    batches.flatMap((batch) => batch.words),
    snapshot.snapshotVersion,
  );
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    // Validate every existing proof without writes before any raw-source supplement.
    const proofPlan = await planOrApplyReadingNoteProofs(db, proofPlans);
    const readObserved = async (reader: Pick<typeof db, "word"> = db) =>
      (
        await reader.word.findMany({
          where: { OR: candidates.map(({ expression, reading }) => ({ expression, reading })) },
          select: {
            expression: true,
            reading: true,
            jmdictEntryId: true,
            importedRecord: { select: { importRun: { select: { status: true } } } },
          },
        })
      ).map(({ importedRecord, ...row }) => ({
        ...row,
        importStatus: importedRecord?.importRun.status ?? null,
      }));
    const { selected: missing, totalMissingPairs } = planReviewedSourceWindow(
      candidates,
      await readObserved(),
      options.maxPairs,
    );
    if (!missing.length) {
      const proofs = options.apply
        ? await planOrApplyReadingNoteProofs(db, proofPlans, { apply: true })
        : proofPlan;
      console.log(
        JSON.stringify({
          status: "no-absent-word-pairs",
          importedEntries: 0,
          remainingPairs: 0,
          existingRowsNotRevalidated: true,
          ...counts,
          ...proofs,
        }),
      );
      return;
    }
    const supplement = await buildReviewedSourceSupplement(source, missing, reviewedSeals);
    // Only these exact pairs are written; other spellings/readings of the same entries are untouched.
    const checkAbsent = async (reader: Pick<typeof db, "word">) =>
      requireAbsentSupplementPairs(
        await reader.word.findMany({
          where: {
            OR: supplement.exactPairs.map(({ expression, reading }) => ({ expression, reading })),
          },
          select: { id: true },
        }),
      );
    const summary = {
      snapshotVersion: snapshot.snapshotVersion,
      ...counts,
      parentContentSha256: source.contentSha256,
      derivedContentSha256: supplement.checksumSha256,
      missingPairs: missing.length,
      totalMissingPairs,
      entries: supplement.entryCount,
      plannedProofCount: proofPlan.plannedProofCount,
      ...(reviewedSeals === undefined ? {} : { revalidatedLexicalPairs: missing.length }),
      existingRowsNotRevalidated: true,
    };
    if (!options.apply) {
      await checkAbsent(db);
      console.log(JSON.stringify({ status: "supplement-plan", ...summary }));
      return;
    }
    const { createPrismaJmDictBatchWriter } =
      await import("../packages/content-importers/src/jmdict-prisma-batch.ts");
    const attempted = new Set(missing.map(pairKey));
    const { result, remaining } = await db.$transaction(
      async (transaction) => {
        await checkAbsent(transaction);
        const result = await importJmDictXml(
          transaction as unknown as JmDictImportDatabase,
          supplement.xml,
          {
            sourceFileName: `JMdict-${snapshot.snapshotVersion}-derived-from-${source.contentSha256}.xml`,
            sourceVersion: snapshot.snapshotVersion,
            sourceDownloadedAt: new Date(source.downloadedAt),
            checksumSha256: supplement.checksumSha256,
            exactPairs: supplement.exactPairs,
            batchWriter: createPrismaJmDictBatchWriter(transaction, { insertOnly: true }),
          },
        );
        const remaining = findAbsentReviewedSources(candidates, await readObserved(transaction));
        if (
          remaining.some((candidate) => attempted.has(pairKey(candidate))) ||
          (options.maxPairs === undefined && remaining.length > 0)
        )
          throw new Error("Source supplement did not satisfy the requested source evidence.");
        return { result, remaining };
      },
      { maxWait: 5_000, timeout: 120_000 },
    );
    const proofs =
      remaining.length === 0
        ? await planOrApplyReadingNoteProofs(db, proofPlans, { apply: true })
        : proofPlan;
    console.log(
      JSON.stringify({
        status: result.status,
        importedEntries: result.entryCount,
        importChecksumSha256: result.checksumSha256,
        remainingPairs: remaining.length,
        ...summary,
        ...proofs,
      }),
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv.slice(2)).catch((error: unknown) => {
    if (error instanceof ChangedReviewedSourceError)
      console.error(
        JSON.stringify({
          status: "refreshed-source-review-required",
          pairs: error.mismatchedPairs,
        }),
      );
    if (error instanceof IncompleteExistingSourceError)
      console.error(
        "REVIEWED_SOURCE_PROVENANCE_INCOMPLETE: existing rows need a separate reviewed provenance repair.",
      );
    console.error(
      "REVIEWED_SOURCE_SUPPLEMENT_FAILED: check pinned source evidence, exact identities and published-target guard. No teaching content is published by this command.",
    );
    process.exitCode = 1;
  });
}
