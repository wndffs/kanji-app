import { describe, expect, it, vi } from "vitest";
import { PrismaReviewsRepository } from "../src/reviews/reviews.repository";

function item(kind: string, index: number, targetId = `target-${kind}-${index}`, taught = "ひ") {
  return {
    id: `item-${kind}-${index}`,
    kind,
    targetType: kind,
    targetId,
    levelHint: index,
    cards: [
      {
        answerType: "READING",
        promptType: "READING",
        answers: [{ text: taught, locale: "ru-RU", answerKind: "READING", isPrimary: true }],
      },
    ],
  };
}

function harness(items: ReturnType<typeof item>[]) {
  let active = 0;
  let maximum = 0;
  const table = (kind: string) => {
    const rows = [
      ...new Set(items.filter((item) => item.targetType === kind).map((item) => item.targetId)),
    ].map((id) => ({
      id,
      symbol: "一",
      character: id,
      expression: `語-${id}`,
      reading: "ほん",
      jlptLevel: null,
      legacyJlptLevel: 4,
      readings: [{ reading: "ニチ", priority: 1 }],
      senses: [{ locale: "en-US", meaning: "book" }],
      japaneseText: "本です。",
      readingText: "ほんです。",
      translationRu: "Это книга.",
      translationEn: "It is a book.",
    }));
    return {
      rows,
      findUnique: vi.fn(() => {
        throw new Error("Unexpected per-card target read.");
      }),
      findMany: vi.fn(async ({ where }: { where: { id: { in: string[] } } }) => {
        active++;
        maximum = Math.max(maximum, active);
        try {
          await Promise.resolve();
          return rows.filter((row) => where.id.in.includes(row.id)).reverse();
        } finally {
          active--;
        }
      }),
    };
  };
  const tables = {
    component: table("COMPONENT"),
    kanji: table("KANJI"),
    word: table("WORD"),
    sentence: table("SENTENCE"),
  };
  const cards = items.flatMap((learningItem) =>
    ["MEANING", "READING"].map((answerType) => ({
      id: `${learningItem.id}-${answerType}`,
      learningItemId: learningItem.id,
      learningItem,
      cardType: "REVIEW",
      promptType: answerType,
      answerType,
      sortOrder: answerType === "MEANING" ? 0 : 1,
      answers: [
        {
          text: `${learningItem.id}-${answerType}`,
          normalizedText: "answer",
          answerKind: answerType,
          locale: "ru-RU",
          isPrimary: true,
        },
      ],
      blockedAnswers: [],
      audioAsset: null,
    })),
  );
  const states = cards.map((learningCard) => ({
    id: `state-${learningCard.id}`,
    userId: "owner",
    learningCardId: learningCard.id,
    learningCard,
    srsSystemId: "srs",
    stageIndex: 3,
    availableAt: new Date(0),
    burnedAt: null,
    resurrectedAt: null,
    lastReviewedAt: null,
    correctStreak: 2,
    wrongCount: 1,
    srsSystem: {
      stages: [{ stageIndex: 3, name: "stage", intervalMinutes: 1440, isBurned: false }],
    },
  }));
  const db = {
    ...tables,
    userSrsState: { findMany: vi.fn().mockResolvedValue(states) },
    learningCard: { findMany: vi.fn().mockResolvedValue([...cards].reverse()) },
  };
  return {
    repository: new PrismaReviewsRepository({ db } as never),
    db,
    tables,
    cards,
    states,
    maximum: () => maximum,
  };
}

describe("bounded review target hydration", () => {
  it("loads 202 meaning/reading cards with two bounded target reads, preserving card answers and source order", async () => {
    const items = Array.from({ length: 101 }, (_, index) => item("KANJI", index)).reverse();
    const h = harness(items);
    const result = await h.repository.listDueReviewCards("owner", new Date(), 300);
    expect(result.map((row) => row.card.id)).toEqual(h.cards.map((card) => card.id));
    expect(result.map((row) => row.card.acceptedAnswers[0]!.text)).toEqual(
      h.cards.map((card) => card.answers[0]!.text),
    );
    expect(h.tables.kanji.findMany.mock.calls.map(([query]) => query.where.id.in.length)).toEqual([
      100, 1,
    ]);
    expect(h.maximum()).toBe(1);
    expect(
      result.every(
        (row) =>
          row.card.target.reading === "ひ" &&
          row.card.target.jlptLevel === "до 2010: 4" &&
          row.state.stageIndex === 3,
      ),
    ).toBe(true);
    for (const table of Object.values(h.tables)) expect(table.findUnique).not.toHaveBeenCalled();
  });

  it("keeps taught readings per item while deduplicating raw targets, and never shares a cache across calls", async () => {
    const h = harness([
      item("KANJI", 1, "same", "ひ"),
      item("KANJI", 2, "same", "にち"),
      item("WORD", 3, "same"),
      item("COMPONENT", 4),
      item("SENTENCE", 5),
    ]);
    const ids = h.cards.map((card) => card.id).reverse();
    const first = await h.repository.listPublicPracticeCardsByIds(ids);
    expect(first.map((card) => card.id)).toEqual(ids);
    expect(
      first
        .filter((card) => card.learningItemId === "item-KANJI-1")
        .map((card) => card.target.reading),
    ).toEqual(["ひ", "ひ"]);
    expect(
      first
        .filter((card) => card.learningItemId === "item-KANJI-2")
        .map((card) => card.target.reading),
    ).toEqual(["にち", "にち"]);
    for (const table of Object.values(h.tables)) expect(table.findMany).toHaveBeenCalledOnce();
    await h.repository.listPublicPracticeCardsByIds(ids);
    for (const table of Object.values(h.tables)) expect(table.findMany).toHaveBeenCalledTimes(2);
  });

  it("fails on missing targets instead of dropping scheduled cards or doing fallback reads", async () => {
    const h = harness([item("KANJI", 1)]);
    h.tables.kanji.rows.splice(0);
    await expect(h.repository.listDueReviewCards("owner", new Date(), 10)).rejects.toThrow(
      "Missing kanji target",
    );
    expect(h.tables.kanji.findUnique).not.toHaveBeenCalled();
  });

  it("ranks actual per-card leech signals and hydrates only the selected owner card ids", async () => {
    const h = harness([item("KANJI", 1), item("KANJI", 2)]);
    const [weakReading, wrongMeaning, wrongReading] = [h.states[1]!, h.states[2]!, h.states[3]!];
    const since = new Date("2026-11-07T00:00:00Z");
    h.db.userSrsState.findMany
      .mockResolvedValueOnce([
        { ...weakReading, reviewAnswers: [] },
        { ...wrongMeaning, wrongCount: 7, correctStreak: 0, reviewAnswers: [] },
        {
          ...wrongReading,
          reviewAnswers: [
            { result: "WRONG", previousStageIndex: 7, nextStageIndex: 2 },
            { result: "REVEAL", previousStageIndex: 2, nextStageIndex: 1 },
          ],
        },
      ])
      .mockResolvedValueOnce([wrongReading]);
    const result = await h.repository.listPracticeCards("owner", "leeches", since, 1);
    expect(result.map(({ card }) => card.id)).toEqual([wrongReading.learningCardId]);
    expect(h.db.userSrsState.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "owner",
          burnedAt: null,
          learningCard: expect.objectContaining({ learningItem: { status: "PUBLISHED" } }),
        }),
        select: expect.objectContaining({
          reviewAnswers: expect.objectContaining({ where: { answeredAt: { gte: since } } }),
        }),
      }),
    );
    expect(h.db.userSrsState.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "owner",
          learningCardId: { in: [wrongReading.learningCardId] },
        }),
      }),
    );
  });
});
