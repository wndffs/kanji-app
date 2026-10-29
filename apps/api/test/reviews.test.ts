import { isDeepStrictEqual } from "node:util";
import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateAnswer, type AnswerKind } from "@kanji-srs/japanese";
import { DEFAULT_SRS_STAGES, type SrsStage } from "@kanji-srs/srs";
import { type PracticeSource } from "@kanji-srs/shared";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { type OverridesService } from "../src/overrides/overrides.service";
import { buildReviewSessionSummary } from "../src/reviews/review-summary";
import { PrismaReviewsRepository, ReviewsRepository } from "../src/reviews/reviews.repository";
import { ReviewsService } from "../src/reviews/reviews.service";
import {
  createScheduledReviewState,
  getPendingReviewCardIds,
} from "../src/reviews/review-session-state";
import {
  type CreatePracticeSessionInput,
  type FinishedReviewSessionRecord,
  type PracticeSessionRecord,
  type RecordReviewAnswerInput,
  type RecordReviewCorrectionInput,
  type ReviewAnswerTargetRecord,
  type ReviewQueueRecord,
  type ReviewSessionRecord,
  type ReviewSessionProgressRecord,
  type UpdatePracticeSessionProgressInput,
} from "../src/reviews/reviews.types";

const NOW = new Date("2026-06-18T09:00:00.000Z");
const DUE_AT = new Date("2026-06-17T09:00:00.000Z");
const FUTURE_AT = new Date("2999-01-01T09:00:00.000Z");

describe("ReviewsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns due cards only without exposing answers", async () => {
    const { service } = createHarness();
    const queue = await service.getQueue(createUser("owner", { reviewOrderMode: "oldest-first" }));
    const cardIds = queue.items.map((item) => item.card.id);
    const serializedQueue = JSON.stringify(queue);

    expect(cardIds).toEqual(["card-meaning", "card-late"]);
    expect(cardIds).not.toContain("card-future");
    expect(cardIds).not.toContain("card-burned");
    expect(queue.items[0]?.card).not.toHaveProperty("acceptedAnswers");
    expect(queue.items[0]?.card).not.toHaveProperty("blockedAnswers");
    expect(serializedQueue).not.toContain("study answer");
    expect(queue.orderMode).toBe("oldest-first");
    expect(queue.vacationStartedAt).toBeNull();
  });

  it("pauses scheduled reviews without disabling practice or recording answers", async () => {
    const { repository, service } = createHarness();
    const vacationStartedAt = "2026-06-17T09:00:00.000Z";
    const vacationUser = createUser("owner", { vacationStartedAt });

    await expect(service.getQueue(vacationUser)).resolves.toEqual({
      items: [],
      orderMode: "shuffled",
      vacationStartedAt,
    });
    await expect(service.startSession(vacationUser)).rejects.toThrow(
      "Плановые повторения приостановлены, пока включён режим отпуска.",
    );

    const session = await service.startSession(createUser("owner"));
    await expect(
      service.submitAnswer(session.session.id, vacationUser, {
        cardId: "card-meaning",
        answer: "study answer",
        answerType: "meaning",
      }),
    ).rejects.toThrow("Плановые повторения приостановлены, пока включён режим отпуска.");
    await expect(service.getPracticeQueue(vacationUser, "recent-lessons")).resolves.toMatchObject({
      source: "recent-lessons",
      items: expect.any(Array),
    });
    expect(repository.recordedAnswers).toEqual([]);
  });

  it("reorders only the current due batch without changing eligibility", async () => {
    const { repository, service } = createHarness();
    const lowerLevels = await service.getQueue(
      createUser("owner", { reviewOrderMode: "lower-levels-first" }),
    );
    const firstShuffle = await service.getQueue(
      createUser("owner", { reviewOrderMode: "shuffled" }),
    );
    const secondShuffle = await service.getQueue(
      createUser("owner", { reviewOrderMode: "shuffled" }),
    );
    const limited = await service.getQueue(
      createUser("owner", {
        reviewBudget: 1,
        reviewOrderMode: "lower-levels-first",
      }),
    );

    expect(lowerLevels.items.map((item) => item.card.id)).toEqual(["card-late", "card-meaning"]);
    expect(firstShuffle.items.map((item) => item.card.id)).toEqual(
      secondShuffle.items.map((item) => item.card.id),
    );
    expect(firstShuffle.items.map((item) => item.card.id).sort()).toEqual([
      "card-late",
      "card-meaning",
    ]);
    expect(firstShuffle.items.map((item) => item.card.id)).not.toContain("card-future");
    expect(firstShuffle.items.map((item) => item.card.id)).not.toContain("card-burned");
    expect(limited.items.map((item) => item.card.id)).toEqual(["card-meaning"]);
    expect(repository.recordedAnswers).toEqual([]);
  });

  it("advances the stage for a correct answer", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    const response = await service.submitAnswer(session.session.id, createUser("owner"), {
      cardId: "card-meaning",
      answer: "study answer",
      answerType: "meaning",
      answeredAt: NOW.toISOString(),
    });

    expect(response).toMatchObject({
      accepted: true,
      result: "correct",
      previousSrs: { stageIndex: 1 },
      nextSrs: { stageIndex: 2, availableAt: "2026-06-18T17:00:00.000Z" },
      srsTransition: "advanced",
    });
    expect(repository.getState("state-due").stageIndex).toBe(2);
    expect(repository.recordedAnswers[0]?.expectedState).toMatchObject({
      srsSystemId: "srs-default",
      stageIndex: 1,
      availableAt: DUE_AT,
      burnedAt: null,
      wrongCount: 0,
      correctStreak: 0,
      lastReviewedAt: null,
    });
  });

  it("uses strict mode to keep typo answers on the current stage", async () => {
    const relaxedHarness = createHarness();
    const relaxedSession = await relaxedHarness.service.startSession(createUser("owner"));

    await expect(
      relaxedHarness.service.submitAnswer(relaxedSession.session.id, createUser("owner"), {
        cardId: "card-meaning",
        answer: "study answr",
        answerType: "meaning",
        answeredAt: NOW.toISOString(),
      }),
    ).resolves.toMatchObject({
      accepted: true,
      result: "typo",
      nextSrs: { stageIndex: 2 },
    });

    const strictHarness = createHarness();
    const strictSession = await strictHarness.service.startSession(
      createUser("owner", { strictMode: true }),
    );

    await expect(
      strictHarness.service.submitAnswer(
        strictSession.session.id,
        createUser("owner", { strictMode: true }),
        {
          cardId: "card-meaning",
          answer: "study answr",
          answerType: "meaning",
          answeredAt: NOW.toISOString(),
        },
      ),
    ).resolves.toMatchObject({
      accepted: true,
      result: "typo",
      nextSrs: { stageIndex: 1 },
    });
  });

  it("demotes the stage for a wrong answer", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    const response = await service.submitAnswer(session.session.id, createUser("owner"), {
      cardId: "card-late",
      answer: "wrong answer",
      answerType: "meaning",
      answeredAt: NOW.toISOString(),
    });

    expect(response).toMatchObject({
      accepted: false,
      result: "wrong",
      previousSrs: { stageIndex: 5 },
      nextSrs: { stageIndex: 3, wrongCount: 1, correctStreak: 0 },
      srsTransition: "demoted",
    });
    expect(repository.getState("state-late")).toMatchObject({
      stageIndex: 3,
      wrongCount: 1,
      correctStreak: 0,
    });
  });

  it("returns a persisted end-of-review summary", async () => {
    const { service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    await service.submitAnswer(session.session.id, createUser("owner"), {
      cardId: "card-meaning",
      answer: "study answer",
      answerType: "meaning",
    });
    await service.submitAnswer(session.session.id, createUser("owner"), {
      cardId: "card-late",
      answer: "wrong answer",
      answerType: "meaning",
    });
    await service.submitCorrection(session.session.id, createUser("owner"), {
      cardId: "card-late",
      answer: "late answer",
      answerType: "meaning",
    });
    vi.setSystemTime(new Date(NOW.getTime() + 90_000));

    await expect(service.finishSession(session.session.id, createUser("owner"))).resolves.toEqual({
      session: {
        id: session.session.id,
        startedAt: NOW.toISOString(),
        finishedAt: new Date(NOW.getTime() + 90_000).toISOString(),
        mode: "review",
      },
      summary: {
        totalAnswers: 2,
        correctAnswers: 1,
        incorrectAnswers: 1,
        ignoredAnswers: 0,
        accuracyPercent: 50,
        advanced: 1,
        unchanged: 0,
        demoted: 1,
        burned: 0,
        durationSeconds: 90,
      },
    });
  });

  it("explains when a wrong answer is another known kanji reading", async () => {
    const overridesService = {
      validateAnswerForUser: async () => ({
        ...validateAnswer({
          answerKind: "reading",
          answer: "ひと",
          acceptedAnswers: ["いち"],
        }),
        relatedAnswer: "ひと",
      }),
    } as unknown as OverridesService;
    const { repository, service } = createHarness(overridesService);
    const session = await service.startSession(createUser("owner"));

    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), {
        cardId: "card-meaning",
        answer: "ひと",
        answerType: "meaning",
        answeredAt: NOW.toISOString(),
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "wrong",
      retry: true,
      previousSrs: { stageIndex: 1 },
      nextSrs: { stageIndex: 1 },
      feedback: {
        message: "Это существующее чтение кандзи, но эта карточка ожидает другое чтение.",
        diagnostic: { kind: "alternative-reading", matchedAnswer: "ひと" },
      },
    });
    expect(repository.recordedAnswers).toEqual([]);
    expect(repository.getState("state-due")).toMatchObject({
      stageIndex: 1,
      wrongCount: 0,
    });
  });

  it("accepts a user private override", async () => {
    const { service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), {
        cardId: "card-meaning",
        answer: "single stroke",
        answerType: "meaning",
        answeredAt: NOW.toISOString(),
      }),
    ).resolves.toMatchObject({
      accepted: true,
      result: "correct",
      matchedAnswer: "single stroke",
    });
  });

  it("rejects a blocked answer and records it as wrong for SRS", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    const response = await service.submitAnswer(session.session.id, createUser("owner"), {
      cardId: "card-meaning",
      answer: "line",
      answerType: "meaning",
      answeredAt: NOW.toISOString(),
    });

    expect(response).toMatchObject({
      accepted: false,
      result: "blocked",
      matchedAnswer: "line",
      feedback: {
        blockedReason: "Too broad for this card.",
      },
    });
    expect(repository.recordedAnswers[0]?.recordedResult).toBe("wrong");
    expect(repository.getState("state-due").wrongCount).toBe(1);
  });

  it("does not allow answering another user's session", async () => {
    const { service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    await expect(
      service.submitAnswer(session.session.id, createUser("other"), {
        cardId: "card-meaning",
        answer: "study answer",
        answerType: "meaning",
        answeredAt: NOW.toISOString(),
      }),
    ).rejects.toThrow("Review session or card not found.");
  });

  it("rejects duplicate answers for the same session card", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));
    const body = {
      cardId: "card-meaning",
      answer: "study answer",
      answerType: "meaning",
      answeredAt: NOW.toISOString(),
    };

    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), body),
    ).resolves.toMatchObject({
      accepted: true,
    });
    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), body),
    ).rejects.toThrow("Review session or card not found.");
    expect(repository.recordedAnswers).toHaveLength(1);
  });

  it("rejects future and burned cards submitted outside the due queue", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), {
        cardId: "card-future",
        answer: "future answer",
        answerType: "meaning",
      }),
    ).rejects.toThrow("Review session or card not found.");
    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), {
        cardId: "card-burned",
        answer: "burned answer",
        answerType: "meaning",
      }),
    ).rejects.toThrow("Review session or card not found.");
    expect(repository.recordedAnswers).toHaveLength(0);
  });

  it("uses server time instead of client answeredAt for scheduling", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    await service.submitAnswer(session.session.id, createUser("owner"), {
      cardId: "card-meaning",
      answer: "study answer",
      answerType: "meaning",
      answeredAt: "2999-01-01T00:00:00.000Z",
    });

    expect(repository.recordedAnswers[0]?.answeredAt).toEqual(NOW);
    expect(repository.getState("state-due").availableAt).toEqual(
      new Date("2026-06-18T17:00:00.000Z"),
    );
  });

  it("rejects oversized answers before mutating SRS state", async () => {
    const { repository, service } = createHarness();
    const session = await service.startSession(createUser("owner"));

    await expect(
      service.submitAnswer(session.session.id, createUser("owner"), {
        cardId: "card-meaning",
        answer: "a".repeat(501),
        answerType: "meaning",
      }),
    ).rejects.toThrow("answer is too long.");
    expect(repository.recordedAnswers).toHaveLength(0);
    expect(repository.getState("state-due").stageIndex).toBe(1);
  });

  it("does not include burned cards in the due queue", async () => {
    const { service } = createHarness();

    await expect(service.getQueue(createUser("owner"))).resolves.toMatchObject({
      items: expect.not.arrayContaining([
        expect.objectContaining({
          card: expect.objectContaining({ id: "card-burned" }),
        }),
      ]),
    });
  });

  it("returns source-specific optional practice queues", async () => {
    const { service } = createHarness();

    await expect(
      service.getPracticeQueue(createUser("owner"), "recent-lessons"),
    ).resolves.toMatchObject({
      source: "recent-lessons",
      items: expect.arrayContaining([
        expect.objectContaining({ card: expect.objectContaining({ id: "card-meaning" }) }),
      ]),
    });
    await expect(
      service.getPracticeQueue(createUser("owner"), "recent-mistakes"),
    ).resolves.toMatchObject({
      source: "recent-mistakes",
      items: [expect.objectContaining({ card: expect.objectContaining({ id: "card-late" }) })],
    });
    await expect(service.getPracticeQueue(createUser("owner"), "burned")).resolves.toMatchObject({
      source: "burned",
      items: [expect.objectContaining({ card: expect.objectContaining({ id: "card-burned" }) })],
    });
  });

  it("validates practice answers without recording or changing SRS", async () => {
    const { repository, service } = createHarness();
    const previousState = { ...repository.getState("state-burned") };
    const started = await service.startPracticeSession(createUser("owner"), {
      source: "burned",
    });

    await expect(
      service.submitPracticeAnswer(started.session.id, createUser("owner"), {
        cardId: "card-burned",
        answer: "burned answer",
        answerType: "meaning",
      }),
    ).resolves.toMatchObject({
      answer: {
        cardId: "card-burned",
        accepted: true,
        result: "correct",
      },
      session: {
        id: started.session.id,
        currentIndex: 1,
        progress: { answered: 1, accepted: 1, missed: 0 },
      },
    });
    await expect(
      service.startPracticeSession(createUser("owner"), { source: "burned" }),
    ).resolves.toMatchObject({
      session: {
        id: started.session.id,
        currentIndex: 1,
        progress: { answered: 1, accepted: 1, missed: 0 },
      },
      items: [expect.objectContaining({ card: expect.objectContaining({ id: "card-burned" }) })],
    });
    await expect(
      service.finishPracticeSession(started.session.id, createUser("owner")),
    ).resolves.toMatchObject({
      summary: { answered: 1, accepted: 1, missed: 0 },
    });
    expect(repository.recordedAnswers).toEqual([]);
    expect(repository.getState("state-burned")).toEqual(previousState);
  });

  it("keeps an alternative reading as a neutral retry in optional practice", async () => {
    const overridesService = {
      validateAnswerForUser: async () => ({
        ...validateAnswer({
          answerKind: "reading",
          answer: "ひと",
          acceptedAnswers: ["いち"],
        }),
        relatedAnswer: "ひと",
      }),
    } as unknown as OverridesService;
    const { repository, service } = createHarness(overridesService);
    const previousState = { ...repository.getState("state-burned") };
    const started = await service.startPracticeSession(createUser("owner"), {
      source: "burned",
    });

    await expect(
      service.submitPracticeAnswer(started.session.id, createUser("owner"), {
        cardId: "card-burned",
        answer: "ひと",
        answerType: "meaning",
      }),
    ).resolves.toMatchObject({
      answer: {
        accepted: false,
        result: "wrong",
        retry: true,
        feedback: { diagnostic: { kind: "alternative-reading", matchedAnswer: "ひと" } },
      },
      session: {
        currentIndex: 0,
        progress: { answered: 0, accepted: 0, missed: 0 },
      },
    });
    expect(repository.recordedAnswers).toEqual([]);
    expect(repository.getState("state-burned")).toEqual(previousState);
  });

  it("rejects unknown practice sources and cards owned by another user", async () => {
    const { service } = createHarness();
    const started = await service.startPracticeSession(createUser("owner"), {
      source: "burned",
    });

    await expect(service.getPracticeQueue(createUser("owner"), "all")).rejects.toThrow(
      "source must be recent-lessons, recent-mistakes, or burned.",
    );
    await expect(
      service.submitPracticeAnswer(started.session.id, createUser("other"), {
        cardId: "card-burned",
        answer: "burned answer",
        answerType: "meaning",
      }),
    ).rejects.toThrow("Активная сессия практики не найдена.");
  });

  it("does not let generic practice endpoints finish a confusable session", async () => {
    const { repository, service } = createHarness();
    const session = await repository.createPracticeSession({
      userId: "owner",
      now: NOW,
      source: "confusable-kanji",
      contextId: "pair-one-two",
      cardIds: ["card-burned"],
    });

    await repository.updatePracticeSessionProgress({
      userId: "owner",
      sessionId: session.id,
      currentIndex: 1,
      progress: { answered: 1, accepted: 1, missed: 0 },
    });

    await expect(service.finishPracticeSession(session.id, createUser("owner"))).rejects.toThrow(
      "Активная сессия практики не найдена.",
    );
  });
});

describe("resumable scheduled review corrections", () => {
  const user = createUser("owner", { reviewOrderMode: "oldest-first" });
  const singleCardUser = createUser("owner", { reviewOrderMode: "oldest-first", reviewBudget: 1 });
  const request = { cardId: "card-meaning", answer: "incorrect", answerType: "meaning" } as const;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("returns the full empty contract and does not create an empty scheduled session", async () => {
    const { repository, service } = createHarness();
    const emptyUser = createUser("other");
    const empty = { session: null, items: [], currentIndex: 0, corrections: [], progress: null };
    expect(await service.getActiveSession(emptyUser)).toEqual(empty);
    await expect(service.startSession(emptyUser)).rejects.toBeInstanceOf(BadRequestException);
    expect(await repository.findActiveReviewSession(emptyUser.id)).toBeNull();
  });

  it("restores pending-only cards in snapshot order without merging the new due queue", async () => {
    const { repository, service } = createHarness();
    const queue = await service.getQueue(user);
    const started = await service.startSession(user);
    expect(started.items?.map((item) => item.card.id)).toEqual(
      queue.items.map((item) => item.card.id),
    );
    await service.submitAnswer(started.session.id, user, request);
    Object.assign(repository.getState("state-future"), { availableAt: DUE_AT });
    const reloaded = new ReviewsService(
      repository,
      new FakeOverridesService(repository) as unknown as OverridesService,
    );
    const active = await reloaded.getActiveSession(user);
    expect(active).toMatchObject({
      session: started.session,
      currentIndex: 0,
      progress: {
        scheduledTotal: 2,
        scheduledAnswered: 1,
        correctionsRequired: 1,
        original: { totalAnswers: 1, incorrectAnswers: 1, accuracyPercent: 0 },
      },
    });
    expect(active.items.map((item) => item.card.id)).toEqual(["card-late"]);
    expect(active.corrections.map((item) => item.card.id)).toEqual(["card-meaning"]);
    expect(JSON.stringify(active)).not.toContain("study answer");
    expect(JSON.stringify(active)).not.toContain("single stroke");
    const resumed = await reloaded.startSession(singleCardUser);
    expect(resumed.session.id).toBe(started.session.id);
    expect(resumed.resumed).toBe(true);
    expect(resumed.items).toEqual(active.items);
    expect((await reloaded.getActiveSession(createUser("other"))).session).toBeNull();
  });

  it("keeps wrong cards accessible after rescheduling and rejects unfinished scheduling and corrections", async () => {
    const { repository, service } = createHarness();
    const started = await service.startSession(user);
    await expect(service.finishSession(started.session.id, user)).rejects.toBeInstanceOf(
      ConflictException,
    );
    await service.submitAnswer(started.session.id, user, request);
    await service.submitAnswer(started.session.id, user, {
      cardId: "card-late",
      answer: "late answer",
      answerType: "meaning",
    });
    expect(repository.getState("state-due").availableAt!.getTime()).toBeGreaterThan(NOW.getTime());
    expect((await service.getQueue(user)).items).toEqual([]);
    const active = await service.getActiveSession(user);
    expect(active.items).toEqual([]);
    expect(active.currentIndex).toBe(0);
    expect(active.corrections.map((item) => item.card.id)).toEqual([request.cardId]);
    await expect(service.finishSession(started.session.id, user)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it("retries ordinary wrong and blocked answers without SRS/history writes, accepts private answers, and replays after finish", async () => {
    const { repository, service } = createHarness();
    const started = await service.startSession(singleCardUser);
    await service.submitAnswer(started.session.id, user, { ...request, answer: "line" });
    const beforeState = structuredClone(repository.getState("state-due"));
    const beforeAnswers = structuredClone(repository.recordedAnswers);
    expect(await service.submitCorrection(started.session.id, user, request)).toMatchObject({
      accepted: false,
      result: "wrong",
      corrected: false,
      alreadyCorrected: false,
      retry: false,
    });
    expect(
      await service.submitCorrection(started.session.id, user, { ...request, answer: "line" }),
    ).toMatchObject({
      accepted: false,
      result: "blocked",
      corrected: false,
      retry: false,
      feedback: { blockedReason: "Too broad for this card." },
    });
    const correct = { ...request, answer: "single stroke" };
    const response = await service.submitCorrection(started.session.id, user, correct);
    expect(response).toMatchObject({
      accepted: true,
      corrected: true,
      alreadyCorrected: false,
      retry: false,
      progress: {
        correctedCardIds: [request.cardId],
        original: { totalAnswers: 1, correctAnswers: 0, incorrectAnswers: 1, accuracyPercent: 0 },
      },
    });
    expect(await service.submitCorrection(started.session.id, user, correct)).toMatchObject({
      accepted: true,
      corrected: true,
      alreadyCorrected: true,
    });
    // A second device's stale wrong answer must still receive the authoritative completed state.
    const otherDevice = new ReviewsService(
      repository,
      new FakeOverridesService(repository) as unknown as OverridesService,
    );
    expect(await otherDevice.submitCorrection(started.session.id, user, request)).toMatchObject({
      accepted: false,
      corrected: true,
      alreadyCorrected: true,
      retry: false,
    });
    const finished = await service.finishSession(started.session.id, user);
    expect(finished.summary).toMatchObject({
      totalAnswers: 1,
      correctAnswers: 0,
      incorrectAnswers: 1,
      accuracyPercent: 0,
    });
    expect(await otherDevice.submitCorrection(started.session.id, user, correct)).toMatchObject({
      accepted: true,
      corrected: true,
      alreadyCorrected: true,
    });
    expect((await otherDevice.getActiveSession(user)).session).toBeNull();
    expect(repository.getState("state-due")).toEqual(beforeState);
    expect(repository.recordedAnswers).toEqual(beforeAnswers);
  });

  it("treats an alternative reading as a neutral correction retry without changing the original mistake", async () => {
    const { repository, service } = createHarness();
    const started = await service.startSession(singleCardUser);
    await service.submitAnswer(started.session.id, user, request);
    const before = structuredClone(repository.getState("state-due"));
    const related = {
      validateAnswerForUser: vi.fn().mockResolvedValue({
        ...validateAnswer({ answerKind: "reading", answer: "ひと", acceptedAnswers: ["いち"] }),
        relatedAnswer: "ひと",
      }),
    } as unknown as OverridesService;
    const corrections = new ReviewsService(repository, related);
    expect(
      await corrections.submitCorrection(started.session.id, user, { ...request, answer: "ひと" }),
    ).toMatchObject({
      accepted: false,
      corrected: false,
      retry: true,
      feedback: { diagnostic: { kind: "alternative-reading", matchedAnswer: "ひと" } },
      progress: { correctedCardIds: [], original: { totalAnswers: 1, incorrectAnswers: 1 } },
    });
    expect(repository.recordedAnswers).toHaveLength(1);
    expect(repository.getState("state-due")).toEqual(before);
  });

  it.each(["revealRequested", "manualIgnore"] as const)(
    "requires corrections for reveal but not ignored originals (%s)",
    async (flag) => {
      const { service } = createHarness();
      const started = await service.startSession(singleCardUser);
      await service.submitAnswer(started.session.id, user, { ...request, [flag]: true });
      const active = await service.getActiveSession(user);
      if (flag === "revealRequested") {
        expect(active.corrections.map((item) => item.card.id)).toEqual([request.cardId]);
        await expect(service.finishSession(started.session.id, user)).rejects.toBeInstanceOf(
          ConflictException,
        );
        await service.submitCorrection(started.session.id, user, {
          ...request,
          answer: "study answer",
        });
      } else {
        expect(active.corrections).toEqual([]);
        expect(active.progress?.original.ignoredAnswers).toBe(1);
        await expect(
          service.submitCorrection(started.session.id, user, {
            ...request,
            answer: "study answer",
          }),
        ).rejects.toBeInstanceOf(NotFoundException);
      }
      await expect(service.finishSession(started.session.id, user)).resolves.toBeDefined();
    },
  );

  it("rejects foreign owners, cross-session originals, non-missed cards and wrong answer types", async () => {
    const { repository, service } = createHarness();
    const started = await service.startSession(user);
    await service.submitAnswer(started.session.id, user, request);
    await service.submitAnswer(started.session.id, user, {
      cardId: "card-late",
      answer: "late answer",
      answerType: "meaning",
    });
    const legacy = await repository.createReviewSession(user.id, NOW);
    for (const [sessionId, caller, body] of [
      [started.session.id, createUser("other"), request],
      [legacy.id, user, request],
      [started.session.id, user, { ...request, cardId: "card-late" }],
      [started.session.id, user, { ...request, cardId: "card-future" }],
    ] as const) {
      await expect(service.submitCorrection(sessionId, caller, body)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    }
    await expect(
      service.submitCorrection(started.session.id, user, { ...request, answerType: "reading" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.recordedAnswers).toHaveLength(2);
  });

  it("does not report correction success when its persistence CAS fails", async () => {
    const { repository, service } = createHarness();
    const started = await service.startSession(singleCardUser);
    await service.submitAnswer(started.session.id, user, request);
    vi.spyOn(repository, "recordReviewCorrection").mockRejectedValueOnce(
      new ConflictException("stale snapshot"),
    );
    await expect(
      service.submitCorrection(started.session.id, user, { ...request, answer: "study answer" }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.getActiveSession(user)).corrections.map((item) => item.card.id)).toEqual([
      request.cardId,
    ]);
    expect(repository.recordedAnswers).toHaveLength(1);
  });

  it("reuses reading normalization and requires listening playback before accepting corrections", async () => {
    const { repository, service } = createHarness();
    const card = repository.getCard(request.cardId);
    Object.assign(card, {
      answerType: "reading",
      promptType: "reading",
      blockedAnswers: [],
      acceptedAnswers: [
        { locale: "ja-JP", text: "がく", normalizedText: "がく", answerKind: "reading" },
      ],
    });
    const started = await service.startSession(singleCardUser);
    const readingRequest = { ...request, answer: "ちがう", answerType: "reading" };
    await service.submitAnswer(started.session.id, user, readingRequest);
    const before = structuredClone(repository.getState("state-due"));
    Object.assign(card, { promptType: "listening" });
    await expect(
      service.submitCorrection(started.session.id, user, { ...readingRequest, answer: "ガク" }),
    ).rejects.toBeInstanceOf(BadRequestException);
    Object.assign(card, { promptType: "reading" });
    expect(
      await service.submitCorrection(started.session.id, user, {
        ...readingRequest,
        answer: "ガク",
      }),
    ).toMatchObject({
      accepted: true,
      corrected: true,
      normalizedAnswer: "がく",
    });
    expect(repository.recordedAnswers).toHaveLength(1);
    expect(repository.getState("state-due")).toEqual(before);
  });

  it("preserves legacy finish behavior and excludes legacy sessions from resumable active state", async () => {
    const { repository, service } = createHarness();
    const legacy = await repository.createReviewSession(user.id, NOW);
    await service.submitAnswer(legacy.id, user, request);
    expect((await service.getActiveSession(user)).session).toBeNull();
    expect((await service.finishSession(legacy.id, user)).summary).toMatchObject({
      totalAnswers: 1,
      incorrectAnswers: 1,
    });
  });
});

describe("PrismaReviewsRepository course progress events", () => {
  it("records every newly unlocked item and the completed level in the answer transaction", async () => {
    const userUnlockEvent = { createMany: vi.fn().mockResolvedValue({ count: 2 }) };
    const userCourseLevelCompletion = {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
    };
    const tx = {
      reviewSession: {
        findFirst: vi.fn().mockResolvedValue({ id: "session-1" }),
      },
      reviewAnswer: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "answer-1" }),
      },
      userSrsState: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningCard: {
        findUnique: vi.fn().mockResolvedValue({
          learningItemId: "kanji-one",
          learningItem: { kind: "KANJI" },
        }),
      },
      dependency: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            createUnlockedDependencyRow("word-one"),
            createUnlockedDependencyRow("word-first"),
          ]),
      },
      courseLevel: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "level-1",
            passPolicyJson: {
              version: 1,
              itemKind: "KANJI",
              passStageIndex: 5,
              requiredPercentage: 100,
            },
            items: [
              {
                learningItem: {
                  kind: "KANJI",
                  cards: [{ id: "card-meaning", srsStates: [{ stageIndex: 5 }] }],
                },
              },
            ],
          },
        ]),
      },
      userUnlockEvent,
      userCourseLevelCompletion,
    };
    const repository = new PrismaReviewsRepository({
      db: {
        $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
          callback(tx),
        ),
      },
    } as never);

    await repository.recordReviewAnswer(createRecordReviewAnswerInput());

    expect(userUnlockEvent.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "owner",
          learningItemId: "word-one",
          reviewSessionId: "session-1",
          triggerLearningCardId: "card-meaning",
          unlockedAt: NOW,
        },
        {
          userId: "owner",
          learningItemId: "word-first",
          reviewSessionId: "session-1",
          triggerLearningCardId: "card-meaning",
          unlockedAt: NOW,
        },
      ],
      skipDuplicates: true,
    });
    expect(userCourseLevelCompletion.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "owner",
          courseLevelId: "level-1",
          reviewSessionId: "session-1",
          policyVersion: 1,
          completedAt: NOW,
        },
      ],
      skipDuplicates: true,
    });
  });

  it("does not call a dependency newly unlocked when it was already satisfied", async () => {
    const userUnlockEvent = { createMany: vi.fn() };
    const tx = {
      reviewSession: {
        findFirst: vi.fn().mockResolvedValue({ id: "session-1" }),
      },
      reviewAnswer: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: "answer-1" }),
      },
      userSrsState: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      learningCard: {
        findUnique: vi.fn().mockResolvedValue({
          learningItemId: "kanji-one",
          learningItem: { kind: "KANJI" },
        }),
      },
      dependency: {
        findMany: vi.fn().mockResolvedValue([createUnlockedDependencyRow("word-one")]),
      },
      courseLevel: { findMany: vi.fn().mockResolvedValue([]) },
      userUnlockEvent,
      userCourseLevelCompletion: { createMany: vi.fn() },
    };
    const repository = new PrismaReviewsRepository({
      db: {
        $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<void>) =>
          callback(tx),
        ),
      },
    } as never);

    await repository.recordReviewAnswer(
      createRecordReviewAnswerInput({
        previousStageIndex: 5,
        nextStageIndex: 6,
      }),
    );

    expect(userUnlockEvent.createMany).not.toHaveBeenCalled();
  });
});

class InMemoryReviewsRepository extends ReviewsRepository {
  async listPracticeHistory(userId: string, source: PracticeSource) {
    return [...this.practiceSessions.values()]
      .filter(
        (session) =>
          session.userId === userId && session.source === source && session.finishedAt !== null,
      )
      .slice(-20)
      .reverse();
  }
  readonly recordedAnswers: RecordReviewAnswerInput[] = [];
  private readonly cards = createCards();
  private readonly states = new Map<string, ReviewQueueRecord>(
    createQueueRecords(this.cards).map((record) => [record.state.id, record]),
  );
  private readonly sessions = new Map<string, ReviewSessionRecord>();
  private readonly practiceSessions = new Map<string, PracticeSessionRecord>();
  private readonly answeredSessionCards = new Set<string>();
  private nextSessionId = 1;

  async listDueReviewCards(
    userId: string,
    now: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]> {
    return [...this.states.values()]
      .filter(
        (record) =>
          record.state.userId === userId &&
          record.state.burnedAt === null &&
          record.state.availableAt !== null &&
          record.state.availableAt.getTime() <= now.getTime(),
      )
      .slice(0, limit);
  }

  async listPracticeCards(
    userId: string,
    source: "recent-lessons" | "recent-mistakes" | "burned",
    _since: Date,
    limit: number,
  ): Promise<readonly ReviewQueueRecord[]> {
    const records = [...this.states.values()].filter((record) => record.state.userId === userId);
    const selected =
      source === "burned"
        ? records.filter((record) => record.state.burnedAt !== null)
        : source === "recent-mistakes"
          ? records.filter((record) => record.card.id === "card-late")
          : records.filter((record) => record.state.burnedAt === null);

    return selected.slice(0, limit);
  }

  async findPracticeCard(userId: string, cardId: string): Promise<ReviewQueueRecord | null> {
    return (
      [...this.states.values()].find(
        (record) => record.state.userId === userId && record.card.id === cardId,
      ) ?? null
    );
  }

  async findPublicPracticeCard(cardId: string) {
    return this.cards.get(cardId) ?? null;
  }

  async listPublicPracticeCardsByIds(cardIds: readonly string[]) {
    return cardIds.flatMap((cardId) => {
      const card = this.cards.get(cardId);
      return card === undefined ? [] : [card];
    });
  }

  async listPracticeCardsByIds(
    userId: string,
    cardIds: readonly string[],
  ): Promise<readonly ReviewQueueRecord[]> {
    const byCardId = new Map(
      [...this.states.values()]
        .filter((record) => record.state.userId === userId)
        .map((record) => [record.card.id, record]),
    );

    return cardIds.flatMap((cardId) => {
      const record = byCardId.get(cardId);
      return record === undefined ? [] : [record];
    });
  }

  async findActivePracticeSession(
    userId: string,
    source: PracticeSessionRecord["source"],
    contextId?: string,
  ): Promise<PracticeSessionRecord | null> {
    return (
      [...this.practiceSessions.values()].find(
        (session) =>
          session.userId === userId &&
          session.source === source &&
          (contextId === undefined || session.contextId === contextId) &&
          session.finishedAt === null,
      ) ?? null
    );
  }

  async findPracticeSession(
    userId: string,
    sessionId: string,
  ): Promise<PracticeSessionRecord | null> {
    const session = this.practiceSessions.get(sessionId);

    return session?.userId === userId && session.finishedAt === null ? session : null;
  }

  async createPracticeSession(input: CreatePracticeSessionInput): Promise<PracticeSessionRecord> {
    const session: PracticeSessionRecord = {
      id: `practice-session-${this.nextSessionId++}`,
      userId: input.userId,
      startedAt: input.now,
      finishedAt: null,
      source: input.source,
      contextId: input.contextId ?? null,
      cardIds: input.cardIds,
      currentIndex: 0,
      progress: { answered: 0, accepted: 0, missed: 0 },
    };

    this.practiceSessions.set(session.id, session);
    return session;
  }

  async updatePracticeSessionProgress(
    input: UpdatePracticeSessionProgressInput,
  ): Promise<PracticeSessionRecord | null> {
    const session = await this.findPracticeSession(input.userId, input.sessionId);

    if (session === null) {
      return null;
    }

    const updated = {
      ...session,
      currentIndex: input.currentIndex,
      progress: input.progress,
    };
    this.practiceSessions.set(session.id, updated);
    return updated;
  }

  async finishPracticeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<PracticeSessionRecord | null> {
    const session = await this.findPracticeSession(userId, sessionId);

    if (session === null || session.currentIndex < session.cardIds.length) {
      return null;
    }

    const finished = { ...session, finishedAt: now };
    this.practiceSessions.set(session.id, finished);
    return finished;
  }

  async abandonPracticeSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<PracticeSessionRecord | null> {
    const session = await this.findPracticeSession(userId, sessionId);

    if (session === null) {
      return null;
    }

    const finished = { ...session, finishedAt: now };
    this.practiceSessions.set(session.id, finished);
    return finished;
  }

  async createReviewSession(userId: string, now: Date): Promise<ReviewSessionRecord> {
    const session: ReviewSessionRecord = {
      id: `session-${this.nextSessionId++}`,
      userId,
      startedAt: now,
      finishedAt: null,
      mode: "review",
    };

    this.sessions.set(session.id, session);

    return session;
  }

  async startScheduledReviewSession(userId: string, now: Date, cardIds: readonly string[]) {
    const active = await this.findActiveReviewSession(userId);
    if (active) return { ...active, resumed: true };
    const reviewState = createScheduledReviewState(cardIds);
    if (cardIds.length === 0)
      throw new BadRequestException("Сейчас нет карточек для планового повторения.");
    const due = await this.listDueReviewCards(userId, now, 100);
    if (cardIds.some((id) => !due.some((entry) => entry.card.id === id)))
      throw new ConflictException("Queue changed.");
    const created = await this.createReviewSession(userId, now);
    const session = { ...created, reviewState };
    this.sessions.set(session.id, session);
    return { session, answers: [], resumed: false };
  }

  async findActiveReviewSession(userId: string): Promise<ReviewSessionProgressRecord | null> {
    const session = [...this.sessions.values()]
      .reverse()
      .find(
        (candidate) =>
          candidate.userId === userId &&
          candidate.mode === "review" &&
          candidate.finishedAt === null &&
          candidate.reviewState,
      );
    return session ? this.progressFor(session) : null;
  }

  async findReviewSessionProgress(
    userId: string,
    sessionId: string,
  ): Promise<ReviewSessionProgressRecord | null> {
    const session = this.sessions.get(sessionId);
    return session?.userId === userId && session.mode === "review"
      ? this.progressFor(session)
      : null;
  }

  async recordReviewCorrection(
    input: RecordReviewCorrectionInput,
  ): Promise<ReviewSessionProgressRecord> {
    const record = await this.findReviewSessionProgress(input.userId, input.sessionId);
    const state = record?.session.reviewState;
    if (
      !record ||
      !state ||
      !state.scheduledCardIds.includes(input.cardId) ||
      !record.answers.some(
        (answer) =>
          answer.cardId === input.cardId &&
          (answer.result === "wrong" || answer.result === "reveal"),
      )
    )
      throw new NotFoundException();
    if (state.correctedCardIds.includes(input.cardId)) return record;
    if (record.session.finishedAt !== null) throw new NotFoundException();
    if (!isDeepStrictEqual(state, input.expectedState)) throw new ConflictException();
    const session = {
      ...record.session,
      reviewState: { ...state, correctedCardIds: [...state.correctedCardIds, input.cardId] },
    };
    this.sessions.set(session.id, session);
    return this.progressFor(session);
  }

  private progressFor(session: ReviewSessionRecord): ReviewSessionProgressRecord {
    return {
      session,
      answers: this.recordedAnswers
        .filter((answer) => answer.sessionId === session.id && answer.userId === session.userId)
        .map((answer) => ({
          cardId: answer.cardId,
          result: answer.recordedResult,
          srsTransition: answer.srsTransition,
        })),
    };
  }

  async findAnswerTarget(
    userId: string,
    sessionId: string,
    cardId: string,
    now: Date,
  ): Promise<ReviewAnswerTargetRecord | null> {
    const session = this.sessions.get(sessionId);
    const record = [...this.states.values()].find(
      (candidate) => candidate.state.userId === userId && candidate.card.id === cardId,
    );

    if (
      session === undefined ||
      session.userId !== userId ||
      session.mode !== "review" ||
      session.finishedAt !== null
    ) {
      return null;
    }

    if (session.reviewState && !session.reviewState.scheduledCardIds.includes(cardId)) return null;

    if (record === undefined) {
      return null;
    }

    if (
      record.state.burnedAt !== null ||
      record.state.availableAt === null ||
      record.state.availableAt.getTime() > now.getTime()
    ) {
      return null;
    }

    if (
      this.answeredSessionCards.has(getAnsweredSessionCardKey(sessionId, record.state.id, cardId))
    ) {
      return null;
    }

    return { ...record, session };
  }

  async recordReviewAnswer(input: RecordReviewAnswerInput): Promise<void> {
    const session = this.sessions.get(input.sessionId);
    if (
      !session ||
      session.userId !== input.userId ||
      session.mode !== "review" ||
      session.finishedAt !== null ||
      (session.reviewState && !session.reviewState.scheduledCardIds.includes(input.cardId))
    )
      throw new NotFoundException();
    if (
      this.answeredSessionCards.has(
        getAnsweredSessionCardKey(input.sessionId, input.stateId, input.cardId),
      )
    )
      throw new ConflictException();
    const record = this.states.get(input.stateId);

    if (record === undefined) {
      throw new Error(`Unknown state ${input.stateId}.`);
    }
    if (
      record.state.userId !== input.userId ||
      record.card.id !== input.cardId ||
      !isDeepStrictEqual(record.state, input.expectedState)
    )
      throw new ConflictException();
    this.recordedAnswers.push(input);
    this.answeredSessionCards.add(
      getAnsweredSessionCardKey(input.sessionId, input.stateId, input.cardId),
    );

    this.states.set(input.stateId, {
      ...record,
      state: {
        ...record.state,
        stageIndex: input.nextState.stageIndex,
        availableAt: input.nextState.availableAt,
        burnedAt: input.nextState.burnedAt,
        resurrectedAt: input.nextState.resurrectedAt,
        wrongCount: input.nextState.wrongCount,
        correctStreak: input.nextState.correctStreak,
        lastReviewedAt: input.nextState.lastReviewedAt,
      },
    });
  }

  async finishReviewSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<FinishedReviewSessionRecord | null> {
    const session = this.sessions.get(sessionId);

    if (
      session === undefined ||
      session.userId !== userId ||
      session.mode !== "review" ||
      session.finishedAt !== null
    ) {
      return null;
    }

    if (session.reviewState) {
      const pending = getPendingReviewCardIds(
        session.reviewState,
        this.progressFor(session).answers,
      );
      if (pending.scheduled.length || pending.corrections.length) throw new ConflictException();
    }
    const finished = { ...session, finishedAt: now };
    this.sessions.set(sessionId, finished);

    return {
      session: finished,
      summary: buildReviewSessionSummary({
        answers: this.recordedAnswers
          .filter((answer) => answer.userId === userId && answer.sessionId === sessionId)
          .map((answer) => ({
            result: answer.recordedResult,
            srsTransition: answer.srsTransition,
          })),
        startedAt: session.startedAt,
        finishedAt: now,
      }),
    };
  }

  getState(stateId: string) {
    const record = this.states.get(stateId);

    if (record === undefined) {
      throw new Error(`Unknown state ${stateId}.`);
    }

    return record.state;
  }

  getCard(cardId: string) {
    const card = this.cards.get(cardId);

    if (card === undefined) {
      throw new Error(`Unknown card ${cardId}.`);
    }

    return card;
  }
}

class FakeOverridesService {
  constructor(private readonly repository: InMemoryReviewsRepository) {}

  async validateAnswerForUser(input: {
    readonly userId: string;
    readonly cardId: string;
    readonly answerKind: AnswerKind;
    readonly answer: string;
  }) {
    const card = this.repository.getCard(input.cardId);

    return validateAnswer({
      answerKind: input.answerKind,
      answer: input.answer,
      acceptedAnswers: card.acceptedAnswers.map((answer) => answer.text),
      blockedAnswers: card.blockedAnswers.map((answer) => answer.text),
      userAcceptedAnswers:
        input.userId === "owner" && input.cardId === "card-meaning" ? ["single stroke"] : [],
    });
  }
}

function createHarness(overridesService?: OverridesService): {
  readonly repository: InMemoryReviewsRepository;
  readonly service: ReviewsService;
} {
  const repository = new InMemoryReviewsRepository();
  const activeOverridesService =
    overridesService ?? (new FakeOverridesService(repository) as unknown as OverridesService);

  return {
    repository,
    service: new ReviewsService(repository, activeOverridesService),
  };
}

function createCards(): Map<string, ReviewQueueRecord["card"]> {
  const base = {
    learningItemId: "item-kanji",
    itemType: "kanji" as const,
    cardType: "review" as const,
    promptType: "meaning" as const,
    answerType: "meaning" as const,
    sortOrder: 1,
    target: {
      id: "item-kanji",
      itemType: "kanji" as const,
      japanese: "学",
      reading: "がく",
      level: 1,
      jlptLevel: "N5",
    },
    blockedAnswers: [
      {
        locale: "en-US" as const,
        text: "line",
        normalizedText: "line",
        reason: "Too broad for this card.",
      },
    ],
  };

  return new Map([
    [
      "card-meaning",
      {
        ...base,
        id: "card-meaning",
        target: {
          ...base.target,
          level: 2,
        },
        acceptedAnswers: [
          {
            locale: "en-US",
            text: "study answer",
            normalizedText: "study answer",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
      },
    ],
    [
      "card-late",
      {
        ...base,
        id: "card-late",
        learningItemId: "item-kanji-late",
        target: {
          ...base.target,
          id: "item-kanji-late",
          level: 1,
        },
        acceptedAnswers: [
          {
            locale: "en-US",
            text: "late answer",
            normalizedText: "late answer",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
        blockedAnswers: [],
      },
    ],
    [
      "card-future",
      {
        ...base,
        id: "card-future",
        acceptedAnswers: [],
        blockedAnswers: [],
      },
    ],
    [
      "card-burned",
      {
        ...base,
        id: "card-burned",
        acceptedAnswers: [
          {
            locale: "en-US",
            text: "burned answer",
            normalizedText: "burned answer",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
        blockedAnswers: [],
      },
    ],
  ]);
}

function createQueueRecords(
  cards: Map<string, ReviewQueueRecord["card"]>,
): readonly ReviewQueueRecord[] {
  return [
    createQueueRecord("state-due", "owner", cards.get("card-meaning"), 1, DUE_AT),
    createQueueRecord("state-late", "owner", cards.get("card-late"), 5, DUE_AT),
    createQueueRecord("state-future", "owner", cards.get("card-future"), 1, FUTURE_AT),
    createQueueRecord("state-burned", "owner", cards.get("card-burned"), 9, null, NOW),
  ];
}

function createQueueRecord(
  stateId: string,
  userId: string,
  card: ReviewQueueRecord["card"] | undefined,
  stageIndex: number,
  availableAt: Date | null,
  burnedAt: Date | null = null,
): ReviewQueueRecord {
  if (card === undefined) {
    throw new Error(`Missing test card for ${stateId}.`);
  }

  return {
    state: {
      id: stateId,
      userId,
      learningCardId: card.id,
      srsSystemId: "srs-default",
      stageIndex,
      availableAt,
      burnedAt,
      resurrectedAt: null,
      wrongCount: 0,
      correctStreak: 0,
      lastReviewedAt: null,
    },
    card,
    stages: DEFAULT_SRS_STAGES as readonly SrsStage[],
  };
}

function getAnsweredSessionCardKey(sessionId: string, stateId: string, cardId: string): string {
  return `${sessionId}:${stateId}:${cardId}`;
}

function createUnlockedDependencyRow(learningItemId: string) {
  return {
    learningItem: {
      id: learningItemId,
      cards: [{ id: `card-${learningItemId}`, srsStates: [] }],
      dependencies: [
        {
          requiredStage: 5,
          prerequisiteItem: {
            cards: [{ id: "card-meaning", srsStates: [{ stageIndex: 5 }] }],
          },
        },
      ],
    },
  };
}

function createRecordReviewAnswerInput(
  overrides: Partial<RecordReviewAnswerInput> = {},
): RecordReviewAnswerInput {
  const previousStageIndex = overrides.previousStageIndex ?? 4;
  const nextStageIndex = overrides.nextStageIndex ?? 5;

  return {
    userId: "owner",
    sessionId: "session-1",
    stateId: "state-due",
    cardId: "card-meaning",
    answerText: "study answer",
    normalizedAnswer: "study answer",
    answeredAt: NOW,
    recordedResult: "correct",
    responseResult: "correct",
    previousStageIndex,
    nextStageIndex,
    srsTransition: "advanced",
    expectedState: {
      srsSystemId: "srs-default",
      stageIndex: previousStageIndex,
      availableAt: DUE_AT,
      burnedAt: null,
      resurrectedAt: null,
      wrongCount: 0,
      correctStreak: 0,
      lastReviewedAt: null,
    },
    nextState: {
      stageIndex: nextStageIndex,
      availableAt: FUTURE_AT,
      burnedAt: null,
      resurrectedAt: null,
      wrongCount: 0,
      correctStreak: 1,
      lastReviewedAt: NOW,
    },
    details: {},
    ...overrides,
  };
}

function createUser(
  id: string,
  settings: Partial<CurrentUserDto["settings"]> = {},
): CurrentUserDto {
  return {
    id,
    email: `${id}@example.test`,
    displayName: id,
    role: "USER",
    settings: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 20,
      reviewOrderMode: "shuffled",
      strictMode: false,
      ...settings,
    },
  };
}
