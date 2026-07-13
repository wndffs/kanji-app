import { describe, expect, it } from "vitest";

import {
  buildCurriculumCandidatePlan,
  CURRICULUM_CANDIDATE_POLICY_VERSION,
} from "../src/admin/curriculum-candidate-plan";
import { type ImportedCandidateRankingInput } from "../src/admin/imported-candidate-ranking";

describe("curriculum candidate plan", () => {
  it("selects a stable independent shortlist and enforces word kanji prerequisites", () => {
    const plan = buildCurriculumCandidatePlan({
      existingItems: { kanji: 2_299, word: 7_998 },
      existingKanji: ["日"],
      poolTruncated: { kanji: false, word: false },
      candidates: [
        candidate({
          targetId: "kanji-water",
          itemType: "kanji",
          japanese: "水",
          reading: "みず",
          sourcePriority: 100,
          sourceName: "KANJIDIC2",
          meanings: { ru: [], en: ["water"] },
          hasStrokeData: true,
        }),
        candidate({
          targetId: "kanji-fire",
          itemType: "kanji",
          japanese: "火",
          reading: "ひ",
          sourcePriority: 2_000,
          sourceName: "KANJIDIC2",
          meanings: { ru: [], en: ["fire"] },
        }),
        candidate({
          targetId: "word-water",
          japanese: "水",
          reading: "みず",
          sourcePriority: 500,
          meanings: { ru: ["вода"], en: ["water"] },
        }),
        candidate({
          targetId: "word-japan",
          japanese: "日本",
          reading: "にほん",
          sourcePriority: 600,
          meanings: { ru: ["Япония"], en: ["Japan"] },
        }),
        candidate({
          targetId: "word-kana",
          japanese: "ありがとう",
          reading: "ありがとう",
          sourcePriority: 700,
          meanings: { ru: ["спасибо"], en: ["thank you"] },
        }),
      ],
    });

    expect(plan.summary).toMatchObject({
      policyVersion: CURRICULUM_CANDIDATE_POLICY_VERSION,
      candidateSlots: { kanji: 1, word: 2 },
      selectedItems: { kanji: 1, word: 2 },
      unfilledSlots: { kanji: 0, word: 0 },
      excludedWordsMissingKanji: 1,
    });
    expect(plan.candidates.kanji).toEqual([
      expect.objectContaining({
        selectionRank: 1,
        targetId: "kanji-water",
        coverage: expect.objectContaining({ strokeData: true }),
      }),
    ]);
    expect(plan.candidates.word).toEqual([
      expect.objectContaining({
        selectionRank: 1,
        targetId: "word-water",
        prerequisiteKanji: ["水"],
      }),
      expect.objectContaining({
        selectionRank: 2,
        targetId: "word-kana",
        prerequisiteKanji: [],
      }),
    ]);
  });

  it("rejects duplicate source targets", () => {
    const duplicate = candidate({ targetId: "duplicate" });

    expect(() =>
      buildCurriculumCandidatePlan({
        existingItems: { kanji: 0, word: 0 },
        existingKanji: [],
        poolTruncated: { kanji: false, word: false },
        candidates: [duplicate, duplicate],
      }),
    ).toThrow("Duplicate curriculum candidate target: duplicate.");
  });
});

function candidate(
  overrides: Partial<ImportedCandidateRankingInput>,
): ImportedCandidateRankingInput {
  return {
    targetId: "word",
    itemType: "word",
    japanese: "語",
    reading: null,
    meanings: { ru: [], en: [] },
    jlptLevel: null,
    sourcePriority: null,
    schoolGrade: null,
    hasStrokeData: false,
    sourceName: "JMdict",
    ...overrides,
  };
}
