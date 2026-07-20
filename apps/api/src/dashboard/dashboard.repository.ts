import { Inject, Injectable } from "@nestjs/common";

import { parseCourseLevelPassPolicy, Prisma } from "@kanji-srs/db";

import { PrismaService } from "../database/prisma.service";
import { resolveCurrentCourseId } from "../courses/current-course";
import {
  type DashboardCourseItemProgressRecord,
  type DashboardCourseProgressRecord,
  type DashboardLeechSignalRecord,
  type DashboardKanaProgressRecord,
  type DashboardLessonItemRecord,
  type DashboardLessonProgressRecord,
  type DashboardRecentItemRecord,
  type DashboardReviewResult,
  type DashboardReviewResultCountRecord,
  type DashboardSrsStateRecord,
  type DashboardSrsStageSpreadRecord,
  type DashboardStudyActivityDayRecord,
  type DashboardUnlockEventRecord,
} from "./dashboard.types";

export abstract class DashboardRepository {
  abstract listLessonAvailabilityItems(
    userId: string,
  ): Promise<readonly DashboardLessonItemRecord[]>;
  abstract listLessonProgress(userId: string): Promise<readonly DashboardLessonProgressRecord[]>;
  abstract listKanaProgress(userId: string): Promise<readonly DashboardKanaProgressRecord[]>;
  abstract hasCompletedReviewSession(userId: string): Promise<boolean>;
  abstract countDueReviews(userId: string, now: Date): Promise<number>;
  abstract countBurnedCards(userId: string): Promise<number>;
  abstract listLeechSignals(
    userId: string,
    since: Date,
  ): Promise<readonly DashboardLeechSignalRecord[]>;
  abstract listRecentMistakeItems(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<readonly DashboardRecentItemRecord[]>;
  abstract listAvailableLessonItems(
    itemIds: readonly string[],
    limit: number,
  ): Promise<readonly DashboardRecentItemRecord[]>;
  abstract listLatestUnlockEvents(userId: string): Promise<readonly DashboardUnlockEventRecord[]>;
  abstract listRecentBurnedItems(
    userId: string,
    limit: number,
  ): Promise<readonly DashboardRecentItemRecord[]>;
  abstract listStudyActivity(
    userId: string,
    since: Date,
    timezone: string,
  ): Promise<readonly DashboardStudyActivityDayRecord[]>;
  abstract listForecastStates(
    userId: string,
    horizonEnd: Date,
  ): Promise<readonly DashboardSrsStateRecord[]>;
  abstract listSrsStageSpread(userId: string): Promise<readonly DashboardSrsStageSpreadRecord[]>;
  abstract findCurrentCourseProgress(userId: string): Promise<DashboardCourseProgressRecord | null>;
  abstract countRecentReviewResults(
    userId: string,
    since: Date,
    now: Date,
  ): Promise<readonly DashboardReviewResultCountRecord[]>;
}

type ForecastStateRow = {
  readonly id: string;
  readonly learningCardId: string;
  readonly srsSystemId: string;
  readonly stageIndex: number;
  readonly availableAt: Date | null;
  readonly burnedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly srsSystem: {
    readonly stages: readonly SrsStageRow[];
  };
};

type LeechStateRow = ForecastStateRow & {
  readonly reviewAnswers: readonly LeechReviewAnswerRow[];
  readonly learningCard: {
    readonly learningItem: LeechLearningItemRow;
  };
};

type ActivityStateRow = ForecastStateRow & {
  readonly learningCard: {
    readonly learningItem: LeechLearningItemRow;
  };
};

type ActivityReviewAnswerRow = {
  readonly answeredAt: Date;
  readonly userSrsState: ActivityStateRow;
};

type LeechLearningItemRow = {
  readonly id: string;
  readonly kind: string;
  readonly targetType: string;
  readonly targetId: string;
  readonly levelHint: number | null;
};

type LeechReviewAnswerRow = {
  readonly result: string;
  readonly previousStageIndex: number | null;
  readonly nextStageIndex: number | null;
};

type SrsStageRow = {
  readonly stageIndex: number;
  readonly name: string;
  readonly intervalMinutes: number | null;
  readonly isBurned: boolean;
};

type SrsSpreadSystemRow = {
  readonly id: string;
  readonly title: string;
  readonly stages: readonly SrsStageRow[];
};

type SrsSpreadCountRow = {
  readonly srsSystemId: string;
  readonly stageIndex: number;
  readonly _count: {
    readonly _all: number;
  };
};

type LessonEnrollmentRow = {
  readonly course: {
    readonly id: string;
    readonly levels: readonly LessonCourseLevelRow[];
  };
};

type LessonCourseLevelRow = {
  readonly levelNumber: number;
  readonly items: readonly LessonCourseLevelItemRow[];
};

type LessonCourseLevelItemRow = {
  readonly sortOrder: number;
  readonly learningItem: {
    readonly id: string;
    readonly cards: readonly {
      readonly id: string;
    }[];
    readonly dependencies: readonly {
      readonly prerequisiteItemId: string;
      readonly requiredStage: number | null;
    }[];
  };
};

type LessonProgressRow = {
  readonly stageIndex: number;
  readonly createdAt: Date;
  readonly learningCardId: string;
  readonly learningCard: {
    readonly learningItemId: string;
  };
};

type EnrollmentRow = {
  readonly course: {
    readonly id: string;
    readonly titleRu: string;
    readonly levels: readonly CourseLevelRow[];
  };
};

type CourseLevelRow = {
  readonly id: string;
  readonly levelNumber: number;
  readonly passPolicyJson: unknown;
  readonly completions: readonly {
    readonly completedAt: Date;
  }[];
  readonly items: readonly CourseLevelItemRow[];
};

type CourseLevelItemRow = {
  readonly learningItem: {
    readonly id: string;
    readonly kind: string;
    readonly cards: readonly CourseCardRow[];
  };
};

type CourseCardRow = {
  readonly id: string;
  readonly srsStates: readonly {
    readonly id: string;
    readonly stageIndex: number;
    readonly burnedAt: Date | null;
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

const dashboardActivityStateSelect = {
  id: true,
  learningCardId: true,
  srsSystemId: true,
  stageIndex: true,
  availableAt: true,
  burnedAt: true,
  wrongCount: true,
  correctStreak: true,
  learningCard: {
    select: {
      learningItem: {
        select: {
          id: true,
          kind: true,
          targetType: true,
          targetId: true,
          levelHint: true,
        },
      },
    },
  },
  srsSystem: {
    select: {
      stages: {
        select: {
          stageIndex: true,
          name: true,
          intervalMinutes: true,
          isBurned: true,
        },
        orderBy: { stageIndex: "asc" as const },
      },
    },
  },
} as const;

@Injectable()
export class PrismaDashboardRepository extends DashboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listLessonAvailabilityItems(userId: string): Promise<readonly DashboardLessonItemRecord[]> {
    const currentCourseId = await resolveCurrentCourseId(this.prisma.db, userId);

    if (currentCourseId === null) {
      return [];
    }

    const enrollments = (await this.prisma.db.userEnrollment.findMany({
      where: {
        userId,
        courseId: currentCourseId,
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
                  where: { learningItem: { status: "PUBLISHED" } },
                  orderBy: { sortOrder: "asc" },
                  include: {
                    learningItem: {
                      select: {
                        id: true,
                        cards: {
                          select: { id: true },
                          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                        },
                        dependencies: {
                          where: { dependencyType: "PREREQUISITE" },
                          select: {
                            prerequisiteItemId: true,
                            requiredStage: true,
                          },
                          orderBy: { prerequisiteItemId: "asc" },
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
    })) as readonly LessonEnrollmentRow[];

    const records: DashboardLessonItemRecord[] = [];

    for (const enrollment of enrollments) {
      for (const level of enrollment.course.levels) {
        for (const item of level.items) {
          records.push({
            courseId: enrollment.course.id,
            courseLevelNumber: level.levelNumber,
            sortOrder: item.sortOrder,
            id: item.learningItem.id,
            cardIds: item.learningItem.cards.map((card) => card.id),
            dependencies: item.learningItem.dependencies.map((dependency) => ({
              prerequisiteItemId: dependency.prerequisiteItemId,
              requiredStage: dependency.requiredStage ?? 1,
            })),
          });
        }
      }
    }

    return records;
  }

  async listLessonProgress(userId: string): Promise<readonly DashboardLessonProgressRecord[]> {
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
    })) as readonly LessonProgressRow[];

    return states.map((state) => ({
      learningItemId: state.learningCard.learningItemId,
      learningCardId: state.learningCardId,
      stageIndex: state.stageIndex,
      createdAt: state.createdAt,
    }));
  }

  async listKanaProgress(userId: string): Promise<readonly DashboardKanaProgressRecord[]> {
    const rows = await this.prisma.db.userKanaProgress.findMany({
      where: { userId },
      select: {
        character: true,
        script: true,
        masteredAt: true,
      },
    });

    return rows.map((row) => ({
      character: row.character,
      script: row.script === "HIRAGANA" ? "hiragana" : "katakana",
      masteredAt: row.masteredAt,
    }));
  }

  async hasCompletedReviewSession(userId: string): Promise<boolean> {
    const session = await this.prisma.db.reviewSession.findFirst({
      where: {
        userId,
        mode: "REVIEW",
        finishedAt: { not: null },
      },
      select: { id: true },
    });

    return session !== null;
  }

  async countDueReviews(userId: string, now: Date): Promise<number> {
    return this.prisma.db.userSrsState.count({
      where: {
        userId,
        burnedAt: null,
        availableAt: {
          lte: now,
        },
      },
    });
  }

  async countBurnedCards(userId: string): Promise<number> {
    return this.prisma.db.userSrsState.count({
      where: {
        userId,
        burnedAt: {
          not: null,
        },
      },
    });
  }

  async listLeechSignals(
    userId: string,
    since: Date,
  ): Promise<readonly DashboardLeechSignalRecord[]> {
    const states = (await this.prisma.db.userSrsState.findMany({
      where: {
        userId,
        burnedAt: null,
        OR: [
          {
            wrongCount: {
              gt: 0,
            },
          },
          {
            reviewAnswers: {
              some: {
                answeredAt: {
                  gte: since,
                },
              },
            },
          },
        ],
      },
      include: {
        reviewAnswers: {
          where: {
            answeredAt: {
              gte: since,
            },
          },
          select: {
            result: true,
            previousStageIndex: true,
            nextStageIndex: true,
          },
        },
        learningCard: {
          select: {
            learningItem: {
              select: {
                id: true,
                kind: true,
                targetType: true,
                targetId: true,
                levelHint: true,
              },
            },
          },
        },
        srsSystem: {
          select: {
            stages: {
              select: {
                stageIndex: true,
                name: true,
                intervalMinutes: true,
                isBurned: true,
              },
              orderBy: { stageIndex: "asc" },
            },
          },
        },
      },
      orderBy: [{ wrongCount: "desc" }, { updatedAt: "desc" }, { id: "asc" }],
    })) as readonly LeechStateRow[];

    const records: DashboardLeechSignalRecord[] = [];

    for (const state of states) {
      const item = await this.toLeechItemRecord(state.learningCard.learningItem);

      records.push({
        id: state.id,
        learningCardId: state.learningCardId,
        srsSystemId: state.srsSystemId,
        stageIndex: state.stageIndex,
        availableAt: state.availableAt,
        burnedAt: state.burnedAt,
        wrongCount: state.wrongCount,
        correctStreak: state.correctStreak,
        stages: state.srsSystem.stages,
        recentWrongCount: countWrongLikeAnswers(state.reviewAnswers),
        stageDropCount: countStageDrops(state.reviewAnswers),
        stageDropMagnitude: sumStageDropMagnitude(state.reviewAnswers),
        item,
      });
    }

    return records;
  }

  async listRecentMistakeItems(
    userId: string,
    since: Date,
    limit: number,
  ): Promise<readonly DashboardRecentItemRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const attempts = (await this.prisma.db.reviewAnswer.findMany({
      where: {
        userSrsState: { userId },
        answeredAt: { gte: since },
        result: { in: ["WRONG", "REVEAL"] },
      },
      select: {
        answeredAt: true,
        userSrsState: { select: dashboardActivityStateSelect },
      },
      distinct: ["learningCardId"],
      orderBy: [{ answeredAt: "desc" }, { id: "asc" }],
      take: limit * 4,
    })) as readonly ActivityReviewAnswerRow[];
    const selected = takeDistinctActivityRows(
      attempts,
      (attempt) => attempt.userSrsState.learningCard.learningItem.id,
      limit,
    );

    return Promise.all(
      selected.map((attempt) => this.toRecentItemRecord(attempt.userSrsState, attempt.answeredAt)),
    );
  }

  async listAvailableLessonItems(
    itemIds: readonly string[],
    limit: number,
  ): Promise<readonly DashboardRecentItemRecord[]> {
    const orderedIds = [...new Set(itemIds)].slice(0, Math.max(0, limit));

    if (orderedIds.length === 0) {
      return [];
    }

    const items = (await this.prisma.db.learningItem.findMany({
      where: {
        id: { in: orderedIds },
        status: "PUBLISHED",
      },
      select: {
        id: true,
        kind: true,
        targetType: true,
        targetId: true,
        levelHint: true,
      },
    })) as readonly LeechLearningItemRow[];
    const itemById = new Map(items.map((item) => [item.id, item]));

    return Promise.all(
      orderedIds.flatMap((itemId) => {
        const item = itemById.get(itemId);

        return item === undefined
          ? []
          : [
              this.toLeechItemRecord(item).then((hydrated) => ({
                occurredAt: null,
                item: hydrated,
                srs: null,
              })),
            ];
      }),
    );
  }

  async listLatestUnlockEvents(userId: string): Promise<readonly DashboardUnlockEventRecord[]> {
    const currentCourseId = await resolveCurrentCourseId(this.prisma.db, userId);

    if (currentCourseId === null) {
      return [];
    }

    const latest = await this.prisma.db.userUnlockEvent.findFirst({
      where: {
        userId,
        learningItem: {
          courseLevelItems: {
            some: {
              courseLevel: { courseId: currentCourseId },
            },
          },
        },
      },
      select: { reviewSessionId: true },
      orderBy: [
        { reviewSession: { startedAt: "desc" } },
        { unlockedAt: "desc" },
        { id: "asc" },
      ],
    });

    if (latest === null) {
      return [];
    }

    return this.prisma.db.userUnlockEvent.findMany({
      where: {
        userId,
        reviewSessionId: latest.reviewSessionId,
        learningItem: {
          courseLevelItems: {
            some: {
              courseLevel: { courseId: currentCourseId },
            },
          },
        },
      },
      select: {
        reviewSessionId: true,
        learningItemId: true,
        unlockedAt: true,
      },
      orderBy: [{ unlockedAt: "asc" }, { learningItemId: "asc" }],
    });
  }

  async listRecentBurnedItems(
    userId: string,
    limit: number,
  ): Promise<readonly DashboardRecentItemRecord[]> {
    if (limit <= 0) {
      return [];
    }

    const states = (await this.prisma.db.userSrsState.findMany({
      where: {
        userId,
        burnedAt: { not: null },
      },
      select: dashboardActivityStateSelect,
      orderBy: [{ burnedAt: "desc" }, { id: "asc" }],
      take: limit * 4,
    })) as readonly ActivityStateRow[];
    const selected = takeDistinctActivityRows(
      states,
      (state) => state.learningCard.learningItem.id,
      limit,
    );

    return Promise.all(selected.map((state) => this.toRecentItemRecord(state, state.burnedAt)));
  }

  async listStudyActivity(
    userId: string,
    since: Date,
    timezone: string,
  ): Promise<readonly DashboardStudyActivityDayRecord[]> {
    const rows = await this.prisma.db.$queryRaw<
      readonly {
        readonly localDate: string;
        readonly reviewCount: number;
        readonly lessonCount: number;
      }[]
    >(Prisma.sql`
      WITH review_activity AS (
        SELECT
          to_char(ra."answeredAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "localDate",
          COUNT(DISTINCT (ra."reviewSessionId", ra."learningCardId"))::int AS "reviewCount"
        FROM "ReviewAnswer" ra
        INNER JOIN "ReviewSession" rs ON rs."id" = ra."reviewSessionId"
        WHERE
          rs."userId" = ${userId}::uuid
          AND rs."mode" = 'REVIEW'
          AND ra."answeredAt" >= ${since}
        GROUP BY 1
      ),
      lesson_starts AS (
        SELECT
          lc."learningItemId",
          MIN(state."createdAt") AS "startedAt"
        FROM "UserSrsState" state
        INNER JOIN "LearningCard" lc ON lc."id" = state."learningCardId"
        WHERE state."userId" = ${userId}::uuid
        GROUP BY lc."learningItemId"
      ),
      lesson_activity AS (
        SELECT
          to_char("startedAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "localDate",
          COUNT(*)::int AS "lessonCount"
        FROM lesson_starts
        WHERE "startedAt" >= ${since}
        GROUP BY 1
      )
      SELECT
        COALESCE(reviews."localDate", lessons."localDate") AS "localDate",
        COALESCE(reviews."reviewCount", 0)::int AS "reviewCount",
        COALESCE(lessons."lessonCount", 0)::int AS "lessonCount"
      FROM review_activity reviews
      FULL OUTER JOIN lesson_activity lessons
        ON lessons."localDate" = reviews."localDate"
      ORDER BY "localDate" ASC
    `);

    return rows.map((row) => ({
      localDate: row.localDate,
      reviewCount: Number(row.reviewCount),
      lessonCount: Number(row.lessonCount),
    }));
  }

  async listForecastStates(
    userId: string,
    horizonEnd: Date,
  ): Promise<readonly DashboardSrsStateRecord[]> {
    const states = (await this.prisma.db.userSrsState.findMany({
      where: {
        userId,
        burnedAt: null,
        availableAt: {
          not: null,
          lte: horizonEnd,
        },
      },
      select: {
        id: true,
        learningCardId: true,
        srsSystemId: true,
        stageIndex: true,
        availableAt: true,
        burnedAt: true,
        wrongCount: true,
        correctStreak: true,
        srsSystem: {
          select: {
            stages: {
              select: {
                stageIndex: true,
                name: true,
                intervalMinutes: true,
                isBurned: true,
              },
              orderBy: { stageIndex: "asc" },
            },
          },
        },
      },
      orderBy: [{ availableAt: "asc" }, { id: "asc" }],
    })) as readonly ForecastStateRow[];

    return states.map((state) => ({
      id: state.id,
      learningCardId: state.learningCardId,
      srsSystemId: state.srsSystemId,
      stageIndex: state.stageIndex,
      availableAt: state.availableAt,
      burnedAt: state.burnedAt,
      wrongCount: state.wrongCount,
      correctStreak: state.correctStreak,
      stages: state.srsSystem.stages,
    }));
  }

  async listSrsStageSpread(userId: string): Promise<readonly DashboardSrsStageSpreadRecord[]> {
    const [systems, componentCounts, kanjiCounts, wordCounts, sentenceCounts] = await Promise.all([
      this.prisma.db.srsSystem.findMany({
        where: {
          states: {
            some: { userId },
          },
        },
        select: {
          id: true,
          title: true,
          stages: {
            select: {
              stageIndex: true,
              name: true,
              intervalMinutes: true,
              isBurned: true,
            },
            orderBy: { stageIndex: "asc" },
          },
        },
        orderBy: [{ title: "asc" }, { id: "asc" }],
      }),
      this.countSrsStatesByItemKind(userId, "COMPONENT"),
      this.countSrsStatesByItemKind(userId, "KANJI"),
      this.countSrsStatesByItemKind(userId, "WORD"),
      this.countSrsStatesByItemKind(userId, "SENTENCE"),
    ]);
    const counts = new Map<string, number>();

    addSrsSpreadCounts(counts, componentCounts, "component");
    addSrsSpreadCounts(counts, kanjiCounts, "kanji");
    addSrsSpreadCounts(counts, wordCounts, "word");
    addSrsSpreadCounts(counts, sentenceCounts, "sentence");

    return (systems as readonly SrsSpreadSystemRow[]).map((system) => ({
      srsSystemId: system.id,
      srsSystemTitle: system.title,
      stages: system.stages.map((stage) => ({
        stageIndex: stage.stageIndex,
        name: stage.name,
        isBurned: stage.isBurned,
        cardsByItemType: {
          component: getSrsSpreadCount(counts, system.id, stage.stageIndex, "component"),
          kanji: getSrsSpreadCount(counts, system.id, stage.stageIndex, "kanji"),
          word: getSrsSpreadCount(counts, system.id, stage.stageIndex, "word"),
          sentence: getSrsSpreadCount(counts, system.id, stage.stageIndex, "sentence"),
        },
      })),
    }));
  }

  async findCurrentCourseProgress(userId: string): Promise<DashboardCourseProgressRecord | null> {
    const currentCourseId = await resolveCurrentCourseId(this.prisma.db, userId);

    if (currentCourseId === null) {
      return null;
    }

    const enrollment = (await this.prisma.db.userEnrollment.findFirst({
      where: {
        userId,
        courseId: currentCourseId,
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
                completions: {
                  where: { userId },
                  select: { completedAt: true },
                  take: 1,
                },
                items: {
                  where: { learningItem: { status: "PUBLISHED" } },
                  orderBy: { sortOrder: "asc" },
                  include: {
                    learningItem: {
                      select: {
                        id: true,
                        kind: true,
                        cards: {
                          select: {
                            id: true,
                            srsStates: {
                              where: { userId },
                              select: { id: true, stageIndex: true, burnedAt: true },
                            },
                          },
                          orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
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
    })) as EnrollmentRow | null;

    if (enrollment === null) {
      return null;
    }

    return {
      id: enrollment.course.id,
      title: enrollment.course.titleRu,
      levels: enrollment.course.levels.map((level) => ({
        id: level.id,
        levelNumber: level.levelNumber,
        passPolicy: parseCourseLevelPassPolicy(level.passPolicyJson),
        completedAt: level.completions[0]?.completedAt ?? null,
        items: level.items.map((item) => ({
          id: item.learningItem.id,
          itemType: toDashboardItemKind(item.learningItem.kind),
          cardIds: item.learningItem.cards.map((card) => card.id),
          startedCardIds: item.learningItem.cards
            .filter((card) => card.srsStates.length > 0)
            .map((card) => card.id),
          burnedCardIds: item.learningItem.cards
            .filter((card) => card.srsStates.some((state) => state.burnedAt !== null))
            .map((card) => card.id),
          cardStages: item.learningItem.cards.map((card) => ({
            cardId: card.id,
            stageIndex: card.srsStates[0]?.stageIndex ?? null,
          })),
        })),
      })),
    };
  }

  async countRecentReviewResults(
    userId: string,
    since: Date,
    now: Date,
  ): Promise<readonly DashboardReviewResultCountRecord[]> {
    const rows = await this.prisma.db.reviewAnswer.groupBy({
      by: ["result"],
      where: {
        answeredAt: {
          gte: since,
          lte: now,
        },
        reviewSession: {
          userId,
          mode: "REVIEW",
        },
      },
      _count: {
        _all: true,
      },
    });

    return rows.map((row) => ({
      result: toDashboardReviewResult(row.result),
      count: row._count._all,
    }));
  }

  private async countSrsStatesByItemKind(
    userId: string,
    kind: "COMPONENT" | "KANJI" | "WORD" | "SENTENCE",
  ): Promise<readonly SrsSpreadCountRow[]> {
    const rows = await this.prisma.db.userSrsState.groupBy({
      by: ["srsSystemId", "stageIndex"],
      where: {
        userId,
        learningCard: {
          learningItem: { kind },
        },
      },
      _count: { _all: true },
      orderBy: [{ srsSystemId: "asc" }, { stageIndex: "asc" }],
    });

    return rows;
  }

  private async toRecentItemRecord(
    state: ActivityStateRow,
    occurredAt: Date | null,
  ): Promise<DashboardRecentItemRecord> {
    return {
      occurredAt,
      item: await this.toLeechItemRecord(state.learningCard.learningItem),
      srs: {
        stageIndex: state.stageIndex,
        availableAt: state.availableAt,
        burnedAt: state.burnedAt,
        wrongCount: state.wrongCount,
        correctStreak: state.correctStreak,
        stages: state.srsSystem.stages,
      },
    };
  }

  private async toLeechItemRecord(
    item: LeechLearningItemRow,
  ): Promise<DashboardLeechSignalRecord["item"]> {
    switch (item.targetType) {
      case "COMPONENT":
        return this.toLeechComponentItem(item);
      case "KANJI":
        return this.toLeechKanjiItem(item);
      case "WORD":
        return this.toLeechWordItem(item);
      case "SENTENCE":
        return this.toLeechSentenceItem(item);
      default:
        throw new Error(`Unsupported learning item target type: ${item.targetType}`);
    }
  }

  private async toLeechComponentItem(
    item: LeechLearningItemRow,
  ): Promise<DashboardLeechSignalRecord["item"]> {
    const component = (await this.prisma.db.component.findUnique({
      where: { id: item.targetId },
    })) as ComponentTargetRow | null;

    if (component === null) {
      throw new Error(`Missing component target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: "component",
      japanese: component.symbol,
      reading: null,
      translations: {
        ru: [
          dashboardLocalizedText("ru-RU", component.meaningRu, {
            isPrimary: true,
            sourceKind: toSourceKind(component.sourceKind),
          }),
        ],
        en: [
          dashboardLocalizedText("en-US", component.meaningEn, {
            isPrimary: true,
            sourceKind: toSourceKind(component.sourceKind),
          }),
        ],
      },
      level: item.levelHint,
      jlptLevel: null,
    };
  }

  private async toLeechKanjiItem(
    item: LeechLearningItemRow,
  ): Promise<DashboardLeechSignalRecord["item"]> {
    const kanji = (await this.prisma.db.kanji.findUnique({
      where: { id: item.targetId },
      include: {
        readings: { orderBy: [{ priority: "desc" }, { reading: "asc" }] },
        meanings: { orderBy: [{ isPrimary: "desc" }, { locale: "asc" }, { meaning: "asc" }] },
      },
    })) as KanjiTargetRow | null;

    if (kanji === null) {
      throw new Error(`Missing kanji target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: "kanji",
      japanese: kanji.character,
      reading: kanji.readings[0]?.reading ?? null,
      translations: groupLocalizedTexts(
        kanji.meanings.map((meaning) =>
          dashboardLocalizedText(toContentLocale(meaning.locale), meaning.meaning, {
            isPrimary: meaning.isPrimary,
            sourceKind: toSourceKind(meaning.sourceKind),
          }),
        ),
      ),
      level: item.levelHint,
      jlptLevel: formatJlptLevel(kanji.jlptLevel),
    };
  }

  private async toLeechWordItem(
    item: LeechLearningItemRow,
  ): Promise<DashboardLeechSignalRecord["item"]> {
    const word = (await this.prisma.db.word.findUnique({
      where: { id: item.targetId },
      include: {
        senses: { orderBy: [{ locale: "asc" }, { meaning: "asc" }] },
      },
    })) as WordTargetRow | null;

    if (word === null) {
      throw new Error(`Missing word target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: "word",
      japanese: word.expression,
      reading: word.reading,
      translations: groupLocalizedTexts(
        word.senses.map((sense, index) =>
          dashboardLocalizedText(toContentLocale(sense.locale), sense.meaning, {
            isPrimary: index === 0,
            sourceKind: toSourceKind(sense.sourceKind),
          }),
        ),
      ),
      level: item.levelHint,
      jlptLevel: formatJlptLevel(word.jlptLevel),
    };
  }

  private async toLeechSentenceItem(
    item: LeechLearningItemRow,
  ): Promise<DashboardLeechSignalRecord["item"]> {
    const sentence = (await this.prisma.db.sentence.findUnique({
      where: { id: item.targetId },
    })) as SentenceTargetRow | null;

    if (sentence === null) {
      throw new Error(`Missing sentence target ${item.targetId}.`);
    }

    return {
      id: item.id,
      itemType: "sentence",
      japanese: sentence.japaneseText,
      reading: sentence.readingText,
      translations: {
        ru:
          sentence.translationRu === null
            ? []
            : [dashboardLocalizedText("ru-RU", sentence.translationRu, { isPrimary: true })],
        en:
          sentence.translationEn === null
            ? []
            : [dashboardLocalizedText("en-US", sentence.translationEn, { isPrimary: true })],
      },
      level: item.levelHint,
      jlptLevel: null,
    };
  }
}

function takeDistinctActivityRows<T>(
  rows: readonly T[],
  getItemId: (row: T) => string,
  limit: number,
): readonly T[] {
  const selected: T[] = [];
  const seenItemIds = new Set<string>();

  for (const row of rows) {
    const itemId = getItemId(row);

    if (seenItemIds.has(itemId)) {
      continue;
    }

    seenItemIds.add(itemId);
    selected.push(row);

    if (selected.length >= limit) {
      break;
    }
  }

  return selected;
}

function addSrsSpreadCounts(
  target: Map<string, number>,
  rows: readonly SrsSpreadCountRow[],
  itemKind: "component" | "kanji" | "word" | "sentence",
): void {
  for (const row of rows) {
    target.set(srsSpreadCountKey(row.srsSystemId, row.stageIndex, itemKind), row._count._all);
  }
}

function getSrsSpreadCount(
  counts: ReadonlyMap<string, number>,
  srsSystemId: string,
  stageIndex: number,
  itemKind: "component" | "kanji" | "word" | "sentence",
): number {
  return counts.get(srsSpreadCountKey(srsSystemId, stageIndex, itemKind)) ?? 0;
}

function srsSpreadCountKey(srsSystemId: string, stageIndex: number, itemKind: string): string {
  return `${srsSystemId}:${stageIndex}:${itemKind}`;
}

function toDashboardItemKind(kind: string): DashboardCourseItemProgressRecord["itemType"] {
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

function countWrongLikeAnswers(answers: readonly LeechReviewAnswerRow[]): number {
  return answers.filter((answer) => answer.result === "WRONG" || answer.result === "REVEAL").length;
}

function countStageDrops(answers: readonly LeechReviewAnswerRow[]): number {
  return answers.filter(isStageDrop).length;
}

function sumStageDropMagnitude(answers: readonly LeechReviewAnswerRow[]): number {
  return answers.reduce((sum, answer) => {
    if (!isStageDrop(answer)) {
      return sum;
    }

    return sum + (answer.previousStageIndex - answer.nextStageIndex);
  }, 0);
}

function isStageDrop(answer: LeechReviewAnswerRow): answer is LeechReviewAnswerRow & {
  readonly previousStageIndex: number;
  readonly nextStageIndex: number;
} {
  return (
    answer.previousStageIndex !== null &&
    answer.nextStageIndex !== null &&
    answer.previousStageIndex > answer.nextStageIndex
  );
}

function dashboardLocalizedText(
  locale: "ru-RU" | "en-US",
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

function groupLocalizedTexts(
  texts: readonly { readonly locale: "ru-RU" | "en-US"; readonly text: string }[],
) {
  return {
    ru: texts.filter((text) => text.locale === "ru-RU"),
    en: texts.filter((text) => text.locale === "en-US"),
  };
}

function toContentLocale(locale: string): "ru-RU" | "en-US" {
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

function formatJlptLevel(value: number | null): string | null {
  return value === null ? null : `N${value}`;
}

function toDashboardReviewResult(result: string): DashboardReviewResult {
  switch (result) {
    case "CORRECT":
      return "correct";
    case "TYPO":
      return "typo";
    case "REVEAL":
      return "reveal";
    case "MANUAL_IGNORE":
      return "manual-ignore";
    case "RESURRECT":
      return "resurrect";
    default:
      return "wrong";
  }
}
