import { createHash } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";

import {
  type AdminContentStatus,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurriculumScaleReadinessDto,
  type AdminCurationCardDto,
  type AdminCurationItemDto,
  type AdminCurationTextDto,
  type AdminImportRunSummaryDto,
  type AdminImportedCandidateDto,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateRejectionDto,
  type AdminImportedCandidateRejectionListItemDto,
  type AdminPrerequisiteCandidateDto,
  type AdminPrerequisiteCandidateListResponse,
  type AdminReviewQueueItemDto,
  type CardAnswerType,
  type CardPromptType,
  type ContentLocale,
  type CourseBand,
  type ItemKind,
  type SourceAttributionDto,
  CURRICULUM_SCALE_TARGETS,
} from "@kanji-srs/shared";
import { PrismaService } from "../database/prisma.service";
import { applyQualityIssues, buildCurriculumCompletenessReport } from "./curriculum-quality";
import {
  buildCurriculumCandidatePlan,
  CURRICULUM_CANDIDATE_POLICY_VERSION,
  type CurriculumCandidatePlan,
} from "./curriculum-candidate-plan";
import { buildCurriculumScaleReadiness } from "./curriculum-scale-readiness";
import {
  type ImportedCandidateRankingInput,
  rankImportedCandidates,
} from "./imported-candidate-ranking";
import {
  type AdminCandidatePlanEnqueueItemInput,
  type AdminCandidatePlanEnqueueResult,
  type AdminImportedCandidateTargetInput,
  type AdminReviewQueueCursor,
  type AdminReviewQueuePageResult,
  type NormalizedAdminCardAnswersInput,
  type NormalizedAdminApproveImportedTranslationInput,
  type NormalizedAdminRejectImportedCandidateInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminPromoteCandidateInput,
  type NormalizedAdminUpdatePrerequisitesInput,
  type NormalizedAdminReviewQueueFilters,
  type NormalizedAdminTextInput,
} from "./admin.types";

export abstract class AdminRepository {
  abstract listImportRuns(): Promise<readonly AdminImportRunSummaryDto[]>;
  abstract listImportedCandidates(): Promise<readonly AdminImportedCandidateDto[]>;
  abstract findImportedCandidateDetails(
    targetType: AdminImportedCandidateDetailsDto["itemType"],
    targetId: string,
  ): Promise<AdminImportedCandidateDetailsDto | null>;
  abstract listImportedCandidateRejections(): Promise<
    readonly AdminImportedCandidateRejectionListItemDto[]
  >;
  abstract findRejectedCandidateKeys(
    candidates: readonly AdminImportedCandidateTargetInput[],
  ): Promise<readonly string[]>;
  abstract rejectImportedCandidate(
    input: NormalizedAdminRejectImportedCandidateInput,
  ): Promise<AdminImportedCandidateRejectionDto | null>;
  abstract restoreImportedCandidate(input: AdminImportedCandidateTargetInput): Promise<boolean>;
  abstract listReviewItems(
    filters: NormalizedAdminReviewQueueFilters,
  ): Promise<AdminReviewQueuePageResult>;
  abstract getCompletenessReport(): Promise<AdminCurriculumCompletenessReportDto>;
  abstract getScaleReadiness(): Promise<AdminCurriculumScaleReadinessDto>;
  abstract getCandidatePlanVersion(): Promise<string>;
  abstract getCandidatePlan(): Promise<CurriculumCandidatePlan>;
  abstract enqueueCandidatePlanCandidates(
    candidates: readonly AdminCandidatePlanEnqueueItemInput[],
  ): Promise<AdminCandidatePlanEnqueueResult>;
  abstract findCurationItem(itemId: string): Promise<AdminCurationItemDto | null>;
  abstract listPrerequisiteCandidates(
    itemId: string,
  ): Promise<AdminPrerequisiteCandidateListResponse | null>;
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
  abstract replacePrerequisites(
    itemId: string,
    input: NormalizedAdminUpdatePrerequisitesInput,
  ): Promise<AdminCurationItemDto | null>;
  abstract updateCardAnswers(
    cardId: string,
    input: NormalizedAdminCardAnswersInput,
  ): Promise<AdminCurationItemDto | null>;
}

export class PrerequisiteSelectionChangedError extends Error {}

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

type ImportedCandidateDetailsSourceRow = {
  readonly sourceRecordId: string;
  readonly importRun: {
    readonly id: string;
    readonly sourceVersion: string | null;
    readonly sourceFileName: string;
    readonly checksumSha256: string;
    readonly dataSource: {
      readonly name: string;
      readonly homepageUrl: string | null;
      readonly attributionText: string;
      readonly license: {
        readonly name: string;
      };
    };
  };
};

type ImportedKanjiDetailsRow = {
  readonly id: string;
  readonly character: string;
  readonly strokeCount: number | null;
  readonly grade: number | null;
  readonly jlptLevel: number | null;
  readonly frequencyRank: number | null;
  readonly readings: readonly {
    readonly reading: string;
    readonly readingType: string;
  }[];
  readonly meanings: readonly { readonly locale: string; readonly meaning: string }[];
  readonly strokeGraphic: { readonly id: string } | null;
  readonly importedRecord: ImportedCandidateDetailsSourceRow | null;
};

type ImportedWordDetailsRow = {
  readonly id: string;
  readonly expression: string;
  readonly reading: string;
  readonly commonnessRank: number | null;
  readonly jlptLevel: number | null;
  readonly senses: readonly { readonly locale: string; readonly meaning: string }[];
  readonly importedRecord: ImportedCandidateDetailsSourceRow | null;
};

type CandidatePlanKanjiRow = {
  readonly id: string;
  readonly character: string;
  readonly frequencyRank: number | null;
  readonly grade: number | null;
  readonly jlptLevel: number | null;
  readonly readings: readonly { readonly reading: string }[];
  readonly meanings: readonly { readonly locale: string }[];
  readonly strokeGraphic: { readonly id: string } | null;
};

type CandidatePlanWordRow = {
  readonly id: string;
  readonly expression: string;
  readonly reading: string;
  readonly commonnessRank: number | null;
  readonly jlptLevel: number | null;
  readonly senses: readonly { readonly locale: string }[];
};

type ImportedCandidateRejectionRow = {
  readonly id: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly reason: string;
  readonly note: string | null;
  readonly rejectedByUserId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
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
const CURRICULUM_KANJI_CANDIDATE_POOL_LIMIT = 5_000;
const CURRICULUM_WORD_CANDIDATE_POOL_LIMIT = 40_000;
const ADMIN_REVIEW_QUEUE_SCAN_LIMIT = 100;

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

  async listImportedCandidateRejections(): Promise<
    readonly AdminImportedCandidateRejectionListItemDto[]
  > {
    const rows = (await this.prisma.db.importedCandidateRejection.findMany({
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    })) as unknown as readonly ImportedCandidateRejectionRow[];

    const kanjiIds = rows.filter((row) => row.targetType === "KANJI").map((row) => row.targetId);
    const wordIds = rows.filter((row) => row.targetType === "WORD").map((row) => row.targetId);
    const [kanjiRows, wordRows] = await Promise.all([
      kanjiIds.length === 0
        ? []
        : this.prisma.db.kanji.findMany({
            where: { id: { in: kanjiIds } },
            select: {
              id: true,
              character: true,
              readings: {
                orderBy: [{ priority: "asc" }, { reading: "asc" }],
                take: 1,
                select: { reading: true },
              },
            },
          }),
      wordIds.length === 0
        ? []
        : this.prisma.db.word.findMany({
            where: { id: { in: wordIds } },
            select: { id: true, expression: true, reading: true },
          }),
    ]);
    const targets = new Map<string, { readonly japanese: string; readonly reading: string | null }>(
      [
        ...kanjiRows.map(
          (kanji) =>
            [
              importedCandidateKey("kanji", kanji.id),
              { japanese: kanji.character, reading: kanji.readings[0]?.reading ?? null },
            ] as const,
        ),
        ...wordRows.map(
          (word) =>
            [
              importedCandidateKey("word", word.id),
              { japanese: word.expression, reading: word.reading },
            ] as const,
        ),
      ],
    );

    return rows.map((row) => {
      const rejection = toImportedCandidateRejectionDto(row);
      const target = targets.get(importedCandidateKey(rejection.targetType, rejection.targetId));

      return {
        ...rejection,
        japanese: target?.japanese ?? null,
        reading: target?.reading ?? null,
      };
    });
  }

  async findRejectedCandidateKeys(
    candidates: readonly AdminImportedCandidateTargetInput[],
  ): Promise<readonly string[]> {
    if (candidates.length === 0) {
      return [];
    }

    const rows = await this.prisma.db.importedCandidateRejection.findMany({
      where: {
        OR: candidates.map((candidate) => ({
          targetType: toPrismaImportedCandidateTargetType(candidate.itemType),
          targetId: candidate.targetId,
        })),
      },
      select: { targetType: true, targetId: true },
    });

    return rows.map((row) =>
      importedCandidateKey(toApiImportedCandidateTargetType(row.targetType), row.targetId),
    );
  }

  async rejectImportedCandidate(
    input: NormalizedAdminRejectImportedCandidateInput,
  ): Promise<AdminImportedCandidateRejectionDto | null> {
    const targetType = toPrismaImportedCandidateTargetType(input.itemType);
    const [targetExists, learningItem] = await Promise.all([
      input.itemType === "kanji"
        ? this.prisma.db.kanji.count({
            where: { id: input.targetId, kanjidicImportedRecordId: { not: null } },
          })
        : this.prisma.db.word.count({
            where: { id: input.targetId, jmdictImportedRecordId: { not: null } },
          }),
      this.prisma.db.learningItem.findUnique({
        where: {
          targetType_targetId: {
            targetType,
            targetId: input.targetId,
          },
        },
        select: { id: true },
      }),
    ]);

    if (targetExists === 0 || learningItem !== null) {
      return null;
    }

    const row = (await this.prisma.db.importedCandidateRejection.upsert({
      where: {
        targetType_targetId: {
          targetType,
          targetId: input.targetId,
        },
      },
      update: {
        reason: toPrismaImportedCandidateRejectionReason(input.reason),
        note: input.note,
        rejectedByUserId: input.rejectedByUserId,
      },
      create: {
        targetType,
        targetId: input.targetId,
        reason: toPrismaImportedCandidateRejectionReason(input.reason),
        note: input.note,
        rejectedByUserId: input.rejectedByUserId,
      },
    })) as unknown as ImportedCandidateRejectionRow;

    return toImportedCandidateRejectionDto(row);
  }

  async restoreImportedCandidate(input: AdminImportedCandidateTargetInput): Promise<boolean> {
    const result = await this.prisma.db.importedCandidateRejection.deleteMany({
      where: {
        targetType: toPrismaImportedCandidateTargetType(input.itemType),
        targetId: input.targetId,
      },
    });

    return result.count > 0;
  }

  async listImportedCandidates(): Promise<readonly AdminImportedCandidateDto[]> {
    const [promotedTargets, rejectedTargets] = await Promise.all([
      this.prisma.db.learningItem.findMany({
        where: { targetType: { in: ["KANJI", "WORD"] } },
        select: { targetType: true, targetId: true },
      }),
      this.prisma.db.importedCandidateRejection.findMany({
        select: { targetType: true, targetId: true },
      }),
    ]);
    const promotedKanjiIds = promotedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const promotedWordIds = promotedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const rejectedKanjiIds = rejectedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const rejectedWordIds = rejectedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const excludedKanjiIds = [...new Set([...promotedKanjiIds, ...rejectedKanjiIds])];
    const excludedWordIds = [...new Set([...promotedWordIds, ...rejectedWordIds])];
    const [kanjiRows, wordRows] = await Promise.all([
      this.prisma.db.kanji.findMany({
        where: {
          kanjidicImportedRecordId: { not: null },
          ...(excludedKanjiIds.length === 0 ? {} : { id: { notIn: excludedKanjiIds } }),
        },
        orderBy: [{ frequencyRank: "asc" }, { grade: "asc" }, { character: "asc" }],
        take: IMPORTED_CANDIDATE_QUERY_LIMIT,
        include: {
          readings: {
            orderBy: [{ priority: "asc" }, { reading: "asc" }],
            take: 3,
          },
          meanings: {
            where: {
              locale: { in: ["ru-RU", "en-US"] },
              sourceKind: "IMPORTED",
            },
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
          ...(excludedWordIds.length === 0 ? {} : { id: { notIn: excludedWordIds } }),
        },
        orderBy: [{ commonnessRank: "asc" }, { expression: "asc" }, { reading: "asc" }],
        take: IMPORTED_CANDIDATE_QUERY_LIMIT,
        include: {
          senses: {
            where: {
              locale: { in: ["ru-RU", "en-US"] },
              sourceKind: "IMPORTED",
            },
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

  async findImportedCandidateDetails(
    targetType: AdminImportedCandidateDetailsDto["itemType"],
    targetId: string,
  ): Promise<AdminImportedCandidateDetailsDto | null> {
    if (targetType === "kanji") {
      const row = (await this.prisma.db.kanji.findFirst({
        where: { id: targetId, kanjidicImportedRecordId: { not: null } },
        select: {
          id: true,
          character: true,
          strokeCount: true,
          grade: true,
          jlptLevel: true,
          frequencyRank: true,
          readings: {
            orderBy: [{ priority: "asc" }, { reading: "asc" }],
            select: { reading: true, readingType: true },
          },
          meanings: {
            where: {
              locale: { in: ["ru-RU", "en-US"] },
              sourceKind: "IMPORTED",
            },
            orderBy: [{ locale: "asc" }, { isPrimary: "desc" }, { meaning: "asc" }],
            select: { locale: true, meaning: true },
          },
          strokeGraphic: { select: { id: true } },
          importedRecord: {
            select: {
              sourceRecordId: true,
              importRun: {
                select: {
                  id: true,
                  sourceVersion: true,
                  sourceFileName: true,
                  checksumSha256: true,
                  dataSource: {
                    select: {
                      name: true,
                      homepageUrl: true,
                      attributionText: true,
                      license: { select: { name: true } },
                    },
                  },
                },
              },
            },
          },
        },
      })) as unknown as ImportedKanjiDetailsRow | null;

      return row === null ? null : toImportedKanjiDetails(row);
    }

    const row = (await this.prisma.db.word.findFirst({
      where: { id: targetId, jmdictImportedRecordId: { not: null } },
      select: {
        id: true,
        expression: true,
        reading: true,
        commonnessRank: true,
        jlptLevel: true,
        senses: {
          where: {
            locale: { in: ["ru-RU", "en-US"] },
            sourceKind: "IMPORTED",
          },
          orderBy: [{ locale: "asc" }, { meaning: "asc" }],
          select: { locale: true, meaning: true },
        },
        importedRecord: {
          select: {
            sourceRecordId: true,
            importRun: {
              select: {
                id: true,
                sourceVersion: true,
                sourceFileName: true,
                checksumSha256: true,
                dataSource: {
                  select: {
                    name: true,
                    homepageUrl: true,
                    attributionText: true,
                    license: { select: { name: true } },
                  },
                },
              },
            },
          },
        },
      },
    })) as unknown as ImportedWordDetailsRow | null;

    return row === null ? null : toImportedWordDetails(row);
  }

  async getScaleReadiness(): Promise<AdminCurriculumScaleReadinessDto> {
    const [assignedTargets, rejectedTargets] = await Promise.all([
      this.prisma.db.learningItem.findMany({
        where: { targetType: { in: ["KANJI", "WORD"] } },
        select: { targetType: true, targetId: true },
      }),
      this.prisma.db.importedCandidateRejection.findMany({
        select: { targetType: true, targetId: true },
      }),
    ]);
    const assignedKanjiIds = assignedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const assignedWordIds = assignedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const rejectedKanjiIds = rejectedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const rejectedWordIds = rejectedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const unavailableKanjiIds = [...new Set([...assignedKanjiIds, ...rejectedKanjiIds])];
    const unavailableWordIds = [...new Set([...assignedWordIds, ...rejectedWordIds])];
    const unassignedKanjiWhere = {
      kanjidicImportedRecordId: { not: null },
      ...(unavailableKanjiIds.length === 0 ? {} : { id: { notIn: unavailableKanjiIds } }),
    };
    const unassignedWordWhere = {
      jmdictImportedRecordId: { not: null },
      ...(unavailableWordIds.length === 0 ? {} : { id: { notIn: unavailableWordIds } }),
    };
    const [
      publishedKanji,
      curatedKanji,
      importedKanji,
      kanjiWithReading,
      kanjiWithRussianMeaning,
      kanjiWithEnglishMeaning,
      kanjiWithBilingualMeanings,
      kanjiWithStrokeData,
      publishedWords,
      curatedWords,
      importedWords,
      wordsWithReading,
      wordsWithRussianMeaning,
      wordsWithEnglishMeaning,
      wordsWithBilingualMeanings,
    ] = await Promise.all([
      this.prisma.db.learningItem.count({
        where: { targetType: "KANJI", status: "PUBLISHED" },
      }),
      this.prisma.db.learningItem.count({
        where: { targetType: "KANJI", status: { in: ["DRAFT", "NEEDS_REVIEW"] } },
      }),
      this.prisma.db.kanji.count({ where: unassignedKanjiWhere }),
      this.prisma.db.kanji.count({
        where: { ...unassignedKanjiWhere, readings: { some: {} } },
      }),
      this.prisma.db.kanji.count({
        where: { ...unassignedKanjiWhere, meanings: { some: { locale: "ru-RU" } } },
      }),
      this.prisma.db.kanji.count({
        where: { ...unassignedKanjiWhere, meanings: { some: { locale: "en-US" } } },
      }),
      this.prisma.db.kanji.count({
        where: {
          ...unassignedKanjiWhere,
          AND: [
            { meanings: { some: { locale: "ru-RU" } } },
            { meanings: { some: { locale: "en-US" } } },
          ],
        },
      }),
      this.prisma.db.kanji.count({
        where: { ...unassignedKanjiWhere, strokeGraphic: { isNot: null } },
      }),
      this.prisma.db.learningItem.count({
        where: { targetType: "WORD", status: "PUBLISHED" },
      }),
      this.prisma.db.learningItem.count({
        where: { targetType: "WORD", status: { in: ["DRAFT", "NEEDS_REVIEW"] } },
      }),
      this.prisma.db.word.count({ where: unassignedWordWhere }),
      this.prisma.db.word.count({
        where: { ...unassignedWordWhere, reading: { not: "" } },
      }),
      this.prisma.db.word.count({
        where: { ...unassignedWordWhere, senses: { some: { locale: "ru-RU" } } },
      }),
      this.prisma.db.word.count({
        where: { ...unassignedWordWhere, senses: { some: { locale: "en-US" } } },
      }),
      this.prisma.db.word.count({
        where: {
          ...unassignedWordWhere,
          AND: [
            { senses: { some: { locale: "ru-RU" } } },
            { senses: { some: { locale: "en-US" } } },
          ],
        },
      }),
    ]);

    return buildCurriculumScaleReadiness(
      [
        {
          itemType: "kanji",
          targetItems: CURRICULUM_SCALE_TARGETS.kanji,
          publishedItems: publishedKanji,
          inCurationItems: curatedKanji,
          importedCandidates: importedKanji,
          candidateCoverage: {
            withReading: kanjiWithReading,
            withRussianMeaning: kanjiWithRussianMeaning,
            withEnglishMeaning: kanjiWithEnglishMeaning,
            withBilingualMeanings: kanjiWithBilingualMeanings,
            withStrokeData: kanjiWithStrokeData,
          },
        },
        {
          itemType: "word",
          targetItems: CURRICULUM_SCALE_TARGETS.word,
          publishedItems: publishedWords,
          inCurationItems: curatedWords,
          importedCandidates: importedWords,
          candidateCoverage: {
            withReading: wordsWithReading,
            withRussianMeaning: wordsWithRussianMeaning,
            withEnglishMeaning: wordsWithEnglishMeaning,
            withBilingualMeanings: wordsWithBilingualMeanings,
            withStrokeData: null,
          },
        },
      ],
      new Date(),
    );
  }

  async getCandidatePlan(): Promise<CurriculumCandidatePlan> {
    const [assignedTargets, rejectedTargets] = await Promise.all([
      this.prisma.db.learningItem.findMany({
        where: { targetType: { in: ["KANJI", "WORD"] } },
        select: { targetType: true, targetId: true, status: true },
      }),
      this.prisma.db.importedCandidateRejection.findMany({
        select: { targetType: true, targetId: true },
      }),
    ]);
    const assignedKanjiIds = assignedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const assignedWordIds = assignedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const rejectedKanjiIds = rejectedTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const rejectedWordIds = rejectedTargets
      .filter((target) => target.targetType === "WORD")
      .map((target) => target.targetId);
    const unavailableKanjiIds = [...new Set([...assignedKanjiIds, ...rejectedKanjiIds])];
    const unavailableWordIds = [...new Set([...assignedWordIds, ...rejectedWordIds])];
    const activeTargets = assignedTargets.filter((target) => target.status !== "ARCHIVED");
    const activeKanjiIds = activeTargets
      .filter((target) => target.targetType === "KANJI")
      .map((target) => target.targetId);
    const unassignedKanjiWhere = {
      kanjidicImportedRecordId: { not: null },
      ...(unavailableKanjiIds.length === 0 ? {} : { id: { notIn: unavailableKanjiIds } }),
    };
    const unassignedWordWhere = {
      jmdictImportedRecordId: { not: null },
      ...(unavailableWordIds.length === 0 ? {} : { id: { notIn: unavailableWordIds } }),
    };
    const [existingKanjiRows, importedKanjiCount, importedWordCount, kanjiRows, wordRows] =
      await Promise.all([
        activeKanjiIds.length === 0
          ? Promise.resolve([])
          : this.prisma.db.kanji.findMany({
              where: { id: { in: activeKanjiIds } },
              select: { character: true },
            }),
        this.prisma.db.kanji.count({ where: unassignedKanjiWhere }),
        this.prisma.db.word.count({ where: unassignedWordWhere }),
        this.prisma.db.kanji.findMany({
          where: unassignedKanjiWhere,
          orderBy: [{ frequencyRank: "asc" }, { grade: "asc" }, { character: "asc" }],
          take: CURRICULUM_KANJI_CANDIDATE_POOL_LIMIT,
          select: {
            id: true,
            character: true,
            frequencyRank: true,
            grade: true,
            jlptLevel: true,
            readings: {
              orderBy: [{ priority: "asc" }, { reading: "asc" }],
              take: 1,
              select: { reading: true },
            },
            meanings: {
              where: { locale: { in: ["ru-RU", "en-US"] } },
              distinct: ["locale"],
              select: { locale: true },
            },
            strokeGraphic: { select: { id: true } },
          },
        }),
        this.prisma.db.word.findMany({
          where: unassignedWordWhere,
          orderBy: [{ commonnessRank: "asc" }, { expression: "asc" }, { reading: "asc" }],
          take: CURRICULUM_WORD_CANDIDATE_POOL_LIMIT,
          select: {
            id: true,
            expression: true,
            reading: true,
            commonnessRank: true,
            jlptLevel: true,
            senses: {
              where: { locale: { in: ["ru-RU", "en-US"] } },
              distinct: ["locale"],
              select: { locale: true },
            },
          },
        }),
      ]);

    return buildCurriculumCandidatePlan({
      existingItems: {
        kanji: activeTargets.filter((target) => target.targetType === "KANJI").length,
        word: activeTargets.filter((target) => target.targetType === "WORD").length,
      },
      existingKanji: existingKanjiRows.map((row) => row.character),
      candidates: [
        ...(kanjiRows as unknown as readonly CandidatePlanKanjiRow[]).map(
          toCandidatePlanKanjiInput,
        ),
        ...(wordRows as unknown as readonly CandidatePlanWordRow[]).map(toCandidatePlanWordInput),
      ],
      poolTruncated: {
        kanji: importedKanjiCount > kanjiRows.length,
        word: importedWordCount > wordRows.length,
      },
    });
  }

  async getCandidatePlanVersion(): Promise<string> {
    const [learningItems, rejections, kanji, words, strokeGraphics] = await Promise.all([
      this.prisma.db.learningItem.aggregate({
        where: { targetType: { in: ["KANJI", "WORD"] } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.db.importedCandidateRejection.aggregate({
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.db.kanji.aggregate({
        where: { kanjidicImportedRecordId: { not: null } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.db.word.aggregate({
        where: { jmdictImportedRecordId: { not: null } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
      this.prisma.db.kanjiStrokeGraphic.aggregate({
        where: { importedRecordId: { not: null } },
        _count: { _all: true },
        _max: { updatedAt: true },
      }),
    ]);
    const state = [
      `policy:${CURRICULUM_CANDIDATE_POLICY_VERSION}`,
      candidatePlanVersionPart("learning-items", learningItems),
      candidatePlanVersionPart("candidate-rejections", rejections),
      candidatePlanVersionPart("kanji", kanji),
      candidatePlanVersionPart("words", words),
      candidatePlanVersionPart("strokes", strokeGraphics),
    ].join("|");

    return createHash("sha256").update(state).digest("hex");
  }

  async enqueueCandidatePlanCandidates(
    candidates: readonly AdminCandidatePlanEnqueueItemInput[],
  ): Promise<AdminCandidatePlanEnqueueResult> {
    return this.prisma.db.$transaction(async (db) => {
      const targetConditions = candidates.map((candidate) => ({
        targetType: toPrismaTargetType(candidate.itemType),
        targetId: candidate.targetId,
      }));
      const existingItems = await db.learningItem.findMany({
        where: { OR: targetConditions },
        select: { targetType: true, targetId: true },
      });
      const existingTargetKeys = new Set(
        existingItems.map((item) => candidatePlanItemKey(item.targetType, item.targetId)),
      );
      const missingCandidates = candidates.filter(
        (candidate) =>
          !existingTargetKeys.has(
            candidatePlanItemKey(toPrismaTargetType(candidate.itemType), candidate.targetId),
          ),
      );
      const created =
        missingCandidates.length === 0
          ? { count: 0 }
          : await db.learningItem.createMany({
              data: missingCandidates.map((candidate) => ({
                kind: toPrismaItemKind(candidate.itemType),
                targetType: toPrismaTargetType(candidate.itemType),
                targetId: candidate.targetId,
                title: candidate.title,
                levelHint: null,
                curriculumBand: toPrismaBand(candidate.band),
                status: "NEEDS_REVIEW" as const,
              })),
              skipDuplicates: true,
            });
      const queuedItems = await db.learningItem.findMany({
        where: { OR: targetConditions },
        select: { id: true, targetType: true, targetId: true, status: true },
      });
      const queuedItemsByKey = new Map(
        queuedItems.map((item) => [candidatePlanItemKey(item.targetType, item.targetId), item]),
      );

      return {
        requestedCount: candidates.length,
        enqueuedCount: created.count,
        alreadyQueuedCount: candidates.length - created.count,
        items: candidates.map((candidate) => {
          const targetType = toPrismaTargetType(candidate.itemType);
          const item = queuedItemsByKey.get(candidatePlanItemKey(targetType, candidate.targetId));

          if (item === undefined) {
            throw new Error(
              `Queued candidate ${candidate.itemType}:${candidate.targetId} not found.`,
            );
          }

          return {
            learningItemId: item.id,
            targetId: candidate.targetId,
            itemType: candidate.itemType,
            status: toApiStatus(item.status),
          };
        }),
      };
    });
  }

  async listReviewItems(
    filters: NormalizedAdminReviewQueueFilters,
  ): Promise<AdminReviewQueuePageResult> {
    const matches: {
      readonly item: AdminReviewQueueItemDto;
      readonly cursor: AdminReviewQueueCursor;
    }[] = [];
    let scanCursor = filters.cursor;

    while (matches.length <= filters.limit) {
      const items = (await this.prisma.db.learningItem.findMany({
        where: {
          status: filters.status === undefined ? "NEEDS_REVIEW" : toPrismaStatus(filters.status),
          ...(filters.band === undefined ? {} : { curriculumBand: toPrismaBand(filters.band) }),
          ...(scanCursor === null
            ? {}
            : {
                OR: [
                  { updatedAt: { lt: scanCursor.updatedAt } },
                  { updatedAt: scanCursor.updatedAt, id: { gt: scanCursor.id } },
                ],
              }),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: ADMIN_REVIEW_QUEUE_SCAN_LIMIT,
        include: this.itemInclude(),
      })) as unknown as readonly LearningItemRow[];

      if (items.length === 0) {
        break;
      }

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

        matches.push({
          item: {
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
          },
          cursor: { updatedAt: item.updatedAt, id: item.id },
        });

        if (matches.length > filters.limit) {
          break;
        }
      }

      if (matches.length > filters.limit || items.length < ADMIN_REVIEW_QUEUE_SCAN_LIMIT) {
        break;
      }

      const lastItem = items.at(-1);

      if (lastItem === undefined) {
        break;
      }

      scanCursor = { updatedAt: lastItem.updatedAt, id: lastItem.id };
    }

    const pageMatches = matches.slice(0, filters.limit);

    return {
      items: pageMatches.map(({ item }) => item),
      nextCursor: matches.length > filters.limit ? (pageMatches.at(-1)?.cursor ?? null) : null,
    };
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

  async listPrerequisiteCandidates(
    itemId: string,
  ): Promise<AdminPrerequisiteCandidateListResponse | null> {
    const item = await this.prisma.db.learningItem.findUnique({
      where: { id: itemId },
      select: {
        id: true,
        targetType: true,
        targetId: true,
        dependencies: {
          where: { dependencyType: "PREREQUISITE" },
          select: {
            requiredStage: true,
            prerequisiteItem: {
              select: { id: true, title: true, kind: true, status: true },
            },
          },
        },
      },
    });

    if (item === null) {
      return null;
    }

    let targetType: "COMPONENT" | "KANJI" | null = null;
    let targetIds: readonly string[] = [];
    let suggestionReason: AdminPrerequisiteCandidateDto["suggestionReason"] = "existing";

    if (item.targetType === "KANJI") {
      const components = await this.prisma.db.kanjiComponent.findMany({
        where: { kanjiId: item.targetId },
        select: { componentId: true },
        orderBy: { componentId: "asc" },
      });
      targetType = "COMPONENT";
      targetIds = components.map((component) => component.componentId);
      suggestionReason = "component";
    } else if (item.targetType === "WORD") {
      const word = await this.prisma.db.word.findUnique({
        where: { id: item.targetId },
        select: { expression: true },
      });
      const characters = word === null ? [] : extractKanjiCharacters(word.expression);
      const kanji =
        characters.length === 0
          ? []
          : await this.prisma.db.kanji.findMany({
              where: { character: { in: [...characters] } },
              select: { id: true },
              orderBy: { character: "asc" },
            });
      targetType = "KANJI";
      targetIds = kanji.map((candidate) => candidate.id);
      suggestionReason = "kanji";
    }

    const inferredItems =
      targetType === null || targetIds.length === 0
        ? []
        : await this.prisma.db.learningItem.findMany({
            where: {
              id: { not: item.id },
              targetType,
              targetId: { in: [...targetIds] },
              status: "PUBLISHED",
            },
            select: { id: true, title: true, kind: true, status: true },
            orderBy: [{ levelHint: "asc" }, { title: "asc" }, { id: "asc" }],
          });
    const candidates = new Map<string, AdminPrerequisiteCandidateDto>();

    for (const inferred of inferredItems) {
      candidates.set(inferred.id, {
        prerequisiteItemId: inferred.id,
        prerequisiteTitle: inferred.title,
        prerequisiteItemType: toItemKind(inferred.kind),
        prerequisiteStatus: toApiStatus(inferred.status),
        selected: false,
        requiredStage: null,
        suggestionReason,
      });
    }

    for (const dependency of item.dependencies) {
      const prerequisite = dependency.prerequisiteItem;
      const inferred = candidates.get(prerequisite.id);

      candidates.set(prerequisite.id, {
        prerequisiteItemId: prerequisite.id,
        prerequisiteTitle: prerequisite.title,
        prerequisiteItemType: toItemKind(prerequisite.kind),
        prerequisiteStatus: toApiStatus(prerequisite.status),
        selected: true,
        requiredStage: dependency.requiredStage,
        suggestionReason: inferred?.suggestionReason ?? "existing",
      });
    }

    return {
      itemId: item.id,
      candidates: [...candidates.values()].sort(
        (left, right) =>
          Number(right.selected) - Number(left.selected) ||
          left.prerequisiteTitle.localeCompare(right.prerequisiteTitle, "ru"),
      ),
    };
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

  async replacePrerequisites(
    itemId: string,
    input: NormalizedAdminUpdatePrerequisitesInput,
  ): Promise<AdminCurationItemDto | null> {
    const item = await this.prisma.db.learningItem.findUnique({
      where: { id: itemId },
      select: { id: true },
    });

    if (item === null) {
      return null;
    }

    const prerequisiteIds = input.prerequisites.map(
      (prerequisite) => prerequisite.prerequisiteItemId,
    );

    await this.prisma.db.$transaction(async (db) => {
      const validPrerequisites =
        prerequisiteIds.length === 0
          ? 0
          : await db.learningItem.count({
              where: {
                id: { in: prerequisiteIds, not: item.id },
                status: "PUBLISHED",
              },
            });

      if (validPrerequisites !== prerequisiteIds.length) {
        throw new PrerequisiteSelectionChangedError();
      }

      await db.dependency.deleteMany({
        where: { learningItemId: item.id, dependencyType: "PREREQUISITE" },
      });

      if (input.prerequisites.length > 0) {
        await db.dependency.createMany({
          data: input.prerequisites.map((prerequisite) => ({
            learningItemId: item.id,
            prerequisiteItemId: prerequisite.prerequisiteItemId,
            dependencyType: "PREREQUISITE",
            requiredStage: prerequisite.requiredStage,
          })),
        });
      }

      await db.learningItem.update({
        where: { id: item.id },
        data: { updatedAt: new Date() },
      });
    });

    return this.findCurationItem(item.id);
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
    const source = await this.findImportedCandidateDetails(input.targetType, input.targetId);

    if (source === null) {
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
        data: input.acceptedReadings.map((reading) => ({
          learningCardId: readingCard.id,
          text: reading.text,
          normalizedText: reading.normalizedText,
          answerKind: "READING",
          locale: reading.locale,
          isPrimary: reading.isPrimary,
          sourceKind: "PROJECT_AUTHORED",
        })),
      });

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

function candidatePlanItemKey(targetType: string, targetId: string): string {
  return `${targetType}:${targetId}`;
}

function importedCandidateKey(itemType: "kanji" | "word", targetId: string): string {
  return `${itemType}:${targetId}`;
}

function toImportedCandidateRejectionDto(
  row: ImportedCandidateRejectionRow,
): AdminImportedCandidateRejectionDto {
  return {
    id: row.id,
    targetType: toApiImportedCandidateTargetType(row.targetType),
    targetId: row.targetId,
    reason: toApiImportedCandidateRejectionReason(row.reason),
    note: row.note,
    rejectedByUserId: row.rejectedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toApiImportedCandidateTargetType(value: string): "kanji" | "word" {
  if (value === "KANJI") {
    return "kanji";
  }

  if (value === "WORD") {
    return "word";
  }

  throw new Error(`Unsupported imported candidate target type: ${value}`);
}

function toPrismaImportedCandidateTargetType(value: "kanji" | "word"): "KANJI" | "WORD" {
  return value === "kanji" ? "KANJI" : "WORD";
}

function toApiImportedCandidateRejectionReason(
  value: string,
): AdminImportedCandidateRejectionDto["reason"] {
  switch (value) {
    case "DUPLICATE":
      return "duplicate";
    case "OUT_OF_SCOPE":
      return "out-of-scope";
    case "DATA_QUALITY":
      return "data-quality";
    case "LOW_EDUCATIONAL_VALUE":
      return "low-educational-value";
    case "OTHER":
      return "other";
    default:
      throw new Error(`Unsupported imported candidate rejection reason: ${value}`);
  }
}

function toPrismaImportedCandidateRejectionReason(
  value: AdminImportedCandidateRejectionDto["reason"],
): "DUPLICATE" | "OUT_OF_SCOPE" | "DATA_QUALITY" | "LOW_EDUCATIONAL_VALUE" | "OTHER" {
  switch (value) {
    case "duplicate":
      return "DUPLICATE";
    case "out-of-scope":
      return "OUT_OF_SCOPE";
    case "data-quality":
      return "DATA_QUALITY";
    case "low-educational-value":
      return "LOW_EDUCATIONAL_VALUE";
    case "other":
      return "OTHER";
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

function toPrismaItemKind(kind: ItemKind): "COMPONENT" | "KANJI" | "WORD" | "SENTENCE" {
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

function toPrismaTargetType(kind: ItemKind): "COMPONENT" | "KANJI" | "WORD" | "SENTENCE" {
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

function candidatePlanVersionPart(
  label: string,
  aggregate: {
    readonly _count: { readonly _all: number };
    readonly _max: { readonly updatedAt: Date | null };
  },
): string {
  return `${label}:${aggregate._count._all}:${aggregate._max.updatedAt?.toISOString() ?? "none"}`;
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

function toImportedKanjiDetails(row: ImportedKanjiDetailsRow): AdminImportedCandidateDetailsDto {
  const readings = row.readings
    .map((reading) => ({
      text: reading.reading.trim(),
      type: toImportedReadingType(reading.readingType),
    }))
    .filter((reading) => reading.text !== "");

  return {
    targetId: row.id,
    itemType: "kanji",
    japanese: row.character,
    reading: readings[0]?.text ?? null,
    readings,
    meanings: pickImportedDetailsMeanings(row.meanings),
    jlptLevel: formatImportedKanjiJlptLevel(row.jlptLevel),
    sourcePriority: row.frequencyRank,
    schoolGrade: row.grade,
    strokeCount: row.strokeCount,
    hasStrokeData: row.strokeGraphic !== null,
    source: toImportedCandidateDetailsSource(row.importedRecord, "KANJIDIC2"),
  };
}

function toImportedWordDetails(row: ImportedWordDetailsRow): AdminImportedCandidateDetailsDto {
  const reading = row.reading.trim();

  return {
    targetId: row.id,
    itemType: "word",
    japanese: row.expression,
    reading: reading === "" ? null : reading,
    readings: reading === "" ? [] : [{ text: reading, type: "word" }],
    meanings: pickImportedDetailsMeanings(row.senses),
    jlptLevel: formatCurrentJlptLevel(row.jlptLevel),
    sourcePriority: normalizeStoredWordRank(row.commonnessRank),
    schoolGrade: null,
    strokeCount: null,
    hasStrokeData: null,
    source: toImportedCandidateDetailsSource(row.importedRecord, "JMdict"),
  };
}

function toImportedReadingType(
  value: string,
): AdminImportedCandidateDetailsDto["readings"][number]["type"] {
  switch (value) {
    case "ONYOMI":
      return "on";
    case "KUNYOMI":
      return "kun";
    case "NANORI":
      return "nanori";
    default:
      return "other";
  }
}

function pickImportedDetailsMeanings(
  rows: readonly { readonly locale: string; readonly meaning: string }[],
): AdminImportedCandidateDetailsDto["meanings"] {
  return {
    ru: uniqueMeaningsForLocale(rows, "ru-RU"),
    en: uniqueMeaningsForLocale(rows, "en-US"),
  };
}

function uniqueMeaningsForLocale(
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
  ];
}

function toImportedCandidateDetailsSource(
  importedRecord: ImportedCandidateDetailsSourceRow | null,
  expected: AdminImportedCandidateDetailsDto["source"]["name"],
): AdminImportedCandidateDetailsDto["source"] {
  const source = importedRecord?.importRun.dataSource;

  if (importedRecord === null || source?.name !== expected) {
    throw new Error(
      `Imported candidate source mismatch: expected ${expected}, received ${source?.name}.`,
    );
  }

  return {
    name: expected,
    sourceRecordId: importedRecord.sourceRecordId,
    sourceUrl: source.homepageUrl,
    licenseName: source.license.name,
    attributionText: source.attributionText,
    importRunId: importedRecord.importRun.id,
    sourceVersion: importedRecord.importRun.sourceVersion,
    sourceFileName: importedRecord.importRun.sourceFileName,
    checksumSha256: importedRecord.importRun.checksumSha256,
  };
}

function toCandidatePlanKanjiInput(row: CandidatePlanKanjiRow): ImportedCandidateRankingInput {
  return {
    targetId: row.id,
    itemType: "kanji",
    japanese: row.character,
    reading: row.readings[0]?.reading ?? null,
    meanings: candidateCoverageMeanings(row.meanings),
    jlptLevel: formatImportedKanjiJlptLevel(row.jlptLevel),
    sourcePriority: row.frequencyRank,
    schoolGrade: row.grade,
    hasStrokeData: row.strokeGraphic !== null,
    sourceName: "KANJIDIC2",
  };
}

function toCandidatePlanWordInput(row: CandidatePlanWordRow): ImportedCandidateRankingInput {
  return {
    targetId: row.id,
    itemType: "word",
    japanese: row.expression,
    reading: row.reading.trim() === "" ? null : row.reading,
    meanings: candidateCoverageMeanings(row.senses),
    jlptLevel: formatCurrentJlptLevel(row.jlptLevel),
    sourcePriority: normalizeStoredWordRank(row.commonnessRank),
    schoolGrade: null,
    hasStrokeData: false,
    sourceName: "JMdict",
  };
}

function candidateCoverageMeanings(
  rows: readonly { readonly locale: string }[],
): ImportedCandidateRankingInput["meanings"] {
  return {
    ru: rows.some((row) => row.locale === "ru-RU") ? ["available"] : [],
    en: rows.some((row) => row.locale === "en-US") ? ["available"] : [],
  };
}

function extractKanjiCharacters(value: string): readonly string[] {
  return [...new Set([...value.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]))];
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
