import { describe, expect, it, vi } from "vitest";

import { primaryTaughtReadingCards } from "@kanji-srs/db";

import { PrismaItemsRepository } from "../src/items/items.repository";
import { ItemsService } from "../src/items/items.service";
import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";

function harness(hasTaughtReading = true) {
  const answer = (text: string, locale: string, answerKind: string) => ({
    text,
    normalizedText: text,
    locale,
    answerKind,
    isPrimary: true,
  });
  const card = (promptType: string, text: string) => ({
    id: `card-${promptType}`,
    learningItemId: "item-rice",
    cardType: "REVIEW",
    promptType,
    answerType: promptType,
    sortOrder: promptType === "MEANING" ? 0 : 1,
    answers: [answer(text, promptType === "MEANING" ? "en-US" : "ru-RU", promptType)],
    blockedAnswers: [],
    userOverrides: [],
    audioAsset: null,
  });
  const cards = [card("MEANING", "rice"), ...(hasTaughtReading ? [card("READING", "こめ")] : [])];
  const item = {
    id: "item-rice",
    kind: "KANJI",
    targetType: "KANJI",
    targetId: "kanji-rice",
    title: "米",
    status: "PUBLISHED",
    levelHint: 7,
    cards,
    dependencies: [],
    mnemonics: [],
    hints: [],
    userMnemonics: [],
  };
  const kanji = {
    character: "米",
    jlptLevel: 5,
    legacyJlptLevel: null,
    kanjidicSourceId: null,
    strokeGraphic: null,
    readings: [
      { reading: "ベイ", readingType: "ONYOMI", priority: 1 },
      { reading: "マイ", readingType: "ONYOMI", priority: 2 },
      { reading: "こめ", readingType: "KUNYOMI", priority: 3 },
    ],
    meanings: [],
  };
  const db = {
    learningItem: { findUnique: vi.fn().mockResolvedValue(item) },
    learningCard: {
      findMany: vi.fn().mockResolvedValue(cards.map((card) => ({ ...card, learningItem: item }))),
    },
    dependency: { findMany: vi.fn().mockResolvedValue([]) },
    kanjiComponent: { findMany: vi.fn().mockResolvedValue([]) },
    kanji: { findUnique: vi.fn().mockResolvedValue(kanji) },
    userSrsState: {
      findMany: vi.fn().mockResolvedValue(
        cards.map((card) => ({
          id: `state-${card.id}`,
          userId: "owner",
          learningCardId: card.id,
          srsSystemId: "default",
          stageIndex: 1,
          availableAt: new Date(0),
          burnedAt: null,
          lastReviewedAt: null,
          correctStreak: 0,
          wrongCount: 0,
          createdAt: new Date(0),
          srsSystem: {
            stages: [{ stageIndex: 1, name: "Stage 1", intervalMinutes: 240, isBurned: false }],
          },
          learningCard: { ...card, learningItem: item },
        })),
      ),
    },
  };
  return { db, item, kanji, cards };
}

describe("taught kanji readings in API hydration", () => {
  it.each([true, false])(
    "keeps item headers and dictionary evidence separate (taught: %s)",
    async (taught) => {
      const h = harness(taught);
      const before = structuredClone(h.kanji);
      const repository = new PrismaItemsRepository({ db: h.db } as never);
      const service = new ItemsService(repository);
      const result = await service.getItemDetails(h.item.id, null);
      expect(result.reading).toBe(taught ? "こめ" : "ベイ");
      expect(result.kanjiDetails?.readingEvidence.map((entry) => entry.reading)).toEqual([
        "ベイ",
        "マイ",
        "こめ",
      ]);
      expect(result.kanjiDetails?.primaryTaughtReading?.text ?? null).toBe(taught ? "こめ" : null);
      expect(h.db.kanji.findUnique).toHaveBeenCalledTimes(1);
      expect(h.kanji).toEqual(before);
    },
  );

  it("uses the same taught reading for public meaning and reading practice", async () => {
    const h = harness();
    const repository = new PrismaReviewsRepository({ db: h.db } as never);
    const result = await repository.listPublicPracticeCardsByIds(h.cards.map((card) => card.id));
    expect(result.map((card) => card.target.reading)).toEqual(["こめ", "こめ"]);
    expect(result.map((card) => card.answerType)).toEqual(["meaning", "reading"]);
    expect(h.db.learningCard.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          learningItem: { include: { cards: primaryTaughtReadingCards } },
        }),
      }),
    );
  });

  it("hydrates scheduled review targets from global card answers without modifying SRS or source rows", async () => {
    const h = harness();
    const before = structuredClone(h.item);
    const repository = new PrismaReviewsRepository({ db: h.db } as never);
    const result = await repository.listDueQueue("owner", new Date(), 10);
    expect(result.map((row) => row.card.target.reading)).toEqual(["こめ", "こめ"]);
    expect(result.map((row) => row.state.stageIndex)).toEqual([1, 1]);
    expect(h.db.userSrsState.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          learningCard: {
            include: expect.objectContaining({
              learningItem: { include: { cards: primaryTaughtReadingCards } },
            }),
          },
        }),
      }),
    );
    expect(h.item).toEqual(before);
  });
});
