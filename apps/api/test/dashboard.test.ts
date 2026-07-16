import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SRS_STAGES } from "@kanji-srs/srs";

import { type CurrentUserDto } from "../src/auth/auth.types";
import {
  DashboardRepository,
  PrismaDashboardRepository,
} from "../src/dashboard/dashboard.repository";
import { DashboardService } from "../src/dashboard/dashboard.service";
import {
  type DashboardCourseProgressRecord,
  type DashboardLeechSignalRecord,
  type DashboardLessonItemRecord,
  type DashboardLessonProgressRecord,
  type DashboardReviewResult,
  type DashboardReviewResultCountRecord,
  type DashboardSrsStateRecord,
  type DashboardSrsStageSpreadRecord,
} from "../src/dashboard/dashboard.types";

const NOW = new Date("2026-06-18T09:00:00.000Z");
const RECENT_SINCE = "2026-06-11T09:00:00.000Z";

describe("PrismaDashboardRepository", () => {
  it("loads availability and progress only for the resolved published course", async () => {
    const currentCourseEnrollment = {
      courseId: "course-main",
      startedAt: NOW,
      course: { slug: "japanese-ru-n2" },
    };
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([currentCourseEnrollment])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([currentCourseEnrollment]);
    const findFirst = vi.fn().mockResolvedValue(null);
    const repository = new PrismaDashboardRepository({
      db: {
        userSettings: { findUnique: vi.fn().mockResolvedValue({ currentCourseId: null }) },
        userEnrollment: { findMany, findFirst },
      },
    } as never);

    await repository.listLessonAvailabilityItems("user-1");
    await repository.findCurrentCourseProgress("user-1");

    for (const query of [findMany.mock.calls[1]?.[0], findFirst.mock.calls[0]?.[0]]) {
      expect(query).toMatchObject({
        where: { courseId: "course-main" },
        include: {
          course: {
            include: {
              levels: {
                include: {
                  items: { where: { learningItem: { status: "PUBLISHED" } } },
                },
              },
            },
          },
        },
      });
    }

    expect(findFirst.mock.calls[0]?.[0]).toMatchObject({
      include: {
        course: {
          include: {
            levels: {
              include: {
                items: {
                  include: {
                    learningItem: {
                      select: {
                        kind: true,
                        cards: {
                          select: {
                            srsStates: { select: { id: true, burnedAt: true } },
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
      },
    });
  });

  it("aggregates the SRS spread by configured stage and item type", async () => {
    const groupBy = vi
      .fn()
      .mockResolvedValueOnce([{ srsSystemId: "srs-default", stageIndex: 1, _count: { _all: 2 } }])
      .mockResolvedValueOnce([{ srsSystemId: "srs-default", stageIndex: 1, _count: { _all: 3 } }])
      .mockResolvedValueOnce([{ srsSystemId: "srs-default", stageIndex: 9, _count: { _all: 4 } }])
      .mockResolvedValueOnce([]);
    const repository = new PrismaDashboardRepository({
      db: {
        srsSystem: {
          findMany: vi.fn().mockResolvedValue([
            {
              id: "srs-default",
              title: "Default SRS",
              stages: [{ ...DEFAULT_SRS_STAGES[0] }, { ...DEFAULT_SRS_STAGES[8] }],
            },
          ]),
        },
        userSrsState: { groupBy },
      },
    } as never);

    await expect(repository.listSrsStageSpread("user-1")).resolves.toEqual([
      {
        srsSystemId: "srs-default",
        srsSystemTitle: "Default SRS",
        stages: [
          {
            stageIndex: 1,
            name: "Apprentice 1",
            isBurned: false,
            cardsByItemType: { component: 2, kanji: 3, word: 0, sentence: 0 },
          },
          {
            stageIndex: 9,
            name: "Burned",
            isBurned: true,
            cardsByItemType: { component: 0, kanji: 0, word: 4, sentence: 0 },
          },
        ],
      },
    ]);
    expect(groupBy).toHaveBeenCalledTimes(4);
    expect(groupBy.mock.calls[1]?.[0]).toMatchObject({
      where: { userId: "user-1", learningCard: { learningItem: { kind: "KANJI" } } },
    });
  });
});

describe("DashboardService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a dashboard for a new user", async () => {
    const { service } = createHarness();

    await expect(service.getDashboard(createUser("new-user"))).resolves.toEqual({
      user: {
        id: "new-user",
        displayName: "new-user",
        locale: "ru-RU",
        translationDisplayMode: "ru-en",
        timezone: "Europe/Moscow",
      },
      counts: {
        dueReviews: 0,
        availableLessons: 0,
        burnedCards: 0,
        leechCandidates: 0,
      },
      currentCourse: null,
      workload: {
        reviews: {
          dueNow: 0,
          next24Hours: 0,
          laterThisWeek: 0,
          budget: 20,
          pressurePercent: 0,
        },
        lessons: {
          completedToday: 0,
          remainingToday: 10,
          dailyLimit: 10,
          percent: 0,
        },
      },
      reviewForecast: [],
      srsStageSpread: [],
      leechCandidates: [],
      recentReviewStats: {
        since: RECENT_SINCE,
        total: 0,
        correct: 0,
        wrong: 0,
        typo: 0,
        reveal: 0,
        manualIgnore: 0,
        resurrect: 0,
        accuracy: null,
      },
      recentItems: [],
    });
  });

  it("returns due reviews, forecast buckets, leech candidates, and recent stats", async () => {
    const { repository, service } = createHarness();
    repository.setLessonItems([createLessonItem("lesson-a", 1), createLessonItem("lesson-b", 2)]);
    repository.addState(createState("owner", "state-due", "card-due", "2026-06-17T09:00:00.000Z"));
    repository.addState(
      createState("owner", "state-leech", "card-leech", "2026-06-18T10:00:00.000Z", {
        wrongCount: 9,
        correctStreak: 1,
      }),
    );
    repository.addState(
      createState("owner", "state-burned", "card-burned", null, {
        burnedAt: "2026-06-18T08:00:00.000Z",
        stageIndex: 9,
      }),
    );
    repository.addReviewAnswer("owner", "correct", new Date("2026-06-18T08:00:00.000Z"));
    repository.addReviewAnswer("owner", "typo", new Date("2026-06-18T08:10:00.000Z"));
    repository.addReviewAnswer("owner", "wrong", new Date("2026-06-18T08:20:00.000Z"));
    repository.addReviewAnswer("owner", "wrong", new Date("2026-06-10T08:20:00.000Z"));

    const dashboard = await service.getDashboard(createUser("owner"));

    expect(dashboard.counts).toEqual({
      dueReviews: 1,
      availableLessons: 2,
      burnedCards: 1,
      leechCandidates: 1,
    });
    expect(dashboard.reviewForecast).toEqual([
      {
        bucketKey: "2026-06-18T12:00",
        localDate: "2026-06-18",
        localHour: 12,
        dueCount: 1,
      },
      {
        bucketKey: "2026-06-18T13:00",
        localDate: "2026-06-18",
        localHour: 13,
        dueCount: 1,
      },
    ]);
    expect(dashboard.workload).toEqual({
      reviews: {
        dueNow: 1,
        next24Hours: 1,
        laterThisWeek: 0,
        budget: 20,
        pressurePercent: 10,
      },
      lessons: {
        completedToday: 0,
        remainingToday: 10,
        dailyLimit: 10,
        percent: 0,
      },
    });
    expect(dashboard.srsStageSpread).toEqual([
      expect.objectContaining({
        srsSystemId: "srs-default",
        totalCards: 3,
        stages: expect.arrayContaining([
          expect.objectContaining({
            stageIndex: 1,
            totalCards: 2,
            cardsByItemType: {
              component: 0,
              kanji: 2,
              word: 0,
              sentence: 0,
            },
          }),
          expect.objectContaining({
            stageIndex: 9,
            totalCards: 1,
            cardsByItemType: {
              component: 0,
              kanji: 1,
              word: 0,
              sentence: 0,
            },
          }),
        ]),
      }),
    ]);
    expect(dashboard.leechCandidates).toEqual([
      expect.objectContaining({
        item: expect.objectContaining({
          japanese: "card-leech",
          srs: expect.objectContaining({
            leech: expect.objectContaining({
              score: 16,
              isCandidate: true,
            }),
          }),
        }),
        leech: expect.objectContaining({
          score: 16,
          wrongCount: 9,
          correctStreak: 1,
        }),
      }),
    ]);
    expect(dashboard.recentReviewStats).toMatchObject({
      since: RECENT_SINCE,
      total: 3,
      correct: 1,
      wrong: 1,
      typo: 1,
      accuracy: 0.667,
    });
  });

  it("returns current course and level progress after completed lessons", async () => {
    const { repository, service } = createHarness();
    repository.setLessonItems([
      createLessonItem("item-burned", 1),
      createLessonItem("item-started", 2),
      createLessonItem("item-open", 3),
      {
        ...createLessonItem("item-locked", 4),
        dependencies: [{ prerequisiteItemId: "missing-prerequisite", requiredStage: 5 }],
      },
    ]);
    repository.setCourse({
      id: "course-demo",
      title: "Demo course",
      levels: [
        {
          levelNumber: 1,
          items: [
            {
              id: "item-burned",
              itemType: "component",
              cardIds: ["card-burned"],
              startedCardIds: ["card-burned"],
              burnedCardIds: ["card-burned"],
            },
            {
              id: "item-started",
              itemType: "kanji",
              cardIds: ["card-started-meaning", "card-started-reading"],
              startedCardIds: ["card-started-meaning", "card-started-reading"],
              burnedCardIds: [],
            },
            {
              id: "item-open",
              itemType: "word",
              cardIds: ["card-open"],
              startedCardIds: [],
              burnedCardIds: [],
            },
            {
              id: "item-locked",
              itemType: "sentence",
              cardIds: ["card-locked"],
              startedCardIds: [],
              burnedCardIds: [],
            },
          ],
        },
        {
          levelNumber: 2,
          items: [
            {
              id: "item-next",
              itemType: "kanji",
              cardIds: ["card-next"],
              startedCardIds: [],
              burnedCardIds: [],
            },
          ],
        },
      ],
    });

    await expect(service.getDashboard(createUser("owner"))).resolves.toMatchObject({
      currentCourse: {
        id: "course-demo",
        title: "Demo course",
        currentLevel: 1,
        levelProgress: {
          level: 1,
          completedItems: 2,
          totalItems: 4,
          completedCards: 3,
          totalCards: 5,
          percent: 50,
          cardPercent: 60,
          itemsByType: [
            {
              itemType: "component",
              totalItems: 1,
              locked: 0,
              available: 0,
              inProgress: 0,
              burned: 1,
            },
            {
              itemType: "kanji",
              totalItems: 1,
              locked: 0,
              available: 0,
              inProgress: 1,
              burned: 0,
            },
            {
              itemType: "word",
              totalItems: 1,
              locked: 0,
              available: 1,
              inProgress: 0,
              burned: 0,
            },
            {
              itemType: "sentence",
              totalItems: 1,
              locked: 1,
              available: 0,
              inProgress: 0,
              burned: 0,
            },
          ],
        },
      },
    });
  });

  it("summarizes today's lesson capacity using distinct completed items", async () => {
    const { repository, service } = createHarness();
    repository.addLessonProgress({
      userId: "owner",
      learningItemId: "item-today",
      learningCardId: "card-today-meaning",
      stageIndex: 1,
      createdAt: NOW,
    });
    repository.addLessonProgress({
      userId: "owner",
      learningItemId: "item-today",
      learningCardId: "card-today-reading",
      stageIndex: 1,
      createdAt: NOW,
    });

    await expect(service.getDashboard(createUser("owner"))).resolves.toMatchObject({
      workload: {
        lessons: {
          completedToday: 1,
          remainingToday: 9,
          dailyLimit: 10,
          percent: 10,
        },
      },
    });
  });

  it("uses the user's timezone for forecast buckets", async () => {
    vi.setSystemTime(new Date("2026-01-01T10:00:00.000Z"));

    const { repository, service } = createHarness();
    repository.addState(
      createState("owner", "state-night", "card-night", "2026-01-01T21:30:00.000Z"),
    );

    await expect(service.getDashboard(createUser("owner"))).resolves.toMatchObject({
      reviewForecast: [
        {
          bucketKey: "2026-01-02T00:00",
          localDate: "2026-01-02",
          localHour: 0,
          dueCount: 1,
        },
      ],
    });
  });
});

class InMemoryDashboardRepository extends DashboardRepository {
  private readonly states: InMemoryDashboardSrsStateRecord[] = [];
  private lessonItems: readonly DashboardLessonItemRecord[] = [];
  private lessonProgress: InMemoryDashboardLessonProgressRecord[] = [];
  private readonly reviewAnswers: {
    readonly userId: string;
    readonly result: DashboardReviewResult;
    readonly answeredAt: Date;
  }[] = [];
  private course: DashboardCourseProgressRecord | null = null;

  async listLessonAvailabilityItems(
    _userId: string,
  ): Promise<readonly DashboardLessonItemRecord[]> {
    return this.lessonItems;
  }

  async listLessonProgress(userId: string): Promise<readonly DashboardLessonProgressRecord[]> {
    return this.lessonProgress
      .filter((record) => record.userId === userId)
      .map(({ userId: _userId, ...record }) => record);
  }

  async countDueReviews(userId: string, now: Date): Promise<number> {
    return this.states.filter(
      (state) =>
        state.userId === userId &&
        state.burnedAt === null &&
        state.availableAt !== null &&
        state.availableAt.getTime() <= now.getTime(),
    ).length;
  }

  async countBurnedCards(userId: string): Promise<number> {
    return this.states.filter((state) => state.userId === userId && state.burnedAt !== null).length;
  }

  async listLeechSignals(
    userId: string,
    _since: Date,
  ): Promise<readonly DashboardLeechSignalRecord[]> {
    return this.states.filter(
      (state) =>
        state.userId === userId &&
        state.burnedAt === null &&
        (state.wrongCount > 0 || state.recentWrongCount > 0),
    );
  }

  async listForecastStates(
    userId: string,
    horizonEnd: Date,
  ): Promise<readonly DashboardSrsStateRecord[]> {
    return this.states.filter(
      (state) =>
        state.userId === userId &&
        state.burnedAt === null &&
        state.availableAt !== null &&
        state.availableAt.getTime() <= horizonEnd.getTime(),
    );
  }

  async listSrsStageSpread(userId: string): Promise<readonly DashboardSrsStageSpreadRecord[]> {
    const states = this.states.filter((state) => state.userId === userId);
    const systemIds = [...new Set(states.map((state) => state.srsSystemId))].sort();

    return systemIds.map((srsSystemId) => {
      const systemStates = states.filter((state) => state.srsSystemId === srsSystemId);
      const stages = systemStates[0]?.stages ?? [];

      return {
        srsSystemId,
        srsSystemTitle: "Default SRS",
        stages: stages.map((stage) => {
          const stageStates = systemStates.filter((state) => state.stageIndex === stage.stageIndex);

          return {
            stageIndex: stage.stageIndex,
            name: stage.name,
            isBurned: stage.isBurned ?? false,
            cardsByItemType: {
              component: countStatesByItemType(stageStates, "component"),
              kanji: countStatesByItemType(stageStates, "kanji"),
              word: countStatesByItemType(stageStates, "word"),
              sentence: countStatesByItemType(stageStates, "sentence"),
            },
          };
        }),
      };
    });
  }

  async findCurrentCourseProgress(_userId: string): Promise<DashboardCourseProgressRecord | null> {
    return this.course;
  }

  async countRecentReviewResults(
    userId: string,
    since: Date,
    now: Date,
  ): Promise<readonly DashboardReviewResultCountRecord[]> {
    const countByResult = new Map<DashboardReviewResult, number>();

    for (const answer of this.reviewAnswers) {
      if (
        answer.userId !== userId ||
        answer.answeredAt.getTime() < since.getTime() ||
        answer.answeredAt.getTime() > now.getTime()
      ) {
        continue;
      }

      countByResult.set(answer.result, (countByResult.get(answer.result) ?? 0) + 1);
    }

    return [...countByResult.entries()].map(([result, count]) => ({ result, count }));
  }

  addState(state: InMemoryDashboardSrsStateRecord): void {
    this.states.push(state);
  }

  setLessonItems(items: readonly DashboardLessonItemRecord[]): void {
    this.lessonItems = items;
  }

  addLessonProgress(progress: InMemoryDashboardLessonProgressRecord): void {
    this.lessonProgress.push(progress);
  }

  addReviewAnswer(userId: string, result: DashboardReviewResult, answeredAt: Date): void {
    this.reviewAnswers.push({ userId, result, answeredAt });
  }

  setCourse(course: DashboardCourseProgressRecord): void {
    this.course = course;
  }
}

type InMemoryDashboardSrsStateRecord = DashboardSrsStateRecord & {
  readonly userId: string;
  readonly recentWrongCount: number;
  readonly stageDropCount: number;
  readonly stageDropMagnitude: number;
  readonly item: DashboardLeechSignalRecord["item"];
};

type InMemoryDashboardLessonProgressRecord = DashboardLessonProgressRecord & {
  readonly userId: string;
};

function createHarness(): {
  readonly repository: InMemoryDashboardRepository;
  readonly service: DashboardService;
} {
  const repository = new InMemoryDashboardRepository();

  return {
    repository,
    service: new DashboardService(repository),
  };
}

function countStatesByItemType(
  states: readonly InMemoryDashboardSrsStateRecord[],
  itemType: DashboardLeechSignalRecord["item"]["itemType"],
): number {
  return states.filter((state) => state.item.itemType === itemType).length;
}

function createLessonItem(id: string, sortOrder: number): DashboardLessonItemRecord {
  return {
    courseId: "course-demo",
    courseLevelNumber: 1,
    sortOrder,
    id,
    cardIds: [`card-${id}`],
    dependencies: [],
  };
}

function createState(
  userId: string,
  stateId: string,
  cardId: string,
  availableAt: string | null,
  options: {
    readonly stageIndex?: number;
    readonly srsSystemId?: string;
    readonly burnedAt?: string | null;
    readonly wrongCount?: number;
    readonly correctStreak?: number;
    readonly recentWrongCount?: number;
    readonly stageDropCount?: number;
    readonly stageDropMagnitude?: number;
  } = {},
): InMemoryDashboardSrsStateRecord {
  return {
    id: stateId,
    userId,
    learningCardId: cardId,
    srsSystemId: options.srsSystemId ?? "srs-default",
    stageIndex: options.stageIndex ?? 1,
    availableAt: availableAt === null ? null : new Date(availableAt),
    burnedAt:
      options.burnedAt === undefined || options.burnedAt === null
        ? null
        : new Date(options.burnedAt),
    wrongCount: options.wrongCount ?? 0,
    correctStreak: options.correctStreak ?? 0,
    recentWrongCount: options.recentWrongCount ?? 0,
    stageDropCount: options.stageDropCount ?? 0,
    stageDropMagnitude: options.stageDropMagnitude ?? 0,
    stages: DEFAULT_SRS_STAGES,
    item: {
      id: `item-${cardId}`,
      itemType: "kanji",
      japanese: cardId,
      reading: null,
      translations: {
        ru: [{ locale: "ru-RU", text: cardId, isPrimary: true, sourceKind: "curated" }],
        en: [{ locale: "en-US", text: cardId, isPrimary: true, sourceKind: "curated" }],
      },
      level: 1,
      jlptLevel: "N5",
    },
  };
}

function createUser(id: string): CurrentUserDto {
  return {
    id,
    email: `${id}@example.test`,
    displayName: id,
    role: "USER",
    settings: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 20,
      strictMode: false,
    },
  };
}
