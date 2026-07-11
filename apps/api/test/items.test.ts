import { describe, expect, it } from "vitest";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { ItemsRepository } from "../src/items/items.repository";
import { ItemsService } from "../src/items/items.service";
import { type ItemLookupOptions, type ItemRecord, localizedText } from "../src/items/items.types";

describe("ItemsService", () => {
  it("searches by kanji character", async () => {
    const service = createService();

    await expect(service.search({ q: "一" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-kanji-one",
          itemType: "kanji",
          japanese: "一",
        },
      ],
      pagination: {
        total: 1,
        hasNextPage: false,
      },
    });
  });

  it("searches by Japanese word expression", async () => {
    const service = createService();

    await expect(service.search({ q: "学校" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
          itemType: "word",
          japanese: "学校",
        },
      ],
    });
  });

  it("searches by reading", async () => {
    const service = createService();

    await expect(service.search({ q: "がっこう" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
          reading: "がっこう",
        },
      ],
    });
  });

  it("searches by Russian and English meanings", async () => {
    const service = createService();

    await expect(service.search({ q: "школа" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
          translations: {
            primaryRu: "школа",
            primaryEn: "school",
          },
        },
      ],
    });
    await expect(service.search({ q: "school" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
        },
      ],
    });
  });

  it("paginates search results", async () => {
    const service = createService();

    await expect(service.search({ q: "o", page: "2", limit: "1" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
        },
      ],
      pagination: {
        page: 2,
        limit: 1,
        total: 2,
        hasNextPage: false,
      },
    });
  });

  it("includes user SRS summary in authenticated search results", async () => {
    const service = createService();

    await expect(service.search({ q: "school" }, createUser("owner"))).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
          srs: {
            stageIndex: 2,
            stageName: "Apprentice 2",
          },
        },
      ],
    });
    await expect(service.search({ q: "school" }, null)).resolves.toMatchObject({
      items: [
        {
          id: "item-word-school",
          srs: null,
        },
      ],
    });
  });

  it("includes user overrides only for their owner", async () => {
    const service = createService();

    await expect(
      service.getItemDetails("item-kanji-one", createUser("owner")),
    ).resolves.toMatchObject({
      id: "item-kanji-one",
      userOverrides: [
        {
          id: "override-owner",
          text: "single stroke",
          note: "Personal wording from my notes.",
        },
      ],
    });
    await expect(
      service.getItemDetails("item-kanji-one", createUser("other")),
    ).resolves.toMatchObject({
      id: "item-kanji-one",
      userOverrides: [
        {
          id: "override-other",
          text: "line",
        },
      ],
    });
    await expect(service.getItemDetails("item-kanji-one", null)).resolves.toMatchObject({
      id: "item-kanji-one",
      userOverrides: [],
    });
  });

  it("includes private mnemonics only for their owner", async () => {
    const service = createService();

    await expect(
      service.getItemDetails("item-kanji-one", createUser("owner")),
    ).resolves.toMatchObject({
      mnemonics: {
        en: [
          {
            text: "Imagine one clean stroke.",
            sourceKind: "user",
          },
        ],
      },
    });
    await expect(
      service.getItemDetails("item-kanji-one", createUser("other")),
    ).resolves.toMatchObject({
      mnemonics: {
        en: [],
      },
    });
    await expect(service.getItemDetails("item-kanji-one", null)).resolves.toMatchObject({
      mnemonics: {
        en: [],
      },
    });
  });

  it("includes kanji stroke data on item details", async () => {
    const service = createService();

    await expect(service.getItemDetails("item-kanji-one", null)).resolves.toMatchObject({
      id: "item-kanji-one",
      strokeGraphic: {
        sourceRecordId: "kanjivg:04e00",
        viewBox: "0 0 109 109",
        strokes: [
          {
            id: "kvg:04e00-s1",
            order: 1,
            path: "M18,54 C34,52 72,52 91,54",
            type: "㇐",
          },
        ],
      },
    });
  });

  it("keeps component names and shapes separate from meanings", async () => {
    const service = createService([createComponentItem()]);

    await expect(service.getItemDetails("item-component-one", null)).resolves.toMatchObject({
      itemType: "component",
      translations: {
        primaryRu: "один",
        primaryEn: "one",
        ru: [{ text: "один" }],
        en: [{ text: "one" }],
      },
      componentDetails: {
        name: { primaryRu: "единица", primaryEn: "one" },
        shapeDescription: {
          primaryRu: "горизонтальная черта",
          primaryEn: "horizontal stroke",
        },
      },
    });
  });
});

class InMemoryItemsRepository extends ItemsRepository {
  constructor(private readonly items: readonly ItemRecord[]) {
    super();
  }

  async findItemById(id: string, options: ItemLookupOptions): Promise<ItemRecord | null> {
    const item = this.items.find((candidate) => candidate.id === id);

    return item === undefined ? null : filterForUser(item, options.userId);
  }

  async findKanjiItemByCharacter(
    character: string,
    options: ItemLookupOptions,
  ): Promise<ItemRecord | null> {
    const item = this.items.find(
      (candidate) => candidate.itemType === "kanji" && candidate.target.japanese === character,
    );

    return item === undefined ? null : filterForUser(item, options.userId);
  }

  async searchItems(query: string, options: ItemLookupOptions): Promise<readonly ItemRecord[]> {
    const normalizedQuery = query.toLowerCase();

    return this.items
      .filter((item) => matchesItem(item, normalizedQuery))
      .map((item) => filterForUser(item, options.userId));
  }
}

function createService(items: readonly ItemRecord[] = createItems()): ItemsService {
  return new ItemsService(new InMemoryItemsRepository(items));
}

function createComponentItem(): ItemRecord {
  return {
    id: "item-component-one",
    itemType: "component",
    title: "Component one",
    level: 1,
    status: "PUBLISHED",
    target: {
      japanese: "一",
      reading: null,
      jlptLevel: null,
      translations: {
        ru: [localizedText("ru-RU", "один", { isPrimary: true })],
        en: [localizedText("en-US", "one", { isPrimary: true })],
      },
      componentDetails: {
        name: {
          ru: [localizedText("ru-RU", "единица", { isPrimary: true })],
          en: [localizedText("en-US", "one", { isPrimary: true })],
        },
        shapeDescription: {
          ru: [localizedText("ru-RU", "горизонтальная черта", { isPrimary: true })],
          en: [localizedText("en-US", "horizontal stroke", { isPrimary: true })],
        },
      },
      sourceRecordIds: [],
      strokeGraphic: null,
      attributions: [],
    },
    cards: [],
    mnemonics: [],
    hints: [],
    relations: [],
    attributions: [],
    userOverrides: [],
    srs: null,
  };
}

function createItems(): readonly ItemRecord[] {
  const now = new Date("2026-06-17T09:00:00.000Z");

  return [
    {
      id: "item-kanji-one",
      itemType: "kanji",
      title: "Kanji one",
      level: 1,
      status: "PUBLISHED",
      target: {
        japanese: "一",
        reading: "いち",
        jlptLevel: "N5",
        translations: {
          ru: [localizedText("ru-RU", "один", { isPrimary: true })],
          en: [localizedText("en-US", "one", { isPrimary: true })],
        },
        componentDetails: null,
        sourceRecordIds: ["fixture:kanji:one"],
        strokeGraphic: {
          sourceRecordId: "kanjivg:04e00",
          viewBox: "0 0 109 109",
          strokes: [
            {
              id: "kvg:04e00-s1",
              order: 1,
              path: "M18,54 C34,52 72,52 91,54",
              type: "㇐",
            },
          ],
        },
        attributions: [],
      },
      cards: [
        {
          id: "card-kanji-one-meaning",
          cardType: "review",
          promptType: "meaning",
          answerType: "meaning",
          sortOrder: 1,
          answers: [
            {
              ...localizedText("ru-RU", "один", { isPrimary: true }),
              normalizedText: "один",
              answerKind: "meaning",
            },
            {
              ...localizedText("en-US", "one", { isPrimary: true }),
              normalizedText: "one",
              answerKind: "meaning",
            },
          ],
          blockedAnswers: [],
          userOverrides: [
            {
              id: "override-owner",
              userId: "owner",
              learningCardId: "card-kanji-one-meaning",
              overrideType: "accepted-meaning",
              locale: "en-US",
              text: "single stroke",
              normalizedText: "single stroke",
              note: "Personal wording from my notes.",
              createdAt: now,
              updatedAt: now,
            },
            {
              id: "override-other",
              userId: "other",
              learningCardId: "card-kanji-one-meaning",
              overrideType: "accepted-meaning",
              locale: "en-US",
              text: "line",
              normalizedText: "line",
              note: null,
              createdAt: now,
              updatedAt: now,
            },
          ],
        },
      ],
      mnemonics: [],
      hints: [],
      relations: [],
      attributions: [
        {
          sourceName: "Fixture source",
          licenseName: "LicenseRef-Project-Authored",
          attributionText: "Project-authored fixture.",
          sourceUrl: "https://example.local/source",
        },
      ],
      userOverrides: [],
      srs: null,
    },
    {
      id: "item-word-school",
      itemType: "word",
      title: "Word school",
      level: 1,
      status: "PUBLISHED",
      target: {
        japanese: "学校",
        reading: "がっこう",
        jlptLevel: "N5",
        translations: {
          ru: [localizedText("ru-RU", "школа", { isPrimary: true })],
          en: [localizedText("en-US", "school", { isPrimary: true })],
        },
        componentDetails: null,
        sourceRecordIds: ["fixture:word:school"],
        strokeGraphic: null,
        attributions: [],
      },
      cards: [],
      mnemonics: [],
      hints: [],
      relations: [],
      attributions: [],
      userOverrides: [],
      srs: null,
    },
  ];
}

function matchesItem(item: ItemRecord, normalizedQuery: string): boolean {
  const searchableValues = [
    item.target.japanese,
    item.target.reading,
    ...item.target.translations.ru.map((text) => text.text),
    ...item.target.translations.en.map((text) => text.text),
    ...item.cards.flatMap((card) => card.answers.map((answer) => answer.text)),
  ].filter((value): value is string => value !== null);

  return searchableValues.some((value) => value.toLowerCase().includes(normalizedQuery));
}

function filterForUser(item: ItemRecord, userId: string | undefined): ItemRecord {
  const cards = item.cards.map((card) => ({
    ...card,
    userOverrides:
      userId === undefined
        ? []
        : card.userOverrides.filter((override) => override.userId === userId),
  }));

  return {
    ...item,
    cards,
    srs:
      userId === "owner" && item.id === "item-word-school"
        ? {
            stageIndex: 2,
            stageName: "Apprentice 2",
            availableAt: "2026-06-17T17:00:00.000Z",
            burnedAt: null,
            wrongCount: 0,
            correctStreak: 2,
          }
        : item.srs,
    mnemonics:
      userId === "owner"
        ? [
            ...item.mnemonics,
            {
              locale: "en-US",
              text: "Imagine one clean stroke.",
              type: "STORY",
              sourceKind: "user",
            },
          ]
        : item.mnemonics,
    userOverrides: cards.flatMap((card) => card.userOverrides),
  };
}

function createUser(id: string): CurrentUserDto {
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
      reviewBudget: 100,
      strictMode: false,
    },
  };
}
