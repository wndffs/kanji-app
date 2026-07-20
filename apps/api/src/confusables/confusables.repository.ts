import { Inject, Injectable } from "@nestjs/common";

import { type AdminContentStatus, type ContentLocale } from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import {
  type ConfusableComparisonKanjiRecord,
  type ConfusableComparisonRecord,
  type ConfusableKanjiRefRecord,
  type ConfusablePairRecord,
  type ConfusableRelatedItemRecord,
  type CreateConfusablePairRecordInput,
  type UpdateConfusablePairRecordInput,
} from "./confusables.types";

export abstract class ConfusablesRepository {
  abstract listPublishedPairs(
    userId: string,
    since: Date,
    itemId?: string,
  ): Promise<readonly ConfusablePairRecord[]>;
  abstract findPublishedPair(id: string): Promise<ConfusablePairRecord | null>;
  abstract findComparison(id: string): Promise<ConfusableComparisonRecord | null>;
  abstract findKanjiRefByItemId(itemId: string): Promise<ConfusableKanjiRefRecord | null>;
  abstract findPairCardIds(id: string): Promise<readonly string[] | null>;
  abstract findPairCardIdsForApproval(id: string): Promise<readonly string[] | null>;
  abstract listAdminPairs(): Promise<readonly ConfusablePairRecord[]>;
  abstract createPair(input: CreateConfusablePairRecordInput): Promise<ConfusablePairRecord>;
  abstract updatePair(
    id: string,
    input: UpdateConfusablePairRecordInput,
  ): Promise<ConfusablePairRecord | null>;
  abstract publishPair(
    id: string,
    approvedByUserId: string,
    approvedAt: Date,
  ): Promise<ConfusablePairRecord | null>;
}

type PairRow = {
  readonly id: string;
  readonly leftKanjiId: string;
  readonly rightKanjiId: string;
  readonly visual: boolean;
  readonly semantic: boolean;
  readonly strength: number;
  readonly explanationRu: string | null;
  readonly explanationEn: string | null;
  readonly sourceNote: string;
  readonly status: string;
  readonly createdByUserId: string;
  readonly approvedByUserId: string | null;
  readonly approvedAt: Date | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly leftKanji: {
    readonly id: string;
    readonly character: string;
    readonly jlptLevel: number | null;
  };
  readonly rightKanji: {
    readonly id: string;
    readonly character: string;
    readonly jlptLevel: number | null;
  };
};

type LearningItemRefRow = {
  readonly id: string;
  readonly targetId: string;
  readonly levelHint: number | null;
};

type LearningItemCardsRow = {
  readonly id: string;
  readonly cards: readonly {
    readonly id: string;
    readonly answerType: string;
    readonly sortOrder: number;
  }[];
};

type WrongAnswerRow = {
  readonly learningCard: {
    readonly learningItem: {
      readonly targetId: string;
    };
  };
};

type KanjiComparisonRow = {
  readonly id: string;
  readonly character: string;
  readonly jlptLevel: number | null;
  readonly readings: readonly { readonly reading: string; readonly priority: number }[];
  readonly meanings: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly isPrimary: boolean;
    readonly sourceKind: string;
  }[];
  readonly components: readonly {
    readonly component: {
      readonly id: string;
      readonly symbol: string;
      readonly meaningRu: string;
      readonly meaningEn: string;
      readonly sourceKind: string;
    };
  }[];
};

type WordComparisonRow = {
  readonly id: string;
  readonly expression: string;
  readonly reading: string;
  readonly senses: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly sourceKind: string;
  }[];
};

const pairInclude = {
  leftKanji: { select: { id: true, character: true, jlptLevel: true } },
  rightKanji: { select: { id: true, character: true, jlptLevel: true } },
} as const;

@Injectable()
export class PrismaConfusablesRepository extends ConfusablesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listPublishedPairs(
    userId: string,
    since: Date,
    itemId?: string,
  ): Promise<readonly ConfusablePairRecord[]> {
    const targetId =
      itemId === undefined ? undefined : (await this.findKanjiRefByItemId(itemId))?.kanjiId;

    if (itemId !== undefined && targetId === undefined) {
      return [];
    }

    const [rows, wrongAnswers] = await Promise.all([
      this.prisma.db.kanjiConfusablePair.findMany({
        where: {
          status: "PUBLISHED",
          ...(targetId === undefined
            ? {}
            : { OR: [{ leftKanjiId: targetId }, { rightKanjiId: targetId }] }),
        },
        include: pairInclude,
        orderBy: [{ strength: "desc" }, { id: "asc" }],
        take: 500,
      }) as Promise<readonly PairRow[]>,
      this.prisma.db.reviewAnswer.findMany({
        where: {
          reviewSession: { userId },
          answeredAt: { gte: since },
          result: { in: ["WRONG", "REVEAL"] },
          learningCard: { learningItem: { targetType: "KANJI" } },
        },
        select: {
          learningCard: {
            select: {
              learningItem: { select: { targetId: true } },
            },
          },
        },
        orderBy: [{ answeredAt: "desc" }, { id: "asc" }],
        take: 1_000,
      }) as Promise<readonly WrongAnswerRow[]>,
    ]);
    const wrongCounts = new Map<string, number>();

    for (const answer of wrongAnswers) {
      const kanjiId = answer.learningCard.learningItem.targetId;
      wrongCounts.set(kanjiId, (wrongCounts.get(kanjiId) ?? 0) + 1);
    }

    return this.hydratePairs(rows, wrongCounts, true);
  }

  async findPublishedPair(id: string): Promise<ConfusablePairRecord | null> {
    const row = (await this.prisma.db.kanjiConfusablePair.findFirst({
      where: { id, status: "PUBLISHED" },
      include: pairInclude,
    })) as PairRow | null;

    if (row === null) {
      return null;
    }

    return (await this.hydratePairs([row], new Map(), true))[0] ?? null;
  }

  async findKanjiRefByItemId(itemId: string): Promise<ConfusableKanjiRefRecord | null> {
    const item = (await this.prisma.db.learningItem.findFirst({
      where: { id: itemId, targetType: "KANJI" },
      select: { id: true, targetId: true, levelHint: true },
    })) as LearningItemRefRow | null;

    if (item === null) {
      return null;
    }

    const kanji = await this.prisma.db.kanji.findUnique({
      where: { id: item.targetId },
      select: { character: true, jlptLevel: true },
    });

    return kanji === null
      ? null
      : {
          kanjiId: item.targetId,
          itemId: item.id,
          character: kanji.character,
          level: item.levelHint,
          jlptLevel: formatJlptLevel(kanji.jlptLevel),
        };
  }

  async findPairCardIds(id: string): Promise<readonly string[] | null> {
    const pair = await this.findPublishedPair(id);

    if (pair === null) {
      return null;
    }

    return this.findCardIdsForKanjiItems(pair.kanji.map((kanji) => kanji.itemId));
  }

  async findPairCardIdsForApproval(id: string): Promise<readonly string[] | null> {
    const pair = (await this.prisma.db.kanjiConfusablePair.findUnique({
      where: { id },
      include: pairInclude,
    })) as PairRow | null;

    if (pair === null) {
      return null;
    }

    const hydrated = (await this.hydratePairs([pair], new Map(), false))[0];

    return hydrated === undefined
      ? null
      : this.findCardIdsForKanjiItems(hydrated.kanji.map((kanji) => kanji.itemId));
  }

  private async findCardIdsForKanjiItems(
    itemIds: readonly string[],
  ): Promise<readonly string[] | null> {
    const items = (await this.prisma.db.learningItem.findMany({
      where: {
        id: { in: [...itemIds] },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        cards: {
          where: {
            cardType: "REVIEW",
            answerType: { in: ["MEANING", "READING"] },
            answers: { some: {} },
          },
          select: { id: true, answerType: true, sortOrder: true },
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
        },
      },
    })) as readonly LearningItemCardsRow[];
    const cardsByItem = new Map(items.map((item) => [item.id, item.cards]));
    const cardIds: string[] = [];

    for (const itemId of itemIds) {
      const cards = cardsByItem.get(itemId) ?? [];
      const meaning = cards.find((card) => card.answerType === "MEANING");
      const reading = cards.find((card) => card.answerType === "READING");

      if (meaning === undefined || reading === undefined) {
        return null;
      }

      cardIds.push(meaning.id, reading.id);
    }

    return cardIds;
  }

  async findComparison(id: string): Promise<ConfusableComparisonRecord | null> {
    const pair = await this.findPublishedPair(id);

    if (pair === null) {
      return null;
    }

    const kanji = await Promise.all(pair.kanji.map((ref) => this.findKanjiComparison(ref)));

    if (kanji[0] === null || kanji[1] === null) {
      return null;
    }

    return { pair, kanji: [kanji[0], kanji[1]] };
  }

  async listAdminPairs(): Promise<readonly ConfusablePairRecord[]> {
    const rows = (await this.prisma.db.kanjiConfusablePair.findMany({
      include: pairInclude,
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    })) as readonly PairRow[];

    return this.hydratePairs(rows, new Map(), false);
  }

  async createPair(input: CreateConfusablePairRecordInput): Promise<ConfusablePairRecord> {
    const row = (await this.prisma.db.kanjiConfusablePair.create({
      data: {
        leftKanjiId: input.left.kanjiId,
        rightKanjiId: input.right.kanjiId,
        visual: input.kinds.includes("visual"),
        semantic: input.kinds.includes("semantic"),
        strength: input.strength,
        explanationRu: input.explanationRu,
        explanationEn: input.explanationEn,
        sourceNote: input.sourceNote,
        sourceKind: "PROJECT_AUTHORED",
        status: "DRAFT",
        createdByUserId: input.createdByUserId,
      },
      include: pairInclude,
    })) as PairRow;

    const created = (await this.hydratePairs([row], new Map(), false))[0];

    if (created === undefined) {
      throw new Error("Created confusable pair has no matching kanji learning items.");
    }

    return created;
  }

  async updatePair(
    id: string,
    input: UpdateConfusablePairRecordInput,
  ): Promise<ConfusablePairRecord | null> {
    const existing = await this.prisma.db.kanjiConfusablePair.findUnique({
      where: { id },
      select: { id: true },
    });

    if (existing === null) {
      return null;
    }

    const row = (await this.prisma.db.kanjiConfusablePair.update({
      where: { id },
      data: {
        visual: input.kinds.includes("visual"),
        semantic: input.kinds.includes("semantic"),
        strength: input.strength,
        explanationRu: input.explanationRu,
        explanationEn: input.explanationEn,
        sourceNote: input.sourceNote,
        status: "NEEDS_REVIEW",
        approvedByUserId: null,
        approvedAt: null,
      },
      include: pairInclude,
    })) as PairRow;

    return (await this.hydratePairs([row], new Map(), false))[0] ?? null;
  }

  async publishPair(
    id: string,
    approvedByUserId: string,
    approvedAt: Date,
  ): Promise<ConfusablePairRecord | null> {
    const updated = await this.prisma.db.kanjiConfusablePair.updateMany({
      where: { id, status: { in: ["DRAFT", "NEEDS_REVIEW"] } },
      data: {
        status: "PUBLISHED",
        approvedByUserId,
        approvedAt,
      },
    });

    if (updated.count === 0) {
      return null;
    }

    const row = (await this.prisma.db.kanjiConfusablePair.findUnique({
      where: { id },
      include: pairInclude,
    })) as PairRow | null;

    return row === null ? null : ((await this.hydratePairs([row], new Map(), false))[0] ?? null);
  }

  private async hydratePairs(
    rows: readonly PairRow[],
    wrongCounts: ReadonlyMap<string, number>,
    requirePublishedItems: boolean,
  ): Promise<readonly ConfusablePairRecord[]> {
    if (rows.length === 0) {
      return [];
    }

    const targetIds = [...new Set(rows.flatMap((row) => [row.leftKanjiId, row.rightKanjiId]))];
    const items = (await this.prisma.db.learningItem.findMany({
      where: {
        targetType: "KANJI",
        targetId: { in: targetIds },
        ...(requirePublishedItems ? { status: "PUBLISHED" } : {}),
      },
      select: { id: true, targetId: true, levelHint: true },
      orderBy: [{ levelHint: "asc" }, { id: "asc" }],
    })) as readonly LearningItemRefRow[];
    const itemByTargetId = new Map<string, LearningItemRefRow>();

    for (const item of items) {
      if (!itemByTargetId.has(item.targetId)) {
        itemByTargetId.set(item.targetId, item);
      }
    }

    return rows.flatMap((row) => {
      const leftItem = itemByTargetId.get(row.leftKanjiId);
      const rightItem = itemByTargetId.get(row.rightKanjiId);

      if (leftItem === undefined || rightItem === undefined) {
        return [];
      }

      return [
        {
          id: row.id,
          kinds: toKinds(row),
          strength: row.strength,
          recentWrongCount:
            (wrongCounts.get(row.leftKanjiId) ?? 0) + (wrongCounts.get(row.rightKanjiId) ?? 0),
          kanji: [toKanjiRef(row.leftKanji, leftItem), toKanjiRef(row.rightKanji, rightItem)],
          explanationRu: row.explanationRu,
          explanationEn: row.explanationEn,
          sourceNote: row.sourceNote,
          status: toStatus(row.status),
          createdByUserId: row.createdByUserId,
          approvedByUserId: row.approvedByUserId,
          approvedAt: row.approvedAt,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        },
      ];
    });
  }

  private async findKanjiComparison(
    ref: ConfusableKanjiRefRecord,
  ): Promise<ConfusableComparisonKanjiRecord | null> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id: ref.kanjiId },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
        components: { include: { component: true }, orderBy: [{ position: "asc" }, { id: "asc" }] },
      },
    })) as KanjiComparisonRow | null;

    if (kanji === null) {
      return null;
    }

    const componentItems = await this.prisma.db.learningItem.findMany({
      where: {
        targetType: "COMPONENT",
        targetId: { in: kanji.components.map((link) => link.component.id) },
        status: "PUBLISHED",
      },
      select: { id: true, targetId: true },
    });
    const componentItemByTarget = new Map(componentItems.map((item) => [item.targetId, item.id]));
    const components = kanji.components.flatMap((link): readonly ConfusableRelatedItemRecord[] => {
      const itemId = componentItemByTarget.get(link.component.id);

      return itemId === undefined
        ? []
        : [
            {
              id: itemId,
              japanese: link.component.symbol,
              reading: null,
              translations: bilingual(
                localized("ru-RU", link.component.meaningRu, link.component.sourceKind),
                localized("en-US", link.component.meaningEn, link.component.sourceKind),
              ),
            },
          ];
    });
    const vocabulary = await this.findVocabulary(ref.itemId);

    return {
      ...ref,
      meanings: bilingualFromRows(
        kanji.meanings.map((meaning) => ({
          locale: meaning.locale,
          text: meaning.meaning,
          isPrimary: meaning.isPrimary,
          sourceKind: meaning.sourceKind,
        })),
      ),
      readings: [...new Set(kanji.readings.map((reading) => reading.reading))],
      components,
      vocabulary,
    };
  }

  private async findVocabulary(
    kanjiItemId: string,
  ): Promise<readonly ConfusableRelatedItemRecord[]> {
    const dependencies = await this.prisma.db.dependency.findMany({
      where: {
        prerequisiteItemId: kanjiItemId,
        learningItem: { targetType: "WORD", status: "PUBLISHED" },
      },
      select: { learningItem: { select: { id: true, targetId: true } } },
      orderBy: [{ learningItem: { levelHint: "asc" } }, { learningItemId: "asc" }],
      take: 4,
    });
    const words = (await this.prisma.db.word.findMany({
      where: { id: { in: dependencies.map((row) => row.learningItem.targetId) } },
      include: { senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] } },
    })) as readonly WordComparisonRow[];
    const wordById = new Map(words.map((word) => [word.id, word]));

    return dependencies.flatMap((dependency) => {
      const word = wordById.get(dependency.learningItem.targetId);

      return word === undefined
        ? []
        : [
            {
              id: dependency.learningItem.id,
              japanese: word.expression,
              reading: word.reading,
              translations: bilingualFromRows(
                word.senses.map((sense, index) => ({
                  locale: sense.locale,
                  text: sense.meaning,
                  isPrimary: index === 0,
                  sourceKind: sense.sourceKind,
                })),
              ),
            },
          ];
    });
  }
}

function toKanjiRef(
  kanji: PairRow["leftKanji"],
  item: LearningItemRefRow,
): ConfusableKanjiRefRecord {
  return {
    kanjiId: kanji.id,
    itemId: item.id,
    character: kanji.character,
    level: item.levelHint,
    jlptLevel: formatJlptLevel(kanji.jlptLevel),
  };
}

function toKinds(row: Pick<PairRow, "visual" | "semantic">) {
  return [
    ...(row.visual ? (["visual"] as const) : []),
    ...(row.semantic ? (["semantic"] as const) : []),
  ];
}

function toStatus(value: string): AdminContentStatus {
  switch (value) {
    case "NEEDS_REVIEW":
      return "needs-review";
    case "PUBLISHED":
      return "published";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}

function localized(locale: ContentLocale, text: string, sourceKind: string) {
  return {
    locale,
    text,
    isPrimary: true,
    sourceKind: sourceKind === "IMPORTED" ? ("imported" as const) : ("curated" as const),
  };
}

function bilingual(ru: ReturnType<typeof localized>, en: ReturnType<typeof localized>) {
  return { ru: ru.text.trim() === "" ? [] : [ru], en: en.text.trim() === "" ? [] : [en] };
}

function bilingualFromRows(
  rows: readonly {
    readonly locale: string;
    readonly text: string;
    readonly isPrimary: boolean;
    readonly sourceKind: string;
  }[],
) {
  const toText = (row: (typeof rows)[number], locale: ContentLocale) => ({
    locale,
    text: row.text,
    isPrimary: row.isPrimary,
    sourceKind: row.sourceKind === "IMPORTED" ? ("imported" as const) : ("curated" as const),
  });

  return {
    ru: rows.filter((row) => row.locale === "ru-RU").map((row) => toText(row, "ru-RU")),
    en: rows.filter((row) => row.locale === "en-US").map((row) => toText(row, "en-US")),
  };
}
