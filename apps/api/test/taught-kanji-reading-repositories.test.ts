import { describe, expect, it, vi } from "vitest";

import { primaryTaughtReadingCards } from "@kanji-srs/db";

import { PrismaCharactersRepository } from "../src/characters/characters.repository";
import { PrismaDashboardRepository } from "../src/dashboard/dashboard.repository";
import { PrismaDecksRepository } from "../src/decks/decks.repository";

const NOW = new Date("2026-10-22T09:00:00.000Z");
const RAW_READINGS = [
  { reading: "ユウ", priority: 0 },
  { reading: "ビ", priority: 1 },
  { reading: "ひ", priority: 2 },
] as const;
const READING_CASES = [
  { name: "taught reading", taught: "ひ", readings: RAW_READINGS, expected: "ひ" },
  { name: "dictionary fallback", taught: null, readings: RAW_READINGS, expected: "ユウ" },
  { name: "taught reading without dictionary data", taught: "ひ", readings: [], expected: "ひ" },
  { name: "missing reading", taught: null, readings: [], expected: null },
] as const;
const WORD = {
  id: "word-target",
  expression: "日々",
  reading: "ひび",
  commonnessRank: 100,
  jlptLevel: null,
  senses: [],
};

describe("PrismaCharactersRepository taught kanji readings", () => {
  it.each(READING_CASES)("uses $name without dropping SRS cards", async (testCase) => {
    const item = buildItem(testCase.taught);
    const courseFindUnique = vi.fn().mockResolvedValue({
      id: "course-1",
      titleRu: "Course",
      levels: [
        {
          levelNumber: 1,
          band: "N5",
          passPolicyJson: null,
          completions: [],
          items: [{ sortOrder: 1, learningItem: item }],
        },
      ],
    });
    const kanjiRow = buildKanji(testCase.readings);
    const kanjiFindMany = vi.fn().mockResolvedValue([kanjiRow]);
    const repository = new PrismaCharactersRepository({
      db: {
        userSettings: { findUnique: vi.fn().mockResolvedValue({ currentCourseId: null }) },
        userEnrollment: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { courseId: "course-1", startedAt: NOW, course: { slug: "japanese-ru-n2" } },
            ]),
        },
        course: { findUnique: courseFindUnique },
        kanji: { findMany: kanjiFindMany },
      },
    } as never);

    const result = await repository.findCurrentCourseKanji("user-1");
    const level = result?.levels[0];
    const kanji = level?.kanji[0];

    expect(kanji?.reading).toBe(testCase.expected);
    expect(level).toMatchObject({ policyItemCount: 1, passedPolicyItemCount: 0 });
    expect(kanji?.cards).toEqual(
      item.cards.map((card) => ({
        id: card.id,
        srs: {
          stageIndex: card.srsStates[0]!.stageIndex,
          stageName: "Configured stage",
          burnedAt: card.srsStates[0]!.burnedAt,
          wrongCount: card.srsStates[0]!.wrongCount,
          correctStreak: card.srsStates[0]!.correctStreak,
        },
      })),
    );
    const cardsQuery =
      courseFindUnique.mock.calls[0]?.[0].select.levels.select.items.select.learningItem.select
        .cards;
    expect(cardsQuery).not.toHaveProperty("where");
    expect(cardsQuery).not.toHaveProperty("take");
    expect(cardsQuery.select).toEqual({
      ...primaryTaughtReadingCards.select,
      id: true,
      srsStates: expect.objectContaining({ where: { userId: "user-1" } }),
    });
    expect(cardsQuery.orderBy).toEqual([{ sortOrder: "asc" }, { id: "asc" }]);
    expect(kanjiFindMany.mock.calls[0]?.[0].select.readings.orderBy).toEqual([
      { priority: "asc" },
      { reading: "asc" },
    ]);
    expect(courseFindUnique).toHaveBeenCalledOnce();
    expect(kanjiFindMany).toHaveBeenCalledOnce();
    expect(kanjiRow.readings).toEqual(testCase.readings);
    expectNoPrivateAnswers(result, cardsQuery);
  });
});

describe("PrismaDecksRepository taught kanji readings", () => {
  it.each(READING_CASES)("uses $name in matches, prerequisites and decks", async (testCase) => {
    const harness = buildDeckHarness(buildItem(testCase.taught), buildKanji(testCase.readings));
    const { repository, learningItemFindMany, dependencyFindMany, deckFindFirst } = harness;

    const matches = await repository.findTextMatches({
      sourceText: "日",
      wordCandidates: [],
      kanjiCharacters: ["日"],
    });
    const prerequisites = await repository.findPrerequisites(["dependent-item"]);
    const deck = await repository.findDeckForOwner("user-1", "deck-1");

    expect(matches[0]?.item.target.reading).toBe(testCase.expected);
    expect(prerequisites[0]?.item.target.reading).toBe(testCase.expected);
    expect(deck?.items[0]?.item.target.reading).toBe(testCase.expected);
    expect(deck).toMatchObject({ itemCount: 1, newItemCount: 0 });
    expect(deck?.items[0]?.isNewForUser).toBe(false);
    expect(learningItemFindMany).toHaveBeenCalledOnce();
    expect(learningItemFindMany.mock.calls[0]?.[0].include).toEqual({
      cards: primaryTaughtReadingCards,
    });
    expect(dependencyFindMany.mock.calls[0]?.[0].include.prerequisiteItem).toEqual({
      include: { cards: primaryTaughtReadingCards },
    });
    expect(deckFindFirst.mock.calls[0]?.[0].include.items.include.learningItem).toEqual({
      include: { cards: primaryTaughtReadingCards },
    });
    expect(harness.kanjiFindMany).toHaveBeenCalledOnce();
    expect(harness.kanjiFindUnique).toHaveBeenCalledTimes(2);
    expect(harness.kanji.readings).toEqual(testCase.readings);
    expectNoPrivateAnswers(
      [matches, prerequisites, deck],
      [learningItemFindMany.mock.calls, dependencyFindMany.mock.calls, deckFindFirst.mock.calls],
    );
  });

  it("preserves deck counts without loading reading answers for list queries", async () => {
    const { repository, deckFindMany } = buildDeckHarness();

    const result = await repository.listDecks("user-1");

    expect(result).toMatchObject([{ itemCount: 1, newItemCount: 0 }]);
    expect(deckFindMany.mock.calls[0]?.[0].include.items.include.learningItem).toBe(true);
  });

  it("keeps dictionary word readings in matches and saved decks", async () => {
    const harness = buildDeckHarness({
      ...buildItem(),
      kind: "WORD",
      targetType: "WORD",
      targetId: WORD.id,
    });
    const matches = await harness.repository.findTextMatches({
      sourceText: WORD.expression,
      wordCandidates: [WORD.expression],
      kanjiCharacters: [],
    });
    const deck = await harness.repository.findDeckForOwner("user-1", "deck-1");

    expect(matches[0]?.item.target.reading).toBe(WORD.reading);
    expect(deck?.items[0]?.item.target.reading).toBe(WORD.reading);
    expect(harness.learningItemFindMany.mock.calls[0]?.[0]).not.toHaveProperty("include");
  });
});

describe("PrismaDashboardRepository taught kanji readings", () => {
  it.each(READING_CASES)("uses $name across all display queries", async (testCase) => {
    const harness = buildDashboardHarness(
      buildItem(testCase.taught),
      buildKanji(testCase.readings),
    );
    const { repository, learningItemFindMany, stateFindMany, reviewAnswerFindMany } = harness;
    const leeches = await repository.listLeechSignals("user-1", NOW);
    const mistakes = await repository.listRecentMistakeItems("user-1", NOW, 5);
    const lessons = await repository.listAvailableLessonItems(["item-1"], 5);
    const burned = await repository.listRecentBurnedItems("user-1", 5);

    for (const records of [leeches, mistakes, lessons, burned]) {
      expect(records).toHaveLength(1);
      expect(records[0]?.item.reading).toBe(testCase.expected);
    }
    expect(leeches[0]).toMatchObject({
      learningCardId: "card-meaning",
      stageIndex: 2,
      wrongCount: 7,
      recentWrongCount: 1,
      stageDropCount: 1,
      stageDropMagnitude: 2,
    });
    expect(mistakes[0]?.srs).toMatchObject({ stageIndex: 2, wrongCount: 7 });
    expect(burned[0]?.srs).toMatchObject({ stageIndex: 2, wrongCount: 7, burnedAt: NOW });
    expect(lessons[0]).toMatchObject({ occurredAt: null, srs: null });
    const itemQueries = [
      stateFindMany.mock.calls[0]?.[0].include.learningCard.select.learningItem,
      reviewAnswerFindMany.mock.calls[0]?.[0].select.userSrsState.select.learningCard.select
        .learningItem,
      { select: learningItemFindMany.mock.calls[0]?.[0].select },
      stateFindMany.mock.calls[1]?.[0].select.learningCard.select.learningItem,
    ];
    for (const query of itemQueries) {
      expect(query).toEqual({
        select: {
          id: true,
          kind: true,
          targetType: true,
          targetId: true,
          levelHint: true,
          cards: primaryTaughtReadingCards,
        },
      });
    }
    expect(learningItemFindMany).toHaveBeenCalledOnce();
    expect(stateFindMany).toHaveBeenCalledTimes(2);
    expect(reviewAnswerFindMany).toHaveBeenCalledOnce();
    expect(harness.kanjiFindUnique).toHaveBeenCalledTimes(4);
    expect(harness.kanji.readings).toEqual(testCase.readings);
    expectNoPrivateAnswers([leeches, mistakes, lessons, burned], itemQueries);
  });

  it("keeps word readings unchanged across dashboard displays", async () => {
    const { repository } = buildDashboardHarness({
      ...buildItem(),
      kind: "WORD",
      targetType: "WORD",
      targetId: WORD.id,
    });
    const results = [
      await repository.listLeechSignals("user-1", NOW),
      await repository.listRecentMistakeItems("user-1", NOW, 5),
      await repository.listAvailableLessonItems(["item-1"], 5),
      await repository.listRecentBurnedItems("user-1", 5),
    ];

    for (const records of results) {
      expect(records[0]?.item.reading).toBe(WORD.reading);
    }
  });
});

function buildItem(taught: string | null = "ひ") {
  const answer = (text: string) => ({
    text,
    locale: "ru-RU",
    answerKind: "READING",
    isPrimary: true,
  });
  const card = (id: string, answerType: string, promptType: string, stageIndex: number) => ({
    id,
    answerType,
    promptType,
    answers: [answer("ignored-reading")],
    userOverrides: [{ text: "private-reading", locale: "ru-RU", overrideType: "ACCEPTED_READING" }],
    srsStates: [
      {
        stageIndex,
        burnedAt: stageIndex === 9 ? NOW : null,
        wrongCount: 7,
        correctStreak: 1,
        srsSystem: { stages: [{ stageIndex, name: "Configured stage" }] },
      },
    ],
  });

  return {
    id: "item-1",
    kind: "KANJI",
    targetType: "KANJI",
    targetId: "kanji-target",
    title: "日",
    levelHint: 1,
    cards: [
      card("card-meaning", "MEANING", "MEANING", 2),
      card("card-listening", "READING", "LISTENING", 9),
      {
        ...card("card-reading", "READING", "READING", 5),
        answers: [
          { ...answer("unsupported-locale"), locale: "fr-FR" },
          { ...answer("not-reading"), answerKind: "MEANING" },
          { ...answer("ビ"), isPrimary: false },
          ...(taught === null ? [] : [answer(taught)]),
        ],
      },
    ],
  };
}

function buildKanji(readings: readonly { readonly reading: string; readonly priority: number }[]) {
  return {
    id: "kanji-target",
    character: "日",
    jlptLevel: null,
    legacyJlptLevel: 4,
    frequencyRank: 10,
    readings: readings.map((reading) => ({ ...reading })),
    meanings: [],
  };
}

function buildDeckHarness(item = buildItem(), kanji = buildKanji(RAW_READINGS)) {
  const learningItemFindMany = vi.fn().mockResolvedValue([item]);
  const dependencyFindMany = vi
    .fn()
    .mockResolvedValue([{ learningItemId: "dependent-item", prerequisiteItem: item }]);
  const deck = {
    id: "deck-1",
    ownerUserId: "user-1",
    title: "Deck",
    sourceText: "日",
    status: "ACTIVE",
    createdAt: NOW,
    updatedAt: NOW,
    items: [{ learningItemId: item.id, sortOrder: 1, reasonJson: [], learningItem: item }],
  };
  const deckFindFirst = vi.fn().mockResolvedValue(deck);
  const deckFindMany = vi.fn().mockResolvedValue([deck]);
  const kanjiFindMany = vi.fn().mockResolvedValue([kanji]);
  const kanjiFindUnique = vi.fn().mockResolvedValue(kanji);
  const repository = new PrismaDecksRepository({
    db: {
      learningItem: { findMany: learningItemFindMany },
      dependency: { findMany: dependencyFindMany },
      deck: { findFirst: deckFindFirst, findMany: deckFindMany },
      kanji: { findMany: kanjiFindMany, findUnique: kanjiFindUnique },
      word: {
        findMany: vi.fn().mockResolvedValue([WORD]),
        findUnique: vi.fn().mockResolvedValue(WORD),
      },
      userSrsState: {
        findMany: vi.fn().mockResolvedValue([{ learningCard: { learningItemId: item.id } }]),
      },
    },
  } as never);

  return {
    repository,
    learningItemFindMany,
    dependencyFindMany,
    deckFindFirst,
    deckFindMany,
    kanjiFindMany,
    kanjiFindUnique,
    kanji,
  };
}

function buildDashboardHarness(item = buildItem(), kanji = buildKanji(RAW_READINGS)) {
  const state = {
    id: "state-1",
    learningCardId: "card-meaning",
    srsSystemId: "srs-1",
    stageIndex: 2,
    availableAt: NOW,
    burnedAt: null,
    wrongCount: 7,
    correctStreak: 1,
    learningCard: { learningItem: item },
    srsSystem: { stages: [] },
    reviewAnswers: [{ result: "WRONG", previousStageIndex: 4, nextStageIndex: 2 }],
  };
  const learningItemFindMany = vi.fn().mockResolvedValue([item]);
  const stateFindMany = vi
    .fn()
    .mockResolvedValueOnce([state])
    .mockResolvedValueOnce([{ ...state, burnedAt: NOW }]);
  const reviewAnswerFindMany = vi
    .fn()
    .mockResolvedValue([{ answeredAt: NOW, userSrsState: state }]);
  const kanjiFindUnique = vi.fn().mockResolvedValue(kanji);
  const repository = new PrismaDashboardRepository({
    db: {
      learningItem: { findMany: learningItemFindMany },
      userSrsState: { findMany: stateFindMany },
      reviewAnswer: { findMany: reviewAnswerFindMany },
      kanji: { findUnique: kanjiFindUnique },
      word: { findUnique: vi.fn().mockResolvedValue(WORD) },
    },
  } as never);

  return {
    repository,
    learningItemFindMany,
    stateFindMany,
    reviewAnswerFindMany,
    kanjiFindUnique,
    kanji,
  };
}

function expectNoPrivateAnswers(result: unknown, query: unknown) {
  expect(JSON.stringify(result)).not.toContain("private-reading");
  expect(JSON.stringify(result)).not.toContain("userOverrides");
  expect(JSON.stringify(query)).not.toContain("userOverrides");
}
