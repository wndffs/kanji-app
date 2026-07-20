import { describe, expect, it } from "vitest";

import { buildReviewSessionSummary } from "../src/reviews/review-summary";

describe("buildReviewSessionSummary", () => {
  it("counts graded answers and mutually exclusive SRS transitions", () => {
    const summary = buildReviewSessionSummary({
      answers: [
        { result: "correct", srsTransition: "advanced" },
        { result: "typo", srsTransition: "burned" },
        { result: "wrong", srsTransition: "demoted" },
        { result: "reveal", srsTransition: "unchanged" },
        { result: "manual-ignore", srsTransition: "unchanged" },
      ],
      startedAt: new Date("2026-06-18T09:00:00.000Z"),
      finishedAt: new Date("2026-06-18T09:02:05.000Z"),
    });

    expect(summary).toEqual({
      totalAnswers: 5,
      correctAnswers: 2,
      incorrectAnswers: 2,
      ignoredAnswers: 1,
      accuracyPercent: 50,
      advanced: 1,
      unchanged: 2,
      demoted: 1,
      burned: 1,
      durationSeconds: 125,
    });
  });

  it("returns no accuracy for a session without graded answers", () => {
    const summary = buildReviewSessionSummary({
      answers: [{ result: "manual-ignore", srsTransition: "unchanged" }],
      startedAt: new Date("2026-06-18T09:00:10.000Z"),
      finishedAt: new Date("2026-06-18T09:00:00.000Z"),
    });

    expect(summary.accuracyPercent).toBeNull();
    expect(summary.durationSeconds).toBe(0);
  });
});
