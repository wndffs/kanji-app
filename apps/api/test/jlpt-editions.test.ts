import { describe, expect, it, vi } from "vitest";

import { PrismaConfusablesRepository } from "../src/confusables/confusables.repository";
import { PrismaDashboardRepository } from "../src/dashboard/dashboard.repository";
import { PrismaDecksRepository } from "../src/decks/decks.repository";
import { PrismaItemsRepository } from "../src/items/items.repository";
import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const editions = [
  { name: "legacy 4", modern: null, legacy: 4, label: "до 2010: 4" },
  { name: "legacy 2", modern: null, legacy: 2, label: "до 2010: 2" },
  { name: "modern 5 preferred over legacy 4", modern: 5, legacy: 4, label: "N5" },
  { name: "both levels null", modern: null, legacy: null, label: null },
  { name: "legacy property absent", modern: null, legacy: undefined, label: null },
] as const;

describe.each(editions)("kanji JLPT API projections: $name", (edition) => {
  it("preserves the edition in item detail and character lookup", async () => {
    const h = harness(edition);
    const repository = new PrismaItemsRepository(h.prisma);
    const options = { includeExamples: false };

    const detail = await repository.findItemById(h.item.id, options);
    const byCharacter = await repository.findKanjiItemByCharacter(h.kanji.character, options);

    expect(detail?.target.jlptLevel).toBe(edition.label);
    expect(byCharacter?.target.jlptLevel).toBe(edition.label);
    expect(detail?.target.reading).toBe("やま");
  });

  it("preserves the edition in the due queue, resumed practice and public practice cards", async () => {
    const h = harness(edition);
    const repository = new PrismaReviewsRepository(h.prisma);

    const due = await repository.listDueReviewCards("user", NOW, 1);
    const resumed = await repository.listPracticeCardsByIds("user", [h.card.id]);
    const publicCard = await repository.findPublicPracticeCard(h.card.id);

    expect(due.map((row) => row.card.target.jlptLevel)).toEqual([edition.label]);
    expect(resumed.map((row) => row.card.target.jlptLevel)).toEqual([edition.label]);
    expect(publicCard?.target.jlptLevel).toBe(edition.label);
  });

  it("preserves the edition for bulk text matches and stored deck items", async () => {
    const h = harness(edition);
    const repository = new PrismaDecksRepository(h.prisma);

    const matches = await repository.findTextMatches({
      sourceText: "山",
      wordCandidates: [],
      kanjiCharacters: ["山"],
    });
    const stored = await repository.findDeckForOwner("user", "deck");

    expect(matches.map((row) => row.item.target.jlptLevel)).toEqual([edition.label]);
    expect(stored?.items.map((row) => row.item.target.jlptLevel)).toEqual([edition.label]);
  });

  it("preserves the edition in dashboard lesson previews and leech signals", async () => {
    const h = harness(edition);
    const repository = new PrismaDashboardRepository(h.prisma);

    const lessons = await repository.listAvailableLessonItems([h.item.id], 1);
    const leeches = await repository.listLeechSignals("user", NOW);

    expect(lessons.map((row) => row.item.jlptLevel)).toEqual([edition.label]);
    expect(leeches.map((row) => row.item.jlptLevel)).toEqual([edition.label]);
  });

  it("preserves both pair aliases, individual references and comparison references", async () => {
    const h = harness(edition);
    const peer = {
      ...h.kanji,
      id: "kanji-peer",
      character: "川",
      jlptLevel: null,
      legacyJlptLevel: 2,
    };
    const peerItem = { ...h.item, id: "item-peer", targetId: peer.id };
    h.kanjiRows.push(peer);
    h.db.learningItem.findMany.mockResolvedValue([h.item, peerItem]);
    const pair = {
      id: "pair",
      leftKanjiId: h.kanji.id,
      rightKanjiId: peer.id,
      visual: true,
      semantic: false,
      strength: 50,
      explanationRu: "Различайте форму.",
      explanationEn: "Distinguish the shapes.",
      sourceNote: "Project-authored comparison.",
      status: "PUBLISHED",
      createdByUserId: null,
      approvedByUserId: null,
      approvedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    };
    const findPair = vi.fn(
      async ({
        include,
      }: {
        include: {
          leftKanji: ScalarProjection;
          rightKanji: ScalarProjection;
        };
      }) => ({
        ...pair,
        leftKanji: projectScalars(h.kanji, include.leftKanji),
        rightKanji: projectScalars(peer, include.rightKanji),
      }),
    );
    const repository = new PrismaConfusablesRepository({
      db: {
        ...h.db,
        kanjiConfusablePair: {
          findFirst: findPair,
          findMany: vi.fn(async (query) => [await findPair(query)]),
        },
      },
    } as never);

    const ref = await repository.findKanjiRefByItemId(h.item.id);
    const published = await repository.findPublishedPair(pair.id);
    const listed = await repository.listPublishedPairs("user", NOW);
    const comparison = await repository.findComparison(pair.id);

    expect(ref?.jlptLevel).toBe(edition.label);
    const expected = [edition.label, "до 2010: 2"];
    expect(published?.kanji.map((row) => row.jlptLevel)).toEqual(expected);
    expect(listed[0]?.kanji.map((row) => row.jlptLevel)).toEqual(expected);
    expect(comparison?.kanji.map((row) => row.jlptLevel)).toEqual(expected);
  });
});

describe("word JLPT metadata remains modern", () => {
  it.each([4, 5, null])(
    "keeps word level %s across item, review, deck and dashboard projections",
    async (level) => {
      const h = harness({ modern: null, legacy: 4 }, "WORD");
      h.word.jlptLevel = level;
      const expected = level === null ? null : `N${level}`;

      const item = await new PrismaItemsRepository(h.prisma).findItemById(h.item.id, {
        includeExamples: false,
      });
      const reviews = await new PrismaReviewsRepository(h.prisma).listDueReviewCards(
        "user",
        NOW,
        1,
      );
      const decks = new PrismaDecksRepository(h.prisma);
      const matches = await decks.findTextMatches({
        sourceText: "山",
        wordCandidates: ["山"],
        kanjiCharacters: [],
      });
      const deck = await decks.findDeckForOwner("user", "deck");
      const dashboard = await new PrismaDashboardRepository(h.prisma).listAvailableLessonItems(
        [h.item.id],
        1,
      );

      expect(item?.target.jlptLevel).toBe(expected);
      expect(reviews.map((row) => row.card.target.jlptLevel)).toEqual([expected]);
      expect(matches.map((row) => row.item.target.jlptLevel)).toEqual([expected]);
      expect(deck?.items.map((row) => row.item.target.jlptLevel)).toEqual([expected]);
      expect(dashboard.map((row) => row.item.jlptLevel)).toEqual([expected]);
    },
  );
});

type ScalarProjection = { readonly select?: Readonly<Record<string, unknown>> };
function projectScalars(row: object, query: ScalarProjection) {
  // Honor actual selectors, so a missing legacy field cannot be masked by a full-row mock.
  return query.select === undefined
    ? row
    : Object.fromEntries(Object.entries(row).filter(([key]) => Boolean(query.select?.[key])));
}

function harness(
  edition: { readonly modern: number | null; readonly legacy: number | null | undefined },
  kind: "KANJI" | "WORD" = "KANJI",
) {
  const kanji = {
    id: "kanji",
    character: "山",
    jlptLevel: edition.modern,
    ...(edition.legacy === undefined ? {} : { legacyJlptLevel: edition.legacy }),
    frequencyRank: null,
    kanjidicSourceId: null,
    strokeGraphic: null,
    components: [],
    readings: [{ reading: "やま", readingType: "KUN", priority: 0 }],
    meanings: [{ locale: "ru-RU", meaning: "гора", isPrimary: true, sourceKind: "CURATED" }],
  };
  const word = {
    id: "word",
    expression: "山",
    reading: "やま",
    jlptLevel: 4 as number | null,
    commonnessRank: null,
    jmdictEntryId: null,
    senses: [
      {
        locale: "ru-RU",
        meaning: "гора",
        sourceKind: "CURATED",
        partOfSpeech: "noun",
        register: null,
        tags: [],
      },
    ],
  };
  const item = {
    id: "item",
    targetId: kind === "KANJI" ? kanji.id : word.id,
    targetType: kind,
    kind,
    status: "PUBLISHED",
    title: "山",
    levelHint: 1,
    cards: [],
    dependencies: [],
    mnemonics: [],
    hints: [],
  };
  const card = {
    id: "card",
    learningItemId: item.id,
    learningItem: item,
    cardType: "REVIEW",
    promptType: "MEANING",
    answerType: "MEANING",
    sortOrder: 1,
    answers: [],
    blockedAnswers: [],
    audioAsset: null,
  };
  const state = {
    id: "state",
    userId: "user",
    learningCardId: card.id,
    learningCard: card,
    srsSystemId: "system",
    srsSystem: { stages: [{ stageIndex: 1, name: "One", intervalMinutes: 240, isBurned: false }] },
    stageIndex: 1,
    availableAt: NOW,
    createdAt: NOW,
    lastReviewedAt: null,
    burnedAt: null,
    resurrectedAt: null,
    wrongCount: 1,
    correctStreak: 0,
    reviewAnswers: [],
  };
  const kanjiRows = [kanji];
  type TargetQuery = ScalarProjection & {
    readonly where: { readonly id?: string; readonly character?: string };
  };
  const db = {
    kanji: {
      findUnique: vi.fn(async (query: TargetQuery) => {
        const row = kanjiRows.find(
          (row) => query.where.id === row.id || query.where.character === row.character,
        );
        return row === undefined ? null : projectScalars(row, query);
      }),
      findMany: vi.fn(async (query: ScalarProjection) =>
        kanjiRows.map((row) => projectScalars(row, query)),
      ),
    },
    word: {
      findUnique: vi.fn(async (query: ScalarProjection) => projectScalars(word, query)),
      findMany: vi.fn().mockResolvedValue([word]),
    },
    learningItem: {
      findUnique: vi.fn().mockResolvedValue(item),
      findFirst: vi.fn().mockResolvedValue(item),
      findMany: vi.fn().mockResolvedValue([item]),
    },
    learningCard: { findMany: vi.fn().mockResolvedValue([card]) },
    userSrsState: { findMany: vi.fn().mockResolvedValue([state]) },
    dependency: { findMany: vi.fn().mockResolvedValue([]) },
    reviewAnswer: { findMany: vi.fn().mockResolvedValue([]) },
    kanjiComponent: { findMany: vi.fn().mockResolvedValue([]) },
    deck: {
      findFirst: vi.fn().mockResolvedValue({
        id: "deck",
        ownerUserId: "user",
        title: "My deck",
        sourceText: "山",
        status: "ACTIVE",
        createdAt: NOW,
        updatedAt: NOW,
        items: [{ learningItemId: item.id, learningItem: item, sortOrder: 1, reasonJson: [] }],
      }),
    },
  };
  return { db, prisma: { db } as never, kanji, kanjiRows, word, item, card };
}
