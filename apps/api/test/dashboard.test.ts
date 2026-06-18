import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DEFAULT_SRS_STAGES } from "@kanji-srs/srs";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { DashboardRepository } from "../src/dashboard/dashboard.repository";
import { DashboardService } from "../src/dashboard/dashboard.service";
import {
  type DashboardCourseProgressRecord,
  type DashboardLessonItemRecord,
  type DashboardLessonProgressRecord,
  type DashboardReviewResult,
  type DashboardReviewResultCountRecord,
  type DashboardSrsStateRecord,
} from "../src/dashboard/dashboard.types";

const NOW = new Date("2026-06-18T09:00:00.000Z");
const RECENT_SINCE = "2026-06-11T09:00:00.000Z";

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
      reviewForecast: [],
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
    repository.setCourse({
      id: "course-demo",
      title: "Demo course",
      levels: [
        {
          levelNumber: 1,
          items: [
            {
              id: "item-started",
              cardIds: ["card-started-meaning", "card-started-reading"],
              startedCardIds: ["card-started-meaning", "card-started-reading"],
            },
            {
              id: "item-open",
              cardIds: ["card-open"],
              startedCardIds: [],
            },
          ],
        },
        {
          levelNumber: 2,
          items: [
            {
              id: "item-next",
              cardIds: ["card-next"],
              startedCardIds: [],
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
          completedItems: 1,
          totalItems: 2,
          completedCards: 2,
          totalCards: 3,
          percent: 50,
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

  async countLeechCandidates(
    userId: string,
    thresholds: {
      readonly minimumWrongCount: number;
      readonly maximumCorrectStreak: number;
    },
  ): Promise<number> {
    return this.states.filter(
      (state) =>
        state.userId === userId &&
        state.burnedAt === null &&
        state.wrongCount >= thresholds.minimumWrongCount &&
        state.correctStreak <= thresholds.maximumCorrectStreak,
    ).length;
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
    stages: DEFAULT_SRS_STAGES,
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
