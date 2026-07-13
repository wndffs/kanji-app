import { describe, expect, it } from "vitest";

import {
  buildCurriculumScaleReadiness,
  type CurriculumScaleReadinessSource,
} from "../src/admin/curriculum-scale-readiness";

describe("curriculum scale readiness", () => {
  it("separates the publication gap from candidates still needed", () => {
    const report = buildCurriculumScaleReadiness(
      [
        buildSource({
          itemType: "kanji",
          targetItems: 2_300,
          publishedItems: 100,
          inCurationItems: 50,
          importedCandidates: 2_200,
          candidateCoverage: {
            withReading: 2_190,
            withRussianMeaning: 120,
            withEnglishMeaning: 2_200,
            withBilingualMeanings: 120,
            withStrokeData: 2_100,
          },
        }),
        buildSource({
          itemType: "word",
          targetItems: 8_000,
          publishedItems: 500,
          inCurationItems: 100,
          importedCandidates: 6_000,
          candidateCoverage: {
            withReading: 6_000,
            withRussianMeaning: 5_500,
            withEnglishMeaning: 6_000,
            withBilingualMeanings: 5_500,
            withStrokeData: null,
          },
        }),
      ],
      new Date("2026-07-13T10:00:00.000Z"),
    );

    expect(report).toEqual({
      generatedAt: "2026-07-13T10:00:00.000Z",
      items: [
        expect.objectContaining({
          itemType: "kanji",
          remainingToPublish: 2_200,
          candidatesNeeded: 2_150,
          fillableCandidateSlots: 2_150,
          capacityShortfall: 0,
        }),
        expect.objectContaining({
          itemType: "word",
          remainingToPublish: 7_500,
          candidatesNeeded: 7_400,
          fillableCandidateSlots: 6_000,
          capacityShortfall: 1_400,
        }),
      ],
    });
  });

  it("rejects impossible candidate coverage", () => {
    expect(() =>
      buildCurriculumScaleReadiness([
        buildSource({
          itemType: "kanji",
          importedCandidates: 1,
          candidateCoverage: {
            withReading: 2,
            withRussianMeaning: 0,
            withEnglishMeaning: 1,
            withBilingualMeanings: 0,
            withStrokeData: 1,
          },
        }),
        buildSource({ itemType: "word" }),
      ]),
    ).toThrow("Scale readiness coverage exceeds kanji candidate count.");
  });
});

function buildSource(
  overrides: Partial<CurriculumScaleReadinessSource>,
): CurriculumScaleReadinessSource {
  const itemType = overrides.itemType ?? "word";

  return {
    itemType,
    targetItems: 10,
    publishedItems: 0,
    inCurationItems: 0,
    importedCandidates: 0,
    candidateCoverage: {
      withReading: 0,
      withRussianMeaning: 0,
      withEnglishMeaning: 0,
      withBilingualMeanings: 0,
      withStrokeData: itemType === "kanji" ? 0 : null,
    },
    ...overrides,
  };
}
