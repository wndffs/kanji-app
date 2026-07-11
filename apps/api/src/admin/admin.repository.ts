import { Inject, Injectable } from "@nestjs/common";

import {
  type AdminContentStatus,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurationCardDto,
  type AdminCurationItemDto,
  type AdminCurationTextDto,
  type AdminImportRunSummaryDto,
  type AdminImportedCandidateDto,
  type AdminReviewQueueItemDto,
  type CardAnswerType,
  type CardPromptType,
  type ContentLocale,
  type CourseBand,
  type ItemKind,
  type SourceAttributionDto,
} from "@kanji-srs/shared";
import { normalizeJapaneseReading } from "@kanji-srs/japanese";

import { PrismaService } from "../database/prisma.service";
import { applyQualityIssues, buildCurriculumCompletenessReport } from "./curriculum-quality";
import {
  type ImportedCandidateRankingInput,
  rankImportedCandidates,
} from "./imported-candidate-ranking";
import {
  type NormalizedAdminCardAnswersInput,
  type NormalizedAdminApproveImportedTranslationInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminPromoteCandidateInput,
  type NormalizedAdminReviewQueueFilters,
  type NormalizedAdminTextInput,
} from "./admin.types";

export abstract class AdminRepository {
  abstract listImportRuns(): Promise<readonly AdminImportRunSummaryDto[]>;
  abstract listImportedCandidates(): Promise<readonly AdminImportedCandidateDto[]>;
  abstract listReviewItems(
    filters: NormalizedAdminReviewQueueFilters,
  ): Promise<readonly AdminReviewQueueItemDto[]>;
  abstract getCompletenessReport(): Promise<AdminCurriculumCompletenessReportDto>;
  abstract findCurationItem(itemId: string): Promise<AdminCurationItemDto | null>;
  abstract findItemByCardId(cardId: string): Promise<AdminCurationItemDto | null>;
  abstract promoteImportedCandidate(
    input: NormalizedAdminPromoteCandidateInput,
  ): Promise<AdminCurationItemDto | null>;
  abstract approveImportedTranslation(
    input: NormalizedAdminApproveImportedTranslationInput,
  ): Promise<AdminCurationItemDto | null>;
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
  readonly curriculumBand: string | null;
  readonly status: string;
  readonly updatedAt: Date;
  readonly cards: readonly LearningCardRow[];
  readonly hints: readonly TextRow[];
  readonly mnemonics: readonly TextRow[];
  readonly dependencies: readonly DependencyRow[];
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

type DependencyRow = {
  readonly id: string;
  readonly dependencyType: string;
  readonly requiredStage: number | null;
  readonly prerequisiteItemId: string;
  readonly prerequisiteItem: {
    readonly id: string;
    readonly title: string;
    readonly status: string;
  };
};

type TargetSnapshot = {
  readonly japanese: string;
  readonly reading: string | null;
  readonly meanings: {
    readonly ru: string;
    readonly en: string;
  };
  readonly jlptLevel: string | null;
  readonly sourceRecordIds: readonly string[];
  readonly attributions: readonly SourceAttributionDto[];
};

type SourceInfo = {
  readonly attributions: readonly SourceAttributionDto[];
  readonly importRuns: readonly AdminImportRunSummaryDto[];
};

type ImportRunCoreRow = {
  readonly id: string;
  readonly sourceVersion: string | null;
  readonly sourceFileName: string;
  readonly checksumSha256: string;
  readonly startedAt: Date;
  readonly finishedAt: Date | null;
  readonly status: string;
  readonly statsJson: unknown;
  readonly errorText: string | null;
  readonly dataSource: {
    readonly name: string;
    readonly license: {
      readonly name: string;
    };
  };
};

type ImportRunSummaryRow = ImportRunCoreRow & {
  readonly _count: {
    readonly records: number;
  };
};

type ImportedCandidateSourceRow = {
  readonly importRun: {
    readonly dataSource: {
      readonly name: string;
    };
  };
};

type ImportedKanjiCandidateRow = {
  readonly id: string;
  readonly character: string;
  readonly frequencyRank: number | null;
  readonly grade: number | null;
  readonly jlptLevel: number | null;
  readonly readings: readonly { readonly reading: string }[];
  readonly meanings: readonly { readonly locale: string; readonly meaning: string }[];
  readonly strokeGraphic: { readonly id: string } | null;
  readonly importedRecord: ImportedCandidateSourceRow | null;
};

type ImportedWordCandidateRow = {
  readonly id: string;
  readonly expression: string;
  readonly reading: string;
  readonly commonnessRank: number | null;
  readonly jlptLevel: number | null;
  readonly senses: readonly { readonly locale: string; readonly meaning: string }[];
  readonly importedRecord: ImportedCandidateSourceRow | null;
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

const PROJECT_AUTHORED_ATTRIBUTION: SourceAttributionDto = {
  sourceName: "Project authored",
  licenseName: "Project content",
  attributionText: "Project-authored curated learning content.",
  sourceUrl: null,
};
const IMPORTED_CANDIDATE_QUERY_LIMIT = 500;
const IMPORTED_CANDIDATE_RESPONSE_LIMIT = 100;

@Injectable()
export class PrismaAdminRepository extends AdminRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listImportRuns(): Promise<readonly AdminImportRunSummaryDto[]> {
    const runs = (await this.prisma.db.importRun.findMany({
      orderBy: [{ startedAt: "desc" }, { id: "asc" }],
      take: 50,
      include: {
        dataSource: {
          include: {
            license: true,
          },
        },
        _count: {
          select: {
            records: true,
          },
        },
      },
    })) as unknown as readonly ImportRunSummaryRow[];

    return runs.map((run) => toImportRunSummary(run, run._count.records));
  }

  async listImportedCandidates(): Promise<readonly AdminImportedCandidateDto[]> {
    const promotedTargets = await this.prisma.db.learningItem.findMany({
      where: { targetType: { in: ["KANJI", "WORD"] } },
      select: { targetType: true, targetId: true },
    });
    const promotedKanjiIds = promotedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const promotedWordIds = promotedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const [kanjiRows, wordRows] = await Promise.all([
      this.prisma.db.kanji.findMany({
        where: {
          kanjidicImportedRecordId: { not: null },
          ...(promotedKanjiIds.length === 0 ? {} : { id: { notIn: promotedKanjiIds } }),
        },
        orderBy: [{ frequencyRank: "asc" }, { grade: "asc" }, { character: "asc" }],
        take: IMPORTED_CANDIDATE_QUERY_LIMIT,
        include: {
          readings: {
            orderBy: [{ priority: "asc" }, { reading: "asc" }],
            take: 3,
          },
          meanings: {
            where: { locale: { in: ["ru-RU", "en-US"] } },
            orderBy: [{ locale: "asc" }, { isPrimary: "desc" }, { meaning: "asc" }],
          },
          strokeGraphic: { select: { id: true } },
          importedRecord: {
            include: {
              importRun: {
                include: {
                  dataSource: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.db.word.findMany({
        where: {
          jmdictImportedRecordId: { not: null },
          ...(promotedWordIds.length === 0 ? {} : { id: { notIn: promotedWordIds } }),
        },
        orderBy: [{ commonnessRank: "asc" }, { expression: "asc" }, { reading: "asc" }],
        take: IMPORTED_CANDIDATE_QUERY_LIMIT,
        include: {
          senses: {
            where: { locale: { in: ["ru-RU", "en-US"] } },
            orderBy: [{ locale: "asc" }, { meaning: "asc" }],
          },
          importedRecord: {
            include: {
              importRun: {
                include: {
                  dataSource: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    ]);
    const candidates: ImportedCandidateRankingInput[] = [
      ...(kanjiRows as unknown as readonly ImportedKanjiCandidateRow[]).map(toKanjiCandidate),
      ...(wordRows as unknown as readonly ImportedWordCandidateRow[]).map(toWordCandidate),
    ];

    return rankImportedCandidates(candidates, IMPORTED_CANDIDATE_RESPONSE_LIMIT);
  }

  async listReviewItems(
    filters: NormalizedAdminReviewQueueFilters,
  ): Promise<readonly AdminReviewQueueItemDto[]> {
    const items = (await this.prisma.db.learningItem.findMany({
      where: {
        status: filters.status === undefined ? "NEEDS_REVIEW" : toPrismaStatus(filters.status),
        ...(filters.band === undefined ? {} : { curriculumBand: toPrismaBand(filters.band) }),
      },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      take: 200,
      include: this.itemInclude(),
    })) as unknown as readonly LearningItemRow[];

    const summaries: AdminReviewQueueItemDto[] = [];

    for (const item of items) {
      const curationItem = await this.toCurationItem(item);

      if (filters.jlptLevel !== undefined && curationItem.jlptLevel !== filters.jlptLevel) {
        continue;
      }

      if (
        filters.missingAcceptedAnswers === true &&
        !curationItem.qualityIssues.some((issue) => issue.code === "missing-accepted-answer")
      ) {
        continue;
      }

      if (
        filters.missingMnemonics === true &&
        !curationItem.qualityIssues.some(
          (issue) => issue.code === "missing-ru-mnemonic" || issue.code === "missing-en-mnemonic",
        )
      ) {
        continue;
      }

      summaries.push({
        id: item.id,
        itemType: toItemKind(item.kind),
        title: item.title,
        band: curationItem.band,
        japanese: curationItem.japanese,
        reading: curationItem.reading,
        level: item.levelHint,
        jlptLevel: curationItem.jlptLevel,
        status: toApiStatus(item.status),
        updatedAt: item.updatedAt.toISOString(),
        sourceNames: curationItem.attributions.map((source) => source.sourceName),
        qualityIssues: curationItem.qualityIssues,
      });

      if (summaries.length >= 50) {
        break;
      }
    }

    return summaries;
  }

  async getCompletenessReport(): Promise<AdminCurriculumCompletenessReportDto> {
    const items = (await this.prisma.db.learningItem.findMany({
      orderBy: [{ curriculumBand: "asc" }, { levelHint: "asc" }, { id: "asc" }],
      include: this.itemInclude(),
    })) as unknown as readonly LearningItemRow[];

    const curationItems: AdminCurationItemDto[] = [];

    for (const item of items) {
      curationItems.push(await this.toCurationItem(item));
    }

    return buildCurriculumCompletenessReport(curationItems, new Date());
  }

  async findCurationItem(itemId: string): Promise<AdminCurationItemDto | null> {
    const item = (await this.prisma.db.learningItem.findUnique({
      where: { id: itemId },
      include: this.itemInclude(),
    })) as unknown as LearningItemRow | null;

    return item === null ? null : this.toCurationItem(item);
  }

  async findItemByCardId(cardId: string): Promise<AdminCurationItemDto | null> {
    const card = await this.prisma.db.learningCard.findUnique({
      where: { id: cardId },
      select: { learningItemId: true },
    });

    return card === null ? null : this.findCurationItem(card.learningItemId);
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
          ...(input.band === undefined ? {} : { curriculumBand: toPrismaBandOrNull(input.band) }),
          updatedAt: now,
        },
      });
    });

    return this.findCurationItem(itemId);
  }

  async promoteImportedCandidate(
    input: NormalizedAdminPromoteCandidateInput,
  ): Promise<AdminCurationItemDto | null> {
    const targetType = toPrismaTargetType(input.targetType);
    const targetExists = await this.targetExists(targetType, input.targetId);

    if (!targetExists) {
      return null;
    }

    const item = await this.prisma.db.learningItem.upsert({
      where: {
        targetType_targetId: {
          targetType,
          targetId: input.targetId,
        },
      },
      update: {
        kind: toPrismaItemKind(input.targetType),
        title: input.title,
        levelHint: input.level,
        curriculumBand: toPrismaBand(input.band),
        status: "NEEDS_REVIEW",
      },
      create: {
        kind: toPrismaItemKind(input.targetType),
        targetType,
        targetId: input.targetId,
        title: input.title,
        levelHint: input.level,
        curriculumBand: toPrismaBand(input.band),
        status: "NEEDS_REVIEW",
      },
      include: this.itemInclude(),
    });

    return this.toCurationItem(item as unknown as LearningItemRow);
  }

  async approveImportedTranslation(
    input: NormalizedAdminApproveImportedTranslationInput,
  ): Promise<AdminCurationItemDto | null> {
    const source = await this.findImportedTranslationSource(input.targetType, input.targetId);

    if (source === null || !source.hasRussianMeaning || !source.hasEnglishMeaning) {
      return null;
    }

    const targetType = toPrismaTargetType(input.targetType);
    const itemId = await this.prisma.db.$transaction(async (db) => {
      const item = await db.learningItem.upsert({
        where: {
          targetType_targetId: {
            targetType,
            targetId: input.targetId,
          },
        },
        update: {
          kind: toPrismaItemKind(input.targetType),
          title: input.title,
          levelHint: input.level,
          curriculumBand: toPrismaBand(input.band),
          status: "NEEDS_REVIEW",
        },
        create: {
          kind: toPrismaItemKind(input.targetType),
          targetType,
          targetId: input.targetId,
          title: input.title,
          levelHint: input.level,
          curriculumBand: toPrismaBand(input.band),
          status: "NEEDS_REVIEW",
        },
      });

      await updateTargetMeanings(db, targetType, input.targetId, input.meanings);

      const meaningCard = await db.learningCard.upsert({
        where: {
          learningItemId_promptType_answerType_locale: {
            learningItemId: item.id,
            promptType: "MEANING",
            answerType: "MEANING",
            locale: "ru-RU",
          },
        },
        update: { cardType: "REVIEW", sortOrder: 1 },
        create: {
          learningItemId: item.id,
          cardType: "REVIEW",
          promptType: "MEANING",
          answerType: "MEANING",
          locale: "ru-RU",
          sortOrder: 1,
        },
      });

      await db.learningAnswer.deleteMany({ where: { learningCardId: meaningCard.id } });
      await db.learningAnswer.createMany({
        data: input.acceptedAnswers.map((answer) => ({
          learningCardId: meaningCard.id,
          text: answer.text,
          normalizedText: answer.normalizedText,
          answerKind: "MEANING",
          locale: answer.locale,
          isPrimary: answer.isPrimary,
          sourceKind: "PROJECT_AUTHORED",
        })),
      });

      const readings = uniqueNormalizedReadings(source.readings);

      if (readings.length > 0) {
        const readingCard = await db.learningCard.upsert({
          where: {
            learningItemId_promptType_answerType_locale: {
              learningItemId: item.id,
              promptType: "READING",
              answerType: "READING",
              locale: "ru-RU",
            },
          },
          update: { cardType: "REVIEW", sortOrder: 2 },
          create: {
            learningItemId: item.id,
            cardType: "REVIEW",
            promptType: "READING",
            answerType: "READING",
            locale: "ru-RU",
            sortOrder: 2,
          },
        });

        await db.learningAnswer.deleteMany({ where: { learningCardId: readingCard.id } });
        await db.learningAnswer.createMany({
          data: readings.map((reading, index) => ({
            learningCardId: readingCard.id,
            text: reading.text,
            normalizedText: reading.normalizedText,
            answerKind: "READING",
            locale: "ru-RU",
            isPrimary: index === 0,
            sourceKind: "PROJECT_AUTHORED",
          })),
        });
      }

      return item.id;
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
      dependencies: {
        orderBy: [{ dependencyType: "asc" as const }, { prerequisiteItemId: "asc" as const }],
        include: {
          prerequisiteItem: {
            select: {
              id: true,
              title: true,
              status: true,
            },
          },
        },
      },
    };
  }

  private async findImportedTranslationSource(
    targetType: NormalizedAdminApproveImportedTranslationInput["targetType"],
    targetId: string,
  ): Promise<{
    readonly readings: readonly string[];
    readonly hasRussianMeaning: boolean;
    readonly hasEnglishMeaning: boolean;
  } | null> {
    if (targetType === "kanji") {
      const kanji = await this.prisma.db.kanji.findFirst({
        where: { id: targetId, kanjidicImportedRecordId: { not: null } },
        include: {
          readings: { orderBy: [{ priority: "asc" }, { reading: "asc" }] },
          meanings: { where: { sourceKind: "IMPORTED", locale: { in: ["ru-RU", "en-US"] } } },
        },
      });

      return kanji === null
        ? null
        : {
            readings: kanji.readings.map((reading) => reading.reading),
            hasRussianMeaning: kanji.meanings.some((meaning) => meaning.locale === "ru-RU"),
            hasEnglishMeaning: kanji.meanings.some((meaning) => meaning.locale === "en-US"),
          };
    }

    const word = await this.prisma.db.word.findFirst({
      where: { id: targetId, jmdictImportedRecordId: { not: null } },
      include: {
        senses: { where: { sourceKind: "IMPORTED", locale: { in: ["ru-RU", "en-US"] } } },
      },
    });

    return word === null
      ? null
      : {
          readings: word.reading.trim() === "" ? [] : [word.reading],
          hasRussianMeaning: word.senses.some((sense) => sense.locale === "ru-RU"),
          hasEnglishMeaning: word.senses.some((sense) => sense.locale === "en-US"),
        };
  }

  private async toCurationItem(item: LearningItemRow): Promise<AdminCurationItemDto> {
    const target = await this.findTargetSnapshot(item.targetType, item.targetId);
    const sourceInfo = await this.findSourceInfo(target.sourceRecordIds, target.attributions);

    return applyQualityIssues({
      id: item.id,
      itemType: toItemKind(item.kind),
      band: toApiBandOrNull(item.curriculumBand),
      title: item.title,
      japanese: target.japanese,
      reading: target.reading,
      level: item.levelHint,
      jlptLevel: target.jlptLevel,
      status: toApiStatus(item.status),
      updatedAt: item.updatedAt.toISOString(),
      meanings: target.meanings,
      cards: item.cards.map(toCardDto),
      hints: item.hints.map(toTextDto),
      mnemonics: item.mnemonics.map(toTextDto),
      dependencies: item.dependencies.map(toDependencyDto),
      attributions: sourceInfo.attributions,
      importRuns: sourceInfo.importRuns,
      qualityIssues: [],
    });
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

  private async targetExists(targetType: string, targetId: string): Promise<boolean> {
    switch (targetType) {
      case "COMPONENT":
        return (await this.prisma.db.component.count({ where: { id: targetId } })) > 0;
      case "KANJI":
        return (await this.prisma.db.kanji.count({ where: { id: targetId } })) > 0;
      case "WORD":
        return (await this.prisma.db.word.count({ where: { id: targetId } })) > 0;
      case "SENTENCE":
        return (await this.prisma.db.sentence.count({ where: { id: targetId } })) > 0;
      default:
        return false;
    }
  }

  private async findComponentTarget(targetId: string): Promise<TargetSnapshot> {
    const component = (await this.prisma.db.component.findUnique({
      where: { id: targetId },
      select: { symbol: true, meaningRu: true, meaningEn: true },
    })) as {
      readonly symbol: string;
      readonly meaningRu: string;
      readonly meaningEn: string;
    } | null;

    if (component === null) {
      throw new Error(`Missing component target ${targetId}.`);
    }

    return {
      japanese: component.symbol,
      reading: null,
      meanings: { ru: component.meaningRu, en: component.meaningEn },
      jlptLevel: null,
      sourceRecordIds: [],
      attributions: [PROJECT_AUTHORED_ATTRIBUTION],
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
      readonly jlptLevel: number | null;
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
      jlptLevel: formatJlptLevel(kanji.jlptLevel),
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
      readonly jlptLevel: number | null;
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
      jlptLevel: formatJlptLevel(word.jlptLevel),
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
      jlptLevel: null,
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
      importRunById.set(run.id, toImportRunSummary(run, run.records.length));
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

function toDependencyDto(dependency: DependencyRow): AdminCurationItemDto["dependencies"][number] {
  return {
    id: dependency.id,
    prerequisiteItemId: dependency.prerequisiteItemId,
    prerequisiteTitle: dependency.prerequisiteItem.title,
    prerequisiteStatus: toApiStatus(dependency.prerequisiteItem.status),
    dependencyType: toApiDependencyType(dependency.dependencyType),
    requiredStage: dependency.requiredStage,
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

      if (meanings.en !== undefined) {
        await db.component.update({
          where: { id: targetId },
          data: { meaningEn: meanings.en },
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

function toApiBandOrNull(value: string | null): CourseBand | null {
  if (value === null) {
    return null;
  }

  switch (value) {
    case "FOUNDATION":
      return "foundation";
    case "N5":
      return "n5";
    case "N4":
      return "n4";
    case "N3":
      return "n3";
    case "N2":
      return "n2";
    default:
      throw new Error(`Unsupported course band: ${value}`);
  }
}

function toPrismaBand(band: CourseBand) {
  switch (band) {
    case "foundation":
      return "FOUNDATION";
    case "n5":
      return "N5";
    case "n4":
      return "N4";
    case "n3":
      return "N3";
    case "n2":
      return "N2";
  }
}

function toPrismaBandOrNull(band: CourseBand | null) {
  return band === null ? null : toPrismaBand(band);
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

function toImportRunSummary(run: ImportRunCoreRow, recordCount: number): AdminImportRunSummaryDto {
  return {
    id: run.id,
    dataSourceName: run.dataSource.name,
    licenseName: run.dataSource.license.name,
    sourceVersion: run.sourceVersion,
    sourceFileName: run.sourceFileName,
    checksumSha256: run.checksumSha256,
    status: toApiImportRunStatus(run.status),
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
    recordCount,
    stats: toImportStats(run.statsJson),
    errorText: run.errorText,
  };
}

function toImportStats(
  statsJson: unknown,
): Readonly<Record<string, string | number | boolean | null>> {
  if (!isRecord(statsJson)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(statsJson).map(([key, value]) => [key, toImportStatValue(value)]),
  );
}

function toImportStatValue(value: unknown): string | number | boolean | null {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    value === null
  ) {
    return value;
  }

  return JSON.stringify(value) ?? String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function toPrismaItemKind(kind: ItemKind) {
  switch (kind) {
    case "component":
      return "COMPONENT";
    case "kanji":
      return "KANJI";
    case "word":
      return "WORD";
    case "sentence":
      return "SENTENCE";
  }
}

function toPrismaTargetType(kind: ItemKind) {
  return toPrismaItemKind(kind);
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

function toApiDependencyType(
  value: string,
): AdminCurationItemDto["dependencies"][number]["dependencyType"] {
  switch (value) {
    case "COMPONENT_OF":
      return "related";
    case "UNLOCKS":
      return "unlock";
    default:
      return "prerequisite";
  }
}

function formatJlptLevel(level: number | null): string | null {
  return level === null ? null : `N${level}`;
}

function toKanjiCandidate(row: ImportedKanjiCandidateRow): ImportedCandidateRankingInput {
  return {
    targetId: row.id,
    itemType: "kanji",
    japanese: row.character,
    reading: row.readings[0]?.reading ?? null,
    meanings: pickCandidateMeanings(row.meanings),
    jlptLevel: formatImportedKanjiJlptLevel(row.jlptLevel),
    sourcePriority: row.frequencyRank,
    schoolGrade: row.grade,
    hasStrokeData: row.strokeGraphic !== null,
    sourceName: assertCandidateSource(row.importedRecord, "KANJIDIC2"),
  };
}

function toWordCandidate(row: ImportedWordCandidateRow): ImportedCandidateRankingInput {
  return {
    targetId: row.id,
    itemType: "word",
    japanese: row.expression,
    reading: row.reading.trim() === "" ? null : row.reading,
    meanings: pickCandidateMeanings(row.senses),
    jlptLevel: formatCurrentJlptLevel(row.jlptLevel),
    sourcePriority: normalizeStoredWordRank(row.commonnessRank),
    schoolGrade: null,
    hasStrokeData: false,
    sourceName: assertCandidateSource(row.importedRecord, "JMdict"),
  };
}

function uniqueNormalizedReadings(
  readings: readonly string[],
): readonly { readonly text: string; readonly normalizedText: string }[] {
  const normalized = new Set<string>();
  const result: { text: string; normalizedText: string }[] = [];

  for (const value of readings) {
    const text = value.trim();
    const normalizedText = normalizeJapaneseReading(text);

    if (normalizedText === "" || normalized.has(normalizedText)) {
      continue;
    }

    normalized.add(normalizedText);
    result.push({ text, normalizedText });
  }

  return result;
}

function pickCandidateMeanings(
  rows: readonly { readonly locale: string; readonly meaning: string }[],
): ImportedCandidateRankingInput["meanings"] {
  return {
    ru: uniqueCandidateMeanings(rows, "ru-RU"),
    en: uniqueCandidateMeanings(rows, "en-US"),
  };
}

function uniqueCandidateMeanings(
  rows: readonly { readonly locale: string; readonly meaning: string }[],
  locale: "ru-RU" | "en-US",
): readonly string[] {
  return [
    ...new Set(
      rows
        .filter((row) => row.locale === locale)
        .map((row) => row.meaning.trim())
        .filter((meaning) => meaning !== ""),
    ),
  ].slice(0, 3);
}

function formatImportedKanjiJlptLevel(
  level: number | null,
): ImportedCandidateRankingInput["jlptLevel"] {
  switch (level) {
    case 5:
    case 4:
      return "N5";
    case 3:
      return "N4";
    case 2:
      return "N2";
    default:
      return null;
  }
}

function formatCurrentJlptLevel(level: number | null): ImportedCandidateRankingInput["jlptLevel"] {
  return level === 5 || level === 4 || level === 3 || level === 2 ? `N${level}` : null;
}

function normalizeStoredWordRank(rank: number | null): number | null {
  if (rank === null || rank >= 500) {
    return rank;
  }

  if (rank === 1) {
    return 1_000;
  }

  if (rank === 2) {
    return 10_000;
  }

  return rank * 500;
}

function assertCandidateSource(
  importedRecord: ImportedCandidateSourceRow | null,
  expected: AdminImportedCandidateDto["sourceName"],
): AdminImportedCandidateDto["sourceName"] {
  const actual = importedRecord?.importRun.dataSource.name;

  if (actual !== expected) {
    throw new Error(
      `Imported candidate source mismatch: expected ${expected}, received ${actual}.`,
    );
  }

  return expected;
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
