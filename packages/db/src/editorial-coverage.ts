import { buildEditorialRegistryInventory } from "./editorial-registry-inventory";
import { buildEditorialDraftPreview } from "./editorial-draft-preview";
import { MAIN_COURSE_LEVEL_COUNT } from "./main-course";

export function buildEditorialCoverage() {
  const registry = buildEditorialRegistryInventory();
  const draft = buildEditorialDraftPreview("ru-en");
  const target = { levels: MAIN_COURSE_LEVEL_COUNT, kanji: 2_300, words: 8_000 };
  const reviewed = registry.prepared.reviewedDistinctTotals;
  return {
    scope: "source-only-curriculum-coverage",
    publicationApproved: false,
    caveat:
      "Prepared and sealed source counts are not a live database or publication audit. Drafts do not reduce the reviewed-content backlog.",
    target,
    reviewedRegistry: reviewed,
    remainingReviewedContent: {
      kanji: Math.max(0, target.kanji - reviewed.kanji),
      words: Math.max(0, target.words - reviewed.words),
    },
    pendingDrafts: {
      components: draft.components.length,
      kanji: draft.kanji.length,
      words: draft.words.length,
      exampleSentences: draft.words.length,
      proposedCards: draft.components.length + 2 * (draft.kanji.length + draft.words.length),
    },
    sourceSeals: registry.sourceSeals.map(({ id, status, sealedDistinctTotals }) => ({
      id,
      status,
      sealedDistinctTotals,
    })),
    validation: {
      valid: registry.validation.valid && draft.validation.valid,
      issues: [...registry.validation.issues, ...draft.validation.issues],
    },
  };
}
