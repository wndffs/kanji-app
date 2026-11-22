import { createHash } from "node:crypto";
import type { inspectLocalWords } from "./local-word-evidence.mts";

export type ReviewedLexicalCandidate = {
  expression: string;
  reading: string;
  jmdictEntryId: string;
};
export type ReviewedLexicalObservation = Awaited<
  ReturnType<typeof inspectLocalWords>
>["items"][number];

export function reviewedLexicalEvidence(
  candidate: ReviewedLexicalCandidate,
  item: ReviewedLexicalObservation,
): string | null {
  if (
    item.expression !== candidate.expression ||
    item.reading !== candidate.reading ||
    item.sourceRecordId !== candidate.jmdictEntryId ||
    item.status !== "matched" ||
    !item.bilingual ||
    !item.lexical
  )
    return null;

  const glosses = [
    ...new Set(
      item.lexical.senses.map((sense) =>
        JSON.stringify([sense.locale, sense.meaning, sense.partOfSpeech]),
      ),
    ),
  ].sort();
  return JSON.stringify([
    candidate.expression,
    candidate.reading,
    candidate.jmdictEntryId,
    glosses,
  ]);
}

export function reviewedLexicalPairSeal(
  candidate: ReviewedLexicalCandidate,
  item: ReviewedLexicalObservation,
): string | null {
  const evidence = reviewedLexicalEvidence(candidate, item);
  return evidence === null ? null : createHash("sha256").update(evidence).digest("hex");
}
