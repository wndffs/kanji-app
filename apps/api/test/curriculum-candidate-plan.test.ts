import { describe, expect, it } from "vitest";

import {
  buildCurriculumCandidatePlan,
  CURRICULUM_CANDIDATE_POLICY_VERSION,
  type CurriculumCandidatePlanInput,
} from "../src/admin/curriculum-candidate-plan";

describe("curriculum candidate plan", () => {
  it("selects a stable independent shortlist and enforces word kanji prerequisites", () => {
    const plan = buildCurriculumCandidatePlan({
      existingItems: { kanji: 2_299, word: 7_998 },
      existingKanji: [
        {
          character: "日",
          band: "foundation",
          primaryReading: "ニチ",
          sourcePriority: 1,
        },
      ],
      poolTruncated: { kanji: false, word: false },
      candidates: [
        candidate({
          targetId: "kanji-water",
          itemType: "kanji",
          japanese: "水",
          reading: "みず",
          jlptLevel: "N5",
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
      collapsedWordAlternatives: 0,
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
        suggestedBand: "n5",
      }),
      expect.objectContaining({
        selectionRank: 2,
        targetId: "word-kana",
        prerequisiteKanji: [],
      }),
    ]);
  });

  it("places words no earlier than their latest prerequisite kanji band", () => {
    const plan = buildCurriculumCandidatePlan({
      existingItems: { kanji: 2_298, word: 7_998 },
      existingKanji: [],
      poolTruncated: { kanji: false, word: false },
      candidates: [
        candidate({
          targetId: "kanji-country",
          itemType: "kanji",
          japanese: "国",
          reading: "こく",
          jlptLevel: "N5",
        }),
        candidate({
          targetId: "kanji-study",
          itemType: "kanji",
          japanese: "学",
          reading: "がく",
          jlptLevel: "N3",
        }),
        candidate({
          targetId: "word-country",
          japanese: "国",
          reading: "くに",
          sourcePriority: 5_000,
          meanings: { ru: ["страна"], en: ["country"] },
        }),
        candidate({
          targetId: "word-study",
          japanese: "学",
          reading: "がく",
          sourcePriority: 100,
          meanings: { ru: ["учёба"], en: ["study"] },
        }),
      ],
    });

    expect(plan.candidates.word).toEqual([
      expect.objectContaining({
        selectionRank: 1,
        targetId: "word-country",
        suggestedBand: "n5",
      }),
      expect.objectContaining({
        selectionRank: 2,
        targetId: "word-study",
        suggestedBand: "n3",
      }),
    ]);
  });

  it("keeps one teachable representative per JMdict entry", () => {
    const plan = buildCurriculumCandidatePlan({
      existingItems: { kanji: 2_300, word: 7_995 },
      existingKanji: [
        existingKanji("\u65e5", "\u30cb\u30c1", 1),
        existingKanji("\u672c", "\u30db\u30f3", 10),
        existingKanji("\u4eba", "\u30b8\u30f3", 5),
        existingKanji("\u4e94", "\u30b4", 50),
        existingKanji("\u4ed5", "\u30b7", 800),
        existingKanji("\u8a66", "\u30b7", 200),
        existingKanji("\u5408", "\u30b4\u30a6", 100),
      ],
      poolTruncated: { kanji: false, word: false },
      candidates: [
        candidate({
          targetId: "word-katakana-japan",
          japanese: "\u30cb\u30c3\u30dd\u30f3\u4eba",
          reading: "\u306b\u307b\u3093\u3058\u3093",
          sourceGroupId: "jmdict:japanese-person",
          sourcePriority: 1_000,
        }),
        candidate({
          targetId: "word-standard-japan",
          japanese: "\u65e5\u672c\u4eba",
          reading: "\u306b\u307b\u3093\u3058\u3093",
          sourceGroupId: "jmdict:japanese-person",
          sourcePriority: 1_000,
        }),
        candidate({
          targetId: "word-five-archaic",
          japanese: "\u4e94",
          reading: "\u3044",
          sourceGroupId: "jmdict:five",
          sourcePriority: 1_000,
        }),
        candidate({
          targetId: "word-five-primary",
          japanese: "\u4e94",
          reading: "\u3054",
          sourceGroupId: "jmdict:five",
          sourcePriority: 1_000,
        }),
        candidate({
          targetId: "word-five-kun",
          japanese: "\u4e94",
          reading: "\u3044\u3064",
          sourceGroupId: "jmdict:five",
          sourcePriority: 1_000,
        }),
        candidate({
          targetId: "word-match-rare",
          japanese: "\u4ed5\u5408",
          reading: "\u3057\u3042\u3044",
          sourceGroupId: "jmdict:match",
          sourcePriority: 1_000,
        }),
        candidate({
          targetId: "word-match-standard",
          japanese: "\u8a66\u5408",
          reading: "\u3057\u3042\u3044",
          sourceGroupId: "jmdict:match",
          sourcePriority: 1_000,
        }),
      ],
    });

    expect(plan.summary.collapsedWordAlternatives).toBe(4);
    expect(plan.candidates.word.map((candidate) => candidate.targetId)).toEqual([
      "word-five-primary",
      "word-match-standard",
      "word-standard-japan",
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
  overrides: Partial<CurriculumCandidatePlanInput["candidates"][number]>,
): CurriculumCandidatePlanInput["candidates"][number] {
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
    sourceGroupId: null,
    ...overrides,
  };
}

function existingKanji(
  character: string,
  primaryReading: string,
  sourcePriority: number,
): CurriculumCandidatePlanInput["existingKanji"][number] {
  return {
    character,
    band: "n5",
    primaryReading,
    sourcePriority,
  };
}
