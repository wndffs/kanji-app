import { describe, expect, it } from "vitest";

import { calculateLeechScore } from "../src";

describe("calculateLeechScore", () => {
  it("increases when repeated wrong answers and recent mistakes accumulate", () => {
    const early = calculateLeechScore({
      wrongCount: 2,
      correctStreak: 0,
      recentWrongCount: 1,
      stageDropCount: 0,
      stageDropMagnitude: 0,
    });
    const repeated = calculateLeechScore({
      wrongCount: 5,
      correctStreak: 0,
      recentWrongCount: 3,
      stageDropCount: 1,
      stageDropMagnitude: 2,
    });

    expect(repeated.score).toBeGreaterThan(early.score);
    expect(repeated).toMatchObject({
      isCandidate: true,
      reasons: expect.arrayContaining(["wrong-count", "recent-wrong", "stage-instability"]),
    });
  });

  it("uses correct streak as score relief without increasing leech pressure", () => {
    const unstable = calculateLeechScore({
      wrongCount: 6,
      correctStreak: 0,
      recentWrongCount: 1,
      stageDropCount: 1,
      stageDropMagnitude: 1,
    });
    const recovering = calculateLeechScore({
      wrongCount: 6,
      correctStreak: 4,
      recentWrongCount: 1,
      stageDropCount: 1,
      stageDropMagnitude: 1,
    });

    expect(recovering.score).toBeLessThan(unstable.score);
    expect(recovering.reasons).toContain("correct-streak-relief");
  });

  it("does not mark burned cards as leech candidates", () => {
    const score = calculateLeechScore({
      wrongCount: 30,
      correctStreak: 0,
      recentWrongCount: 8,
      stageDropCount: 5,
      stageDropMagnitude: 10,
      burnedAt: "2026-01-01T09:00:00.000Z",
    });

    expect(score).toMatchObject({
      score: 0,
      isCandidate: false,
      reasons: expect.arrayContaining(["burned"]),
    });
  });
});
