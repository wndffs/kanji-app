import { describe, expect, it } from "vitest";

import { validateAnswer, type AnswerKind } from "@kanji-srs/japanese";
import { DEFAULT_SRS_STAGES, type SrsStage } from "@kanji-srs/srs";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { type OverridesService } from "../src/overrides/overrides.service";
import { ReviewsRepository } from "../src/reviews/reviews.repository";
import { ReviewsService } from "../src/reviews/reviews.service";
import {
  type RecordReviewAnswerInput,
  type ReviewAnswerTargetRecord,
  type ReviewQueueRecord,
  type ReviewSessionRecord,
} from "../src/reviews/reviews.types";

const NOW = new Date("2026-06-18T09:00:00.000Z");
const DUE_AT = new Date("2026-06-17T09:00:00.000Z");
const FUTURE_AT = new Date("2999-01-01T09:00:00.000Z");

describe("ReviewsService", () => {
  it("returns due cards only without exposing answers", async () => {
    const { service } = createHarness();
    const queue = await service.getQueue(createUser("owner"));
    const cardIds = queue.items.map((item) => item.card.id);
    const serializedQueue = JSON.stringify(queue);

    expect(cardIds).toEqual(["card-meaning", "card-late"]);
    expect(cardIds).not.toContain("card-future");
    expect(cardIds).not.toContain("card-burned");
    expect(queue.items[0]?.card).not.toHaveProperty("acceptedAnswers");
    expect(queue.items[0]?.card).not.toHaveProperty("blockedAnswers");
    expect(serializedQueue).not.toContain("study answer");
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
    });
    expect(repository.getState("state-due").stageIndex).toBe(2);
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
    });
    expect(repository.getState("state-late")).toMatchObject({
      stageIndex: 3,
      wrongCount: 1,
      correctStreak: 0,
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
});

class InMemoryReviewsRepository extends ReviewsRepository {
  readonly recordedAnswers: RecordReviewAnswerInput[] = [];
  private readonly cards = createCards();
  private readonly states = new Map<string, ReviewQueueRecord>(
    createQueueRecords(this.cards).map((record) => [record.state.id, record]),
  );
  private readonly sessions = new Map<string, ReviewSessionRecord>();
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

  async findAnswerTarget(
    userId: string,
    sessionId: string,
    cardId: string,
  ): Promise<ReviewAnswerTargetRecord | null> {
    const session = this.sessions.get(sessionId);
    const record = [...this.states.values()].find(
      (candidate) => candidate.state.userId === userId && candidate.card.id === cardId,
    );

    if (session === undefined || session.userId !== userId || session.finishedAt !== null) {
      return null;
    }

    return record === undefined ? null : { ...record, session };
  }

  async recordReviewAnswer(input: RecordReviewAnswerInput): Promise<void> {
    this.recordedAnswers.push(input);

    const record = this.states.get(input.stateId);

    if (record === undefined) {
      throw new Error(`Unknown state ${input.stateId}.`);
    }

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
  ): Promise<ReviewSessionRecord | null> {
    const session = this.sessions.get(sessionId);

    if (session === undefined || session.userId !== userId || session.finishedAt !== null) {
      return null;
    }

    const finished = { ...session, finishedAt: now };
    this.sessions.set(sessionId, finished);

    return finished;
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

function createHarness(): {
  readonly repository: InMemoryReviewsRepository;
  readonly service: ReviewsService;
} {
  const repository = new InMemoryReviewsRepository();
  const overridesService = new FakeOverridesService(repository) as unknown as OverridesService;

  return {
    repository,
    service: new ReviewsService(repository, overridesService),
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
        acceptedAnswers: [],
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
      strictMode: false,
      ...settings,
    },
  };
}
