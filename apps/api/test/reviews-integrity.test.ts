import { ConflictException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { Prisma } from "@kanji-srs/db";
import { calculateNextReview } from "@kanji-srs/srs";

import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";
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

function createReviewHarness(options: { beforeCreate?: () => Promise<void> } = {}) {
  let store = {
    state: structuredClone(INITIAL_STATE),
    answers: [] as StoredAnswer[],
    sessions: [
      createSession("review-a", "REVIEW"),
      createSession("review-b", "REVIEW"),
      createSession("lesson", "LESSON_QUIZ"),
      createSession("practice", "EXTRA_PRACTICE"),
    ],
  };
  let revision = 0;
  const client = (snapshot: typeof store) => ({
    reviewSession: {
      findFirst: vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
        return snapshot.sessions.find((session) => matches(session, where)) ?? null;
      }),
      updateMany: vi.fn(
        async ({ where, data }: { where: Record<string, unknown>; data: Partial<Session> }) => {
          const session = snapshot.sessions.find((candidate) => matches(candidate, where));
          if (session === undefined) return { count: 0 };
          Object.assign(session, data);
          return { count: 1 };
        },
      ),
    },
    userSrsState: {
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
        return snapshot.answers.filter((answer) => matches(answer, where));
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
      const result = await callback(client(snapshot));
      if (transactionOptions?.isolationLevel === "Serializable" && revision !== startedAtRevision) {
        throw new Prisma.PrismaClientKnownRequestError("serialization conflict", {
          code: "P2034",
          clientVersion: "test",
        });
      }
      store = snapshot;
      revision += 1;
      return result;
    },
  );
  const repository = new PrismaReviewsRepository({
    db: { reviewSession: client(store).reviewSession, $transaction: transaction },
  } as never);

  return { repository, transaction, store: () => store };
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
