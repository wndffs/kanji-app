import { describe, expect, it, vi } from "vitest";

import { type CurrentUserDto } from "../src/auth/auth.types";
import type { ConfusablesRepository } from "../src/confusables/confusables.repository";
import { ConfusablesService } from "../src/confusables/confusables.service";
import {
  type ConfusableComparisonRecord,
  type ConfusablePairRecord,
} from "../src/confusables/confusables.types";
import { type OverridesService } from "../src/overrides/overrides.service";
import type { ReviewsRepository } from "../src/reviews/reviews.repository";
import { type PracticeSessionRecord, type ReviewCardRecord } from "../src/reviews/reviews.types";

const NOW = new Date("2026-07-20T12:00:00.000Z");

describe("ConfusablesService", () => {
  it("ranks recent errors before relation strength across visual and semantic pairs", async () => {
    const { service } = createHarness();

    const result = await service.listPairs(createUser());

    expect(result.pairs.map((pair) => pair.id)).toEqual(["pair-visual", "pair-semantic"]);
    expect(result.pairs[0]?.kinds).toEqual(["visual"]);
    expect(result.pairs[1]?.kinds).toEqual(["semantic"]);
  });

  it("rejects a missing or unpublished relation", async () => {
    const { service } = createHarness();

    await expect(service.getActiveSession(createUser(), "missing")).rejects.toThrow(
      "Опубликованная пара кандзи не найдена.",
    );
  });

  it("uses the shared validator for a private answer and reveals comparison only afterward", async () => {
    const { overridesService, service } = createHarness();
    const started = await service.startSession(createUser(), "pair-visual");

    expect(started).not.toHaveProperty("comparison");
    const result = await service.submitAnswer(createUser(), started.session.id, {
      cardId: "card-one-meaning",
      answer: "мой вариант",
      answerType: "meaning",
    });

    expect(overridesService.validateAnswerForUser).toHaveBeenCalledWith({
      userId: "user-1",
      cardId: "card-one-meaning",
      answerKind: "meaning",
      answer: "мой вариант",
    });
    expect(result.answer).toMatchObject({ accepted: true, result: "correct" });
    expect(result.comparison.kanji.map((kanji) => kanji.character)).toEqual(["一", "二"]);
    expect(result.comparison.explanation.primaryRu).toBe("У второго кандзи две черты.");
  });

  it("resumes the active pair session instead of creating another one", async () => {
    const { reviewsRepository, service } = createHarness();

    const first = await service.startSession(createUser(), "pair-visual");
    const resumed = await service.startSession(createUser(), "pair-visual");

    expect(resumed.session.id).toBe(first.session.id);
    expect(reviewsRepository.createPracticeSession).toHaveBeenCalledTimes(1);
  });

  it("leaves SRS state untouched after both completion and abandonment", async () => {
    const { getSrsSnapshot, service } = createHarness();
    const before = getSrsSnapshot();
    const started = await service.startSession(createUser(), "pair-visual");

    for (const [cardId, answerType] of [
      ["card-one-meaning", "meaning"],
      ["card-one-reading", "reading"],
      ["card-two-meaning", "meaning"],
      ["card-two-reading", "reading"],
    ] as const) {
      await service.submitAnswer(createUser(), started.session.id, {
        cardId,
        answer: "accepted",
        answerType,
      });
    }

    await service.finishSession(createUser(), started.session.id);
    expect(getSrsSnapshot()).toEqual(before);

    const second = await service.startSession(createUser(), "pair-visual");
    await service.abandonSession(createUser(), second.session.id);
    expect(getSrsSnapshot()).toEqual(before);
  });
});

function createHarness() {
  const pairs = [
    createPair("pair-semantic", ["semantic"], 95, 0),
    createPair("pair-visual", ["visual"], 40, 3),
  ];
  const cards = createCards();
  let activeSession: PracticeSessionRecord | null = null;
  let nextSession = 1;
  const srsState = new Map([
    ["state-one", { stageIndex: 3, availableAt: "2026-07-21T12:00:00.000Z" }],
    ["state-two", { stageIndex: 5, availableAt: "2026-07-28T12:00:00.000Z" }],
  ]);
  const confusablesRepository = {
    listPublishedPairs: vi.fn(async () => pairs),
    findPublishedPair: vi.fn(async (id: string) => pairs.find((pair) => pair.id === id) ?? null),
    findComparison: vi.fn(async (id: string) =>
      id === "pair-visual" ? createComparison(pairs[1]!) : null,
    ),
    findKanjiRefByItemId: vi.fn(),
    findPairCardIds: vi.fn(async (id: string) => (id === "pair-visual" ? [...cards.keys()] : null)),
    findPairCardIdsForApproval: vi.fn(),
    listAdminPairs: vi.fn(),
    createPair: vi.fn(),
    updatePair: vi.fn(),
    publishPair: vi.fn(),
  } as unknown as ConfusablesRepository;
  const reviewsRepository = {
    findActivePracticeSession: vi.fn(
      async (_userId: string, _source: string, contextId?: string) =>
        activeSession?.finishedAt === null && activeSession.contextId === contextId
          ? activeSession
          : null,
    ),
    createPracticeSession: vi.fn(
      async (input: {
        readonly userId: string;
        readonly source: PracticeSessionRecord["source"];
        readonly contextId?: string | null;
        readonly cardIds: readonly string[];
        readonly now: Date;
      }) => {
        activeSession = {
          id: `session-${nextSession++}`,
          userId: input.userId,
          startedAt: input.now,
          finishedAt: null,
          source: input.source,
          contextId: input.contextId ?? null,
          cardIds: input.cardIds,
          currentIndex: 0,
          progress: { answered: 0, accepted: 0, missed: 0 },
        };
        return activeSession;
      },
    ),
    findPracticeSession: vi.fn(async (_userId: string, id: string) =>
      activeSession?.id === id && activeSession.finishedAt === null ? activeSession : null,
    ),
    findPublicPracticeCard: vi.fn(async (id: string) => cards.get(id) ?? null),
    listPublicPracticeCardsByIds: vi.fn(async (ids: readonly string[]) =>
      ids.flatMap((id) => {
        const card = cards.get(id);
        return card === undefined ? [] : [card];
      }),
    ),
    updatePracticeSessionProgress: vi.fn(
      async (input: {
        readonly sessionId: string;
        readonly currentIndex: number;
        readonly progress: PracticeSessionRecord["progress"];
      }) => {
        if (activeSession === null || activeSession.id !== input.sessionId) return null;
        activeSession = {
          ...activeSession,
          currentIndex: input.currentIndex,
          progress: input.progress,
        };
        return activeSession;
      },
    ),
    finishPracticeSession: vi.fn(async (_userId: string, id: string, now: Date) => {
      if (
        activeSession === null ||
        activeSession.id !== id ||
        activeSession.currentIndex < activeSession.cardIds.length
      )
        return null;
      activeSession = { ...activeSession, finishedAt: now };
      return activeSession;
    }),
    abandonPracticeSession: vi.fn(async (_userId: string, id: string, now: Date) => {
      if (activeSession === null || activeSession.id !== id) return null;
      activeSession = { ...activeSession, finishedAt: now };
      return activeSession;
    }),
  } as unknown as ReviewsRepository;
  const overridesService = {
    validateAnswerForUser: vi.fn(async (input: { readonly answer: string }) => ({
      accepted: true,
      result: "correct" as const,
      normalizedAnswer: input.answer,
      matchedAnswer: input.answer === "мой вариант" ? "мой вариант" : "accepted",
      relatedAnswer: null,
    })),
  } as unknown as OverridesService;

  return {
    confusablesRepository,
    reviewsRepository,
    overridesService,
    service: new ConfusablesService(confusablesRepository, reviewsRepository, overridesService),
    getSrsSnapshot: () => structuredClone([...srsState.entries()]),
  };
}

function createPair(
  id: string,
  kinds: ConfusablePairRecord["kinds"],
  strength: number,
  recentWrongCount: number,
): ConfusablePairRecord {
  return {
    id,
    kinds,
    strength,
    recentWrongCount,
    kanji: [
      { kanjiId: "kanji-one", itemId: "item-one", character: "一", level: 1, jlptLevel: "N5" },
      { kanjiId: "kanji-two", itemId: "item-two", character: "二", level: 1, jlptLevel: "N5" },
    ],
    explanationRu: "У второго кандзи две черты.",
    explanationEn: "The second kanji has two strokes.",
    sourceNote: "Project-authored distinction verified against KANJIDIC2 metadata.",
    status: "published",
    createdByUserId: "admin-1",
    approvedByUserId: "admin-2",
    approvedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function createComparison(pair: ConfusablePairRecord): ConfusableComparisonRecord {
  const related = (id: string, japanese: string) => ({
    id,
    japanese,
    reading: null,
    translations: {
      ru: [{ locale: "ru-RU" as const, text: "число", sourceKind: "curated" as const }],
      en: [{ locale: "en-US" as const, text: "number", sourceKind: "curated" as const }],
    },
  });

  return {
    pair,
    kanji: [
      {
        ...pair.kanji[0],
        meanings: {
          ru: [{ locale: "ru-RU", text: "один" }],
          en: [{ locale: "en-US", text: "one" }],
        },
        readings: ["いち"],
        components: [related("component-one", "一")],
        vocabulary: [related("word-one", "一つ")],
      },
      {
        ...pair.kanji[1],
        meanings: {
          ru: [{ locale: "ru-RU", text: "два" }],
          en: [{ locale: "en-US", text: "two" }],
        },
        readings: ["に"],
        components: [related("component-two", "二")],
        vocabulary: [related("word-two", "二つ")],
      },
    ],
  };
}

function createCards(): Map<string, ReviewCardRecord> {
  const card = (
    id: string,
    itemId: string,
    japanese: string,
    answerType: "meaning" | "reading",
  ): ReviewCardRecord => ({
    id,
    learningItemId: itemId,
    itemType: "kanji",
    cardType: "review",
    promptType: answerType,
    answerType,
    sortOrder: answerType === "meaning" ? 1 : 2,
    target: { id: itemId, itemType: "kanji", japanese, reading: null, level: 1, jlptLevel: "N5" },
    acceptedAnswers: [
      {
        locale: answerType === "reading" ? "en-US" : "ru-RU",
        text: "accepted",
        normalizedText: "accepted",
        answerKind: answerType,
        isPrimary: true,
      },
    ],
    blockedAnswers: [],
  });

  return new Map([
    ["card-one-meaning", card("card-one-meaning", "item-one", "一", "meaning")],
    ["card-one-reading", card("card-one-reading", "item-one", "一", "reading")],
    ["card-two-meaning", card("card-two-meaning", "item-two", "二", "meaning")],
    ["card-two-reading", card("card-two-reading", "item-two", "二", "reading")],
  ]);
}

function createUser(): CurrentUserDto {
  return {
    id: "user-1",
    email: "user@example.test",
    displayName: "User",
    role: "USER",
    settings: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 20,
      strictMode: false,
    },
  };
}
