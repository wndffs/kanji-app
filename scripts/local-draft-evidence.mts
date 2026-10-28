import { createHash } from "node:crypto";
import { buildKanjiDraft07 } from "../packages/db/src/editorial-draft-kanji-07";
import { buildWordDraft07 } from "../packages/db/src/editorial-draft-words-07";
import { verifyLocalSnapshot, type LocalSourceSnapshot } from "./local-source-manifest.mts";
import { inspectLocalKanji } from "./local-kanji-evidence.mts";
import { inspectLocalWords } from "./local-word-evidence.mts";
import { inspectLocalStrokes } from "./local-stroke-evidence.mts";

export const fingerprint = (value: unknown): string =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export function localCandidateFingerprint(): string {
  return fingerprint({ kanji: buildKanjiDraft07(), words: buildWordDraft07() });
}
export function localSourceFingerprint(snapshot: LocalSourceSnapshot): string {
  return fingerprint({
    version: snapshot.snapshotVersion,
    sources: snapshot.sources
      .map(({ path: _path, ...source }) => source)
      .sort((a, b) => a.id.localeCompare(b.id)),
  });
}
export async function inspectLocalDraft(directory: string) {
  const snapshot = await verifyLocalSnapshot(directory);
  const source = (id: "jmdict" | "kanjidic2" | "kanjivg") =>
    snapshot.sources.find((candidate) => candidate.id === id)!;
  const kanjiDraft = buildKanjiDraft07();
  const words = buildWordDraft07().words;
  const characters = [
    ...new Set([
      ...kanjiDraft.components.map((candidate) => candidate.symbol),
      ...kanjiDraft.kanji.map((candidate) => candidate.character),
    ]),
  ].sort();
  const kanji = await inspectLocalKanji(source("kanjidic2"), kanjiDraft.kanji);
  const dictionary = await inspectLocalWords(source("jmdict"), words);
  const strokes = await inspectLocalStrokes(source("kanjivg"), characters);
  const report = {
    scope: "local-draft07-source-observations" as const,
    policyVersion: "local-draft-evidence-v1",
    candidateFingerprint: localCandidateFingerprint(),
    sourceFingerprint: localSourceFingerprint(snapshot),
    snapshot,
    kanji,
    words: dictionary,
    strokes,
    independentReview: false,
    publicationApproved: false,
    readyToPublish: false,
  };
  return { ...report, summary: summarizeLocalEvidence(report) };
}
export function summarizeLocalEvidence(report: {
  kanji: { scanned: number; items: readonly { status: string }[] };
  words: { scanned: number; items: readonly { status: string; bilingual: boolean }[] };
  strokes: { scanned: number; items: readonly { status: string }[] };
}) {
  const count = (section: { scanned: number; items: readonly { status: string }[] }) => ({
    scanned: section.scanned,
    candidates: section.items.length,
    matched: section.items.filter((item) => item.status === "matched").length,
    missing: section.items.filter((item) => item.status === "missing").length,
    ambiguous: section.items.filter((item) => item.status === "ambiguous").length,
    mismatched: section.items.filter((item) => item.status === "reading-mismatch").length,
  });
  const kanji = count(report.kanji);
  const words = {
    ...count(report.words),
    bilingual: report.words.items.filter((item) => item.status === "matched" && item.bilingual)
      .length,
  };
  const strokes = count(report.strokes);
  const sourceMatchesComplete =
    kanji.candidates > 0 &&
    words.candidates > 0 &&
    strokes.candidates > 0 &&
    kanji.matched === kanji.candidates &&
    words.matched === words.candidates &&
    words.bilingual === words.candidates &&
    strokes.matched === strokes.candidates;
  return {
    scope: "aggregate-local-source-observations",
    kanji,
    words,
    strokes,
    sourceMatchesComplete,
    independentReview: false,
    publicationApproved: false,
    readyToPublish: false,
  };
}
