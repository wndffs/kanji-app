import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  DEFAULT_COURSE_LEVEL_PASS_POLICY,
  parseCourseLevelPassPolicy,
} from "../src/course-level-policy";
import {
  buildStarterCourseSeed,
  getInitialStarterLessonKeys,
  validateStarterCourseSeed,
} from "../src/course-seed";
import {
  buildMainCourseBlueprint,
  MAIN_COURSE_LEVEL_COUNT,
  validateMainCourseBlueprint,
} from "../src/main-course";

const currentDir = dirname(fileURLToPath(import.meta.url));
const seed = readFileSync(join(currentDir, "..", "prisma", "seed.ts"), "utf8");

describe("Prisma seed", () => {
  it("keeps the demo user development-only with a real password hash", () => {
    expect(seed).toContain("if (shouldSeedDevelopmentUser())");
    expect(seed).toContain('return process.env.NODE_ENV !== "production";');
    expect(seed).toContain("const DEV_USER_PASSWORD_HASH =");
    expect(seed).toContain('"scrypt$v1$16384$8$1$');
    expect(seed).not.toContain("dev-only-placeholder-hash");
  });

  it("generates a small handcrafted starter course", () => {
    const starterSeed = buildStarterCourseSeed();

    expect(starterSeed.course.levels).toHaveLength(4);
    expect(starterSeed.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining(["COMPONENT", "KANJI", "WORD", "SENTENCE"]),
    );
    expect(starterSeed.items.every((item) => item.cards.length > 0)).toBe(true);
  });

  it("defines an independent 60-level structured course through N2", () => {
    const mainCourse = buildMainCourseBlueprint();

    expect(mainCourse.course).toMatchObject({
      slug: "japanese-ru-n2",
      targetLevel: "JLPT N2",
      band: "FOUNDATION",
    });
    expect(mainCourse.levels).toHaveLength(MAIN_COURSE_LEVEL_COUNT);
    expect(mainCourse.levels.map((level) => level.levelNumber)).toEqual(
      Array.from({ length: MAIN_COURSE_LEVEL_COUNT }, (_, index) => index + 1),
    );
    expect(countLevelsByBand(mainCourse.levels)).toEqual({
      FOUNDATION: 5,
      N5: 10,
      N4: 12,
      N3: 16,
      N2: 17,
    });
    expect(mainCourse.levels.every((level) => level.passPolicy.itemKind === "KANJI")).toBe(true);
    expect(validateMainCourseBlueprint(mainCourse)).toEqual([]);
  });

  it("rejects gaps and band changes in the main course blueprint", () => {
    const mainCourse = buildMainCourseBlueprint();
    const invalidLevels = mainCourse.levels
      .filter((level) => level.levelNumber !== 12)
      .map((level) => (level.levelNumber === 6 ? { ...level, band: "N2" as const } : level));

    expect(
      validateMainCourseBlueprint({
        ...mainCourse,
        levels: invalidLevels,
      }),
    ).toEqual(
      expect.arrayContaining([
        `main course must contain ${MAIN_COURSE_LEVEL_COUNT} levels`,
        "main course level 6 must use N5, received N2",
        "main course level 12 is missing",
      ]),
    );
  });

  it("seeds the main course without deleting placements or demoting existing status", () => {
    const functionStart = seed.indexOf("async function upsertMainCourseStructure");
    const functionEnd = seed.indexOf("async function upsertDefaultSrsSystem", functionStart);
    const mainCourseSeed = seed.slice(functionStart, functionEnd);

    expect(seed).toContain("await upsertMainCourseStructure(mainCourse);");
    expect(mainCourseSeed).toContain('courseType: "STRUCTURED"');
    expect(mainCourseSeed).toContain('status: "DRAFT"');
    expect(mainCourseSeed.match(/status: "DRAFT"/gu)).toHaveLength(1);
    expect(mainCourseSeed).not.toContain("deleteMany");
    expect(mainCourseSeed).not.toContain("courseLevelItem");
  });

  it("assigns starter levels and items to Foundation and N5 course bands", () => {
    const starterSeed = buildStarterCourseSeed();

    expect(starterSeed.course.band).toBe("FOUNDATION");
    expect(starterSeed.course.levels.map((level) => level.band)).toEqual([
      "FOUNDATION",
      "FOUNDATION",
      "N5",
      "N5",
    ]);
    expect(new Set(starterSeed.items.map((item) => item.band))).toEqual(
      new Set(["FOUNDATION", "N5"]),
    );
  });

  it("keeps starter component names, shapes, and meanings bilingual", () => {
    const components = buildStarterCourseSeed().items.filter(
      (item) => item.target.kind === "COMPONENT",
    );

    expect(components.length).toBeGreaterThan(0);
    expect(
      components.every(
        (item) =>
          item.target.kind === "COMPONENT" &&
          item.target.displayNameRu !== "" &&
          item.target.displayNameEn !== "" &&
          item.target.shapeDescriptionRu !== "" &&
          item.target.shapeDescriptionEn !== "" &&
          item.target.meaningRu !== "" &&
          item.target.meaningEn !== "",
      ),
    ).toBe(true);
  });

  it("does not confuse the shapes of 一 and 口 with their meanings", () => {
    const items = buildStarterCourseSeed().items;
    const one = items.find((item) => item.key === "component-one-stroke");
    const mouth = items.find((item) => item.key === "component-mouth-frame");

    expect(one?.target).toMatchObject({
      kind: "COMPONENT",
      displayNameRu: "единица",
      displayNameEn: "one",
      shapeDescriptionRu: "горизонтальная черта",
      shapeDescriptionEn: "horizontal stroke",
      meaningRu: "один",
      meaningEn: "one",
    });
    expect(one?.cards[0]?.acceptedAnswers.map((answer) => answer.normalizedText)).toEqual([
      "единица",
      "один",
      "one",
      "unit",
    ]);
    expect(one?.cards[0]?.blockedAnswers?.map((answer) => answer.normalizedText)).toEqual([
      "одна черта",
    ]);

    expect(mouth?.target).toMatchObject({
      kind: "COMPONENT",
      displayNameRu: "рот",
      displayNameEn: "mouth",
      shapeDescriptionRu: "прямоугольная рамка",
      shapeDescriptionEn: "rectangular frame",
      meaningRu: "рот",
      meaningEn: "mouth",
    });
    expect(mouth?.cards[0]?.acceptedAnswers.map((answer) => answer.normalizedText)).toEqual([
      "рот",
      "mouth",
    ]);
    expect(mouth?.cards[0]?.blockedAnswers?.map((answer) => answer.normalizedText)).toEqual([
      "отверстие",
    ]);

    const oneKanji = items.find((item) => item.key === "kanji-one");
    expect(
      oneKanji?.target.kind === "KANJI"
        ? oneKanji.target.meanings.map((meaning) => [meaning.locale, meaning.text])
        : [],
    ).toEqual([
      ["ru-RU", "один"],
      ["ru-RU", "единица"],
      ["en-US", "one"],
      ["en-US", "unit"],
    ]);
  });

  it("reconciles project-authored answers when the starter seed changes", () => {
    expect(seed).toContain("prisma.learningAnswer.deleteMany");
    expect(seed).toContain("prisma.blockedAnswer.deleteMany");
    expect(seed).toContain('sourceKind: "PROJECT_AUTHORED"');
  });

  it("keeps starter course dependencies valid", () => {
    const starterSeed = buildStarterCourseSeed();

    expect(validateStarterCourseSeed(starterSeed)).toEqual([]);
  });

  it("does not define cards without accepted answers", () => {
    const cards = buildStarterCourseSeed().items.flatMap((item) => item.cards);

    expect(cards.length).toBeGreaterThan(0);
    expect(cards.every((card) => card.acceptedAnswers.length > 0)).toBe(true);
  });

  it("enrolls the demo user into a course with initial lessons", () => {
    const starterSeed = buildStarterCourseSeed();

    expect(starterSeed.demoUser.enrollInCourseSlug).toBe(starterSeed.course.slug);
    expect(getInitialStarterLessonKeys(starterSeed)).toEqual([
      "component-one-stroke",
      "component-mouth-frame",
    ]);
  });

  it("uses explicit versioned pass policies for starter levels", () => {
    const starterSeed = buildStarterCourseSeed();

    expect(starterSeed.course.levels.map((level) => level.passPolicy.itemKind)).toEqual([
      "COMPONENT",
      "KANJI",
      "WORD",
      "SENTENCE",
    ]);
    expect(
      parseCourseLevelPassPolicy({
        version: 2,
        itemKind: "KANJI",
        passStageIndex: 5,
        requiredPercentage: 90,
      }),
    ).toEqual(DEFAULT_COURSE_LEVEL_PASS_POLICY);
  });
});

function countLevelsByBand(
  levels: ReturnType<typeof buildMainCourseBlueprint>["levels"],
): Record<string, number> {
  const counts: Record<string, number> = {};

  for (const level of levels) {
    counts[level.band] = (counts[level.band] ?? 0) + 1;
  }

  return counts;
}
