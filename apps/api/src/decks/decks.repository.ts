import { Inject, Injectable } from "@nestjs/common";

import { type Prisma } from "@kanji-srs/db";
import {
  type ContentLocale,
  type DeckItemReasonCode,
  type DeckItemReasonDto,
} from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import {
  type CreateTextDeckInput,
  type TextDeckItemRecord,
  type TextDeckListRecord,
  type TextDeckMatchRecord,
  type TextDeckPrerequisiteRecord,
  type TextDeckRecord,
  type TextDeckStoredItemRecord,
  type TextDeckTargetRecord,
  type TextDeckTokenLookup,
  localizedText,
} from "./decks.types";

export abstract class DecksRepository {
  abstract findTextMatches(tokens: TextDeckTokenLookup): Promise<readonly TextDeckMatchRecord[]>;
  abstract findPrerequisites(
    learningItemIds: readonly string[],
  ): Promise<readonly TextDeckPrerequisiteRecord[]>;
  abstract createTextDeck(input: CreateTextDeckInput): Promise<TextDeckRecord>;
  abstract listDecks(ownerUserId: string): Promise<readonly TextDeckListRecord[]>;
  abstract findDeckForOwner(ownerUserId: string, deckId: string): Promise<TextDeckRecord | null>;
  abstract updateDeckStatus(
    ownerUserId: string,
    deckId: string,
    status: "active" | "archived",
  ): Promise<TextDeckRecord | null>;
}

type LearningItemRow = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly title: string;
  readonly levelHint: number | null;
};

type DependencyRow = {
  readonly learningItemId: string;
  readonly prerequisiteItem: LearningItemRow;
};

type WordRow = {
  readonly id: string;
  readonly expression: string;
  readonly reading: string;
  readonly commonnessRank: number | null;
  readonly jlptLevel: number | null;
  readonly senses: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly sourceKind: string;
  }[];
};

type KanjiRow = {
  readonly id: string;
  readonly character: string;
  readonly frequencyRank: number | null;
  readonly jlptLevel: number | null;
  readonly readings: readonly {
    readonly reading: string;
    readonly priority: number;
  }[];
  readonly meanings: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly isPrimary: boolean;
    readonly sourceKind: string;
  }[];
};

type ComponentRow = {
  readonly symbol: string;
  readonly meaningRu: string;
  readonly meaningEn: string;
  readonly sourceKind: string;
};

type SentenceRow = {
  readonly japaneseText: string;
  readonly readingText: string | null;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
};

type DeckRow = {
  readonly id: string;
  readonly ownerUserId: string;
  readonly title: string;
  readonly sourceText: string | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly items: readonly {
    readonly learningItemId: string;
    readonly sortOrder: number;
    readonly reasonJson: unknown;
    readonly learningItem: LearningItemRow;
  }[];
};

@Injectable()
export class PrismaDecksRepository extends DecksRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async findTextMatches(tokens: TextDeckTokenLookup): Promise<readonly TextDeckMatchRecord[]> {
    const [wordMatches, kanjiMatches] = await Promise.all([
      this.findWordMatches(tokens),
      this.findKanjiMatches(tokens),
    ]);

    return [...wordMatches, ...kanjiMatches].sort(
      (left, right) =>
        left.sourceIndex - right.sourceIndex ||
        left.item.itemType.localeCompare(right.item.itemType) ||
        left.item.target.japanese.localeCompare(right.item.target.japanese) ||
        left.item.id.localeCompare(right.item.id),
    );
  }

  async findPrerequisites(
    learningItemIds: readonly string[],
  ): Promise<readonly TextDeckPrerequisiteRecord[]> {
    if (learningItemIds.length === 0) {
      return [];
    }

    const dependencies = (await this.prisma.db.dependency.findMany({
      where: {
        learningItemId: { in: [...new Set(learningItemIds)] },
        dependencyType: "PREREQUISITE",
        prerequisiteItem: {
          status: "PUBLISHED",
        },
      },
      include: {
        prerequisiteItem: true,
      },
      orderBy: [{ learningItemId: "asc" }, { prerequisiteItemId: "asc" }],
    })) as readonly DependencyRow[];

    const records: TextDeckPrerequisiteRecord[] = [];

    for (const dependency of dependencies) {
      records.push({
        sourceItemId: dependency.learningItemId,
        item: await this.toItemRecord(dependency.prerequisiteItem),
      });
    }

    return records;
  }

  async createTextDeck(input: CreateTextDeckInput): Promise<TextDeckRecord> {
    const deck = await this.prisma.db.$transaction(async (tx) => {
      const created = await tx.deck.create({
        data: {
          ownerUserId: input.ownerUserId,
          title: input.title,
          deckType: "TEXT_MINING",
          sourceText: input.sourceText,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      if (input.items.length > 0) {
        await tx.deckItem.createMany({
          data: input.items.map((item) => ({
            deckId: created.id,
            learningItemId: item.learningItemId,
            sortOrder: item.sortOrder,
            reasonJson: item.reasons as Prisma.InputJsonValue,
          })),
          skipDuplicates: true,
        });
      }

      return created;
    });
    const createdDeck = await this.findDeckForOwner(input.ownerUserId, deck.id);

    if (createdDeck === null) {
      throw new Error(`Created text deck ${deck.id} could not be loaded.`);
    }

    return createdDeck;
  }

  async listDecks(ownerUserId: string): Promise<readonly TextDeckListRecord[]> {
    const decks = (await this.prisma.db.deck.findMany({
      where: { ownerUserId },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { learningItem: true },
        },
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    })) as readonly DeckRow[];
    const allItemIds = decks.flatMap((deck) => deck.items.map((item) => item.learningItemId));
    const startedItemIds = await this.findStartedItemIds(ownerUserId, allItemIds);

    return decks.map((deck) => toDeckRecord(deck, [], startedItemIds));
  }

  async findDeckForOwner(ownerUserId: string, deckId: string): Promise<TextDeckRecord | null> {
    const deck = (await this.prisma.db.deck.findFirst({
      where: {
        id: deckId,
        ownerUserId,
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: { learningItem: true },
        },
      },
    })) as DeckRow | null;

    if (deck === null) {
      return null;
    }

    const startedItemIds = await this.findStartedItemIds(
      ownerUserId,
      deck.items.map((item) => item.learningItemId),
    );
    const items: TextDeckStoredItemRecord[] = [];

    for (const item of deck.items) {
      items.push({
        item: await this.toItemRecord(item.learningItem),
        sortOrder: item.sortOrder,
        reasons: readDeckItemReasons(item.reasonJson),
        isNewForUser: !startedItemIds.has(item.learningItemId),
      });
    }

    return toDeckRecord(deck, items, startedItemIds);
  }

  async updateDeckStatus(
    ownerUserId: string,
    deckId: string,
    status: "active" | "archived",
  ): Promise<TextDeckRecord | null> {
    const result = await this.prisma.db.deck.updateMany({
      where: { id: deckId, ownerUserId },
      data: { status: status === "active" ? "ACTIVE" : "ARCHIVED" },
    });

    return result.count === 0 ? null : this.findDeckForOwner(ownerUserId, deckId);
  }

  private async findWordMatches(
    tokens: TextDeckTokenLookup,
  ): Promise<readonly TextDeckMatchRecord[]> {
    if (tokens.wordCandidates.length === 0) {
      return [];
    }

    const words = (await this.prisma.db.word.findMany({
      where: {
        expression: { in: [...tokens.wordCandidates] },
      },
      include: {
        senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] },
      },
      orderBy: [{ commonnessRank: "asc" }, { expression: "asc" }, { reading: "asc" }],
    })) as readonly WordRow[];
    const items = await this.prisma.db.learningItem.findMany({
      where: {
        status: "PUBLISHED",
        targetType: "WORD",
        targetId: { in: words.map((word) => word.id) },
      },
      orderBy: [{ levelHint: "asc" }, { title: "asc" }, { id: "asc" }],
    });
    const wordById = new Map(words.map((word) => [word.id, word]));
    const matches: TextDeckMatchRecord[] = [];

    for (const item of items as readonly LearningItemRow[]) {
      const word = wordById.get(item.targetId);

      if (word === undefined) {
        continue;
      }

      matches.push({
        item: toWordItemRecord(item, word),
        matchedText: word.expression,
        sourceIndex: tokens.sourceText.indexOf(word.expression),
        frequencyRank: word.commonnessRank,
      });
    }

    return matches;
  }

  private async findKanjiMatches(
    tokens: TextDeckTokenLookup,
  ): Promise<readonly TextDeckMatchRecord[]> {
    if (tokens.kanjiCharacters.length === 0) {
      return [];
    }

    const kanji = (await this.prisma.db.kanji.findMany({
      where: {
        character: { in: [...tokens.kanjiCharacters] },
      },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
      orderBy: [{ frequencyRank: "asc" }, { character: "asc" }],
    })) as readonly KanjiRow[];
    const items = await this.prisma.db.learningItem.findMany({
      where: {
        status: "PUBLISHED",
        targetType: "KANJI",
        targetId: { in: kanji.map((row) => row.id) },
      },
      orderBy: [{ levelHint: "asc" }, { title: "asc" }, { id: "asc" }],
    });
    const kanjiById = new Map(kanji.map((row) => [row.id, row]));
    const matches: TextDeckMatchRecord[] = [];

    for (const item of items as readonly LearningItemRow[]) {
      const row = kanjiById.get(item.targetId);

      if (row === undefined) {
        continue;
      }

      matches.push({
        item: toKanjiItemRecord(item, row),
        matchedText: row.character,
        sourceIndex: tokens.sourceText.indexOf(row.character),
        frequencyRank: row.frequencyRank,
      });
    }

    return matches;
  }

  private async findStartedItemIds(
    ownerUserId: string,
    learningItemIds: readonly string[],
  ): Promise<Set<string>> {
    const uniqueItemIds = [...new Set(learningItemIds)];

    if (uniqueItemIds.length === 0) {
      return new Set();
    }

    const states = await this.prisma.db.userSrsState.findMany({
      where: {
        userId: ownerUserId,
        learningCard: {
          learningItemId: { in: uniqueItemIds },
        },
      },
      select: {
        learningCard: {
          select: {
            learningItemId: true,
          },
        },
      },
    });

    return new Set(states.map((state) => state.learningCard.learningItemId));
  }

  private async toItemRecord(item: LearningItemRow): Promise<TextDeckItemRecord> {
    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      title: item.title,
      level: item.levelHint,
      target: await this.findTarget(item),
    };
  }

  private async findTarget(item: LearningItemRow): Promise<TextDeckTargetRecord> {
    switch (item.targetType) {
      case "COMPONENT":
        return this.findComponentTarget(item.targetId);
      case "KANJI":
        return this.findKanjiTarget(item.targetId);
      case "WORD":
        return this.findWordTarget(item.targetId);
      case "SENTENCE":
        return this.findSentenceTarget(item.targetId);
      default:
        throw new Error(`Unsupported learning item target type: ${item.targetType}`);
    }
  }

  private async findComponentTarget(id: string): Promise<TextDeckTargetRecord> {
    const component = (await this.prisma.db.component.findUnique({
      where: { id },
    })) as ComponentRow | null;

    if (component === null) {
      throw new Error(`Missing component target ${id}.`);
    }

    return {
      japanese: component.symbol,
      reading: null,
      jlptLevel: null,
      frequencyRank: null,
      translations: {
        ru: [
          localizedText("ru-RU", component.meaningRu, {
            isPrimary: true,
            sourceKind: toSourceKind(component.sourceKind),
          }),
        ],
        en: [
          localizedText("en-US", component.meaningEn, {
            isPrimary: true,
            sourceKind: toSourceKind(component.sourceKind),
          }),
        ],
      },
    };
  }

  private async findKanjiTarget(id: string): Promise<TextDeckTargetRecord> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
    })) as KanjiRow | null;

    if (kanji === null) {
      throw new Error(`Missing kanji target ${id}.`);
    }

    return toKanjiTargetRecord(kanji);
  }

  private async findWordTarget(id: string): Promise<TextDeckTargetRecord> {
    const word = (await this.prisma.db.word.findUnique({
      where: { id },
      include: {
        senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] },
      },
    })) as WordRow | null;

    if (word === null) {
      throw new Error(`Missing word target ${id}.`);
    }

    return toWordTargetRecord(word);
  }

  private async findSentenceTarget(id: string): Promise<TextDeckTargetRecord> {
    const sentence = (await this.prisma.db.sentence.findUnique({
      where: { id },
    })) as SentenceRow | null;

    if (sentence === null) {
      throw new Error(`Missing sentence target ${id}.`);
    }

    return {
      japanese: sentence.japaneseText,
      reading: sentence.readingText,
      jlptLevel: null,
      frequencyRank: null,
      translations: {
        ru:
          sentence.translationRu === null
            ? []
            : [localizedText("ru-RU", sentence.translationRu, { isPrimary: true })],
        en:
          sentence.translationEn === null
            ? []
            : [localizedText("en-US", sentence.translationEn, { isPrimary: true })],
      },
    };
  }
}

function toWordItemRecord(item: LearningItemRow, word: WordRow): TextDeckItemRecord {
  return {
    id: item.id,
    itemType: "word",
    title: item.title,
    level: item.levelHint,
    target: toWordTargetRecord(word),
  };
}

function toKanjiItemRecord(item: LearningItemRow, kanji: KanjiRow): TextDeckItemRecord {
  return {
    id: item.id,
    itemType: "kanji",
    title: item.title,
    level: item.levelHint,
    target: toKanjiTargetRecord(kanji),
  };
}

function toWordTargetRecord(word: WordRow): TextDeckTargetRecord {
  return {
    japanese: word.expression,
    reading: word.reading,
    jlptLevel: formatJlptLevel(word.jlptLevel),
    frequencyRank: word.commonnessRank,
    translations: groupLocalizedTexts(
      word.senses.map((sense, index) =>
        localizedText(toContentLocale(sense.locale), sense.meaning, {
          isPrimary: isFirstForLocale(word.senses, sense.locale, index),
          sourceKind: toSourceKind(sense.sourceKind),
        }),
      ),
    ),
  };
}

function toKanjiTargetRecord(kanji: KanjiRow): TextDeckTargetRecord {
  return {
    japanese: kanji.character,
    reading: kanji.readings[0]?.reading ?? null,
    jlptLevel: formatJlptLevel(kanji.jlptLevel),
    frequencyRank: kanji.frequencyRank,
    translations: groupLocalizedTexts(
      kanji.meanings.map((meaning) =>
        localizedText(toContentLocale(meaning.locale), meaning.meaning, {
          isPrimary: meaning.isPrimary,
          sourceKind: toSourceKind(meaning.sourceKind),
        }),
      ),
    ),
  };
}

function toDeckRecord(
  deck: DeckRow,
  items: readonly TextDeckStoredItemRecord[],
  startedItemIds: ReadonlySet<string>,
): TextDeckRecord {
  return {
    id: deck.id,
    ownerUserId: deck.ownerUserId,
    title: deck.title,
    sourceText: deck.sourceText,
    status: toDeckStatus(deck.status),
    createdAt: deck.createdAt,
    updatedAt: deck.updatedAt,
    itemCount: deck.items.length,
    newItemCount: deck.items.filter((item) => !startedItemIds.has(item.learningItemId)).length,
    items,
  };
}

function readDeckItemReasons(value: unknown): readonly DeckItemReasonDto[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item !== "object" || item === null) {
      return [];
    }

    const record = item as {
      readonly code?: unknown;
      readonly detail?: unknown;
      readonly matchedText?: unknown;
      readonly sourceItemId?: unknown;
      readonly rank?: unknown;
    };

    if (
      typeof record.code !== "string" ||
      !isDeckItemReasonCode(record.code) ||
      typeof record.detail !== "string"
    ) {
      return [];
    }

    return [
      {
        code: record.code,
        detail: record.detail,
        matchedText:
          typeof record.matchedText === "string" || record.matchedText === null
            ? record.matchedText
            : undefined,
        sourceItemId:
          typeof record.sourceItemId === "string" || record.sourceItemId === null
            ? record.sourceItemId
            : undefined,
        rank: typeof record.rank === "number" || record.rank === null ? record.rank : undefined,
      },
    ];
  });
}

function isDeckItemReasonCode(value: string): value is DeckItemReasonCode {
  switch (value) {
    case "appears-in-text":
    case "prerequisite-kanji":
    case "prerequisite-component":
    case "high-frequency":
      return true;
    default:
      return false;
  }
}

function toItemKind(kind: string): TextDeckItemRecord["itemType"] {
  switch (kind) {
    case "COMPONENT":
      return "component";
    case "KANJI":
      return "kanji";
    case "WORD":
      return "word";
    case "SENTENCE":
      return "sentence";
    default:
      throw new Error(`Unsupported learning item kind: ${kind}`);
  }
}

function toDeckStatus(status: string): TextDeckRecord["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

function toContentLocale(locale: string): ContentLocale {
  return locale === "en-US" ? "en-US" : "ru-RU";
}

function toSourceKind(value: string): "curated" | "imported" | "user" {
  switch (value) {
    case "IMPORTED":
      return "imported";
    case "USER_PRIVATE":
      return "user";
    default:
      return "curated";
  }
}

function groupLocalizedTexts(
  texts: readonly {
    readonly locale: ContentLocale;
    readonly text: string;
    readonly isPrimary?: boolean;
    readonly sourceKind?: "curated" | "imported" | "user";
  }[],
) {
  return {
    ru: texts.filter((text) => text.locale === "ru-RU"),
    en: texts.filter((text) => text.locale === "en-US"),
  };
}

function isFirstForLocale(
  senses: readonly { readonly locale: string }[],
  locale: string,
  index: number,
): boolean {
  return senses.findIndex((sense) => sense.locale === locale) === index;
}

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}
