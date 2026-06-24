import { NotFoundException } from "@nestjs/common";
import { describe, expect, it } from "vitest";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { DecksRepository } from "../src/decks/decks.repository";
import { DecksService } from "../src/decks/decks.service";
import {
  type CreateTextDeckInput,
  type TextDeckItemRecord,
  type TextDeckListRecord,
  type TextDeckMatchRecord,
  type TextDeckPrerequisiteRecord,
  type TextDeckRecord,
  type TextDeckTokenLookup,
} from "../src/decks/decks.types";

const NOW = new Date("2026-06-24T09:00:00.000Z");

describe("DecksService", () => {
  it("creates a dynamic deck from pasted Japanese text", async () => {
    const service = createService();

    const response = await service.createFromText(createUser("owner"), {
      title: "Reading sample",
      text: "学校で学ぶ。学校は楽しい。",
    });

    expect(response.deck).toMatchObject({
      title: "Reading sample",
      itemCount: 3,
      newItemCount: 3,
      items: [
        {
          item: {
            id: "item-word-school",
            itemType: "word",
            japanese: "学校",
          },
          reasons: expect.arrayContaining([
            expect.objectContaining({ code: "appears-in-text", matchedText: "学校" }),
            expect.objectContaining({ code: "high-frequency", rank: 120 }),
          ]),
        },
        {
          item: {
            id: "item-kanji-study",
            itemType: "kanji",
            japanese: "学",
          },
          reasons: expect.arrayContaining([
            expect.objectContaining({ code: "appears-in-text", matchedText: "学" }),
            expect.objectContaining({ code: "prerequisite-kanji" }),
          ]),
        },
        {
          item: {
            id: "item-component-child",
            itemType: "component",
          },
          reasons: [expect.objectContaining({ code: "prerequisite-component" })],
        },
      ],
    });
    expect(response.tokenization.strategy).toBe("substring-fallback");
  });

  it("does not duplicate repeated items within one deck", async () => {
    const service = createService();

    const response = await service.createFromText(createUser("owner"), {
      text: "学校学校学校",
    });
    const schoolItems = response.deck.items.filter(
      (deckItem) => deckItem.item.id === "item-word-school",
    );

    expect(schoolItems).toHaveLength(1);
  });

  it("adds unknown user words when they are present in the DB", async () => {
    const service = createService();

    const response = await service.createFromText(createUser("owner"), {
      text: "猫がいる。",
    });

    expect(response.deck.items).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          id: "item-word-cat",
          itemType: "word",
          japanese: "猫",
        }),
        isNewForUser: true,
      }),
    ]);
  });

  it("keeps decks scoped to their owner", async () => {
    const repository = new InMemoryDecksRepository({
      startedItemIds: new Map([["owner", new Set(["item-word-school"])]]),
    });
    const service = new DecksService(repository);

    const response = await service.createFromText(createUser("owner"), {
      title: "Owner text",
      text: "学校",
    });

    await expect(service.getDeck(createUser("owner"), response.deck.id)).resolves.toMatchObject({
      id: response.deck.id,
      newItemCount: 2,
      items: expect.arrayContaining([
        expect.objectContaining({
          item: expect.objectContaining({ id: "item-word-school" }),
          isNewForUser: false,
        }),
      ]),
    });
    await expect(service.getDeck(createUser("other"), response.deck.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.listDecks(createUser("other"))).resolves.toEqual({ decks: [] });
  });
});

class InMemoryDecksRepository extends DecksRepository {
  private readonly items: readonly TextDeckItemRecord[];
  private readonly dependencies: ReadonlyMap<string, readonly string[]>;
  private readonly startedItemIds: ReadonlyMap<string, ReadonlySet<string>>;
  private readonly decks = new Map<string, TextDeckRecord>();
  private nextDeckId = 1;

  constructor(
    options: {
      readonly items?: readonly TextDeckItemRecord[];
      readonly dependencies?: ReadonlyMap<string, readonly string[]>;
      readonly startedItemIds?: ReadonlyMap<string, ReadonlySet<string>>;
    } = {},
  ) {
    super();
    this.items = options.items ?? createItems();
    this.dependencies = options.dependencies ?? createDependencies();
    this.startedItemIds = options.startedItemIds ?? new Map();
  }

  async findTextMatches(tokens: TextDeckTokenLookup): Promise<readonly TextDeckMatchRecord[]> {
    return this.items.flatMap((item) => {
      if (
        item.itemType === "word" &&
        tokens.wordCandidates.includes(item.target.japanese) &&
        tokens.sourceText.includes(item.target.japanese)
      ) {
        return [
          {
            item,
            matchedText: item.target.japanese,
            sourceIndex: tokens.sourceText.indexOf(item.target.japanese),
            frequencyRank: item.target.frequencyRank,
          },
        ];
      }

      if (
        item.itemType === "kanji" &&
        tokens.kanjiCharacters.includes(item.target.japanese) &&
        tokens.sourceText.includes(item.target.japanese)
      ) {
        return [
          {
            item,
            matchedText: item.target.japanese,
            sourceIndex: tokens.sourceText.indexOf(item.target.japanese),
            frequencyRank: item.target.frequencyRank,
          },
        ];
      }

      return [];
    });
  }

  async findPrerequisites(
    learningItemIds: readonly string[],
  ): Promise<readonly TextDeckPrerequisiteRecord[]> {
    return learningItemIds.flatMap((sourceItemId) =>
      (this.dependencies.get(sourceItemId) ?? []).flatMap((prerequisiteItemId) => {
        const item = this.items.find((candidate) => candidate.id === prerequisiteItemId);

        return item === undefined ? [] : [{ sourceItemId, item }];
      }),
    );
  }

  async createTextDeck(input: CreateTextDeckInput): Promise<TextDeckRecord> {
    const id = `deck-${this.nextDeckId++}`;
    const started = this.startedItemIds.get(input.ownerUserId) ?? new Set<string>();
    const storedItems = input.items.map((deckItem) => {
      const item = this.items.find((candidate) => candidate.id === deckItem.learningItemId);

      if (item === undefined) {
        throw new Error(`Missing fixture item ${deckItem.learningItemId}`);
      }

      return {
        item,
        sortOrder: deckItem.sortOrder,
        reasons: deckItem.reasons,
        isNewForUser: !started.has(item.id),
      };
    });
    const deck: TextDeckRecord = {
      id,
      ownerUserId: input.ownerUserId,
      title: input.title,
      sourceText: input.sourceText,
      status: "active",
      createdAt: NOW,
      updatedAt: NOW,
      itemCount: storedItems.length,
      newItemCount: storedItems.filter((item) => item.isNewForUser).length,
      items: storedItems,
    };

    this.decks.set(id, deck);

    return deck;
  }

  async listDecks(ownerUserId: string): Promise<readonly TextDeckListRecord[]> {
    return [...this.decks.values()]
      .filter((deck) => deck.ownerUserId === ownerUserId)
      .map((deck) => {
        const { items: _items, sourceText: _sourceText, ...listRecord } = deck;

        return listRecord;
      });
  }

  async findDeckForOwner(ownerUserId: string, deckId: string): Promise<TextDeckRecord | null> {
    const deck = this.decks.get(deckId);

    return deck === undefined || deck.ownerUserId !== ownerUserId ? null : deck;
  }
}

function createService(): DecksService {
  return new DecksService(new InMemoryDecksRepository());
}

function createItems(): readonly TextDeckItemRecord[] {
  return [
    createItem("item-word-school", "word", "学校", "がっこう", {
      frequencyRank: 120,
      ru: "школа",
      en: "school",
    }),
    createItem("item-kanji-study", "kanji", "学", "がく", {
      frequencyRank: 80,
      ru: "учеба",
      en: "study",
    }),
    createItem("item-component-child", "component", "子", null, {
      frequencyRank: null,
      ru: "ребенок",
      en: null,
    }),
    createItem("item-word-cat", "word", "猫", "ねこ", {
      frequencyRank: 2_400,
      ru: "кот",
      en: "cat",
    }),
  ];
}

function createDependencies(): ReadonlyMap<string, readonly string[]> {
  return new Map([
    ["item-word-school", ["item-kanji-study"]],
    ["item-kanji-study", ["item-component-child"]],
  ]);
}

function createItem(
  id: string,
  itemType: TextDeckItemRecord["itemType"],
  japanese: string,
  reading: string | null,
  options: {
    readonly frequencyRank: number | null;
    readonly ru: string;
    readonly en: string | null;
  },
): TextDeckItemRecord {
  return {
    id,
    itemType,
    title: id,
    level: 1,
    target: {
      japanese,
      reading,
      jlptLevel: itemType === "component" ? null : "N5",
      frequencyRank: options.frequencyRank,
      translations: {
        ru: [{ locale: "ru-RU", text: options.ru, isPrimary: true, sourceKind: "curated" }],
        en:
          options.en === null
            ? []
            : [{ locale: "en-US", text: options.en, isPrimary: true, sourceKind: "curated" }],
      },
    },
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
