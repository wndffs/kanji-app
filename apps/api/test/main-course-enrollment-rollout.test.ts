import { describe, expect, it } from "vitest";

import { type AdminMainCoursePublicationReadinessResponse } from "@kanji-srs/shared";

import {
  buildMainCourseEnrollmentRolloutPreview,
  type MainCourseEnrollmentRolloutInput,
} from "../src/admin/main-course-enrollment-rollout";

describe("main-course enrollment rollout preview", () => {
  it("summarizes an add-only rollout without exposing learner identifiers", () => {
    const preview = buildMainCourseEnrollmentRolloutPreview(buildInput(), now);

    expect(preview).toMatchObject({
      policyVersion: "main-course-enrollment-rollout-v1",
      readyToApply: true,
      strategy: "add-only",
      summary: {
        learnerAccounts: 4,
        newEnrollments: 1,
        existingActiveEnrollments: 1,
        preservedInactiveEnrollments: 2,
        activeStarterEnrollments: 2,
      },
    });
    expect(preview.generatedAt).toBe("2026-07-15T14:00:00.000Z");
    expect(JSON.stringify(preview)).not.toContain("learner-new");
  });

  it("keeps the version stable across input order and generation time", () => {
    const input = buildInput();
    const reversed = { ...input, learners: [...input.learners].reverse() };

    expect(buildMainCourseEnrollmentRolloutPreview(input, now).rolloutVersion).toBe(
      buildMainCourseEnrollmentRolloutPreview(reversed, new Date("2027-01-01T00:00:00.000Z"))
        .rolloutVersion,
    );
  });

  it("changes the version when learner state changes and blocks an unpublished course", () => {
    const input = buildInput();
    const current = buildMainCourseEnrollmentRolloutPreview(input, now);
    const changed = buildMainCourseEnrollmentRolloutPreview(
      {
        ...input,
        learners: input.learners.map((learner) =>
          learner.userId === "learner-new"
            ? { ...learner, mainCourseEnrollmentStatus: "active" as const }
            : learner,
        ),
      },
      now,
    );
    const unpublished = buildMainCourseEnrollmentRolloutPreview(
      {
        ...input,
        readiness: {
          ...input.readiness,
          readinessVersion: "main-course-readiness:draft",
          course: { ...input.readiness.course, status: "draft" },
        },
      },
      now,
    );

    expect(changed.rolloutVersion).not.toBe(current.rolloutVersion);
    expect(unpublished.rolloutVersion).not.toBe(current.rolloutVersion);
    expect(unpublished.readyToApply).toBe(false);
  });
});

const now = new Date("2026-07-15T14:00:00.000Z");

function buildInput(): MainCourseEnrollmentRolloutInput {
  return {
    readiness: buildReadiness(),
    learners: [
      {
        userId: "learner-new",
        mainCourseEnrollmentStatus: null,
        starterCourseEnrollmentStatus: "active",
      },
      {
        userId: "learner-active",
        mainCourseEnrollmentStatus: "active",
        starterCourseEnrollmentStatus: "active",
      },
      {
        userId: "learner-paused",
        mainCourseEnrollmentStatus: "paused",
        starterCourseEnrollmentStatus: "paused",
      },
      {
        userId: "learner-completed",
        mainCourseEnrollmentStatus: "completed",
        starterCourseEnrollmentStatus: null,
      },
    ],
  };
}

function buildReadiness(): AdminMainCoursePublicationReadinessResponse {
  return {
    policyVersion: "main-course-publication-readiness-v1",
    readinessVersion: "main-course-readiness:published",
    allocationPlanVersion: "course-allocation:published",
    generatedAt: "2026-07-15T13:59:00.000Z",
    readyToPublish: true,
    course: {
      id: "course-main",
      slug: "japanese-ru-n2",
      title: "Основной курс",
      status: "published",
    },
    summary: { passedChecks: 8, blockedChecks: 0 },
    checks: [],
  };
}
