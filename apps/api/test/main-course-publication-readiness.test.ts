import { describe, expect, it } from "vitest";

import { buildMainCourseBlueprint } from "@kanji-srs/db";
import { CURRICULUM_SCALE_TARGETS } from "@kanji-srs/shared";

import {
  buildMainCoursePublicationReadiness,
  type MainCoursePublicationReadinessInput,
} from "../src/admin/main-course-publication-readiness";

describe("main course publication readiness", () => {
  it("passes a complete prerequisite-safe full-scale course", () => {
    const readiness = buildMainCoursePublicationReadiness(
      createInput(),
      new Date("2026-07-15T12:00:00.000Z"),
    );

    expect(readiness).toMatchObject({
      policyVersion: "main-course-publication-readiness-v1",
      generatedAt: "2026-07-15T12:00:00.000Z",
      readyToPublish: true,
      summary: { passedChecks: 8, blockedChecks: 0 },
    });
    expect(readiness.checks.every((check) => check.passed)).toBe(true);
  });

  it("reports scale, empty-level, stale-placement, and allocation blockers", () => {
    const input = createInput();
    const readiness = buildMainCoursePublicationReadiness({
      ...input,
      levels: input.levels.map((level) =>
        level.levelNumber === 60 ? { ...level, publishedItems: 0 } : level,
      ),
      allocation: {
        ...input.allocation,
        existingPlacements: input.allocation.existingPlacements - 2,
        proposedPlacements: 1,
        blockedItems: 1,
        issueCount: 2,
      },
      stalePlacements: 3,
      placedKanji: 100,
      placedWords: 200,
      initialLessonItems: 0,
    });

    expect(readiness.readyToPublish).toBe(false);
    expect(readiness.checks.filter((check) => !check.passed).map((check) => check.code)).toEqual([
      "allocation-complete",
      "published-placements-only",
      "levels-populated",
      "initial-lesson",
      "kanji-target",
      "word-target",
    ]);
  });

  it("versions audit inputs independently of generation time", () => {
    const input = createInput();
    const first = buildMainCoursePublicationReadiness(input, new Date("2026-07-15T12:00:00.000Z"));
    const second = buildMainCoursePublicationReadiness(input, new Date("2026-07-16T12:00:00.000Z"));
    const changed = buildMainCoursePublicationReadiness({
      ...input,
      placedWords: input.placedWords - 1,
    });

    expect(first.readinessVersion).toBe(second.readinessVersion);
    expect(changed.readinessVersion).not.toBe(first.readinessVersion);
  });

  it("rejects drift from the project-owned course blueprint", () => {
    const input = createInput();
    const readiness = buildMainCoursePublicationReadiness({
      ...input,
      levels: input.levels.map((level) =>
        level.levelNumber === 6 ? { ...level, band: "n2" } : level,
      ),
    });

    expect(readiness.checks).toContainEqual(
      expect.objectContaining({ code: "course-blueprint", passed: false }),
    );
  });
});

function createInput(): MainCoursePublicationReadinessInput {
  const blueprint = buildMainCourseBlueprint();
  const publishedItems = CURRICULUM_SCALE_TARGETS.kanji + CURRICULUM_SCALE_TARGETS.word + 1;

  return {
    course: {
      id: "course-main",
      slug: blueprint.course.slug,
      title: blueprint.course.titleRu,
      description: blueprint.course.descriptionRu,
      targetLevel: blueprint.course.targetLevel,
      band: "foundation",
      courseType: "structured",
      status: "draft",
    },
    levels: blueprint.levels.map((level) => ({
      levelNumber: level.levelNumber,
      band: level.band.toLowerCase() as MainCoursePublicationReadinessInput["levels"][number]["band"],
      title: level.titleRu,
      description: level.descriptionRu,
      publishedItems: 1,
    })),
    allocation: {
      planVersion: "course-allocation:complete",
      publishedItems,
      existingPlacements: publishedItems,
      proposedPlacements: 0,
      blockedItems: 0,
      issueCount: 0,
    },
    stalePlacements: 0,
    placedKanji: CURRICULUM_SCALE_TARGETS.kanji,
    placedWords: CURRICULUM_SCALE_TARGETS.word,
    initialLessonItems: 1,
  };
}
