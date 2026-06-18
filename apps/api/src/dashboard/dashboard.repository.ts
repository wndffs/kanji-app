import { Inject, Injectable } from "@nestjs/common";

import { PrismaService } from "../database/prisma.service";
import {
  type DashboardCourseProgressRecord,
  type DashboardLessonItemRecord,
  type DashboardLessonProgressRecord,
  type DashboardReviewResult,
  type DashboardReviewResultCountRecord,
  type DashboardSrsStateRecord,
} from "./dashboard.types";

export abstract class DashboardRepository {
  abstract listLessonAvailabilityItems(
    userId: string,
  ): Promise<readonly DashboardLessonItemRecord[]>;
  abstract listLessonProgress(userId: string): Promise<readonly DashboardLessonProgressRecord[]>;
  abstract countDueReviews(userId: string, now: Date): Promise<number>;
  abstract countBurnedCards(userId: string): Promise<number>;
  abstract countLeechCandidates(
    userId: string,
    thresholds: {
      readonly minimumWrongCount: number;
      readonly maximumCorrectStreak: number;
    },
  ): Promise<number>;
  abstract listForecastStates(
    userId: string,
    horizonEnd: Date,
  ): Promise<readonly DashboardSrsStateRecord[]>;
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

type SrsStageRow = {
  readonly stageIndex: number;
  readonly name: string;
  readonly intervalMinutes: number | null;
  readonly isBurned: boolean;
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
  readonly levelNumber: number;
  readonly items: readonly CourseLevelItemRow[];
};

type CourseLevelItemRow = {
  readonly learningItem: {
    readonly id: string;
    readonly cards: readonly CourseCardRow[];
  };
};

type CourseCardRow = {
  readonly id: string;
  readonly srsStates: readonly {
    readonly id: string;
  }[];
};

@Injectable()
export class PrismaDashboardRepository extends DashboardRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async listLessonAvailabilityItems(userId: string): Promise<readonly DashboardLessonItemRecord[]> {
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

  async countLeechCandidates(
    userId: string,
    thresholds: {
      readonly minimumWrongCount: number;
      readonly maximumCorrectStreak: number;
    },
  ): Promise<number> {
    return this.prisma.db.userSrsState.count({
      where: {
        userId,
        burnedAt: null,
        wrongCount: {
          gte: thresholds.minimumWrongCount,
        },
        correctStreak: {
          lte: thresholds.maximumCorrectStreak,
        },
      },
    });
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

  async findCurrentCourseProgress(userId: string): Promise<DashboardCourseProgressRecord | null> {
    const enrollment = (await this.prisma.db.userEnrollment.findFirst({
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
                      select: {
                        id: true,
                        cards: {
                          select: {
                            id: true,
                            srsStates: {
                              where: { userId },
                              select: { id: true },
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
        levelNumber: level.levelNumber,
        items: level.items.map((item) => ({
          id: item.learningItem.id,
          cardIds: item.learningItem.cards.map((card) => card.id),
          startedCardIds: item.learningItem.cards
            .filter((card) => card.srsStates.length > 0)
            .map((card) => card.id),
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
