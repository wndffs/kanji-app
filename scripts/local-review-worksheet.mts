import { buildKanjiDraft07 } from "../packages/db/src/editorial-draft-kanji-07";
import { buildWordDraft07 } from "../packages/db/src/editorial-draft-words-07";
import {
  fingerprint,
  localCandidateFingerprint,
  type inspectLocalDraft,
} from "./local-draft-evidence.mts";

type Evidence = Awaited<ReturnType<typeof inspectLocalDraft>>;
const materials = () => ({ kanji: buildKanjiDraft07(), words: buildWordDraft07() });
const observations = (report: Evidence) => ({
  kanji: report.kanji.items,
  words: report.words.items,
  strokes: report.strokes.items,
});
export function createReviewWorksheet(report: Evidence) {
  return {
    schemaVersion: 1,
    candidateFingerprint: report.candidateFingerprint,
    sourceFingerprint: report.sourceFingerprint,
    observationsFingerprint: fingerprint(observations(report)),
    materials: materials(),
    review: { status: "pending", reviewer: null, reviewedAt: null, notes: "" },
    sourceObservations: observations(report),
    publicationApproved: false,
  };
}
export function checkWorksheetBinding(value: unknown, report: Evidence) {
  const invalid = {
    status: "stale-or-invalid",
    bound: false,
    independentReview: false,
    publicationApproved: false,
    readyToPublish: false,
  };
  if (!value || typeof value !== "object" || Array.isArray(value)) return invalid;
  const row = value as Record<string, unknown>;
  if (
    row.schemaVersion !== 1 ||
    row.publicationApproved !== false ||
    row.candidateFingerprint !== report.candidateFingerprint ||
    row.candidateFingerprint !== localCandidateFingerprint() ||
    row.sourceFingerprint !== report.sourceFingerprint ||
    row.observationsFingerprint !== fingerprint(observations(report)) ||
    row.sourceObservations === undefined ||
    row.materials === undefined ||
    fingerprint(row.sourceObservations) !== row.observationsFingerprint ||
    fingerprint(row.materials) !== fingerprint(materials())
  )
    return invalid;
  return {
    ...invalid,
    bound: true,
    status: report.summary.sourceMatchesComplete
      ? "bound-awaiting-independent-review"
      : "bound-source-blocked",
  };
}
