import { describe, expect, it } from "vitest";

import {
  DEFAULT_SRS_STAGES,
  buildReviewForecast,
  calculateNextReview,
  createSrsStageConfig,
  resurrectCard,
  schedulingPackageStatus,
  type SrsStageConfig,
  type UserSrsStateSnapshot,
} from "../src";

const NOW = new Date("2026-01-01T09:00:00.000Z");

function stateAt(
  stageIndex: number,
  overrides: Partial<UserSrsStateSnapshot> = {},
): UserSrsStateSnapshot {
  return {
    stageIndex,
    availableAt: NOW,
    burnedAt: null,
    resurrectedAt: null,
    wrongCount: 0,
    correctStreak: 0,
    lastReviewedAt: null,
    ...overrides,
  };
}

function iso(date: Date | null): string | null {
  return date?.toISOString() ?? null;
}

describe("SRS package status", () => {
  it("marks the SRS package as implemented", () => {
    expect(schedulingPackageStatus).toEqual({
      packageName: "@kanji-srs/srs",
      implemented: true,
    });
  });
});

describe("calculateNextReview", () => {
  it("advances correct answers at every non-burned stage", () => {
    const expectedTransitions = [
      [1, 2, "2026-01-01T17:00:00.000Z"],
      [2, 3, "2026-01-02T09:00:00.000Z"],
      [3, 4, "2026-01-03T09:00:00.000Z"],
      [4, 5, "2026-01-08T09:00:00.000Z"],
      [5, 6, "2026-01-15T09:00:00.000Z"],
      [6, 7, "2026-01-31T09:00:00.000Z"],
      [7, 8, "2026-05-01T09:00:00.000Z"],
      [8, 9, null],
    ] as const;

    for (const [previousStage, nextStage, nextAvailableAt] of expectedTransitions) {
      const result = calculateNextReview({
        state: stateAt(previousStage),
        result: "correct",
        now: NOW,
      });

      expect(result.previousStage.stageIndex).toBe(previousStage);
      expect(result.nextStage.stageIndex).toBe(nextStage);
      expect(iso(result.nextAvailableAt)).toBe(nextAvailableAt);
      expect(result.nextState.correctStreak).toBe(1);
      expect(result.nextState.wrongCount).toBe(0);
      expect(iso(result.nextState.lastReviewedAt)).toBe(NOW.toISOString());
    }
  });

  it("demotes wrong answers by one stage in early stages", () => {
    const result = calculateNextReview({
      state: stateAt(3, { wrongCount: 1, correctStreak: 2 }),
      result: "wrong",
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(2);
    expect(result.penaltyApplied).toBe(1);
    expect(result.details.action).toBe("demoted");
    expect(result.nextState.wrongCount).toBe(2);
    expect(result.nextState.correctStreak).toBe(0);
    expect(iso(result.nextAvailableAt)).toBe("2026-01-01T17:00:00.000Z");
  });

  it("keeps wrong answers at the minimum stage", () => {
    const result = calculateNextReview({
      state: stateAt(1),
      result: "wrong",
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(1);
    expect(result.penaltyApplied).toBe(0);
    expect(result.details.action).toBe("stayed");
  });

  it("demotes wrong answers by two stages in later stages", () => {
    const result = calculateNextReview({
      state: stateAt(7, { wrongCount: 3, correctStreak: 4 }),
      result: "wrong",
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(5);
    expect(result.penaltyApplied).toBe(2);
    expect(result.nextState.wrongCount).toBe(4);
    expect(result.nextState.correctStreak).toBe(0);
    expect(iso(result.nextAvailableAt)).toBe("2026-01-08T09:00:00.000Z");
  });

  it("keeps typo answers on the same stage by default", () => {
    const result = calculateNextReview({
      state: stateAt(4, { correctStreak: 2 }),
      result: "typo",
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(4);
    expect(result.penaltyApplied).toBe(0);
    expect(result.details.action).toBe("stayed");
    expect(result.details.reason).toBe("typo-accepted-without-advancement");
    expect(result.nextState.correctStreak).toBe(3);
    expect(iso(result.nextAvailableAt)).toBe("2026-01-03T09:00:00.000Z");
  });

  it("can advance typo answers when configured", () => {
    const stageConfig: SrsStageConfig = {
      stages: DEFAULT_SRS_STAGES,
      rules: {
        typoBehavior: "advance",
      },
    };

    const result = calculateNextReview({
      state: stateAt(4),
      result: "typo",
      now: NOW,
      stageConfig,
    });

    expect(result.nextStage.stageIndex).toBe(5);
    expect(result.details.action).toBe("advanced");
    expect(result.details.reason).toBe("typo-accepted-as-correct");
  });

  it("treats reveal as a wrong answer with demotion", () => {
    const result = calculateNextReview({
      state: stateAt(5, { wrongCount: 1, correctStreak: 3 }),
      result: "reveal",
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(3);
    expect(result.penaltyApplied).toBe(2);
    expect(result.details.reason).toBe("answer-revealed");
    expect(result.nextState.wrongCount).toBe(2);
    expect(result.nextState.correctStreak).toBe(0);
  });

  it("does not change state for manual ignore", () => {
    const currentAvailableAt = new Date("2026-01-02T10:00:00.000Z");
    const currentLastReviewedAt = new Date("2026-01-01T08:00:00.000Z");

    const result = calculateNextReview({
      state: stateAt(4, {
        availableAt: currentAvailableAt,
        wrongCount: 2,
        correctStreak: 5,
        lastReviewedAt: currentLastReviewedAt,
      }),
      result: "manual-ignore",
      now: NOW,
    });

    expect(result.changed).toBe(false);
    expect(result.nextStage.stageIndex).toBe(4);
    expect(result.nextState.wrongCount).toBe(2);
    expect(result.nextState.correctStreak).toBe(5);
    expect(iso(result.nextAvailableAt)).toBe(currentAvailableAt.toISOString());
    expect(iso(result.nextState.lastReviewedAt)).toBe(currentLastReviewedAt.toISOString());
  });

  it("keeps burned cards burned unless resurrected", () => {
    const burnedAt = new Date("2025-12-01T09:00:00.000Z");
    const result = calculateNextReview({
      state: stateAt(9, { availableAt: null, burnedAt, wrongCount: 8, correctStreak: 12 }),
      result: "wrong",
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(9);
    expect(result.details.action).toBe("burned");
    expect(result.changed).toBe(false);
    expect(result.nextAvailableAt).toBeNull();
    expect(iso(result.nextState.burnedAt)).toBe(burnedAt.toISOString());
    expect(result.nextState.wrongCount).toBe(8);
    expect(result.nextState.correctStreak).toBe(12);
  });

  it("supports custom stage intervals and wrong-answer floors", () => {
    const customConfig = createSrsStageConfig({
      stages: [
        { stageIndex: 10, name: "Start", intervalMinutes: 10 },
        { stageIndex: 20, name: "Middle", intervalMinutes: 20 },
        { stageIndex: 30, name: "End", intervalMinutes: null, isBurned: true },
      ],
      rules: {
        minimumStageIndex: 10,
        reviewFloorStageIndex: 20,
        lateWrongStageIndex: 20,
        resurrectStageIndex: 20,
      },
    });

    const correct = calculateNextReview({
      state: stateAt(10),
      result: "correct",
      now: NOW,
      stageConfig: customConfig,
    });
    const wrong = calculateNextReview({
      state: stateAt(20),
      result: "wrong",
      now: NOW,
      stageConfig: customConfig,
    });
    const wrongWithDemotion = calculateNextReview({
      state: stateAt(20),
      result: "wrong",
      now: NOW,
      stageConfig: {
        ...customConfig,
        rules: {
          ...customConfig.rules,
          reviewFloorStageIndex: 10,
        },
      },
    });
    const wrongAtStart = calculateNextReview({
      state: stateAt(10),
      result: "wrong",
      now: NOW,
      stageConfig: customConfig,
    });

    expect(correct.nextStage.stageIndex).toBe(20);
    expect(iso(correct.nextAvailableAt)).toBe("2026-01-01T09:20:00.000Z");
    expect(wrong.nextStage.stageIndex).toBe(20);
    expect(wrong.penaltyApplied).toBe(0);
    expect(wrongWithDemotion.nextStage.stageIndex).toBe(10);
    expect(wrongWithDemotion.penaltyApplied).toBe(1);
    expect(wrongAtStart.nextStage.stageIndex).toBe(10);
    expect(wrongAtStart.penaltyApplied).toBe(0);
  });
});

describe("resurrectCard", () => {
  it("returns a burned item to the configured stage and makes it due immediately", () => {
    const burnedAt = new Date("2025-12-01T09:00:00.000Z");

    const result = resurrectCard({
      state: stateAt(9, { availableAt: null, burnedAt, wrongCount: 8, correctStreak: 12 }),
      now: NOW,
    });

    expect(result.nextStage.stageIndex).toBe(5);
    expect(result.details.action).toBe("resurrected");
    expect(iso(result.nextAvailableAt)).toBe(NOW.toISOString());
    expect(result.nextState.burnedAt).toBeNull();
    expect(iso(result.nextState.resurrectedAt)).toBe(NOW.toISOString());
    expect(result.nextState.wrongCount).toBe(0);
    expect(result.nextState.correctStreak).toBe(0);
  });

  it("can schedule resurrection at the target stage interval", () => {
    const result = resurrectCard({
      state: stateAt(9, { availableAt: null, burnedAt: NOW }),
      now: NOW,
      targetStageIndex: 4,
      availability: "stage-interval",
    });

    expect(result.nextStage.stageIndex).toBe(4);
    expect(iso(result.nextAvailableAt)).toBe("2026-01-03T09:00:00.000Z");
  });

  it("rejects burned stages as resurrection targets", () => {
    expect(() =>
      resurrectCard({
        state: stateAt(9, { availableAt: null, burnedAt: NOW }),
        now: NOW,
        targetStageIndex: 9,
      }),
    ).toThrow("Resurrection target stage must not be a burned stage.");
  });
});

describe("buildReviewForecast", () => {
  it("groups due cards by local hour and skips burned cards", () => {
    const forecast = buildReviewForecast({
      now: NOW,
      timezone: "UTC",
      granularity: "hour",
      states: [
        stateAt(2, {
          id: "overdue",
          learningCardId: "card-overdue",
          availableAt: "2026-01-01T08:30:00.000Z",
        }),
        stateAt(2, {
          id: "current",
          learningCardId: "card-current",
          availableAt: "2026-01-01T09:20:00.000Z",
        }),
        stateAt(3, {
          id: "later",
          learningCardId: "card-later",
          availableAt: "2026-01-01T10:05:00.000Z",
        }),
        stateAt(9, {
          id: "burned",
          learningCardId: "card-burned",
          availableAt: null,
          burnedAt: "2025-12-01T09:00:00.000Z",
        }),
      ],
    });

    expect(forecast).toHaveLength(2);
    expect(forecast[0]).toMatchObject({
      bucketKey: "2026-01-01T09:00",
      localDate: "2026-01-01",
      localHour: 9,
      dueCount: 2,
      stateIds: ["overdue", "current"],
      learningCardIds: ["card-overdue", "card-current"],
    });
    expect(forecast[1]).toMatchObject({
      bucketKey: "2026-01-01T10:00",
      localDate: "2026-01-01",
      localHour: 10,
      dueCount: 1,
      stateIds: ["later"],
      learningCardIds: ["card-later"],
    });
  });

  it("can exclude overdue cards from the forecast", () => {
    const forecast = buildReviewForecast({
      now: NOW,
      timezone: "UTC",
      includeOverdue: false,
      states: [
        stateAt(2, { id: "overdue", availableAt: "2026-01-01T08:30:00.000Z" }),
        stateAt(2, { id: "future", availableAt: "2026-01-01T09:30:00.000Z" }),
      ],
    });

    expect(forecast.map((bucket) => bucket.stateIds)).toEqual([["future"]]);
  });

  it("groups by local day across timezone date boundaries", () => {
    const forecast = buildReviewForecast({
      now: "2026-01-01T20:00:00.000Z",
      timezone: "Europe/Moscow",
      granularity: "day",
      states: [
        stateAt(2, { id: "late-local-day", availableAt: "2026-01-01T20:30:00.000Z" }),
        stateAt(2, { id: "next-local-day", availableAt: "2026-01-01T21:30:00.000Z" }),
      ],
    });

    expect(forecast).toHaveLength(2);
    expect(forecast[0]).toMatchObject({
      bucketKey: "2026-01-01",
      localDate: "2026-01-01",
      localHour: null,
      stateIds: ["late-local-day"],
    });
    expect(forecast[1]).toMatchObject({
      bucketKey: "2026-01-02",
      localDate: "2026-01-02",
      localHour: null,
      stateIds: ["next-local-day"],
    });
  });

  it("uses the requested horizon", () => {
    const forecast = buildReviewForecast({
      now: NOW,
      horizonDays: 1,
      states: [
        stateAt(2, { id: "inside", availableAt: "2026-01-02T08:59:00.000Z" }),
        stateAt(2, { id: "outside", availableAt: "2026-01-02T09:01:00.000Z" }),
      ],
    });

    const stateIds = forecast.flatMap((bucket) => bucket.stateIds);
    expect(stateIds).toEqual(["inside"]);
  });
});
