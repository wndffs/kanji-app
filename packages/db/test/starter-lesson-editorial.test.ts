import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  applyStarterLessonEditorial,
  foundationBasicsEditorialSlots,
  foundationEditorialSlots,
  registeredMainEditorialSlots,
  resolveEditorialBatch,
  shouldRetryEditorialPlan,
} from "../src/apply-starter-lesson-editorial";
import { buildStarterCourseSeed } from "../src/course-seed";
import { STARTER_LESSON_EDITORIAL } from "../src/starter-lesson-editorial";
import { FOUNDATION_KANJI_EDITORIAL } from "../src/foundation-kanji-editorial";
import { FOUNDATION_BASICS_EDITORIAL } from "../src/foundation-basics-editorial";
import { FOUNDATION_COMPONENTS_EDITORIAL } from "../src/foundation-components-editorial";
import { FOUNDATION_COMPLETION_EDITORIAL } from "../src/foundation-level-two-editorial";
import { FOUNDATION_LEVEL_THREE_EDITORIAL } from "../src/foundation-level-three-editorial";
import { FOUNDATION_LEVEL_FOUR_EDITORIAL } from "../src/foundation-level-four-editorial";
import { FOUNDATION_LEVEL_FIVE_EDITORIAL } from "../src/foundation-level-five-editorial";
import { FOUNDATION_LEVEL_SIX_EDITORIAL } from "../src/foundation-level-six-editorial";
import { FOUNDATION_LEVEL_SEVEN_EDITORIAL } from "../src/foundation-level-seven-editorial";
import { FOUNDATION_LEVEL_EIGHT_EDITORIAL } from "../src/foundation-level-eight-editorial";

it("covers the exact starter syllabus with substantive RU/EN hints and kanji-only additions", () => {
  const starter = buildStarterCourseSeed();
  expect(STARTER_LESSON_EDITORIAL.entries.map(({ itemKey }) => itemKey)).toEqual(
    starter.items.map(({ key }) => key),
  );
  let pairs = 0;
  let referencePairs = 0;
  for (const entry of STARTER_LESSON_EDITORIAL.entries) {
    for (const text of Object.values(entry.hints)) {
      expect(text.ru.trim().length).toBeGreaterThan(100);
      expect(text.en.trim().length).toBeGreaterThan(100);
      pairs++;
    }
    if (!entry.referenceMeanings?.length) continue;
    expect(starter.items.find(({ key }) => key === entry.itemKey)?.kind).toBe("KANJI");
    for (const pair of entry.referenceMeanings) {
      expect(pair.ru).not.toBe("");
      expect(pair.en).not.toBe("");
      referencePairs++;
    }
  }
  expect(pairs).toBe(9);
  expect(referencePairs).toBe(2);
});

it("matches all early kanji enhancements to their existing course placement and taught reading", () => {
  const slots = foundationEditorialSlots();
  expect(slots.size).toBe(9);
  for (const { character, reading, itemKey, hints } of FOUNDATION_KANJI_EDITORIAL.entries) {
    expect(slots.get(itemKey)).toMatchObject({ target: { character, kind: "KANJI" }, reading });
    expect(Object.keys(hints).sort()).toEqual(["MEANING", "READING"]);
    for (const text of Object.values(hints)) {
      expect(text.ru.length).toBeGreaterThan(100);
      expect(text.en.length).toBeGreaterThan(100);
    }
  }
});

it("binds the complete first component block and the ten kanji to registered course slots", () => {
  const slots = foundationBasicsEditorialSlots();
  expect(slots.size).toBe(36);
  const components = [...slots.values()].filter(({ target }) => target.kind === "COMPONENT");
  expect(components.map(({ levelNumber }) => levelNumber)).toEqual(Array(26).fill(1));
  expect(components.map(({ sortOrder }) => sortOrder)).toEqual(
    Array.from({ length: 26 }, (_, index) => index + 1),
  );
  let explanations = 0;
  let referencePairs = 0;
  for (const entry of FOUNDATION_BASICS_EDITORIAL.entries) {
    const slot = slots.get(entry.itemKey);
    if (entry.kind === "KANJI") {
      expect(slot).toMatchObject({
        target: { character: entry.character },
        reading: entry.reading,
      });
      referencePairs += entry.referenceMeanings?.length ?? 0;
    } else {
      expect(slot).toMatchObject({ target: { symbol: entry.symbol } });
      expect(entry.referenceMeanings).toBeUndefined();
    }
    for (const text of Object.values(entry.hints)) {
      expect(text.ru.trim().length).toBeGreaterThan(100);
      expect(text.en.trim().length).toBeGreaterThan(100);
      explanations++;
    }
  }
  expect(explanations).toBe(46);
  expect(referencePairs).toBe(5);
});

it("binds the next 37 components and 13 kanji to exact curriculum slots", () => {
  const { entries, version } = FOUNDATION_COMPONENTS_EDITORIAL;
  const slots = registeredMainEditorialSlots(entries);
  expect(slots.size).toBe(50);
  const components = entries.filter((entry) => entry.kind === "COMPONENT");
  expect(components).toHaveLength(37);
  components.forEach((entry, index) => {
    expect(slots.get(entry.itemKey)).toEqual({
      levelNumber: 1,
      sortOrder: 27 + index,
      target: { kind: "COMPONENT", symbol: entry.symbol },
    });
    expect(entry.referenceMeanings).toBeUndefined();
  });
  const kanji = entries.filter((entry) => entry.kind === "KANJI");
  expect(kanji).toHaveLength(13);
  kanji.forEach((entry, index) => {
    expect(slots.get(entry.itemKey)).toEqual({
      levelNumber: 2,
      sortOrder: 8 + index,
      target: { kind: "KANJI", character: entry.character },
      reading: entry.reading,
    });
    expect(Object.keys(entry.hints).sort()).toEqual(["MEANING", "READING"]);
  });
  for (const entry of entries) {
    for (const text of Object.values(entry.hints)) {
      expect(text.ru.trim().length).toBeGreaterThan(85);
      expect(text.en.trim().length).toBeGreaterThan(85);
    }
  }
  const [head] = components;
  expect(() =>
    registeredMainEditorialSlots([{ ...head!, sourceBatchId: "task-118-foundation-kanji-01" }]),
  ).toThrow(/does not match its source batch/u);
  expect(resolveEditorialBatch(`publish-lesson-editorial-${version}`)).toBe(
    "foundation-components",
  );
});

it("completes the registered level-one components and level-two kanji without repeating slots", () => {
  const { entries, version } = FOUNDATION_COMPLETION_EDITORIAL;
  const slots = registeredMainEditorialSlots(entries);
  const components = entries.filter((entry) => entry.kind === "COMPONENT");
  const kanji = entries.filter((entry) => entry.kind === "KANJI");
  expect(slots.size).toBe(66);
  expect(components).toHaveLength(47);
  expect(kanji).toHaveLength(19);
  for (const [index, entry] of components.entries()) {
    expect(slots.get(entry.itemKey)).toEqual({
      levelNumber: 1,
      sortOrder: 64 + index,
      target: { kind: "COMPONENT", symbol: entry.symbol },
    });
  }
  for (const [index, entry] of kanji.entries()) {
    expect(slots.get(entry.itemKey)).toEqual({
      levelNumber: 2,
      sortOrder: 22 + index,
      reading: entry.reading,
      target: { kind: "KANJI", character: entry.character },
    });
    expect(Object.keys(entry.hints).sort()).toEqual(["MEANING", "READING"]);
  }
  for (const entry of entries) {
    for (const text of Object.values(entry.hints)) {
      expect(text.ru.trim().length).toBeGreaterThan(85);
      expect(text.en.trim().length).toBeGreaterThan(85);
    }
  }
  const previous = [
    ...foundationBasicsEditorialSlots().values(),
    ...foundationEditorialSlots().values(),
    ...registeredMainEditorialSlots(FOUNDATION_COMPONENTS_EDITORIAL.entries).values(),
  ];
  const all = [...previous, ...slots.values()];
  expect(
    all.filter(({ levelNumber }) => levelNumber === 1).map(({ sortOrder }) => sortOrder),
  ).toEqual(Array.from({ length: 110 }, (_, index) => index + 1));
  const levelTwo = all
    .filter(({ levelNumber }) => levelNumber === 2)
    .map(({ sortOrder }) => sortOrder);
  expect([...levelTwo, 21].sort((a, b) => a - b)).toEqual(
    Array.from({ length: 40 }, (_, index) => index + 1),
  );
  expect(STARTER_LESSON_EDITORIAL.entries.some(({ itemKey }) => itemKey === "kanji-one")).toBe(
    true,
  );
  expect(resolveEditorialBatch(`publish-lesson-editorial-${version}`)).toBe(
    "foundation-completion",
  );
});

it.each([
  {
    batch: "foundation-level-three",
    release: FOUNDATION_LEVEL_THREE_EDITORIAL,
    length: 40,
    start: 1,
    level: 3,
    skipped: [1, 2, 3, 4, 5, 13],
  },
  {
    batch: "foundation-level-four",
    release: FOUNDATION_LEVEL_FOUR_EDITORIAL,
    length: 41,
    start: 1,
    level: 4,
    skipped: [1, 2, 3, 4, 5, 6, 13],
  },
  {
    batch: "foundation-level-five",
    release: FOUNDATION_LEVEL_FIVE_EDITORIAL,
    length: 42,
    start: 81,
    level: 5,
    skipped: [96, 97],
  },
  {
    batch: "foundation-level-six",
    release: FOUNDATION_LEVEL_SIX_EDITORIAL,
    start: 60,
    length: 54,
    level: 6,
    skipped: Array.from({ length: 14 }, (_, index) => 98 + index),
  },
  {
    batch: "foundation-level-seven",
    release: FOUNDATION_LEVEL_SEVEN_EDITORIAL,
    start: 1,
    length: 40,
    level: 7,
    skipped: [],
  },
  {
    batch: "foundation-level-eight",
    release: FOUNDATION_LEVEL_EIGHT_EDITORIAL,
    start: 15,
    length: 54,
    level: 8,
    skipped: Array.from({ length: 14 }, (_, index) => 16 + index),
  },
])(
  "covers the remaining level-$level kanji",
  ({ batch, release, length, start, level, skipped }) => {
    const { entries, version } = release;
    const slots = registeredMainEditorialSlots(entries);
    const excluded = new Set<number>(skipped);
    const expected = Array.from({ length }, (_, index) => start + index).filter(
      (position) => !excluded.has(position),
    );
    expect(slots.size).toBe(expected.length);
    expect(entries.map(({ itemKey }) => slots.get(itemKey)?.sortOrder)).toEqual(expected);
    for (const entry of entries) {
      expect(entry.kind).toBe("KANJI");
      expect(slots.get(entry.itemKey)?.levelNumber).toBe(level);
      expect(Object.keys(entry.hints).sort()).toEqual(["MEANING", "READING"]);
      for (const pair of Object.values(entry.hints)) {
        expect(pair.ru.trim().length).toBeGreaterThan(85);
        expect(pair.en.trim().length).toBeGreaterThan(85);
      }
    }
    expect(resolveEditorialBatch(`publish-lesson-editorial-${version}`)).toBe(batch);
  },
);

it("keeps Russian and English on their own sides of each new editorial pair", () => {
  const releases = [
    FOUNDATION_COMPONENTS_EDITORIAL,
    FOUNDATION_COMPLETION_EDITORIAL,
    FOUNDATION_LEVEL_THREE_EDITORIAL,
    FOUNDATION_LEVEL_FOUR_EDITORIAL,
    FOUNDATION_LEVEL_FIVE_EDITORIAL,
    FOUNDATION_LEVEL_SIX_EDITORIAL,
    FOUNDATION_LEVEL_SEVEN_EDITORIAL,
    FOUNDATION_LEVEL_EIGHT_EDITORIAL,
  ];
  for (const { entries } of releases) {
    for (const entry of entries) {
      for (const pair of [...Object.values(entry.hints), ...(entry.referenceMeanings ?? [])]) {
        expect(pair.ru, entry.itemKey).toMatch(/\p{Script=Cyrillic}/u);
        expect(pair.en, entry.itemKey).toMatch(/\p{Script=Latin}/u);
        expect(pair.en, entry.itemKey).not.toMatch(/\p{Script=Cyrillic}/u);
      }
    }
  }
});

it("selects only registered editorial names and exact immutable release tags", () => {
  expect(resolveEditorialBatch("starter")).toBe("starter");
  expect(resolveEditorialBatch("foundation-basics")).toBe("foundation-basics");
  expect(
    resolveEditorialBatch(`publish-lesson-editorial-${FOUNDATION_BASICS_EDITORIAL.version}`),
  ).toBe("foundation-basics");
  expect(resolveEditorialBatch("publish-lesson-editorial-latest")).toBeUndefined();
  expect(
    resolveEditorialBatch("publish-lesson-editorial-foundation-basics-editorial-02"),
  ).toBeUndefined();
  const tag = `publish-lesson-editorial-${FOUNDATION_BASICS_EDITORIAL.version}`;
  expect(resolveEditorialBatch(`${tag}-attempt-2`)).toBe("foundation-basics");
  expect(resolveEditorialBatch(`${tag}-attempt-20`)).toBeUndefined();
});

it("retries only a bounded read-only connection failure, never apply or a validation error", () => {
  expect(shouldRetryEditorialPlan("plan", 1, { errorCode: "P1001" })).toBe(true);
  expect(shouldRetryEditorialPlan("plan", 2, { code: "P1001" })).toBe(true);
  expect(shouldRetryEditorialPlan("plan", 3, { code: "P1001" })).toBe(false);
  expect(shouldRetryEditorialPlan("apply", 1, { code: "P1001" })).toBe(false);
  expect(shouldRetryEditorialPlan("plan", 1, new Error("Course slot mismatch"))).toBe(false);
});

const databaseUrl = process.env.INTEGRATION_DATABASE_URL;
describe.skipIf(databaseUrl === undefined)("starter editorial on seeded PostgreSQL", () => {
  it("plans without writes, publishes additively and leaves assessment untouched on repeated apply", async () => {
    const db = new PrismaClient({ datasourceUrl: databaseUrl });
    try {
      const slots = await db.courseLevelItem.findMany({
        where: { courseLevel: { course: { slug: "starter-demo" } } },
        select: { id: true, learningItemId: true },
        orderBy: { id: "asc" },
      });
      const ids = slots.map(({ learningItemId }) => learningItemId);
      expect(ids).toHaveLength(7);
      const where = { learningItemId: { in: ids } };
      const assessment = () =>
        db.learningCard.findMany({
          where,
          include: {
            answers: { orderBy: { id: "asc" } },
            blockedAnswers: { orderBy: { id: "asc" } },
          },
          orderBy: { id: "asc" },
        });
      const originalAssessment = await assessment();
      const originalHintCount = await db.hint.count({ where });
      const plan = await applyStarterLessonEditorial(db, "plan");
      expect(plan).toMatchObject({
        matchedMaterials: 7,
        newHints: 18,
        newReferenceMeanings: 4,
        alreadyApplied: false,
      });
      expect(await db.hint.count({ where })).toBe(originalHintCount);
      expect(await applyStarterLessonEditorial(db, "apply")).toEqual(plan);
      expect(await db.hint.count({ where })).toBe(originalHintCount + 18);
      expect(await assessment()).toEqual(originalAssessment);
      expect(await applyStarterLessonEditorial(db, "apply")).toMatchObject({
        matchedMaterials: 7,
        newHints: 0,
        newReferenceMeanings: 0,
        alreadyApplied: true,
      });
      expect(await db.hint.count({ where })).toBe(originalHintCount + 18);
      const references = STARTER_LESSON_EDITORIAL.entries.flatMap((entry) =>
        (entry.referenceMeanings ?? []).flatMap(({ ru, en }) => [ru, en]),
      );
      expect(
        await db.kanjiMeaning.count({
          where: { meaning: { in: references }, isPrimary: false, sourceKind: "PROJECT_AUTHORED" },
        }),
      ).toBe(4);
    } finally {
      await db.$disconnect();
    }
  });
});
