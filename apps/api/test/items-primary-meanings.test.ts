import { describe, expect, it, vi } from "vitest";

import { PrismaItemsRepository } from "../src/items/items.repository";
import { ItemsService } from "../src/items/items.service";

function answer(text: string, locale: string, isPrimary = false, sourceKind = "CURATED") {
  return { text, normalizedText: text, locale, answerKind: "MEANING", isPrimary, sourceKind };
}

function sense(meaning: string, locale: string, sourceKind = "IMPORTED") {
  return { meaning, locale, sourceKind, partOfSpeech: "adjective", register: null, tags: [] };
}

function harness() {
  const meaningCard = {
    id: "card-good-meaning",
    cardType: "REVIEW",
    promptType: "MEANING",
    answerType: "MEANING",
    sortOrder: 0,
    answers: [
      answer("decent", "en-US"),
      answer("добротный", "ru-RU"),
      answer("good", "en-US", true),
      answer("хороший", "ru-RU", true),
    ],
    blockedAnswers: [] as { text: string; normalizedText: string; reason: string | null }[],
    userOverrides: [] as {
      id: string;
      userId: string;
      learningCardId: string;
      overrideType: string;
      locale: string;
      text: string;
      normalizedText: string;
      note: string | null;
      createdAt: Date;
      updatedAt: Date;
    }[],
  };
  const item = {
    id: "item-good",
    kind: "WORD",
    targetType: "WORD",
    targetId: "word-good",
    title: "良い",
    status: "PUBLISHED",
    levelHint: 1,
    cards: [meaningCard],
    dependencies: [] as {
      dependencyType: string;
      prerequisiteItem: { id: string; kind: string };
    }[],
  };
  const word = {
    expression: "良い",
    reading: "よい",
    jlptLevel: 5,
    commonnessRank: 100,
    jmdictEntryId: null,
    senses: [
      sense("decent", "en-US"),
      sense("good", "en-US"),
      sense("virtuous", "en-US"),
      sense("добротный", "ru-RU", "CURATED"),
      sense("нравственный", "ru-RU"),
      sense("хороший", "ru-RU", "CURATED"),
    ],
  };
  const db = {
    $queryRaw: vi.fn().mockResolvedValue([]),
    learningItem: {
      findUnique: vi.fn().mockResolvedValue(item),
      findMany: vi.fn().mockResolvedValue([item]),
    },
    word: { findUnique: vi.fn().mockResolvedValue(word) },
    dependency: { findMany: vi.fn().mockResolvedValue([]) },
    audioAsset: { findFirst: vi.fn().mockResolvedValue(null) },
  };
  const repository = new PrismaItemsRepository({ db } as never);
  return { item, word, meaningCard, db, repository, service: new ItemsService(repository) };
}

const expectedPrimaries = { primaryRu: "хороший", primaryEn: "good" };

describe("word primary meanings in item hydration", () => {
  it("uses each locale's global primary and accepted scope without changing dictionary evidence", async () => {
    const h = harness();
    const before = structuredClone({ item: h.item, word: h.word });
    const record = await h.repository.findItemById(h.item.id, {
      includeExamples: false,
      includeRelations: false,
    });

    expect(record?.target.translations).toEqual({
      ru: [
        { locale: "ru-RU", text: "добротный", isPrimary: false },
        { locale: "ru-RU", text: "хороший", isPrimary: true },
      ],
      en: [
        { locale: "en-US", text: "decent", isPrimary: false },
        { locale: "en-US", text: "good", isPrimary: true },
      ],
    });
    expect(record?.target.wordDetails?.senses.map((entry) => entry.meaning)).toEqual(
      h.word.senses.map((entry) => entry.meaning),
    );
    expect({ item: h.item, word: h.word }).toEqual(before);
    expect(h.db.learningItem.findUnique).toHaveBeenCalledTimes(1);
    expect(h.db.word.findUnique).toHaveBeenCalledTimes(1);
    expect(h.db.learningItem.findMany).not.toHaveBeenCalled();
    expect(h.db.$queryRaw).not.toHaveBeenCalled();
  });

  it("keeps detail headers and learning cards on the same bilingual teaching scope", async () => {
    const h = harness();
    const details = await h.service.getItemDetails(h.item.id, null);

    expect(details.translations).toMatchObject(expectedPrimaries);
    expect(details.translations.ru.map((entry) => entry.text)).toEqual(["добротный", "хороший"]);
    expect(details.translations.en.map((entry) => entry.text)).toEqual(["decent", "good"]);
    expect(details.cards[0]?.translations).toEqual(details.translations);
    expect(details.wordDetails?.senses).toHaveLength(6);
  });

  it("uses global primary answers even when absent from dictionary senses", async () => {
    const h = harness();
    h.word.senses = [];

    expect((await h.service.getItemDetails(h.item.id, null)).translations).toMatchObject(
      expectedPrimaries,
    );
  });

  it("does not re-rank the accepted teaching scope by dictionary source kind", async () => {
    const h = harness();
    h.meaningCard.answers = h.meaningCard.answers.map((entry) => ({
      ...entry,
      sourceKind: entry.isPrimary ? "IMPORTED" : "CURATED",
    }));
    const details = await h.service.getItemDetails(h.item.id, null);

    expect(details.translations).toMatchObject(expectedPrimaries);
    expect(details.translations.ru.map((entry) => entry.text)).toEqual(["добротный", "хороший"]);
    expect(details.translations.en.map((entry) => entry.text)).toEqual(["decent", "good"]);
  });

  it("hydrates search summaries from already loaded answers without extra queries", async () => {
    const h = harness();
    h.db.$queryRaw.mockResolvedValueOnce([{ ids: [h.item.id], total: 1n }]);
    const result = await h.service.search({ q: "良い" }, null);

    expect(result.items[0]?.translations).toMatchObject(expectedPrimaries);
    expect(result.items[0]?.translations.ru.map((entry) => entry.text)).toEqual([
      "добротный",
      "хороший",
    ]);
    expect(h.db.learningItem.findUnique).toHaveBeenCalledTimes(1);
    expect(h.db.learningItem.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          cards: expect.objectContaining({ include: { answers: expect.any(Object) } }),
        },
      }),
    );
    expect(h.db.word.findUnique).toHaveBeenCalledTimes(1);
    expect(h.db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(h.db.dependency.findMany).not.toHaveBeenCalled();
    expect(h.db.learningItem.findMany).not.toHaveBeenCalled();
  });

  it("uses the same primary meanings in batched related summaries", async () => {
    const h = harness();
    const parent = {
      ...h.item,
      id: "item-good-person",
      targetId: "word-good-person",
      title: "良い人",
      cards: [],
      dependencies: [{ dependencyType: "PREREQUISITE", prerequisiteItem: h.item }],
    };
    h.db.learningItem.findUnique.mockResolvedValue(parent);
    h.db.word.findUnique.mockImplementation(async ({ where }: { where: { id: string } }) =>
      where.id === parent.targetId
        ? { ...h.word, expression: "良い人", reading: "よいひと", senses: [] }
        : h.word,
    );
    const details = await h.service.getItemDetails(parent.id, null);

    expect(details.relationGroups[0]?.items[0]?.translations).toMatchObject(expectedPrimaries);
    expect(details.relations[0]?.item.translations).toEqual(
      details.relationGroups[0]?.items[0]?.translations,
    );
    expect(h.db.learningItem.findUnique).toHaveBeenCalledTimes(1);
    expect(h.db.learningItem.findMany).toHaveBeenCalledTimes(1);
    expect(h.db.learningItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: [h.item.id] }, status: "PUBLISHED" },
        include: {
          cards: expect.objectContaining({ include: { answers: expect.any(Object) } }),
        },
      }),
    );
    expect(h.db.word.findUnique).toHaveBeenCalledTimes(2);
    expect(h.db.dependency.findMany).toHaveBeenCalledTimes(1);
  });

  it("assigns a deterministic primary separately per locale for dictionary-only words", async () => {
    const h = harness();
    h.item.cards = [];
    h.word.senses = h.word.senses.map((entry) => ({ ...entry, sourceKind: "IMPORTED" }));
    const record = await h.repository.findItemById(h.item.id, {
      includeRelations: false,
      includeExamples: false,
    });

    for (const texts of Object.values(record!.target.translations)) {
      expect(texts.filter((entry) => entry.isPrimary).map((entry) => entry.text)).toEqual([
        texts[0]!.text,
      ]);
    }
    const details = await h.service.getItemDetails(h.item.id, null);
    expect(details.translations).toMatchObject({ primaryRu: "добротный", primaryEn: "decent" });
    expect(details.wordDetails?.senses).toHaveLength(6);
  });

  it("falls back only for the locale without global meaning answers", async () => {
    const h = harness();
    h.meaningCard.answers = h.meaningCard.answers.filter((entry) => entry.locale === "ru-RU");
    const details = await h.service.getItemDetails(h.item.id, null);

    expect(details.translations).toMatchObject({ primaryRu: "хороший", primaryEn: "decent" });
    expect(details.translations.ru.map((entry) => entry.text)).toEqual(["добротный", "хороший"]);
    expect(details.translations.en.map((entry) => entry.text)).toEqual([
      "decent",
      "good",
      "virtuous",
    ]);
  });

  it("does not promote private, blocked or reading answers into global translations", async () => {
    const h = harness();
    h.meaningCard.answers.unshift(answer("личное", "ru-RU", true, "USER_PRIVATE"));
    h.meaningCard.answers.push({ ...answer("よい", "ru-RU", true), answerKind: "READING" });
    h.meaningCard.blockedAnswers.push({ text: "плохой", normalizedText: "плохой", reason: null });
    h.meaningCard.userOverrides.push({
      id: "private-answer",
      userId: "owner",
      learningCardId: h.meaningCard.id,
      overrideType: "ACCEPTED_MEANING",
      locale: "ru-RU",
      text: "мой перевод",
      normalizedText: "мой перевод",
      note: null,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    });
    h.item.cards.unshift({
      ...h.meaningCard,
      id: "card-good-reading",
      promptType: "READING",
      answerType: "READING",
      answers: [answer("reading-card distractor", "en-US", true)],
    });
    const record = await h.repository.findItemById(h.item.id, {
      includeExamples: false,
      includeRelations: false,
    });

    expect(record?.target.translations.ru.map((entry) => entry.text)).toEqual([
      "добротный",
      "хороший",
    ]);
    expect(record?.target.translations.en.map((entry) => entry.text)).toEqual(["decent", "good"]);
    const details = await h.service.getItemDetails(h.item.id, null);
    expect(details.translations).toMatchObject(expectedPrimaries);
    expect(details.translations.ru.map((entry) => entry.text)).toEqual(["добротный", "хороший"]);
    expect(details.translations.en.map((entry) => entry.text)).toEqual(["decent", "good"]);
  });
});
