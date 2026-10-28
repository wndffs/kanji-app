import { describe, expect, it } from "vitest";
import {
  buildCourseCoverage,
  countCourseCoverage,
  satisfiesCardPrerequisite,
  type CourseCoverageRow,
} from "../src/index";

const row: CourseCoverageRow = {
  id: "one",
  kind: "kanji",
  level: 2,
  band: "foundation",
  jlpt: "N5",
  cardIds: ["meaning", "reading"],
  hasRu: true,
  hasEn: true,
  hasReading: true,
};
describe("published course aggregates", () => {
  it("requires sentence readings only when a real reading-answer card requires them", () => {
    expect(
      countCourseCoverage([{ ...row, kind: "sentence", hasReading: false, readingRequired: false }])
        .missingReading,
    ).toBe(0);
    expect(
      countCourseCoverage([{ ...row, kind: "sentence", hasReading: false, readingRequired: true }])
        .missingReading,
    ).toBe(1);
    expect(countCourseCoverage([{ ...row, kind: "word", hasReading: false }]).missingReading).toBe(
      1,
    );
  });
  it("separates absent card types, answer fields and unknown metadata", () => {
    const result = buildCourseCoverage(
      "course",
      [
        { ...row, cardAnswerTypes: ["meaning", "reading"] },
        {
          ...row,
          id: "word",
          kind: "word",
          jlpt: null,
          cardAnswerTypes: ["meaning"],
          hasReading: false,
        },
        { ...row, id: "empty", jlpt: "N9", cardAnswerTypes: [] },
        { ...row, id: "old-contract", jlpt: "до 2010: 4" },
      ],
      "2026-10-28",
    );
    expect(result.teachingAspects).toEqual({
      assessedItems: 3,
      missingMeaningCards: 1,
      missingReadingCards: 2,
      withBothCardTypes: 1,
    });
    expect(result.jlptMetadata).toEqual({
      kanji: { labeled: 1, unknown: 2 },
      words: { labeled: 0, unknown: 1 },
      officialSyllabus: false,
    });
    expect(result.jlpt.map((bucket) => bucket.band)).toEqual(["N5", "unassigned"]);
  });
  it("includes declared empty levels without inventing content", () => {
    const result = buildCourseCoverage("course", [], "2026-10-28T00:00:00Z", [
      { level: 60, band: "n2" },
    ]);
    expect(result.total.items).toBe(0);
    expect(result.levels).toMatchObject([{ level: 60, counts: { items: 0, cards: 0 } }]);
    expect(result.bands).toMatchObject([{ band: "n2", counts: { items: 0 } }]);
  });
  it("counts distinct items/cards, with independent per-level/band/JLPT buckets", () => {
    const result = buildCourseCoverage(
      "course",
      [
        row,
        { ...row, level: 3 },
        {
          ...row,
          id: "word",
          kind: "word",
          band: "n4",
          jlpt: null,
          cardIds: ["word-meaning"],
          hasEn: false,
          hasReading: false,
        },
      ],
      "2026-10-28T00:00:00Z",
    );
    expect(result.total).toMatchObject({
      items: 2,
      cards: 3,
      missingRu: 0,
      missingEn: 1,
      missingReading: 1,
      byKind: { kanji: 1, word: 1 },
    });
    expect(result.levels.map((level) => [level.level, level.counts.items])).toEqual([
      [2, 2],
      [3, 1],
    ]);
    expect(result.jlpt.find((band) => band.band === "unassigned")?.counts.items).toBe(1);
    expect(result.bands.find((band) => band.band === "n4")?.counts.missingEn).toBe(1);
  });
  it("has honest zero totals and no inferred reading requirement for components", () => {
    expect(countCourseCoverage([])).toMatchObject({ items: 0, cards: 0, missingReading: 0 });
    expect(
      countCourseCoverage([{ ...row, kind: "component", hasReading: false, hasRu: false }]),
    ).toMatchObject({ missingReading: 0, missingRu: 1 });
  });
});
describe("shared prerequisite stage rule", () => {
  it.each([
    [[], new Map(), 1, false],
    [["m"], undefined, 1, false],
    [["m", "r"], new Map([["m", 5]]), 1, false],
    [
      ["m", "r"],
      new Map([
        ["m", 5],
        ["r", 0],
      ]),
      1,
      false,
    ],
    [
      ["m", "r"],
      new Map([
        ["m", 5],
        ["r", 1],
      ]),
      1,
      true,
    ],
    [
      ["m", "r"],
      new Map([
        ["m", 5],
        ["r", 1],
      ]),
      2,
      false,
    ],
  ] as const)(
    "requires all real cards at the required stage (%#)",
    (ids, progress, required, expected) => {
      expect(satisfiesCardPrerequisite(ids, progress, required)).toBe(expected);
    },
  );
});
