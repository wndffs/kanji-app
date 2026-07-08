import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  buildStarterCourseSeed,
  getInitialStarterLessonKeys,
  validateStarterCourseSeed,
} from "../src/course-seed";

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

  it("keeps starter component meanings bilingual", () => {
    const components = buildStarterCourseSeed().items.filter(
      (item) => item.target.kind === "COMPONENT",
    );

    expect(components.length).toBeGreaterThan(0);
    expect(
      components.every((item) => item.target.kind === "COMPONENT" && item.target.meaningEn !== ""),
    ).toBe(true);
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
});
