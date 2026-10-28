import { buildKanjiDraft07 } from "./editorial-draft-kanji-07";
import { buildWordDraft07, type EditorialWordDraftBatch } from "./editorial-draft-words-07";
import { type MainCourseContentBatch } from "./main-course-content";

export const NEXT_EDITORIAL_WAVE = "foundation-wave-07";
export type EditorialWaveInput = {
  readonly kanji: MainCourseContentBatch;
  readonly words: EditorialWordDraftBatch;
};
export function nextEditorialWave(): EditorialWaveInput {
  return { kanji: buildKanjiDraft07(), words: buildWordDraft07() };
}
export function planEditorialWave(input = nextEditorialWave()) {
  return {
    id: NEXT_EDITORIAL_WAVE,
    scope: "local-draft-preparation" as const,
    publicationApproved: false as const,
    counts: {
      components: input.kanji.components.length,
      kanji: input.kanji.kanji.length,
      words: input.words.words.length,
      examples: input.words.words.length,
      proposedCards:
        input.kanji.components.length + 2 * (input.kanji.kanji.length + input.words.words.length),
    },
    levels: {
      components: input.kanji.componentLevelNumber,
      kanji: [...new Set(input.kanji.kanji.map((item) => item.levelNumber))].sort((a, b) => a - b),
      words: input.words.levelNumber,
    },
    sourceFamiliesRequired: ["KANJIDIC2", "KanjiVG", "JMdict"],
    blockers: [
      "exact-source-evidence-not-verified",
      "independent-review-required",
      "publication-not-authorized",
    ],
  };
}
