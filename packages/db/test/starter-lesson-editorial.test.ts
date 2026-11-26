import { PrismaClient } from "@prisma/client";
import { describe, expect, it } from "vitest";

import {
  applyStarterLessonEditorial,
  foundationEditorialSlots,
} from "../src/apply-starter-lesson-editorial";
import { buildStarterCourseSeed } from "../src/course-seed";
import { STARTER_LESSON_EDITORIAL } from "../src/starter-lesson-editorial";
import { FOUNDATION_KANJI_EDITORIAL } from "../src/foundation-kanji-editorial";

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
