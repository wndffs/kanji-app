import { describe, expect, it } from "vitest";
import { courseReviewTimeline } from "../src/course-browser";

const NOW = Date.parse("2026-10-25T09:00:00Z");
describe("course review timeline", () => {
  it("counts equality as due, ignores missing/invalid dates and burned/new cards", () => {
    expect(courseReviewTimeline([
      { started: true, burned: false, availableAt: "2026-10-25T09:00:00Z" },
      { started: true, burned: false, availableAt: "2026-10-25T10:00:00Z" },
      { started: true, burned: true, availableAt: "2026-10-24T10:00:00Z" },
      { started: false, burned: false, availableAt: "2026-10-24T10:00:00Z" },
      { started: true, burned: false, availableAt: null },
      { started: true, burned: false, availableAt: "invalid" },
    ], NOW)).toEqual({ dueCardCount: 1, scheduledCardCount: 1, nextReviewAt: "2026-10-25T09:00:00.000Z" });
  });
  it("has no next date for an empty or entirely burned item", () => {
    expect(courseReviewTimeline([], NOW)).toEqual({ dueCardCount: 0, scheduledCardCount: 0, nextReviewAt: null });
    expect(courseReviewTimeline([{ started: true, burned: true, availableAt: null }], NOW).nextReviewAt).toBeNull();
  });
});
