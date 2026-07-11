import { describe, expect, it } from "vitest";

import {
  type ImportedCandidateRankingInput,
  rankImportedCandidates,
} from "../src/admin/imported-candidate-ranking";

describe("imported candidate ranking", () => {
  it("ranks candidates deterministically and explains every point", () => {
    const candidates: ImportedCandidateRankingInput[] = [
      buildCandidate({
        targetId: "word-water",
        itemType: "word",
        japanese: "水",
        reading: "みず",
        sourcePriority: 1_000,
        sourceName: "JMdict",
        meanings: { ru: ["вода"], en: ["water"] },
      }),
      buildCandidate({
        targetId: "kanji-water",
        itemType: "kanji",
        japanese: "水",
        reading: "みず",
        jlptLevel: "N5",
        sourcePriority: 223,
        schoolGrade: 1,
        hasStrokeData: true,
        sourceName: "KANJIDIC2",
        meanings: { ru: [], en: ["water"] },
      }),
      buildCandidate({
        targetId: "word-obscure",
        itemType: "word",
        japanese: "語",
        reading: "ご",
        sourcePriority: null,
        sourceName: "JMdict",
        meanings: { ru: [], en: ["word"] },
      }),
    ];

    expect(rankImportedCandidates(candidates, 2)).toEqual([
      expect.objectContaining({
        rank: 1,
        targetId: "word-water",
        score: 100,
        suggestedBand: "n5",
        reasons: expect.arrayContaining([
          { code: "source-priority", points: 55 },
          { code: "ru-coverage", points: 15 },
        ]),
      }),
      expect.objectContaining({
        rank: 2,
        targetId: "kanji-water",
        score: 85,
        suggestedBand: "n5",
      }),
    ]);
  });

  it("uses stable target IDs to resolve complete ties", () => {
    const candidates = [
      buildCandidate({ targetId: "target-b", japanese: "同" }),
      buildCandidate({ targetId: "target-a", japanese: "同" }),
    ];

    expect(rankImportedCandidates(candidates, 10).map((candidate) => candidate.targetId)).toEqual([
      "target-a",
      "target-b",
    ]);
  });
});

function buildCandidate(
  overrides: Partial<ImportedCandidateRankingInput>,
): ImportedCandidateRankingInput {
  return {
    targetId: "target",
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
