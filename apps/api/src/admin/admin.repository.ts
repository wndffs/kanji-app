import { Inject, Injectable } from "@nestjs/common";

import {
  type AdminContentStatus,
  type AdminCurationCardDto,
  type AdminCurationItemDto,
  type AdminCurationTextDto,
  type AdminImportRunSummaryDto,
  type AdminReviewQueueItemDto,
  type CardAnswerType,
  type CardPromptType,
  type ContentLocale,
  type ItemKind,
  type SourceAttributionDto,
} from "@kanji-srs/shared";

import { PrismaService } from "../database/prisma.service";
import {
  type NormalizedAdminCardAnswersInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminTextInput,
} from "./admin.types";

export abstract class AdminRepository {
  abstract listReviewItems(): Promise<readonly AdminReviewQueueItemDto[]>;
  abstract findCurationItem(itemId: string): Promise<AdminCurationItemDto | null>;
  abstract updateItemCuration(
    itemId: string,
    input: NormalizedAdminItemCurationInput,
  ): Promise<AdminCurationItemDto | null>;
  abstract updateCardAnswers(
    cardId: string,
    input: NormalizedAdminCardAnswersInput,
  ): Promise<AdminCurationItemDto | null>;
}

type LearningItemRow = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly title: string;
  readonly levelHint: number | null;
  readonly status: string;
  readonly updatedAt: Date;
  readonly cards: readonly LearningCardRow[];
  readonly hints: readonly TextRow[];
  readonly mnemonics: readonly TextRow[];
};

type LearningCardRow = {
  readonly id: string;
  readonly promptType: string;
  readonly answerType: string;
  readonly locale: string;
  readonly sortOrder: number;
  readonly updatedAt: Date;
  readonly answers: readonly AnswerRow[];
  readonly blockedAnswers: readonly BlockedAnswerRow[];
};

type AnswerRow = {
  readonly id: string;
  readonly learningCardId: string;
  readonly locale: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly answerKind: string;
  readonly isPrimary: boolean;
};

type BlockedAnswerRow = {
  readonly id: string;
  readonly learningCardId: string;
  readonly text: string;
  readonly normalizedText: string;
  readonly reason: string | null;
};

type TextRow = {
  readonly id: string;
  readonly locale: string;
  readonly body: string;
  readonly mnemonicType?: string;
  readonly hintType?: string;
  readonly sourceKind: string;
  readonly version: number;
  readonly updatedAt: Date;
};

type TargetSnapshot = {
  readonly japanese: string;
  readonly reading: string | null;
  readonly meanings: {
    readonly ru: string;
    readonly en: string;
  };
  readonly sourceRecordIds: readonly string[];
  readonly attributions: readonly SourceAttributionDto[];
};

type SourceInfo = {
  readonly attributions: readonly SourceAttributionDto[];
  readonly importRuns: readonly AdminImportRunSummaryDto[];
};

type PrismaAdminWriteClient = Pick<
  PrismaService["db"],
  "component" | "kanjiMeaning" | "wordSense" | "sentence" | "hint" | "mnemonic"
>;

type CardForUpdateRow = {
  readonly id: string;
  readonly learningItemId: string;
  readonly answerType: string;
};

@Injectable()
export class PrismaAdminRepository extends AdminRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listReviewItems(): Promise<readonly AdminReviewQueueItemDto[]> {
    const items = (await this.prisma.db.learningItem.findMany({
      where: { status: "NEEDS_REVIEW" },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 50,
      include: this.itemInclude(),
    })) as unknown as readonly LearningItemRow[];

    const summaries: AdminReviewQueueItemDto[] = [];

    for (const item of items) {
      const target = await this.findTargetSnapshot(item.targetType, item.targetId);
      const sourceInfo = await this.findSourceInfo(target.sourceRecordIds, target.attributions);

      summaries.push({
        id: item.id,
        itemType: toItemKind(item.kind),
        title: item.title,
        japanese: target.japanese,
        reading: target.reading,
        level: item.levelHint,
        status: toApiStatus(item.status),
        updatedAt: item.updatedAt.toISOString(),
        sourceNames: sourceInfo.attributions.map((source) => source.sourceName),
      });
    }

    return summaries;
  }

  async findCurationItem(itemId: string): Promise<AdminCurationItemDto | null> {
    const item = (await this.prisma.db.learningItem.findUnique({
      where: { id: itemId },
      include: this.itemInclude(),
    })) as unknown as LearningItemRow | null;

    return item === null ? null : this.toCurationItem(item);
  }

  async updateItemCuration(
    itemId: string,
    input: NormalizedAdminItemCurationInput,
  ): Promise<AdminCurationItemDto | null> {
    const item = (await this.prisma.db.learningItem.findUnique({
      where: { id: itemId },
      select: { id: true, targetType: true, targetId: true },
    })) as Pick<LearningItemRow, "id" | "targetType" | "targetId"> | null;

    if (item === null) {
      return null;
    }

    const now = new Date();

    await this.prisma.db.$transaction(async (db) => {
      if (input.meanings !== undefined) {
        await updateTargetMeanings(db, item.targetType, item.targetId, input.meanings);
      }

      if (input.hints !== undefined) {
        await upsertHints(db, item.id, input.hints);
      }

      if (input.mnemonics !== undefined) {
        await upsertMnemonics(db, item.id, input.mnemonics);
      }

      await db.learningItem.update({
        where: { id: item.id },
        data: {
          ...(input.status === undefined ? {} : { status: toPrismaStatus(input.status) }),
          updatedAt: now,
        },
      });
    });

    return this.findCurationItem(itemId);
  }

  async updateCardAnswers(
    cardId: string,
    input: NormalizedAdminCardAnswersInput,
  ): Promise<AdminCurationItemDto | null> {
    const card = (await this.prisma.db.learningCard.findUnique({
      where: { id: cardId },
      select: { id: true, learningItemId: true, answerType: true },
    })) as CardForUpdateRow | null;

    if (card === null) {
      return null;
    }

    const now = new Date();

    await this.prisma.db.$transaction(async (db) => {
      await db.learningAnswer.deleteMany({ where: { learningCardId: card.id } });
      await db.blockedAnswer.deleteMany({ where: { learningCardId: card.id } });

      if (input.acceptedAnswers.length > 0) {
        await db.learningAnswer.createMany({
          data: input.acceptedAnswers.map((answer) => ({
            learningCardId: card.id,
            text: answer.text,
            normalizedText: answer.normalizedText,
            answerKind: toPrismaAnswerKind(answer.answerKind),
            locale: answer.locale,
            isPrimary: answer.isPrimary,
          })),
        });
      }

      if (input.blockedAnswers.length > 0) {
        await db.blockedAnswer.createMany({
          data: input.blockedAnswers.map((answer) => ({
            learningCardId: card.id,
            text: answer.text,
            normalizedText: answer.normalizedText,
            reason: answer.reason,
          })),
        });
      }

      await db.learningCard.update({
        where: { id: card.id },
        data: { updatedAt: now },
      });
      await db.learningItem.update({
        where: { id: card.learningItemId },
        data: { updatedAt: now },
      });
    });

    return this.findCurationItem(card.learningItemId);
  }

  private itemInclude() {
    return {
      cards: {
        orderBy: [{ sortOrder: "asc" as const }, { id: "asc" as const }],
        include: {
          answers: {
            orderBy: [
              { isPrimary: "desc" as const },
              { locale: "asc" as const },
              { text: "asc" as const },
            ],
          },
          blockedAnswers: { orderBy: { text: "asc" as const } },
        },
      },
      hints: {
        orderBy: [
          { locale: "asc" as const },
          { hintType: "asc" as const },
          { version: "desc" as const },
        ],
      },
      mnemonics: {
        orderBy: [
          { locale: "asc" as const },
          { mnemonicType: "asc" as const },
          { version: "desc" as const },
        ],
      },
    };
  }

  private async toCurationItem(item: LearningItemRow): Promise<AdminCurationItemDto> {
    const target = await this.findTargetSnapshot(item.targetType, item.targetId);
    const sourceInfo = await this.findSourceInfo(target.sourceRecordIds, target.attributions);

    return {
      id: item.id,
      itemType: toItemKind(item.kind),
      title: item.title,
      japanese: target.japanese,
      reading: target.reading,
      level: item.levelHint,
      status: toApiStatus(item.status),
      updatedAt: item.updatedAt.toISOString(),
      meanings: target.meanings,
      cards: item.cards.map(toCardDto),
      hints: item.hints.map(toTextDto),
      mnemonics: item.mnemonics.map(toTextDto),
      attributions: sourceInfo.attributions,
      importRuns: sourceInfo.importRuns,
    };
  }

  private async findTargetSnapshot(targetType: string, targetId: string): Promise<TargetSnapshot> {
    switch (targetType) {
      case "COMPONENT":
        return this.findComponentTarget(targetId);
      case "KANJI":
        return this.findKanjiTarget(targetId);
      case "WORD":
        return this.findWordTarget(targetId);
      case "SENTENCE":
        return this.findSentenceTarget(targetId);
      default:
        throw new Error(`Unsupported learning item target type: ${targetType}`);
    }
  }

  private async findComponentTarget(targetId: string): Promise<TargetSnapshot> {
    const component = (await this.prisma.db.component.findUnique({
      where: { id: targetId },
      select: { symbol: true, meaningRu: true },
    })) as { readonly symbol: string; readonly meaningRu: string } | null;

    if (component === null) {
      throw new Error(`Missing component target ${targetId}.`);
    }

    return {
      japanese: component.symbol,
      reading: null,
      meanings: { ru: component.meaningRu, en: "" },
      sourceRecordIds: [],
      attributions: [],
    };
  }

  private async findKanjiTarget(targetId: string): Promise<TargetSnapshot> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id: targetId },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
    })) as {
      readonly character: string;
      readonly kanjidicSourceId: string | null;
      readonly readings: readonly { readonly reading: string }[];
      readonly meanings: readonly {
        readonly locale: string;
        readonly meaning: string;
        readonly sourceKind: string;
      }[];
    } | null;

    if (kanji === null) {
      throw new Error(`Missing kanji target ${targetId}.`);
    }

    return {
      japanese: kanji.character,
      reading: kanji.readings[0]?.reading ?? null,
      meanings: pickMeanings(kanji.meanings),
      sourceRecordIds: kanji.kanjidicSourceId === null ? [] : [kanji.kanjidicSourceId],
      attributions: [],
    };
  }

  private async findWordTarget(targetId: string): Promise<TargetSnapshot> {
    const word = (await this.prisma.db.word.findUnique({
      where: { id: targetId },
      include: {
        senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] },
      },
    })) as {
      readonly expression: string;
      readonly reading: string;
      readonly jmdictEntryId: string | null;
      readonly senses: readonly {
        readonly locale: string;
        readonly meaning: string;
        readonly sourceKind: string;
      }[];
    } | null;

    if (word === null) {
      throw new Error(`Missing word target ${targetId}.`);
    }

    return {
      japanese: word.expression,
      reading: word.reading,
      meanings: pickMeanings(word.senses),
      sourceRecordIds: word.jmdictEntryId === null ? [] : [word.jmdictEntryId],
      attributions: [],
    };
  }

  private async findSentenceTarget(targetId: string): Promise<TargetSnapshot> {
    const sentence = (await this.prisma.db.sentence.findUnique({
      where: { id: targetId },
      include: {
        dataSource: { include: { license: true } },
        license: true,
      },
    })) as {
      readonly japaneseText: string;
      readonly readingText: string | null;
      readonly translationRu: string | null;
      readonly translationEn: string | null;
      readonly sourceId: string | null;
      readonly dataSource: {
        readonly name: string;
        readonly homepageUrl: string | null;
        readonly attributionText: string;
        readonly license: { readonly name: string };
      } | null;
      readonly license: { readonly name: string };
    } | null;

    if (sentence === null) {
      throw new Error(`Missing sentence target ${targetId}.`);
    }

    return {
      japanese: sentence.japaneseText,
      reading: sentence.readingText,
      meanings: {
        ru: sentence.translationRu ?? "",
        en: sentence.translationEn ?? "",
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

  private async findSourceInfo(
    sourceRecordIds: readonly string[],
    directAttributions: readonly SourceAttributionDto[],
  ): Promise<SourceInfo> {
    const records =
      sourceRecordIds.length === 0
        ? []
        : await this.prisma.db.importedRecord.findMany({
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
                  records: { select: { id: true } },
                },
              },
            },
          });

    const attributionBySourceId = new Map<string, SourceAttributionDto>();
    const importRunById = new Map<string, AdminImportRunSummaryDto>();

    for (const attribution of directAttributions) {
      attributionBySourceId.set(attribution.sourceName, attribution);
    }

    for (const record of records) {
      const run = record.importRun;
      const source = run.dataSource;

      attributionBySourceId.set(source.id, {
        sourceName: source.name,
        licenseName: source.license.name,
        attributionText: source.attributionText,
        sourceUrl: source.homepageUrl,
      });
      importRunById.set(run.id, {
        id: run.id,
        dataSourceName: source.name,
        licenseName: source.license.name,
        sourceVersion: run.sourceVersion,
        sourceFileName: run.sourceFileName,
        checksumSha256: run.checksumSha256,
        status: toApiImportRunStatus(run.status),
        startedAt: run.startedAt.toISOString(),
        finishedAt: run.finishedAt?.toISOString() ?? null,
        recordCount: run.records.length,
      });
    }

    return {
      attributions: [...attributionBySourceId.values()],
      importRuns: [...importRunById.values()],
    };
  }
}

function toCardDto(card: LearningCardRow): AdminCurationCardDto {
  return {
    id: card.id,
    promptType: toPromptType(card.promptType),
    answerType: toAnswerType(card.answerType),
    locale: toContentLocale(card.locale),
    sortOrder: card.sortOrder,
    updatedAt: card.updatedAt.toISOString(),
    acceptedAnswers: card.answers.map((answer) => ({
      id: answer.id,
      cardId: answer.learningCardId,
      locale: toContentLocale(answer.locale),
      text: answer.text,
      normalizedText: answer.normalizedText,
      answerKind: toAnswerType(answer.answerKind),
      isPrimary: answer.isPrimary,
    })),
    blockedAnswers: card.blockedAnswers.map((answer) => ({
      id: answer.id,
      cardId: answer.learningCardId,
      text: answer.text,
      normalizedText: answer.normalizedText,
      reason: answer.reason,
    })),
  };
}

function toTextDto(text: TextRow): AdminCurationTextDto {
  return {
    id: text.id,
    locale: toContentLocale(text.locale),
    type: toTextType(text.mnemonicType ?? text.hintType ?? "MEANING"),
    body: text.body,
    sourceKind: toApiSourceKind(text.sourceKind),
    version: text.version,
    updatedAt: text.updatedAt.toISOString(),
  };
}

function pickMeanings(
  meanings: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly sourceKind: string;
  }[],
): { readonly ru: string; readonly en: string } {
  return {
    ru: pickMeaning(meanings, "ru-RU"),
    en: pickMeaning(meanings, "en-US"),
  };
}

function pickMeaning(
  meanings: readonly {
    readonly locale: string;
    readonly meaning: string;
    readonly sourceKind: string;
  }[],
  locale: ContentLocale,
): string {
  return (
    meanings.find(
      (meaning) => meaning.locale === locale && meaning.sourceKind === "PROJECT_AUTHORED",
    )?.meaning ??
    meanings.find((meaning) => meaning.locale === locale)?.meaning ??
    ""
  );
}

async function updateTargetMeanings(
  db: PrismaAdminWriteClient,
  targetType: string,
  targetId: string,
  meanings: { readonly ru?: string; readonly en?: string },
): Promise<void> {
  switch (targetType) {
    case "COMPONENT":
      if (meanings.ru !== undefined) {
        await db.component.update({
          where: { id: targetId },
          data: { meaningRu: meanings.ru },
        });
      }
      return;
    case "KANJI":
      await replaceKanjiMeaning(db, targetId, "ru-RU", meanings.ru);
      await replaceKanjiMeaning(db, targetId, "en-US", meanings.en);
      return;
    case "WORD":
      await replaceWordSense(db, targetId, "ru-RU", meanings.ru);
      await replaceWordSense(db, targetId, "en-US", meanings.en);
      return;
    case "SENTENCE":
      await db.sentence.update({
        where: { id: targetId },
        data: {
          ...(meanings.ru === undefined ? {} : { translationRu: meanings.ru }),
          ...(meanings.en === undefined ? {} : { translationEn: meanings.en }),
        },
      });
      return;
    default:
      throw new Error(`Unsupported target type for meaning update: ${targetType}`);
  }
}

async function replaceKanjiMeaning(
  db: PrismaAdminWriteClient,
  kanjiId: string,
  locale: ContentLocale,
  meaning: string | undefined,
): Promise<void> {
  if (meaning === undefined) {
    return;
  }

  await db.kanjiMeaning.deleteMany({
    where: { kanjiId, locale, sourceKind: "PROJECT_AUTHORED" },
  });

  if (meaning.trim() === "") {
    return;
  }

  await db.kanjiMeaning.create({
    data: {
      kanjiId,
      locale,
      meaning,
      isPrimary: true,
      sourceKind: "PROJECT_AUTHORED",
    },
  });
}

async function replaceWordSense(
  db: PrismaAdminWriteClient,
  wordId: string,
  locale: ContentLocale,
  meaning: string | undefined,
): Promise<void> {
  if (meaning === undefined) {
    return;
  }

  await db.wordSense.deleteMany({
    where: { wordId, locale, sourceKind: "PROJECT_AUTHORED" },
  });

  if (meaning.trim() === "") {
    return;
  }

  await db.wordSense.create({
    data: {
      wordId,
      locale,
      meaning,
      partOfSpeech: "curated",
      sourceKind: "PROJECT_AUTHORED",
    },
  });
}

async function upsertHints(
  db: PrismaAdminWriteClient,
  learningItemId: string,
  hints: readonly NormalizedAdminTextInput[],
): Promise<void> {
  for (const hint of hints) {
    const hintType = toPrismaHintType(hint.type);

    if (hint.body === "") {
      await db.hint.deleteMany({
        where: { learningItemId, locale: hint.locale, hintType, version: 1 },
      });
      continue;
    }

    await db.hint.upsert({
      where: {
        learningItemId_locale_hintType_version: {
          learningItemId,
          locale: hint.locale,
          hintType,
          version: 1,
        },
      },
      update: { body: hint.body, sourceKind: "PROJECT_AUTHORED" },
      create: {
        learningItemId,
        locale: hint.locale,
        hintType,
        body: hint.body,
        sourceKind: "PROJECT_AUTHORED",
        version: 1,
      },
    });
  }
}

async function upsertMnemonics(
  db: PrismaAdminWriteClient,
  learningItemId: string,
  mnemonics: readonly NormalizedAdminTextInput[],
): Promise<void> {
  for (const mnemonic of mnemonics) {
    const mnemonicType = toPrismaMnemonicType(mnemonic.type);

    if (mnemonic.body === "") {
      await db.mnemonic.deleteMany({
        where: { learningItemId, locale: mnemonic.locale, mnemonicType, version: 1 },
      });
      continue;
    }

    await db.mnemonic.upsert({
      where: {
        learningItemId_locale_mnemonicType_version: {
          learningItemId,
          locale: mnemonic.locale,
          mnemonicType,
          version: 1,
        },
      },
      update: { body: mnemonic.body, sourceKind: "PROJECT_AUTHORED" },
      create: {
        learningItemId,
        locale: mnemonic.locale,
        mnemonicType,
        body: mnemonic.body,
        sourceKind: "PROJECT_AUTHORED",
        version: 1,
      },
    });
  }
}

function toApiStatus(status: string): AdminContentStatus {
  switch (status) {
    case "DRAFT":
      return "draft";
    case "NEEDS_REVIEW":
      return "needs-review";
    case "PUBLISHED":
      return "published";
    case "ARCHIVED":
      return "archived";
    default:
      throw new Error(`Unsupported content status: ${status}`);
  }
}

function toPrismaStatus(status: AdminContentStatus) {
  switch (status) {
    case "draft":
      return "DRAFT";
    case "needs-review":
      return "NEEDS_REVIEW";
    case "published":
      return "PUBLISHED";
    case "archived":
      return "ARCHIVED";
  }
}

function toApiImportRunStatus(status: string) {
  switch (status) {
    case "PENDING":
      return "pending";
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "failed";
    default:
      throw new Error(`Unsupported import run status: ${status}`);
  }
}

function toItemKind(kind: string): ItemKind {
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

function toPromptType(value: string): CardPromptType {
  switch (value) {
    case "MEANING":
      return "meaning";
    case "READING":
      return "reading";
    case "RECALL":
      return "recall";
    case "CLOZE":
      return "cloze";
    case "RECOGNITION":
      return "recognition";
    default:
      throw new Error(`Unsupported prompt type: ${value}`);
  }
}

function toAnswerType(value: string): CardAnswerType {
  return value === "READING" ? "reading" : "meaning";
}

function toPrismaAnswerKind(value: CardAnswerType) {
  return value === "reading" ? "READING" : "MEANING";
}

function toContentLocale(value: string): ContentLocale {
  return value === "en-US" ? "en-US" : "ru-RU";
}

function toTextType(value: string): AdminCurationTextDto["type"] {
  switch (value) {
    case "READING":
      return "reading";
    case "STORY":
      return "story";
    case "USAGE":
      return "usage";
    default:
      return "meaning";
  }
}

function toApiSourceKind(value: string): AdminCurationTextDto["sourceKind"] {
  switch (value) {
    case "IMPORTED":
      return "imported";
    case "USER_PRIVATE":
      return "user";
    default:
      return "curated";
  }
}

function toPrismaHintType(value: NormalizedAdminTextInput["type"]) {
  switch (value) {
    case "reading":
      return "READING";
    case "usage":
      return "USAGE";
    default:
      return "MEANING";
  }
}

function toPrismaMnemonicType(value: NormalizedAdminTextInput["type"]) {
  switch (value) {
    case "reading":
      return "READING";
    case "story":
    case "usage":
      return "STORY";
    default:
      return "MEANING";
  }
}
