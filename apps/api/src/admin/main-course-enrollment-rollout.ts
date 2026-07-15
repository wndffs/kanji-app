import { createHash } from "node:crypto";

import {
  type AdminMainCourseEnrollmentRolloutPreviewResponse,
  type AdminMainCoursePublicationReadinessResponse,
} from "@kanji-srs/shared";

export const MAIN_COURSE_ENROLLMENT_ROLLOUT_POLICY_VERSION =
  "main-course-enrollment-rollout-v1" as const;

export type EnrollmentRolloutStatus = "active" | "paused" | "completed";

export type MainCourseEnrollmentRolloutInput = {
  readonly readiness: AdminMainCoursePublicationReadinessResponse;
  readonly learners: readonly {
    readonly userId: string;
    readonly mainCourseEnrollmentStatus: EnrollmentRolloutStatus | null;
    readonly starterCourseEnrollmentStatus: EnrollmentRolloutStatus | null;
  }[];
};

export function buildMainCourseEnrollmentRolloutPreview(
  input: MainCourseEnrollmentRolloutInput,
  now = new Date(),
): AdminMainCourseEnrollmentRolloutPreviewResponse {
  const learners = [...input.learners].sort((left, right) =>
    left.userId.localeCompare(right.userId),
  );
  const existingActiveEnrollments = learners.filter(
    (learner) => learner.mainCourseEnrollmentStatus === "active",
  ).length;
  const preservedInactiveEnrollments = learners.filter(
    (learner) =>
      learner.mainCourseEnrollmentStatus === "paused" ||
      learner.mainCourseEnrollmentStatus === "completed",
  ).length;

  return {
    policyVersion: MAIN_COURSE_ENROLLMENT_ROLLOUT_POLICY_VERSION,
    rolloutVersion: buildRolloutVersion(input.readiness, learners),
    readinessVersion: input.readiness.readinessVersion,
    generatedAt: now.toISOString(),
    readyToApply: input.readiness.readyToPublish && input.readiness.course.status === "published",
    strategy: "add-only",
    course: input.readiness.course,
    summary: {
      learnerAccounts: learners.length,
      newEnrollments: learners.filter((learner) => learner.mainCourseEnrollmentStatus === null)
        .length,
      existingActiveEnrollments,
      preservedInactiveEnrollments,
      activeStarterEnrollments: learners.filter(
        (learner) => learner.starterCourseEnrollmentStatus === "active",
      ).length,
    },
  };
}

function buildRolloutVersion(
  readiness: AdminMainCoursePublicationReadinessResponse,
  learners: MainCourseEnrollmentRolloutInput["learners"],
): string {
  const state = JSON.stringify({
    policyVersion: MAIN_COURSE_ENROLLMENT_ROLLOUT_POLICY_VERSION,
    readinessVersion: readiness.readinessVersion,
    course: readiness.course,
    learners,
  });
  const digest = createHash("sha256").update(state).digest("hex");

  return `main-course-enrollment-rollout:${digest}`;
}
