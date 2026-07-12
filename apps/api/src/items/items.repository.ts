import { Inject, Injectable } from "@nestjs/common";

import { calculateLeechScore, type LeechScoreResult } from "@kanji-srs/srs";
import { type SourceAttributionDto, type SrsStateSummaryDto } from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import {
  type ItemAnswerRecord,
  type ItemBlockedAnswerRecord,
  type ItemCardRecord,
  type ItemLookupOptions,
  type ItemRecord,
  type ItemRelationRecord,
  type ItemStrokeGraphicRecord,
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
  readonly userMnemonics?: readonly UserMnemonicTextRow[];
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

type UserMnemonicTextRow = {
  readonly locale: string;
  readonly body: string;
  readonly mnemonicType: string;
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
  readonly locale: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly note: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

type HydrationOptions = ItemLookupOptions & {
  readonly relationDepth: number;
};

type ComponentRow = {
  readonly symbol: string;
  readonly displayNameRu: string;
  readonly displayNameEn: string;
  readonly shapeDescriptionRu: string | null;
  readonly shapeDescriptionEn: string | null;
  readonly meaningRu: string;
  readonly meaningEn: string;
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
  readonly strokeGraphic: {
    readonly sourceRecordId: string;
    readonly viewBox: string;
    readonly strokesJson: unknown;
  } | null;
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
  readonly id: string;
  readonly japaneseText: string;
  readonly readingText: string | null;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
  readonly difficulty: number | null;
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

type SentenceDependencyRow = {
  readonly learningItem: {
    readonly targetId: string;
  };
};

type ItemSrsStateRow = {
  readonly stageIndex: number;
  readonly availableAt: Date | null;
  readonly burnedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly srsSystem: {
    readonly stages: readonly {
      readonly stageIndex: number;
      readonly name: string;
    }[];
  };
  readonly reviewAnswers: readonly {
    readonly result: string;
    readonly previousStageIndex: number | null;
    readonly nextStageIndex: number | null;
  }[];
};

const LEECH_RECENT_REVIEW_DAYS = 14;

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
        userMnemonics:
          options.userId === undefined
            ? false
            : {
                where: { userId: options.userId },
                orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }],
              },
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
          OR: [
            { symbol: query },
            { displayNameRu: contains },
            { displayNameEn: contains },
            { shapeDescriptionRu: contains },
            { shapeDescriptionEn: contains },
            { meaningRu: contains },
            { meaningEn: contains },
          ],
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
    const srs = await this.findItemSrsSummary(item.id, options.userId);
    const exampleSentences =
      options.includeExamples === false ? [] : await this.findExampleSentences(item.id);

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      title: item.title,
      level: item.levelHint,
      status: item.status,
      target,
      cards,
      mnemonics: [
        ...(item.mnemonics ?? []).map(toTextRecord),
        ...(item.userMnemonics ?? []).map(toUserMnemonicTextRecord),
      ],
      hints: (item.hints ?? []).map(toTextRecord),
      relations,
      exampleSentences,
      attributions,
      userOverrides,
      srs,
    };
  }

  private async findItemSrsSummary(
    learningItemId: string,
    userId: string | undefined,
  ): Promise<SrsStateSummaryDto | null> {
    if (userId === undefined) {
      return null;
    }

    const states = (await this.prisma.db.userSrsState.findMany({
      where: {
        userId,
        learningCard: {
          learningItemId,
        },
      },
      include: {
        srsSystem: {
          include: {
            stages: {
              orderBy: { stageIndex: "asc" },
            },
          },
        },
        reviewAnswers: {
          where: {
            answeredAt: {
              gte: addDays(new Date(), -LEECH_RECENT_REVIEW_DAYS),
            },
          },
          select: {
            result: true,
            previousStageIndex: true,
            nextStageIndex: true,
          },
        },
      },
      orderBy: [{ stageIndex: "asc" }, { updatedAt: "asc" }, { id: "asc" }],
    })) as readonly ItemSrsStateRow[];

    if (states.length === 0) {
      return null;
    }

    const selected = selectRepresentativeState(states);
    const stage = selected.srsSystem.stages.find(
      (candidate) => candidate.stageIndex === selected.stageIndex,
    );

    return {
      stageIndex: selected.stageIndex,
      stageName: stage?.name ?? `Stage ${selected.stageIndex}`,
      availableAt: selected.availableAt?.toISOString() ?? null,
      burnedAt: selected.burnedAt?.toISOString() ?? null,
      wrongCount: selected.wrongCount,
      correctStreak: selected.correctStreak,
      leech: toLeechScoreDto(
        calculateLeechScore({
          wrongCount: selected.wrongCount,
          correctStreak: selected.correctStreak,
          burnedAt: selected.burnedAt,
          recentWrongCount: countWrongLikeAnswers(selected.reviewAnswers),
          stageDropCount: countStageDrops(selected.reviewAnswers),
          stageDropMagnitude: sumStageDropMagnitude(selected.reviewAnswers),
        }),
      ),
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
            includeExamples: false,
          }),
        });
      }
    }

    return relations;
  }

  private async findExampleSentences(learningItemId: string) {
    const dependencies = (await this.prisma.db.dependency.findMany({
      where: {
        prerequisiteItemId: learningItemId,
        dependencyType: "PREREQUISITE",
        learningItem: {
          targetType: "SENTENCE",
          status: "PUBLISHED",
        },
      },
      select: {
        learningItem: {
          select: { targetId: true },
        },
      },
      orderBy: [{ learningItem: { levelHint: "asc" } }, { learningItemId: "asc" }],
    })) as readonly SentenceDependencyRow[];
    const targetIds = [
      ...new Set(dependencies.map((dependency) => dependency.learningItem.targetId)),
    ];

    if (targetIds.length === 0) {
      return [];
    }

    const sentences = (await this.prisma.db.sentence.findMany({
      where: {
        id: { in: targetIds },
        translationRu: { not: null },
        translationEn: { not: null },
      },
      include: {
        dataSource: { include: { license: true } },
        license: true,
      },
    })) as readonly SentenceRow[];
    const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));

    return targetIds
      .flatMap((id) => {
        const sentence = sentenceById.get(id);

        if (
          sentence === undefined ||
          sentence.translationRu === null ||
          sentence.translationEn === null
        ) {
          return [];
        }

        return [
          {
            id: sentence.id,
            japaneseText: sentence.japaneseText,
            readingText: sentence.readingText,
            translationRu: sentence.translationRu,
            translationEn: sentence.translationEn,
            difficulty: sentence.difficulty,
            attribution: toSentenceAttribution(sentence),
          },
        ];
      })
      .slice(0, 5);
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
        ],
        en: [
          localizedText("en-US", component.meaningEn, {
            isPrimary: true,
            sourceKind: toSourceKind(component.sourceKind),
          }),
        ],
      },
      componentDetails: {
        name: {
          ru: [
            localizedText("ru-RU", component.displayNameRu, {
              isPrimary: true,
              sourceKind: toSourceKind(component.sourceKind),
            }),
          ],
          en: [
            localizedText("en-US", component.displayNameEn, {
              isPrimary: true,
              sourceKind: toSourceKind(component.sourceKind),
            }),
          ],
        },
        shapeDescription: {
          ru: optionalLocalizedText("ru-RU", component.shapeDescriptionRu, component.sourceKind),
          en: optionalLocalizedText("en-US", component.shapeDescriptionEn, component.sourceKind),
        },
      },
      sourceRecordIds: [],
      strokeGraphic: null,
      attributions: [],
    };
  }

  private async findKanjiTarget(id: string): Promise<ItemTargetRecord> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
        strokeGraphic: true,
      },
    })) as KanjiRow | null;

    if (kanji === null) {
      throw new Error(`Missing kanji target ${id}.`);
    }

    const strokeGraphic = toStrokeGraphic(kanji.strokeGraphic);

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
      componentDetails: null,
      sourceRecordIds: uniqueSourceRecordIds(
        kanji.kanjidicSourceId,
        strokeGraphic?.sourceRecordId ?? null,
      ),
      strokeGraphic,
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
      componentDetails: null,
      sourceRecordIds: word.jmdictEntryId === null ? [] : [word.jmdictEntryId],
      strokeGraphic: null,
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
      componentDetails: null,
      sourceRecordIds: sentence.sourceId === null ? [] : [sentence.sourceId],
      strokeGraphic: null,
      attributions: [toSentenceAttribution(sentence)],
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
    locale: toContentLocale(override.locale),
    text: override.text,
    normalizedText: override.normalizedText,
    note: override.note,
    createdAt: override.createdAt,
    updatedAt: override.updatedAt,
  };
}

function toUserMnemonicTextRecord(text: UserMnemonicTextRow): ItemTextRecord {
  return {
    locale: toContentLocale(text.locale),
    text: text.body,
    type: text.mnemonicType,
    sourceKind: "user",
  };
}

function toSentenceAttribution(sentence: SentenceRow): SourceAttributionDto {
  if (sentence.dataSource === null) {
    return {
      sourceName: "Unknown sentence source",
      licenseName: sentence.license.name,
      attributionText: "",
      sourceUrl: null,
    };
  }

  return {
    sourceName: sentence.dataSource.name,
    licenseName: sentence.dataSource.license.name,
    attributionText: sentence.dataSource.attributionText,
    sourceUrl: sentence.dataSource.homepageUrl,
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

function optionalLocalizedText(locale: "ru-RU" | "en-US", text: string | null, sourceKind: string) {
  return text === null || text.trim() === ""
    ? []
    : [
        localizedText(locale, text, {
          isPrimary: true,
          sourceKind: toSourceKind(sourceKind),
        }),
      ];
}

function selectRepresentativeState(states: readonly ItemSrsStateRow[]): ItemSrsStateRow {
  const sorted = [...states].sort(
    (left, right) =>
      burnedPriority(left) - burnedPriority(right) ||
      left.stageIndex - right.stageIndex ||
      (left.availableAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
        (right.availableAt?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );

  const selected = sorted[0];

  if (selected === undefined) {
    throw new Error("Cannot select an SRS state from an empty list.");
  }

  return selected;
}

function toLeechScoreDto(leech: LeechScoreResult): NonNullable<SrsStateSummaryDto["leech"]> {
  return {
    score: leech.score,
    isCandidate: leech.isCandidate,
    wrongCount: leech.wrongCount,
    correctStreak: leech.correctStreak,
    recentWrongCount: leech.recentWrongCount,
    stageDropCount: leech.stageDropCount,
    stageDropMagnitude: leech.stageDropMagnitude,
    reasons: leech.reasons,
  };
}

function countWrongLikeAnswers(
  answers: readonly {
    readonly result: string;
  }[],
): number {
  return answers.filter((answer) => answer.result === "WRONG" || answer.result === "REVEAL").length;
}

function countStageDrops(
  answers: readonly {
    readonly previousStageIndex: number | null;
    readonly nextStageIndex: number | null;
  }[],
): number {
  return answers.filter(isStageDrop).length;
}

function sumStageDropMagnitude(
  answers: readonly {
    readonly previousStageIndex: number | null;
    readonly nextStageIndex: number | null;
  }[],
): number {
  return answers.reduce((sum, answer) => {
    if (!isStageDrop(answer)) {
      return sum;
    }

    return sum + (answer.previousStageIndex - answer.nextStageIndex);
  }, 0);
}

function isStageDrop(answer: {
  readonly previousStageIndex: number | null;
  readonly nextStageIndex: number | null;
}): answer is {
  readonly previousStageIndex: number;
  readonly nextStageIndex: number;
} {
  return (
    answer.previousStageIndex !== null &&
    answer.nextStageIndex !== null &&
    answer.previousStageIndex > answer.nextStageIndex
  );
}

function burnedPriority(state: ItemSrsStateRow): number {
  return state.burnedAt === null ? 0 : 1;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}

function uniqueSourceRecordIds(...sourceRecordIds: readonly (string | null)[]): readonly string[] {
  return [...new Set(sourceRecordIds.filter((id): id is string => id !== null))];
}

function toStrokeGraphic(strokeGraphic: KanjiRow["strokeGraphic"]): ItemStrokeGraphicRecord | null {
  if (strokeGraphic === null) {
    return null;
  }

  if (!Array.isArray(strokeGraphic.strokesJson)) {
    throw new Error(`KanjiVG stroke graphic ${strokeGraphic.sourceRecordId} has invalid strokes.`);
  }

  return {
    sourceRecordId: strokeGraphic.sourceRecordId,
    viewBox: strokeGraphic.viewBox,
    strokes: strokeGraphic.strokesJson.map((stroke, index) => toStrokePath(stroke, index)),
  };
}

function toStrokePath(stroke: unknown, index: number): ItemStrokeGraphicRecord["strokes"][number] {
  if (typeof stroke !== "object" || stroke === null) {
    throw new Error(`KanjiVG stroke ${index + 1} is not an object.`);
  }

  const record = stroke as {
    readonly id?: unknown;
    readonly order?: unknown;
    readonly path?: unknown;
    readonly type?: unknown;
  };

  if (typeof record.id !== "string" || typeof record.path !== "string") {
    throw new Error(`KanjiVG stroke ${index + 1} is missing id or path.`);
  }

  return {
    id: record.id,
    order: typeof record.order === "number" ? record.order : index + 1,
    path: record.path,
    type: typeof record.type === "string" ? record.type : null,
  };
}
