import { isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { createHash } from "node:crypto";
import {
  buildMainCourseWordBatches,
  mainCourseWordBatchChecksum,
} from "../packages/db/src/main-course-word-content.ts";
import {
  reviewedSourceCandidates,
  selectReviewedSourceBatches,
} from "./import-missing-reviewed-word-sources.mts";
import { verifyLocalSnapshot } from "./local-source-manifest.mts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { reviewedLexicalEvidence, reviewedLexicalPairSeal } from "./reviewed-lexical-evidence.mts";

type Candidate = ReturnType<typeof reviewedSourceCandidates>[number];
type Observation = Awaited<ReturnType<typeof inspectLocalWords>>["items"][number];

export function reviewedLexicalFingerprint(
  candidates: readonly Candidate[],
  observations: readonly Observation[],
) {
  if (observations.length !== candidates.length)
    throw new Error("Source observations are incomplete.");
  const hash = createHash("sha256");
  let missingOrChangedIdentity = 0;
  for (const [index, candidate] of candidates.entries()) {
    const evidence = reviewedLexicalEvidence(candidate, observations[index]!);
    if (evidence === null) missingOrChangedIdentity++;
    else hash.update(`${evidence}\n`);
  }
  return {
    pairs: candidates.length,
    missingOrChangedIdentity,
    lexicalSha256: missingOrChangedIdentity === 0 ? hash.digest("hex") : null,
  };
}

export function compareReviewedSourceObservations(
  candidates: readonly Candidate[],
  before: readonly Observation[],
  after: readonly Observation[],
) {
  const pairs = {
    checked: candidates.length,
    unchanged: 0,
    missingOrChangedIdentity: 0,
    changedGlosses: 0,
    changedRank: 0,
  };
  const differences: { candidate: Candidate; reason: "identity" | "gloss" }[] = [];
  if (before.length !== candidates.length || after.length !== candidates.length)
    throw new Error("Source observations are incomplete.");
  for (const [index, candidate] of candidates.entries()) {
    const previous = before[index]!;
    const next = after[index]!;
    const previousEvidence = reviewedLexicalEvidence(candidate, previous);
    const nextEvidence = reviewedLexicalEvidence(candidate, next);
    if (previousEvidence === null || nextEvidence === null) {
      pairs.missingOrChangedIdentity++;
      differences.push({ candidate, reason: "identity" });
      continue;
    }
    if (previous.lexical?.commonnessRank !== next.lexical?.commonnessRank) pairs.changedRank++;
    if (previousEvidence === nextEvidence) pairs.unchanged++;
    else {
      pairs.changedGlosses++;
      differences.push({ candidate, reason: "gloss" });
    }
  }
  return { pairs, differences };
}

async function main(args: readonly string[]) {
  const { values } = parseArgs({
    args: [...args],
    options: {
      "snapshot-dir": { type: "string" },
      "pair-seals": { type: "boolean" },
      "before-dir": { type: "string" },
      "after-dir": { type: "string" },
      batch: { type: "string", multiple: true },
    },
  });
  const beforeDir = values["before-dir"];
  const afterDir = values["after-dir"];
  const singleDir = values["snapshot-dir"];
  const batches = selectReviewedSourceBatches(buildMainCourseWordBatches(), values.batch ?? []);
  const candidates = reviewedSourceCandidates(batches);
  const inspect = async (snapshot: Awaited<ReturnType<typeof verifyLocalSnapshot>>) =>
    inspectLocalWords(snapshot.sources.find(({ id }) => id === "jmdict")!, candidates, {
      includeLexicalMetadata: true,
    });
  const noteProofsRequired = batches.reduce(
    (count, batch) =>
      count +
      batch.words.reduce((subtotal, word) => subtotal + (word.sourceNoteReadings?.length ?? 0), 0),
    0,
  );
  if (singleDir !== undefined) {
    if (!isAbsolute(singleDir) || beforeDir !== undefined || afterDir !== undefined)
      throw new Error("Select one absolute snapshot directory for fingerprinting.");
    const snapshot = await verifyLocalSnapshot(singleDir);
    const { items } = await inspect(snapshot);
    if (values["pair-seals"]) {
      if (noteProofsRequired) throw new Error("Source note evidence requires separate review.");
      let offset = 0;
      const manifests = Object.fromEntries(
        batches.map((batch) => {
          const pairs = reviewedSourceCandidates([batch]).map((candidate) =>
            reviewedLexicalPairSeal(candidate, items[offset++]!),
          );
          if (pairs.some((seal) => seal === null))
            throw new Error("Missing exact bilingual source evidence.");
          return [batch.id, { manifestSha256: mainCourseWordBatchChecksum(batch), pairs }];
        }),
      );
      console.log(
        JSON.stringify(
          {
            version: snapshot.snapshotVersion,
            jmdictArchiveSha256: snapshot.sources.find(({ id }) => id === "jmdict")!.archiveSha256,
            manifests,
          },
          null,
          2,
        ),
      );
      return;
    }
    const total = reviewedLexicalFingerprint(candidates, items);
    let offset = 0;
    const manifests = batches.map((batch) => {
      const count = reviewedSourceCandidates([batch]).length;
      const end = offset + count;
      const report = reviewedLexicalFingerprint(
        candidates.slice(offset, end),
        items.slice(offset, end),
      );
      offset = end;
      return { id: batch.id, ...report };
    });
    console.log(
      JSON.stringify(
        {
          snapshotVersion: snapshot.snapshotVersion,
          archives: Object.fromEntries(
            snapshot.sources.map(({ id, archiveSha256 }) => [id, archiveSha256]),
          ),
          total,
          manifests,
          noteProofsRequired,
          publicationApproved: false,
        },
        null,
        2,
      ),
    );
    if (total.missingOrChangedIdentity || noteProofsRequired) process.exitCode = 2;
    return;
  }
  if (
    values["pair-seals"] ||
    !beforeDir ||
    !afterDir ||
    !isAbsolute(beforeDir) ||
    !isAbsolute(afterDir) ||
    resolve(beforeDir) === resolve(afterDir)
  )
    throw new Error("Select two distinct absolute snapshot directories.");
  const [previous, next] = await Promise.all([
    verifyLocalSnapshot(beforeDir),
    verifyLocalSnapshot(afterDir),
  ]);
  const [before, after] = await Promise.all([inspect(previous), inspect(next)]);
  const { pairs } = compareReviewedSourceObservations(candidates, before.items, after.items);
  console.log(
    JSON.stringify(
      {
        previous: previous.snapshotVersion,
        next: next.snapshotVersion,
        manifests: batches.length,
        pairs,
        noteProofsRequired,
        publicationApproved: false,
      },
      null,
      2,
    ),
  );
  if (pairs.changedGlosses || pairs.missingOrChangedIdentity || noteProofsRequired)
    process.exitCode = 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).catch(() => {
    console.error("Reviewed source comparison failed before an aggregate result was available.");
    process.exitCode = 1;
  });
}
