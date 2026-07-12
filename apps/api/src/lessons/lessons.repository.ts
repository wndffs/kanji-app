import { Inject, Injectable } from "@nestjs/common";

import {
  type ContentLocale,
  type LessonHintGroupDto,
  type LessonHintPurpose,
  type LessonMnemonicGroupDto,
  type LessonMnemonicPurpose,
  type SentenceDto,
  type SourceAttributionDto,
} from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import {
  type CompleteLessonItemInput,
  type CompletedLessonItemRecord,
  type CourseLessonItemRecord,
  type DeckLessonRecord,
  type LessonAnswerRecord,
  type LessonBlockedAnswerRecord,
  type LessonCardRecord,
  type LessonDependencyRecord,
  type LessonItemRecord,
  type LessonSessionRecord,
  type LessonTargetRecord,
  type SrsSystemRecord,
  type UserItemProgressRecord,
} from "./lessons.types";

export abstract class LessonsRepository {
  abstract listCourseLessonItems(userId: string): Promise<readonly CourseLessonItemRecord[]>;
  abstract findDeckLesson(userId: string, deckId: string): Promise<DeckLessonRecord | null>;
  abstract listUserProgress(userId: string): Promise<readonly UserItemProgressRecord[]>;
  abstract getDefaultSrsSystem(): Promise<SrsSystemRecord | null>;
  abstract createLessonSession(
    userId: string,
    now: Date,
    deckId: string | null,
  ): Promise<LessonSessionRecord>;
  abstract findActiveLessonSession(
    userId: string,
    sessionId: string,
  ): Promise<LessonSessionRecord | null>;
  abstract completeLessonItem(input: CompleteLessonItemInput): Promise<CompletedLessonItemRecord>;
  abstract finishLessonSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<LessonSessionRecord | null>;
}

type EnrollmentRow = {
  readonly course: {
    readonly id: string;
    readonly levels: readonly CourseLevelRow[];
  };
};

type CourseLevelRow = {
  readonly levelNumber: number;
  readonly items: readonly CourseLevelItemRow[];
};

type CourseLevelItemRow = {
  readonly sortOrder: number;
  readonly unlockPolicyJson: unknown;
  readonly learningItem: LearningItemRow;
};

type DeckRow = {
  readonly id: string;
  readonly title: string;
  readonly status: string;
  readonly items: readonly {
    readonly sortOrder: number;
    readonly learningItem: LearningItemRow;
  }[];
};

type LearningItemRow = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly title: string;
  readonly levelHint: number | null;
  readonly cards: readonly LearningCardRow[];
  readonly dependencies: readonly DependencyRow[];
  readonly mnemonics: readonly LessonTextRow[];
  readonly hints: readonly LessonTextRow[];
  readonly userMnemonics: readonly UserLessonTextRow[];
};

type LessonTextRow = {
  readonly locale: string;
  readonly body: string;
  readonly sourceKind: string;
  readonly mnemonicType?: string;
  readonly hintType?: string;
  readonly version: number;
};

type UserLessonTextRow = {
  readonly locale: string;
  readonly body: string;
  readonly mnemonicType: string;
};

type LearningCardRow = {
  readonly id: string;
  readonly learningItemId: string;
  readonly cardType: string;
  readonly promptType: string;
  readonly answerType: string;
  readonly sortOrder: number;
  readonly answers: readonly LearningAnswerRow[];
  readonly blockedAnswers: readonly BlockedAnswerRow[];
};

type LearningAnswerRow = {
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: string;
  readonly locale: string;
  readonly isPrimary: boolean;
};

type BlockedAnswerRow = {
  readonly text: string;
  readonly normalizedText: string;
};

type DependencyRow = {
  readonly prerequisiteItemId: string;
  readonly requiredStage: number | null;
};

type LessonSentenceDependencyRow = {
  readonly prerequisiteItemId: string;
  readonly learningItem: {
    readonly targetId: string;
  };
};

type LessonSentenceExampleRow = {
  readonly id: string;
  readonly japaneseText: string;
  readonly readingText: string | null;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
  readonly difficulty: number | null;
  readonly dataSource: {
    readonly name: string;
    readonly homepageUrl: string | null;
    readonly attributionText: string;
    readonly license: { readonly name: string };
  } | null;
  readonly license: { readonly name: string };
};

type ProgressRow = {
  readonly stageIndex: number;
  readonly createdAt: Date;
  readonly learningCardId: string;
  readonly learningCard: {
    readonly learningItemId: string;
  };
};

type SessionRow = {
  readonly id: string;
  readonly userId: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly mode: string;
  readonly statsJson: unknown;
};

type SrsSystemRow = {
  readonly id: string;
  readonly stages: readonly {
    readonly stageIndex: number;
    readonly name: string;
    readonly intervalMinutes: number | null;
    readonly isBurned: boolean;
  }[];
};

type ComponentTargetRow = {
  readonly symbol: string;
  readonly meaningRu: string;
  readonly meaningEn: string;
  readonly sourceKind: string;
};

type KanjiTargetRow = {
  readonly character: string;
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

type WordTargetRow = {
  readonly expression: string;
  readonly reading: string;
  readonly jlptLevel: number | null;
  readonly senses: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly sourceKind: string;
  }[];
};

type SentenceTargetRow = {
  readonly japaneseText: string;
  readonly readingText: string | null;
  readonly translationRu: string | null;
  readonly translationEn: string | null;
};

@Injectable()
export class PrismaLessonsRepository extends LessonsRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listCourseLessonItems(userId: string): Promise<readonly CourseLessonItemRecord[]> {
    const enrollments = (await this.prisma.db.userEnrollment.findMany({
      where: {
        userId,
        status: "ACTIVE",
        course: {
          status: "PUBLISHED",
        },
      },
      include: {
        course: {
          include: {
            levels: {
              orderBy: { levelNumber: "asc" },
              include: {
                items: {
                  orderBy: { sortOrder: "asc" },
                  include: {
                    learningItem: {
                      include: {
                        cards: {
                          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                          include: {
                            answers: {
                              orderBy: [{ isPrimary: "desc" }, { text: "asc" }],
                            },
                            blockedAnswers: {
                              orderBy: { text: "asc" },
                            },
                          },
                        },
                        dependencies: {
                          where: { dependencyType: "PREREQUISITE" },
                          orderBy: { prerequisiteItemId: "asc" },
                        },
                        mnemonics: {
                          orderBy: [
                            { locale: "asc" },
                            { mnemonicType: "asc" },
                            { version: "desc" },
                          ],
                        },
                        hints: {
                          orderBy: [{ locale: "asc" }, { hintType: "asc" }, { version: "desc" }],
                        },
                        userMnemonics: {
                          where: { userId },
                          orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }],
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    })) as readonly EnrollmentRow[];

    const records: CourseLessonItemRecord[] = [];
    const lessonItems = enrollments.flatMap((enrollment) =>
      enrollment.course.levels.flatMap((level) => level.items.map((entry) => entry.learningItem)),
    );
    const examplesByItem = await this.findExampleSentencesByItem(
      lessonItems.map((item) => item.id),
    );

    for (const enrollment of enrollments) {
      for (const level of enrollment.course.levels) {
        for (const item of level.items) {
          records.push({
            courseId: enrollment.course.id,
            courseLevelNumber: level.levelNumber,
            sortOrder: item.sortOrder,
            item: await this.toLessonItemRecord(
              item.learningItem,
              examplesByItem.get(item.learningItem.id) ?? [],
            ),
            unlockPolicy: isRecord(item.unlockPolicyJson) ? item.unlockPolicyJson : null,
          });
        }
      }
    }

    return records;
  }

  async findDeckLesson(userId: string, deckId: string): Promise<DeckLessonRecord | null> {
    const deck = (await this.prisma.db.deck.findFirst({
      where: {
        id: deckId,
        ownerUserId: userId,
      },
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            learningItem: {
              include: {
                cards: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                  include: {
                    answers: {
                      orderBy: [{ isPrimary: "desc" }, { text: "asc" }],
                    },
                    blockedAnswers: {
                      orderBy: { text: "asc" },
                    },
                  },
                },
                dependencies: {
                  where: { dependencyType: "PREREQUISITE" },
                  orderBy: { prerequisiteItemId: "asc" },
                },
                mnemonics: {
                  orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }, { version: "desc" }],
                },
                hints: {
                  orderBy: [{ locale: "asc" }, { hintType: "asc" }, { version: "desc" }],
                },
                userMnemonics: {
                  where: { userId },
                  orderBy: [{ locale: "asc" }, { mnemonicType: "asc" }],
                },
              },
            },
          },
        },
      },
    })) as DeckRow | null;

    if (deck === null) {
      return null;
    }

    const examplesByItem = await this.findExampleSentencesByItem(
      deck.items.map((entry) => entry.learningItem.id),
    );

    return {
      id: deck.id,
      title: deck.title,
      status: toDeckLessonStatus(deck.status),
      items: await Promise.all(
        deck.items.map(async (entry) => ({
          sortOrder: entry.sortOrder,
          item: await this.toLessonItemRecord(
            entry.learningItem,
            examplesByItem.get(entry.learningItem.id) ?? [],
          ),
        })),
      ),
    };
  }

  async listUserProgress(userId: string): Promise<readonly UserItemProgressRecord[]> {
    const states = (await this.prisma.db.userSrsState.findMany({
      where: { userId },
      select: {
        stageIndex: true,
        createdAt: true,
        learningCardId: true,
        learningCard: {
          select: {
            learningItemId: true,
          },
        },
      },
    })) as readonly ProgressRow[];

    return states.map((state) => ({
      learningItemId: state.learningCard.learningItemId,
      learningCardId: state.learningCardId,
      stageIndex: state.stageIndex,
      createdAt: state.createdAt,
    }));
  }

  async getDefaultSrsSystem(): Promise<SrsSystemRecord | null> {
    const system =
      ((await this.prisma.db.srsSystem.findUnique({
        where: { slug: "default-mvp" },
        include: { stages: { orderBy: { stageIndex: "asc" } } },
      })) as SrsSystemRow | null) ??
      ((await this.prisma.db.srsSystem.findFirst({
        include: { stages: { orderBy: { stageIndex: "asc" } } },
        orderBy: { slug: "asc" },
      })) as SrsSystemRow | null);

    if (system === null) {
      return null;
    }

    return {
      id: system.id,
      stages: system.stages,
    };
  }

  async createLessonSession(
    userId: string,
    now: Date,
    deckId: string | null,
  ): Promise<LessonSessionRecord> {
    const session = (await this.prisma.db.reviewSession.create({
      data: {
        userId,
        startedAt: now,
        mode: "LESSON_QUIZ",
        statsJson: deckId === null ? undefined : { deckId },
      },
    })) as SessionRow;

    return toSessionRecord(session);
  }

  async findActiveLessonSession(
    userId: string,
    sessionId: string,
  ): Promise<LessonSessionRecord | null> {
    const session = (await this.prisma.db.reviewSession.findFirst({
      where: {
        id: sessionId,
        userId,
        mode: "LESSON_QUIZ",
        finishedAt: null,
      },
    })) as SessionRow | null;

    return session === null ? null : toSessionRecord(session);
  }

  async completeLessonItem(input: CompleteLessonItemInput): Promise<CompletedLessonItemRecord> {
    if (input.item.cards.length === 0) {
      return { createdSrsStateCount: 0 };
    }

    const result = await this.prisma.db.userSrsState.createMany({
      data: input.item.cards.map((card) => ({
        userId: input.userId,
        learningCardId: card.id,
        srsSystemId: input.srsSystem.id,
        stageIndex: input.initialStageIndex,
        availableAt: input.availableAt,
        wrongCount: 0,
        correctStreak: 0,
      })),
      skipDuplicates: true,
    });

    return {
      createdSrsStateCount: result.count,
    };
  }

  async finishLessonSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<LessonSessionRecord | null> {
    const result = await this.prisma.db.reviewSession.updateMany({
      where: {
        id: sessionId,
        userId,
        mode: "LESSON_QUIZ",
        finishedAt: null,
      },
      data: {
        finishedAt: now,
      },
    });

    if (result.count === 0) {
      return null;
    }

    const session = (await this.prisma.db.reviewSession.findUnique({
      where: { id: sessionId },
    })) as SessionRow | null;

    return session === null ? null : toSessionRecord(session);
  }

  private async toLessonItemRecord(
    item: LearningItemRow,
    exampleSentences: readonly SentenceDto[],
  ): Promise<LessonItemRecord> {
    const itemType = toItemKind(item.kind);

    return {
      id: item.id,
      itemType,
      title: item.title,
      level: item.levelHint,
      target: await this.findTarget(item),
      cards: item.cards.map((card) => toCardRecord(card, itemType)),
      dependencies: item.dependencies.map(toDependencyRecord),
      mnemonics: groupLessonMnemonics(item.mnemonics, item.userMnemonics),
      hints: groupLessonHints(item.hints),
      exampleSentences,
    };
  }

  private async findExampleSentencesByItem(
    learningItemIds: readonly string[],
  ): Promise<ReadonlyMap<string, readonly SentenceDto[]>> {
    const uniqueItemIds = [...new Set(learningItemIds)];

    if (uniqueItemIds.length === 0) {
      return new Map();
    }

    const dependencies = (await this.prisma.db.dependency.findMany({
      where: {
        prerequisiteItemId: { in: uniqueItemIds },
        dependencyType: "PREREQUISITE",
        learningItem: { targetType: "SENTENCE", status: "PUBLISHED" },
      },
      select: {
        prerequisiteItemId: true,
        learningItem: { select: { targetId: true } },
      },
      orderBy: [
        { prerequisiteItemId: "asc" },
        { learningItem: { levelHint: "asc" } },
        { learningItemId: "asc" },
      ],
    })) as readonly LessonSentenceDependencyRow[];
    const sentenceIds = [
      ...new Set(dependencies.map((dependency) => dependency.learningItem.targetId)),
    ];

    if (sentenceIds.length === 0) {
      return new Map();
    }

    const sentences = (await this.prisma.db.sentence.findMany({
      where: {
        id: { in: sentenceIds },
        translationRu: { not: null },
        translationEn: { not: null },
      },
      include: {
        dataSource: { include: { license: true } },
        license: true,
      },
    })) as readonly LessonSentenceExampleRow[];
    const sentenceById = new Map(sentences.map((sentence) => [sentence.id, sentence]));
    const examplesByItem = new Map<string, SentenceDto[]>();

    for (const dependency of dependencies) {
      const sentence = sentenceById.get(dependency.learningItem.targetId);
      const examples = examplesByItem.get(dependency.prerequisiteItemId) ?? [];

      if (
        sentence === undefined ||
        sentence.translationRu === null ||
        sentence.translationEn === null ||
        examples.length >= 3
      ) {
        continue;
      }

      examples.push({
        id: sentence.id,
        japaneseText: sentence.japaneseText,
        readingText: sentence.readingText,
        translationRu: sentence.translationRu,
        translationEn: sentence.translationEn,
        difficulty: sentence.difficulty,
        attribution: toSentenceAttribution(sentence),
      });
      examplesByItem.set(dependency.prerequisiteItemId, examples);
    }

    return examplesByItem;
  }

  private async findTarget(item: LearningItemRow): Promise<LessonTargetRecord> {
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

  private async findComponentTarget(id: string): Promise<LessonTargetRecord> {
    const component = (await this.prisma.db.component.findUnique({
      where: { id },
    })) as ComponentTargetRow | null;

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
    };
  }

  private async findKanjiTarget(id: string): Promise<LessonTargetRecord> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
    })) as KanjiTargetRow | null;

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
    };
  }

  private async findWordTarget(id: string): Promise<LessonTargetRecord> {
    const word = (await this.prisma.db.word.findUnique({
      where: { id },
      include: {
        senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] },
      },
    })) as WordTargetRow | null;

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
    };
  }

  private async findSentenceTarget(id: string): Promise<LessonTargetRecord> {
    const sentence = (await this.prisma.db.sentence.findUnique({
      where: { id },
    })) as SentenceTargetRow | null;

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
    };
  }
}

function toSessionRecord(row: SessionRow): LessonSessionRecord {
  const stats = isRecord(row.statsJson) ? row.statsJson : null;
  const deckId = typeof stats?.deckId === "string" ? stats.deckId : null;

  return {
    id: row.id,
    userId: row.userId,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    mode: "lesson",
    deckId,
  };
}

function toDeckLessonStatus(status: string): DeckLessonRecord["status"] {
  switch (status) {
    case "ACTIVE":
      return "active";
    case "ARCHIVED":
      return "archived";
    default:
      return "draft";
  }
}

function toCardRecord(
  card: LearningCardRow,
  itemType: LessonCardRecord["itemType"],
): LessonCardRecord {
  return {
    id: card.id,
    learningItemId: card.learningItemId,
    itemType,
    cardType: card.cardType === "LESSON" ? "lesson" : "review",
    promptType: toPromptType(card.promptType),
    answerType: card.answerType === "READING" ? "reading" : "meaning",
    sortOrder: card.sortOrder,
    answers: card.answers.map(toAnswerRecord),
    blockedAnswers: card.blockedAnswers.map(toBlockedAnswerRecord),
  };
}

function toAnswerRecord(answer: LearningAnswerRow): LessonAnswerRecord {
  return {
    locale: toContentLocale(answer.locale),
    text: answer.text,
    normalizedText: answer.normalizedText,
    answerKind: answer.answerKind === "READING" ? "reading" : "meaning",
    isPrimary: answer.isPrimary,
  };
}

function toBlockedAnswerRecord(answer: BlockedAnswerRow): LessonBlockedAnswerRecord {
  return {
    locale: "ru-RU",
    text: answer.text,
    normalizedText: answer.normalizedText,
  };
}

function toSentenceAttribution(sentence: LessonSentenceExampleRow): SourceAttributionDto {
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

function toDependencyRecord(dependency: DependencyRow): LessonDependencyRecord {
  return {
    prerequisiteItemId: dependency.prerequisiteItemId,
    requiredStage: dependency.requiredStage ?? 1,
  };
}

function toItemKind(kind: string): LessonItemRecord["itemType"] {
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

function toPromptType(value: string): LessonCardRecord["promptType"] {
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

function localizedText(
  locale: ContentLocale,
  text: string,
  options: {
    readonly isPrimary?: boolean;
    readonly sourceKind?: "curated" | "imported" | "user";
  } = {},
) {
  return {
    locale,
    text,
    ...options,
  };
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

export function groupLessonMnemonics(
  mnemonics: readonly LessonTextRow[],
  userMnemonics: readonly UserLessonTextRow[],
): readonly LessonMnemonicGroupDto[] {
  const curated = selectLatestLessonTexts(mnemonics, (text) =>
    toLessonMnemonicPurpose(text.mnemonicType),
  ).map((text) => ({
    purpose: toLessonMnemonicPurpose(text.mnemonicType),
    text: localizedText(toContentLocale(text.locale), text.body, {
      sourceKind: toSourceKind(text.sourceKind),
    }),
  }));
  const personal = userMnemonics.map((text) => ({
    purpose: toLessonMnemonicPurpose(text.mnemonicType),
    text: localizedText(toContentLocale(text.locale), text.body, { sourceKind: "user" }),
  }));

  return (["meaning", "reading", "story"] as const).flatMap((purpose) => {
    const texts = [...curated, ...personal]
      .filter((entry) => entry.purpose === purpose)
      .map((entry) => entry.text);

    return texts.length === 0 ? [] : [{ purpose, texts: groupLocalizedTexts(texts) }];
  });
}

export function groupLessonHints(hints: readonly LessonTextRow[]): readonly LessonHintGroupDto[] {
  const latest = selectLatestLessonTexts(hints, (text) => toLessonHintPurpose(text.hintType)).map(
    (text) => ({
      purpose: toLessonHintPurpose(text.hintType),
      text: localizedText(toContentLocale(text.locale), text.body, {
        sourceKind: toSourceKind(text.sourceKind),
      }),
    }),
  );

  return (["meaning", "reading", "usage"] as const).flatMap((purpose) => {
    const texts = latest.filter((entry) => entry.purpose === purpose).map((entry) => entry.text);

    return texts.length === 0 ? [] : [{ purpose, texts: groupLocalizedTexts(texts) }];
  });
}

function selectLatestLessonTexts(
  texts: readonly LessonTextRow[],
  getPurpose: (text: LessonTextRow) => LessonMnemonicPurpose | LessonHintPurpose,
): readonly LessonTextRow[] {
  const latestByLocaleAndPurpose = new Map<string, LessonTextRow>();

  for (const text of texts) {
    const key = `${toContentLocale(text.locale)}:${getPurpose(text)}`;
    const current = latestByLocaleAndPurpose.get(key);

    if (current === undefined || text.version > current.version) {
      latestByLocaleAndPurpose.set(key, text);
    }
  }

  return [...latestByLocaleAndPurpose.values()];
}

function toLessonMnemonicPurpose(value: string | undefined): LessonMnemonicPurpose {
  switch (value) {
    case "READING":
      return "reading";
    case "STORY":
      return "story";
    default:
      return "meaning";
  }
}

function toLessonHintPurpose(value: string | undefined): LessonHintPurpose {
  switch (value) {
    case "READING":
      return "reading";
    case "USAGE":
      return "usage";
    default:
      return "meaning";
  }
}

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
