import { describe, expect, it } from "vitest";

import { getLessonBudget } from "../src/lessons/lesson-budget";

describe("daily lesson budget", () => {
  const now = new Date("2026-06-18T21:15:00.000Z");
  const progress = [
    { learningItemId: "old", createdAt: new Date("2026-06-18T20:59:00.000Z") },
    { learningItemId: "new", createdAt: new Date("2026-06-18T21:00:00.000Z") },
    { learningItemId: "new", createdAt: new Date("2026-06-18T21:01:00.000Z") },
  ];

  it("counts distinct materials on the local day, not cards or UTC dates", () => {
    expect(
      getLessonBudget({ dailyLessonLimit: 5, timezone: "Europe/Moscow" }, progress, now),
    ).toEqual({ completedToday: 1, dailyLimit: 5, remainingToday: 4 });
  });

  it("falls back to UTC for an invalid timezone and the default for an invalid limit", () => {
    expect(getLessonBudget({ dailyLessonLimit: 0, timezone: "bad-zone" }, progress, now)).toEqual({
      completedToday: 2,
      dailyLimit: 10,
      remainingToday: 8,
    });
  });

  it("retains the real completion count when the learner exceeds the limit", () => {
    expect(getLessonBudget({ dailyLessonLimit: 1, timezone: "UTC" }, progress, now)).toEqual({
      completedToday: 2,
      dailyLimit: 1,
      remainingToday: 0,
    });
  });
});
