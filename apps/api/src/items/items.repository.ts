import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  type ItemAnswerRecord,
  type ItemBlockedAnswerRecord,
  type ItemCardRecord,
  type ItemLookupOptions,
  type ItemRecord,
  type ItemRelationRecord,
  type ItemTargetRecord,
  type ItemTextRecord,
  type ItemUserOverrideRecord,
  localizedText,
} from "./items.types";

export abstract class ItemsRepository {
  abstract findItemById(id: string, options: ItemLookupOptions): Promise<ItemRecord | null>;
  abstract findKanjiItemByCharacter(
    character: string,
    options: ItemLookupOptions,
  ): Promise<ItemRecord | null>;
  abstract searchItems(query: string, options: ItemLookupOptions): Promise<readonly ItemRecord[]>;
}

type LearningItemRow = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly title: string;
  readonly levelHint: number | null;
  readonly status: string;
  readonly cards?: readonly LearningCardRow[];
  readonly mnemonics?: readonly TextRow[];
  readonly hints?: readonly TextRow[];
  readonly dependencies?: readonly DependencyRow[];
};

type LearningCardRow = {
  readonly id: string;
  readonly cardType: string;
  readonly promptType: string;
  readonly answerType: string;
  readonly sortOrder: number;
  readonly answers?: readonly AnswerRow[];
  readonly blockedAnswers?: readonly BlockedAnswerRow[];
  readonly userOverrides?: readonly UserOverrideRow[];
};

type AnswerRow = {
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: string;
  readonly locale: string;
  readonly isPrimary: boolean;
};

type BlockedAnswerRow = {
  readonly text: string;
  readonly normalizedText: string;
  readonly reason: string | null;
};

type TextRow = {
  readonly locale: string;
  readonly body: string;
  readonly mnemonicType?: string;
  readonly hintType?: string;
  readonly sourceKind: string;
};

type DependencyRow = {
  readonly dependencyType: string;
  readonly prerequisiteItem: LearningItemRow;
};

type UserOverrideRow = {
  readonly id: string;
  readonly userId: string;
  readonly learningCardId: string;
  readonly overrideType: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type HydrationOptions = ItemLookupOptions & {
  readonly relationDepth: number;
};

type ComponentRow = {
  readonly symbol: string;
  readonly displayNameRu: string;
  readonly meaningRu: string;
  readonly sourceKind: string;
};

type KanjiRow = {
  readonly character: string;
  readonly jlptLevel: number | null;
  readonly kanjidicSourceId: string | null;
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

type WordRow = {
  readonly expression: string;
  readonly reading: string;
  readonly jlptLevel: number | null;
  readonly jmdictEntryId: string | null;
  readonly senses: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly sourceKind: string;
  }[];
};

type SentenceRow = {
  readonly japaneseText: string;
  readonly readingText: string | null;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
  readonly sourceId: string | null;
  readonly dataSource: {
    readonly name: string;
    readonly homepageUrl: string | null;
    readonly attributionText: string;
    readonly license: {
      readonly name: string;
    };
  } | null;
  readonly license: {
    readonly name: string;
  };
};

@Injectable()
export class PrismaItemsRepository extends ItemsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async findItemById(id: string, options: ItemLookupOptions): Promise<ItemRecord | null> {
    const item = await this.findLearningItem({ id }, options);

    return item === null ? null : this.toItemRecord(item, { ...options, relationDepth: 1 });
  }

  async findKanjiItemByCharacter(
    character: string,
    options: ItemLookupOptions,
  ): Promise<ItemRecord | null> {
    const kanji = await this.prisma.db.kanji.findUnique({
      where: { character },
      select: { id: true },
    });

    if (kanji === null) {
      return null;
    }

    const item = await this.findLearningItem(
      {
        targetType_targetId: {
          targetType: "KANJI",
          targetId: kanji.id,
        },
      },
      options,
    );

    return item === null ? null : this.toItemRecord(item, { ...options, relationDepth: 1 });
  }

  async searchItems(query: string, options: ItemLookupOptions): Promise<readonly ItemRecord[]> {
    const itemIds = await this.findMatchingItemIds(query);
    const records: ItemRecord[] = [];

    for (const id of itemIds) {
      const item = await this.findItemById(id, options);

      if (item !== null) {
        records.push(item);
      }
    }

    return records;
  }

  private async findLearningItem(
    where:
      | { readonly id: string }
      | {
          readonly targetType_targetId: {
            readonly targetType: "COMPONENT" | "KANJI" | "WORD" | "SENTENCE";
            readonly targetId: string;
          };
        },
    options: ItemLookupOptions,
  ): Promise<LearningItemRow | null> {
    const item = await this.prisma.db.learningItem.findUnique({
      where,
      include: {
        cards: {
          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          include: {
            answers: { orderBy: [{ isPrimary: "desc" }, { text: "asc" }] },
            blockedAnswers: { orderBy: { text: "asc" } },
            userOverrides:
              options.userId === undefined
                ? false
                : {
                    where: { userId: options.userId },
                    orderBy: { createdAt: "asc" },
                  },
          },
        },
        mnemonics: { orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }, { version: "desc" }] },
        hints: { orderBy: [{ locale: "asc" }, { hintType: "asc" }, { version: "desc" }] },
        dependencies: {
          include: {
            prerequisiteItem: true,
          },
          orderBy: { dependencyType: "asc" },
        },
      },
    });

    return item as LearningItemRow | null;
  }

  private async findMatchingItemIds(query: string): Promise<readonly string[]> {
    const itemIds = new Set<string>();
    const contains = { contains: query, mode: "insensitive" as const };

    const [
      directItems,
      components,
      kanji,
      kanjiReadings,
      kanjiMeanings,
      words,
      wordSenses,
      sentences,
      answers,
    ] = await Promise.all([
      this.prisma.db.learningItem.findMany({
        where: { title: contains },
        select: { id: true },
        orderBy: { title: "asc" },
      }),
      this.prisma.db.component.findMany({
        where: {
          OR: [{ symbol: query }, { displayNameRu: contains }, { meaningRu: contains }],
        },
        select: { id: true },
      }),
      this.prisma.db.kanji.findMany({
        where: { character: { contains: query } },
        select: { id: true },
      }),
      this.prisma.db.kanjiReading.findMany({
        where: { reading: { contains: query } },
        select: { kanjiId: true },
      }),
      this.prisma.db.kanjiMeaning.findMany({
        where: { meaning: contains },
        select: { kanjiId: true },
      }),
      this.prisma.db.word.findMany({
        where: {
          OR: [{ expression: { contains: query } }, { reading: { contains: query } }],
        },
        select: { id: true },
      }),
      this.prisma.db.wordSense.findMany({
        where: { meaning: contains },
        select: { wordId: true },
      }),
      this.prisma.db.sentence.findMany({
        where: {
          OR: [
            { japaneseText: { contains: query } },
            { readingText: { contains: query } },
            { translationRu: contains },
            { translationEn: contains },
          ],
        },
        select: { id: true },
      }),
      this.prisma.db.learningAnswer.findMany({
        where: { text: contains },
        select: { learningCard: { select: { learningItemId: true } } },
      }),
    ]);

    for (const item of directItems) {
      itemIds.add(item.id);
    }

    await this.addItemIdsForTargets(
      itemIds,
      "COMPONENT",
      components.map((component) => component.id),
    );
    await this.addItemIdsForTargets(itemIds, "KANJI", [
      ...kanji.map((row) => row.id),
      ...kanjiReadings.map((row) => row.kanjiId),
      ...kanjiMeanings.map((row) => row.kanjiId),
    ]);
    await this.addItemIdsForTargets(itemIds, "WORD", [
      ...words.map((row) => row.id),
      ...wordSenses.map((row) => row.wordId),
    ]);
    await this.addItemIdsForTargets(
      itemIds,
      "SENTENCE",
      sentences.map((row) => row.id),
    );

    for (const answer of answers) {
      itemIds.add(answer.learningCard.learningItemId);
    }

    return [...itemIds];
  }

  private async addItemIdsForTargets(
    itemIds: Set<string>,
    targetType: "COMPONENT" | "KANJI" | "WORD" | "SENTENCE",
    targetIds: readonly string[],
  ): Promise<void> {
    const uniqueTargetIds = [...new Set(targetIds)];

    if (uniqueTargetIds.length === 0) {
      return;
    }

    const items = await this.prisma.db.learningItem.findMany({
      where: {
        targetType,
        targetId: { in: uniqueTargetIds },
      },
      select: { id: true },
    });

    for (const item of items) {
      itemIds.add(item.id);
    }
  }

  private async toItemRecord(
    item: LearningItemRow,
    options: HydrationOptions,
  ): Promise<ItemRecord> {
    const target = await this.findTarget(item);
    const relations = await this.findRelations(item, options);
    const attributions = [
      ...target.attributions,
      ...(await this.findAttributions(target.sourceRecordIds)),
    ];
    const cards = (item.cards ?? []).map(toCardRecord);
    const userOverrides = cards.flatMap((card) => card.userOverrides);

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      title: item.title,
      level: item.levelHint,
      status: item.status,
      target,
      cards,
      mnemonics: (item.mnemonics ?? []).map(toTextRecord),
      hints: (item.hints ?? []).map(toTextRecord),
      relations,
      attributions,
      userOverrides,
    };
  }

  private async findRelations(
    item: LearningItemRow,
    options: HydrationOptions,
  ): Promise<readonly ItemRelationRecord[]> {
    if (options.relationDepth < 1) {
      return [];
    }

    const relations: ItemRelationRecord[] = [];

    for (const dependency of item.dependencies ?? []) {
      const related = await this.findLearningItem({ id: dependency.prerequisiteItem.id }, options);

      if (related !== null) {
        relations.push({
          relationType: "dependency",
          item: await this.toItemRecord(related, {
            ...options,
            relationDepth: options.relationDepth - 1,
          }),
        });
      }
    }

    return relations;
  }

  private async findTarget(item: LearningItemRow): Promise<ItemTargetRecord> {
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

  private async findComponentTarget(id: string): Promise<ItemTargetRecord> {
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
      translations: {
        ru: [
          localizedText("ru-RU", component.meaningRu, {
            isPrimary: true,
            sourceKind: toSourceKind(component.sourceKind),
          }),
          localizedText("ru-RU", component.displayNameRu, {
            sourceKind: toSourceKind(component.sourceKind),
          }),
        ],
        en: [],
      },
      sourceRecordIds: [],
      attributions: [],
    };
  }

  private async findKanjiTarget(id: string): Promise<ItemTargetRecord> {
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

    return {
      japanese: kanji.character,
      reading: kanji.readings[0]?.reading ?? null,
      jlptLevel: formatJlptLevel(kanji.jlptLevel),
      translations: groupLocalizedTexts(
        kanji.meanings.map((meaning) =>
          localizedText(toContentLocale(meaning.locale), meaning.meaning, {
            isPrimary: meaning.isPrimary,
            sourceKind: toSourceKind(meaning.sourceKind),
          }),
        ),
      ),
      sourceRecordIds: kanji.kanjidicSourceId === null ? [] : [kanji.kanjidicSourceId],
      attributions: [],
    };
  }

  private async findWordTarget(id: string): Promise<ItemTargetRecord> {
    const word = (await this.prisma.db.word.findUnique({
      where: { id },
      include: {
        senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] },
      },
    })) as WordRow | null;

    if (word === null) {
      throw new Error(`Missing word target ${id}.`);
    }

    return {
      japanese: word.expression,
      reading: word.reading,
      jlptLevel: formatJlptLevel(word.jlptLevel),
      translations: groupLocalizedTexts(
        word.senses.map((sense, index) =>
          localizedText(toContentLocale(sense.locale), sense.meaning, {
            isPrimary: index === 0,
            sourceKind: toSourceKind(sense.sourceKind),
          }),
        ),
      ),
      sourceRecordIds: word.jmdictEntryId === null ? [] : [word.jmdictEntryId],
      attributions: [],
    };
  }

  private async findSentenceTarget(id: string): Promise<ItemTargetRecord> {
    const sentence = (await this.prisma.db.sentence.findUnique({
      where: { id },
      include: {
        dataSource: { include: { license: true } },
        license: true,
      },
    })) as SentenceRow | null;

    if (sentence === null) {
      throw new Error(`Missing sentence target ${id}.`);
    }

    return {
      japanese: sentence.japaneseText,
      reading: sentence.readingText,
      jlptLevel: null,
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
      sourceRecordIds: sentence.sourceId === null ? [] : [sentence.sourceId],
      attributions:
        sentence.dataSource === null
          ? [
              {
                sourceName: "Unknown sentence source",
                licenseName: sentence.license.name,
                attributionText: "",
                sourceUrl: null,
              },
            ]
          : [
              {
                sourceName: sentence.dataSource.name,
                licenseName: sentence.dataSource.license.name,
                attributionText: sentence.dataSource.attributionText,
                sourceUrl: sentence.dataSource.homepageUrl,
              },
            ],
    };
  }

  private async findAttributions(sourceRecordIds: readonly string[]) {
    if (sourceRecordIds.length === 0) {
      return [];
    }

    const records = await this.prisma.db.importedRecord.findMany({
      where: {
        sourceRecordId: { in: [...sourceRecordIds] },
      },
      include: {
        importRun: {
          include: {
            dataSource: {
              include: {
                license: true,
              },
            },
          },
        },
      },
    });

    const seen = new Set<string>();

    return records.flatMap((record) => {
      const source = record.importRun.dataSource;
      const key = source.id;

      if (seen.has(key)) {
        return [];
      }

      seen.add(key);

      return [
        {
          sourceName: source.name,
          licenseName: source.license.name,
          attributionText: source.attributionText,
          sourceUrl: source.homepageUrl,
        },
      ];
    });
  }
}

function toCardRecord(card: LearningCardRow): ItemCardRecord {
  return {
    id: card.id,
    cardType: card.cardType === "LESSON" ? "lesson" : "review",
    promptType: toPromptType(card.promptType),
    answerType: card.answerType === "READING" ? "reading" : "meaning",
    sortOrder: card.sortOrder,
    answers: (card.answers ?? []).map(toAnswerRecord),
    blockedAnswers: (card.blockedAnswers ?? []).map(toBlockedAnswerRecord),
    userOverrides: (card.userOverrides ?? []).map(toUserOverrideRecord),
  };
}

function toAnswerRecord(answer: AnswerRow): ItemAnswerRecord {
  return {
    locale: toContentLocale(answer.locale),
    text: answer.text,
    normalizedText: answer.normalizedText,
    answerKind: answer.answerKind === "READING" ? "reading" : "meaning",
    isPrimary: answer.isPrimary,
  };
}

function toBlockedAnswerRecord(answer: BlockedAnswerRow): ItemBlockedAnswerRecord {
  return {
    locale: "ru-RU",
    text: answer.text,
    normalizedText: answer.normalizedText,
    reason: answer.reason,
  };
}

function toUserOverrideRecord(override: UserOverrideRow): ItemUserOverrideRecord {
  return {
    id: override.id,
    userId: override.userId,
    learningCardId: override.learningCardId,
    overrideType: toOverrideType(override.overrideType),
    text: override.text,
    normalizedText: override.normalizedText,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  };
}

function toTextRecord(text: TextRow): ItemTextRecord {
  return {
    locale: toContentLocale(text.locale),
    text: text.body,
    type: text.mnemonicType ?? text.hintType ?? "TEXT",
    sourceKind: toSourceKind(text.sourceKind),
  };
}

function toItemKind(kind: string) {
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

function toPromptType(value: string) {
  switch (value) {
    case "READING":
      return "reading";
    case "RECALL":
      return "recall";
    case "CLOZE":
      return "cloze";
    case "RECOGNITION":
      return "recognition";
    default:
      return "meaning";
  }
}

function toOverrideType(value: string): ItemUserOverrideRecord["overrideType"] {
  switch (value) {
    case "ACCEPTED_READING":
      return "accepted-reading";
    case "BLOCKED_PERSONAL":
      return "blocked-personal";
    case "NOTE":
      return "note";
    default:
      return "accepted-meaning";
  }
}

function toContentLocale(locale: string) {
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
  texts: readonly { readonly locale: "ru-RU" | "en-US"; readonly text: string }[],
) {
  return {
    ru: texts.filter((text) => text.locale === "ru-RU"),
    en: texts.filter((text) => text.locale === "en-US"),
  };
}

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}
