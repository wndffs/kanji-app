import { isDeepStrictEqual } from "node:util";

import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@kanji-srs/db";
import { calculateNextReview } from "@kanji-srs/srs";

import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";
import {
  createScheduledReviewState,
  getPendingReviewCardIds,
  parseScheduledReviewState,
} from "../src/reviews/review-session-state";
import type { RecordReviewAnswerInput } from "../src/reviews/reviews.types";

const NOW = new Date("2026-06-18T09:00:00.000Z");
const INITIAL_STATE = {
  id: "state-1",
  userId: "owner",
  learningCardId: "card-1",
  srsSystemId: "srs-default",
  stageIndex: 4,
  availableAt: new Date("2026-06-17T09:00:00.000Z"),
  burnedAt: null as Date | null,
  resurrectedAt: null as Date | null,
  wrongCount: 0,
  correctStreak: 0,
  lastReviewedAt: null as Date | null,
};

describe("PrismaReviewsRepository progress integrity", () => {
  it("rejects a stale cross-session write after a competing answer has committed", async () => {
    const harness = createReviewHarness();
    const correct = reviewInput("review-a", "correct");
    const staleWrong = reviewInput("review-b", "wrong");

    await harness.repository.recordReviewAnswer(correct);
    await expect(harness.repository.recordReviewAnswer(staleWrong)).rejects.toBeInstanceOf(
      ConflictException,
    );

    expect(harness.store().state).toMatchObject(correct.nextState);
    expect(harness.store().answers).toHaveLength(1);
    expect(harness.store().answers[0].reviewSessionId).toBe("review-a");
  });

  it.each([
    ["availableAt", new Date("2026-06-18T12:00:00.000Z")],
    ["burnedAt", NOW],
    ["resurrectedAt", NOW],
    ["wrongCount", 1],
    ["correctStreak", 1],
    ["lastReviewedAt", NOW],
    ["srsSystemId", "different-system"],
  ])("compares %s as part of the grading snapshot", async (field, value) => {
    const harness = createReviewHarness();
    Object.assign(harness.store().state, { [field as string]: value });

    await expect(
      harness.repository.recordReviewAnswer(reviewInput("review-a", "correct")),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.store().answers).toEqual([]);
  });

  it.each(["review-a", "review-b"])(
    "rejects overlapping submissions against %s without losing the winning answer",
    async (secondSessionId) => {
      const barrier = createBarrier(2);
      const harness = createReviewHarness({ beforeCreate: barrier });
      const outcomes = await Promise.allSettled([
        harness.repository.recordReviewAnswer(reviewInput("review-a", "correct")),
        harness.repository.recordReviewAnswer(reviewInput(secondSessionId, "wrong")),
      ]);

      expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
      const rejected = outcomes.find((outcome) => outcome.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(ConflictException);
      expect(harness.store().answers).toHaveLength(1);
      expect(harness.store().state.stageIndex).toBe(harness.store().answers[0].nextStageIndex);
      for (const [, options] of harness.transaction.mock.calls) {
        expect(options).toEqual({ isolationLevel: "Serializable" });
      }
    },
  );

  it("rejects overlapping manual-ignore duplicates even though scheduling does not change", async () => {
    const harness = createReviewHarness({ beforeCreate: createBarrier(2) });
    const input = reviewInput("review-a", "manual-ignore");
    const outcomes = await Promise.allSettled([
      harness.repository.recordReviewAnswer(input),
      harness.repository.recordReviewAnswer(input),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(harness.store().state).toEqual(INITIAL_STATE);
    expect(harness.store().answers).toHaveLength(1);
    await expect(harness.repository.recordReviewAnswer(input)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(harness.store().answers).toHaveLength(1);
  });

  it("does not commit an in-flight answer after the session has been finished", async () => {
    const enteredCreate = deferred();
    const releaseCreate = deferred();
    const harness = createReviewHarness({
      beforeCreate: async () => {
        enteredCreate.resolve();
        await releaseCreate.promise;
      },
    });
    const pendingAnswer = harness.repository.recordReviewAnswer(reviewInput("review-a", "correct"));
    const rejectedAnswer = expect(pendingAnswer).rejects.toBeInstanceOf(ConflictException);
    await enteredCreate.promise;

    const finished = await harness.repository.finishReviewSession("owner", "review-a", NOW);
    releaseCreate.resolve();
    await rejectedAnswer;

    expect(finished?.summary.totalAnswers).toBe(0);
    expect(harness.store().state).toEqual(INITIAL_STATE);
    expect(harness.store().answers).toEqual([]);
    expect(harness.store().sessions[0].finishedAt).toEqual(NOW);
  });

  it("includes a committed answer when finishing its review session", async () => {
    const harness = createReviewHarness();
    await harness.repository.recordReviewAnswer(reviewInput("review-a", "correct"));

    const finished = await harness.repository.finishReviewSession("owner", "review-a", NOW);

    expect(finished?.summary).toMatchObject({ totalAnswers: 1, correctAnswers: 1, advanced: 1 });
    expect(harness.store().sessions[0].statsJson).toEqual(finished?.summary);
  });

  it.each(["lesson", "practice"])(
    "rejects %s session IDs on scheduled answer lookup, write, and finish paths",
    async (sessionId) => {
      const harness = createReviewHarness();
      const before = structuredClone(harness.store());

      await expect(
        harness.repository.findAnswerTarget("owner", sessionId, "card-1", NOW),
      ).resolves.toBeNull();
      await expect(
        harness.repository.recordReviewAnswer(reviewInput(sessionId, "correct")),
      ).rejects.toBeInstanceOf(NotFoundException);
      await expect(
        harness.repository.finishReviewSession("owner", sessionId, NOW),
      ).resolves.toBeNull();

      expect(harness.store()).toEqual(before);
    },
  );

  it("rolls back the SRS update when inserting the answer fails", async () => {
    const failure = new Error("answer insert failed");
    const harness = createReviewHarness({
      beforeCreate: async () => {
        throw failure;
      },
    });

    await expect(
      harness.repository.recordReviewAnswer(reviewInput("review-a", "correct")),
    ).rejects.toBe(failure);
    expect(harness.store().state).toEqual(INITIAL_STATE);
    expect(harness.store().answers).toEqual([]);
  });

  it("serializes duplicate starts on the owner row and resumes exactly one persisted snapshot", async () => {
    const harness = createReviewHarness();
    const results = await Promise.all([
      harness.repository.startScheduledReviewSession("owner", NOW, ["card-1"]),
      harness.repository.startScheduledReviewSession("owner", NOW, ["card-1"]),
    ]);
    expect(results[0].session.id).toBe(results[1].session.id);
    expect(results.map((result) => result.resumed)).toEqual([false, true]);
    expect(
      harness
        .store()
        .sessions.filter(
          (session) => (session.statsJson as { reviewVersion?: number }).reviewVersion === 1,
        ),
    ).toHaveLength(1);
    expect(harness.ownerLocks).toHaveLength(2);
    expect(
      harness.ownerLocks.every((query) =>
        /SELECT id FROM "User" WHERE id = .*::uuid FOR UPDATE/s.test(query),
      ),
    ).toBe(true);
    for (const [, options] of harness.transaction.mock.calls) {
      expect(options).toEqual({ isolationLevel: "ReadCommitted" });
    }
  });

  it("rejects an empty or stale start without creating a session, but resumes an active one with an empty queue", async () => {
    const harness = createReviewHarness();
    const initial = structuredClone(harness.store());
    await expect(
      harness.repository.startScheduledReviewSession("owner", NOW, []),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      harness.repository.startScheduledReviewSession("owner", NOW, ["unknown"]),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.store()).toEqual(initial);
    const created = await harness.repository.startScheduledReviewSession("owner", NOW, ["card-1"]);
    const resumed = await harness.repository.startScheduledReviewSession("owner", NOW, []);
    expect(resumed.session.id).toBe(created.session.id);
    expect(resumed.resumed).toBe(true);
    await expect(
      harness.repository.startScheduledReviewSession(
        "owner",
        NOW,
        Array.from({ length: 101 }, (_, index) => `card-${index}`),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it("persists corrections only in session JSON, enforces finish gates, and replays after finish", async () => {
    const harness = createReviewHarness();
    const state = createScheduledReviewState(["card-1"]);
    harness.store().sessions[0].statsJson = state;
    await expect(
      harness.repository.finishReviewSession("owner", "review-a", NOW),
    ).rejects.toBeInstanceOf(ConflictException);
    await harness.repository.recordReviewAnswer(reviewInput("review-a", "wrong"));
    const before = structuredClone(harness.store());
    await expect(
      harness.repository.finishReviewSession("owner", "review-a", NOW),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(await harness.repository.findActiveReviewSession("owner")).toMatchObject({
      session: { id: "review-a", reviewState: state },
      answers: [{ cardId: "card-1", result: "wrong" }],
    });
    const input = {
      userId: "owner",
      sessionId: "review-a",
      cardId: "card-1",
      expectedState: state,
    };
    const corrected = await harness.repository.recordReviewCorrection(input);
    expect(corrected.session.reviewState?.correctedCardIds).toEqual(["card-1"]);
    const finished = await harness.repository.finishReviewSession("owner", "review-a", NOW);
    expect(finished?.summary).toMatchObject({
      totalAnswers: 1,
      incorrectAnswers: 1,
      accuracyPercent: 0,
      demoted: 1,
    });
    expect(harness.store().sessions[0].statsJson).toMatchObject({
      ...state,
      correctedCardIds: ["card-1"],
      summary: finished?.summary,
    });
    expect(await harness.repository.findActiveReviewSession("owner")).toBeNull();
    expect((await harness.repository.recordReviewCorrection(input)).session.finishedAt).toEqual(
      NOW,
    );
    expect(harness.store().state).toEqual(before.state);
    expect(harness.store().answers).toEqual(before.answers);
  });

  it("rejects a stale correction CAS and preserves another card's completed correction", async () => {
    const harness = createReviewHarness();
    const state = seedTwoMistakes(harness);
    const input = {
      userId: "owner",
      sessionId: "review-a",
      cardId: "card-1",
      expectedState: state,
    };
    await harness.repository.recordReviewCorrection(input);
    const before = structuredClone(harness.store());
    await expect(
      harness.repository.recordReviewCorrection({ ...input, cardId: "card-2" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(harness.store()).toEqual(before);
    const reloaded = await harness.repository.findReviewSessionProgress("owner", "review-a");
    await harness.repository.recordReviewCorrection({
      ...input,
      cardId: "card-2",
      expectedState: reloaded!.session.reviewState!,
    });
    expect(
      (await harness.repository.findReviewSessionProgress("owner", "review-a"))?.session.reviewState
        ?.correctedCardIds,
    ).toEqual(["card-1", "card-2"]);
  });

  it("rejects overlapping correction writes without losing the winner, then accepts a refreshed retry", async () => {
    const harness = createReviewHarness({ beforeSessionUpdate: createBarrier(2) });
    const state = seedTwoMistakes(harness);
    const outcomes = await Promise.allSettled(
      ["card-1", "card-2"].map((cardId) =>
        harness.repository.recordReviewCorrection({
          userId: "owner",
          sessionId: "review-a",
          cardId,
          expectedState: state,
        }),
      ),
    );
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(ConflictException);
    const reloaded = await harness.repository.findReviewSessionProgress("owner", "review-a");
    const corrected = reloaded!.session.reviewState!;
    expect(corrected.correctedCardIds).toHaveLength(1);
    const remaining = state.scheduledCardIds.find(
      (id) => !corrected.correctedCardIds.includes(id),
    )!;
    await harness.repository.recordReviewCorrection({
      userId: "owner",
      sessionId: "review-a",
      cardId: remaining,
      expectedState: corrected,
    });
    expect((harness.store().sessions[0].statsJson as typeof state).correctedCardIds).toHaveLength(
      2,
    );
    expect(harness.store().state).toEqual(INITIAL_STATE);
    expect(harness.store().answers).toHaveLength(2);
  });

  it("rejects correction owner/mode/injected-card/non-mistake attempts without writes", async () => {
    const harness = createReviewHarness();
    const state = createScheduledReviewState(["card-1"]);
    harness.store().sessions[0].statsJson = state;
    await harness.repository.recordReviewAnswer(reviewInput("review-a", "correct"));
    const before = structuredClone(harness.store());
    const input = {
      userId: "owner",
      sessionId: "review-a",
      cardId: "card-1",
      expectedState: state,
    };
    for (const attempt of [
      input,
      { ...input, userId: "other" },
      { ...input, cardId: "injected" },
      { ...input, sessionId: "review-b" },
      { ...input, sessionId: "lesson" },
      { ...input, sessionId: "practice" },
    ]) {
      await expect(harness.repository.recordReviewCorrection(attempt)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
    expect(harness.store()).toEqual(before);
  });

  it("rejects scheduled writes outside the persisted snapshot even for an owned due card", async () => {
    const harness = createReviewHarness();
    harness.store().sessions[0].statsJson = createScheduledReviewState(["different-card"]);
    const before = structuredClone(harness.store());
    expect(
      await harness.repository.findAnswerTarget("owner", "review-a", "card-1", NOW),
    ).toBeNull();
    await expect(
      harness.repository.recordReviewAnswer(reviewInput("review-a", "correct")),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(harness.store()).toEqual(before);
  });
});

describe("scheduled review snapshot validation", () => {
  it("keeps legacy summaries compatible and accepts an ordered bounded snapshot", () => {
    expect(parseScheduledReviewState(null)).toBeNull();
    expect(parseScheduledReviewState({ totalAnswers: 150 })).toBeNull();
    const ids = Array.from({ length: 100 }, (_, index) => `card-${index}`);
    const state = createScheduledReviewState(ids);
    expect(state.scheduledCardIds).toEqual(ids);
    expect(state.scheduledCardIds).not.toBe(ids);
  });

  it.each([
    { reviewVersion: 2, scheduledCardIds: [], correctedCardIds: [] },
    { reviewVersion: 1 },
    { reviewVersion: 1, scheduledCardIds: ["one", "one"], correctedCardIds: [] },
    { reviewVersion: 1, scheduledCardIds: ["one"], correctedCardIds: ["other"] },
    { reviewVersion: 1, scheduledCardIds: [""], correctedCardIds: [] },
    {
      reviewVersion: 1,
      scheduledCardIds: Array.from({ length: 101 }, (_, index) => `card-${index}`),
      correctedCardIds: [],
    },
  ])("rejects corrupt/version-mismatched snapshots %#", (value) => {
    expect(() => parseScheduledReviewState(value)).toThrow(ConflictException);
  });

  it("rejects duplicate/out-of-snapshot originals and corrections without an original mistake", () => {
    const state = createScheduledReviewState(["one", "two"]);
    const original = { cardId: "one", result: "wrong", srsTransition: "demoted" } as const;
    expect(() => getPendingReviewCardIds(state, [original, original])).toThrow(ConflictException);
    expect(() => getPendingReviewCardIds(state, [{ ...original, cardId: "other" }])).toThrow(
      ConflictException,
    );
    expect(() =>
      getPendingReviewCardIds({ ...state, correctedCardIds: ["two"] }, [original]),
    ).toThrow(ConflictException);
  });
});

type Session = {
  id: string;
  userId: string;
  mode: string;
  startedAt: Date;
  finishedAt: Date | null;
  statsJson: unknown;
};

type StoredAnswer = {
  reviewSessionId: string;
  userSrsStateId: string;
  learningCardId: string;
  result: string;
  nextStageIndex: number;
};

function createReviewHarness(
  options: { beforeCreate?: () => Promise<void>; beforeSessionUpdate?: () => Promise<void> } = {},
) {
  let store = {
    state: structuredClone(INITIAL_STATE),
    extraStates: [] as (typeof INITIAL_STATE)[],
    answers: [] as StoredAnswer[],
    sessions: [
      createSession("review-a", "REVIEW"),
      createSession("review-b", "REVIEW"),
      createSession("lesson", "LESSON_QUIZ"),
      createSession("practice", "EXTRA_PRACTICE"),
    ],
  };
  let revision = 0;
  let ownerTail = Promise.resolve();
  const ownerLocks: string[] = [];
  const client = (snapshot: typeof store, lockOwner: () => Promise<void> = async () => {}) => ({
    $queryRaw: vi.fn(async (strings: TemplateStringsArray, userId: string) => {
      ownerLocks.push(strings.join("?"));
      await lockOwner();
      return userId === "owner" ? [{ id: userId }] : [];
    }),
    reviewSession: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return snapshot.sessions.find((session) => matches(session, where)) ?? null;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Partial<Session> }) => {
          await options.beforeSessionUpdate?.();
          const session = snapshot.sessions.find((candidate) => matches(candidate, where));
          if (session === undefined) return { count: 0 };
          Object.assign(session, data);
          return { count: 1 };
        },
      ),
      create: vi.fn(async ({ data }: { data: Partial<Session> }) => {
        const session = {
          ...createSession(`session-${snapshot.sessions.length}`, "REVIEW"),
          ...data,
        };
        snapshot.sessions.push(session);
        return session;
      }),
    },
    userSrsState: {
      count: vi.fn(
        async ({ where }: { where: Record<string, unknown> }) =>
          [snapshot.state, ...snapshot.extraStates].filter((state) => matches(state, where)).length,
      ),
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: object }) => {
          if (!matches(snapshot.state, where)) return { count: 0 };
          Object.assign(snapshot.state, data);
          return { count: 1 };
        },
      ),
    },
    reviewAnswer: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return snapshot.answers.find((answer) => matches(answer, where)) ?? null;
      }),
      findMany: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return snapshot.answers.filter((answer) =>
          matches(
            {
              ...answer,
              userSrsState: [snapshot.state, ...snapshot.extraStates].find(
                (state) => state.id === answer.userSrsStateId,
              ),
            },
            where,
          ),
        );
      }),
      create: vi.fn(async ({ data }: { data: StoredAnswer }) => {
        await options.beforeCreate?.();
        snapshot.answers.push(data);
        return data;
      }),
    },
    learningCard: { findUnique: vi.fn().mockResolvedValue(null) },
  });
  // Model transaction-local writes and a driver's serialization failure, not an in-memory repository.
  const transaction = vi.fn(
    async (
      callback: (tx: ReturnType<typeof client>) => Promise<unknown>,
      transactionOptions?: { isolationLevel: string },
    ) => {
      const startedAtRevision = revision;
      const snapshot = structuredClone(store);
      let releaseOwner: (() => void) | undefined;
      const lockOwner = async () => {
        const previous = ownerTail;
        const gate = deferred();
        ownerTail = gate.promise;
        await previous;
        releaseOwner = gate.resolve;
        // READ COMMITTED statements after the lock see the preceding owner's committed start.
        Object.assign(snapshot, structuredClone(store));
      };
      try {
        const result = await callback(client(snapshot, lockOwner));
        if (
          transactionOptions?.isolationLevel === "Serializable" &&
          revision !== startedAtRevision
        ) {
          throw new Prisma.PrismaClientKnownRequestError("serialization conflict", {
            code: "P2034",
            clientVersion: "test",
          });
        }
        store = snapshot;
        revision += 1;
        return result;
      } finally {
        releaseOwner?.();
      }
    },
  );
  const repository = new PrismaReviewsRepository({
    db: { reviewSession: client(store).reviewSession, $transaction: transaction },
  } as never);

  return { repository, transaction, store: () => store, ownerLocks };
}

function seedTwoMistakes(harness: ReturnType<typeof createReviewHarness>) {
  const state = createScheduledReviewState(["card-1", "card-2"]);
  harness.store().sessions[0].statsJson = state;
  harness.store().extraStates.push({
    ...structuredClone(INITIAL_STATE),
    id: "state-2",
    learningCardId: "card-2",
  });
  harness.store().answers.push(
    ...["card-1", "card-2"].map((cardId, index) => ({
      reviewSessionId: "review-a",
      userSrsStateId: `state-${index + 1}`,
      learningCardId: cardId,
      result: "WRONG",
      previousStageIndex: 4,
      nextStageIndex: 2,
    })),
  );
  return state;
}

function reviewInput(
  sessionId: string,
  result: "correct" | "wrong" | "manual-ignore",
): RecordReviewAnswerInput {
  const scheduling = calculateNextReview({ state: INITIAL_STATE, result, now: NOW });
  return {
    userId: "owner",
    sessionId,
    stateId: INITIAL_STATE.id,
    cardId: INITIAL_STATE.learningCardId,
    answerText: result,
    normalizedAnswer: result,
    answeredAt: NOW,
    recordedResult: result,
    responseResult: result,
    previousStageIndex: INITIAL_STATE.stageIndex,
    nextStageIndex: scheduling.nextState.stageIndex,
    srsTransition:
      result === "manual-ignore" ? "unchanged" : result === "correct" ? "advanced" : "demoted",
    expectedState: structuredClone(INITIAL_STATE),
    nextState: scheduling.nextState,
    details: {},
  };
}

function createSession(id: string, mode: string): Session {
  return {
    id,
    mode,
    userId: "owner",
    startedAt: NOW,
    finishedAt: null,
    statsJson: { selectedItems: ["keep-this-progress"] },
  };
}

function matches(row: object, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as Record<string, unknown>)[key];
    if (typeof expected === "object" && expected !== null && !(expected instanceof Date)) {
      const filter = expected as Record<string, unknown>;
      if ("equals" in filter) {
        let value = actual;
        if (Array.isArray(filter.path)) {
          for (const part of filter.path) value = (value as Record<string, unknown>)?.[part];
        }
        return isDeepStrictEqual(value, filter.equals);
      }
      if (Array.isArray(filter.in)) return filter.in.includes(actual);
      if (filter.lte instanceof Date) return actual instanceof Date && actual <= filter.lte;
      return typeof actual === "object" && actual !== null && matches(actual, filter);
    }
    return actual instanceof Date && expected instanceof Date
      ? actual.getTime() === expected.getTime()
      : actual === expected;
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function createBarrier(participants: number) {
  const gate = deferred();
  let arrived = 0;
  return async () => {
    arrived += 1;
    if (arrived === participants) gate.resolve();
    await gate.promise;
  };
}
