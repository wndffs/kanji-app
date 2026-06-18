import { Inject, Injectable } from "@nestjs/common";

import {
  buildReviewForecast,
  type ForecastableSrsState,
  type ReviewForecastBucket,
} from "@kanji-srs/srs";
import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type DashboardDto,
  type DashboardLevelProgressDto,
  type DashboardRecentReviewStatsDto,
  type ReviewForecastBucketDto,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { DashboardRepository } from "./dashboard.repository";
import {
  type DashboardCourseItemProgressRecord,
  type DashboardCourseLevelProgressRecord,
  type DashboardCourseProgressRecord,
  type DashboardLessonItemRecord,
  type DashboardLessonProgressRecord,
  type DashboardReviewResult,
  type DashboardReviewResultCountRecord,
  type DashboardSrsStateRecord,
} from "./dashboard.types";

const FORECAST_HORIZON_DAYS = 7;
const RECENT_REVIEW_STATS_DAYS = 7;
const LEECH_MINIMUM_WRONG_COUNT = 8;
const LEECH_MAXIMUM_CORRECT_STREAK = 2;
const DEFAULT_DAILY_LESSON_LIMIT = 10;

@Injectable()
export class DashboardService {
  constructor(
    @Inject(DashboardRepository) private readonly dashboardRepository: DashboardRepository,
  ) {}

  async getDashboard(user: CurrentUserDto): Promise<DashboardDto> {
    const now = new Date();
    const recentSince = addDays(now, -RECENT_REVIEW_STATS_DAYS);
    const forecastHorizonEnd = addDays(now, FORECAST_HORIZON_DAYS);
    const [
      lessonItems,
      lessonProgress,
      dueReviews,
      burnedCards,
      leechCandidates,
      forecastStates,
      currentCourse,
      recentReviewCounts,
    ] = await Promise.all([
      this.dashboardRepository.listLessonAvailabilityItems(user.id),
      this.dashboardRepository.listLessonProgress(user.id),
      this.dashboardRepository.countDueReviews(user.id, now),
      this.dashboardRepository.countBurnedCards(user.id),
      this.dashboardRepository.countLeechCandidates(user.id, {
        minimumWrongCount: LEECH_MINIMUM_WRONG_COUNT,
        maximumCorrectStreak: LEECH_MAXIMUM_CORRECT_STREAK,
      }),
      this.dashboardRepository.listForecastStates(user.id, forecastHorizonEnd),
      this.dashboardRepository.findCurrentCourseProgress(user.id),
      this.dashboardRepository.countRecentReviewResults(user.id, recentSince, now),
    ]);

    return {
      user: {
        id: user.id,
        displayName: user.displayName,
        locale: user.settings.locale,
        translationDisplayMode:
          user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE,
        timezone: user.settings.timezone,
      },
      counts: {
        dueReviews,
        availableLessons: countAvailableLessons(user, lessonItems, lessonProgress, now),
        burnedCards,
        leechCandidates,
      },
      currentCourse: currentCourse === null ? null : toCurrentCourseDto(currentCourse),
      reviewForecast: toReviewForecastDto(forecastStates, now, user.settings.timezone),
      recentReviewStats: toRecentReviewStatsDto(recentReviewCounts, recentSince),
      recentItems: [],
    };
  }
}

function toCurrentCourseDto(
  course: DashboardCourseProgressRecord,
): NonNullable<DashboardDto["currentCourse"]> {
  const levelProgress = findCurrentLevelProgress(course.levels);

  return {
    id: course.id,
    title: course.title,
    currentLevel: levelProgress.level,
    levelProgress,
  };
}

function countAvailableLessons(
  user: CurrentUserDto,
  lessonItems: readonly DashboardLessonItemRecord[],
  progress: readonly DashboardLessonProgressRecord[],
  now: Date,
): number {
  const remainingToday = getRemainingDailyLessons(user, progress, now);

  if (remainingToday <= 0 || lessonItems.length === 0) {
    return 0;
  }

  return findAvailableLessonItems(lessonItems, progress).slice(0, remainingToday).length;
}

function findAvailableLessonItems(
  lessonItems: readonly DashboardLessonItemRecord[],
  progress: readonly DashboardLessonProgressRecord[],
): readonly DashboardLessonItemRecord[] {
  const progressByItem = groupLessonProgressByItem(progress);
  const itemById = new Map(lessonItems.map((item) => [item.id, item]));
  const groupedByCourse = groupLessonItemsByCourse(lessonItems);
  const available: DashboardLessonItemRecord[] = [];

  for (const [, entries] of groupedByCourse) {
    const firstOpenLevel = findFirstOpenLessonLevel(entries, progressByItem);

    if (firstOpenLevel === null) {
      continue;
    }

    for (const entry of firstOpenLevel) {
      if (
        entry.cardIds.length === 0 ||
        isLessonItemStarted(entry, progressByItem) ||
        !hasSatisfiedPrerequisites(entry, progressByItem, itemById)
      ) {
        continue;
      }

      available.push(entry);
    }
  }

  return available.sort(
    (left, right) =>
      left.courseId.localeCompare(right.courseId) ||
      left.courseLevelNumber - right.courseLevelNumber ||
      left.sortOrder - right.sortOrder ||
      left.id.localeCompare(right.id),
  );
}

function groupLessonItemsByCourse(
  lessonItems: readonly DashboardLessonItemRecord[],
): Map<string, readonly DashboardLessonItemRecord[]> {
  const grouped = new Map<string, DashboardLessonItemRecord[]>();

  for (const item of lessonItems) {
    const existing = grouped.get(item.courseId) ?? [];
    existing.push(item);
    grouped.set(item.courseId, existing);
  }

  return new Map(
    [...grouped.entries()].map(([courseId, items]) => [
      courseId,
      items.sort(
        (left, right) =>
          left.courseLevelNumber - right.courseLevelNumber ||
          left.sortOrder - right.sortOrder ||
          left.id.localeCompare(right.id),
      ),
    ]),
  );
}

function findFirstOpenLessonLevel(
  lessonItems: readonly DashboardLessonItemRecord[],
  progressByItem: Map<string, readonly DashboardLessonProgressRecord[]>,
): readonly DashboardLessonItemRecord[] | null {
  const levels = new Map<number, DashboardLessonItemRecord[]>();

  for (const item of lessonItems) {
    const existing = levels.get(item.courseLevelNumber) ?? [];
    existing.push(item);
    levels.set(item.courseLevelNumber, existing);
  }

  for (const [, items] of [...levels.entries()].sort((left, right) => left[0] - right[0])) {
    if (
      items.some((item) => item.cardIds.length > 0 && !isLessonItemStarted(item, progressByItem))
    ) {
      return items;
    }
  }

  return null;
}

function groupLessonProgressByItem(
  progress: readonly DashboardLessonProgressRecord[],
): Map<string, readonly DashboardLessonProgressRecord[]> {
  const grouped = new Map<string, DashboardLessonProgressRecord[]>();

  for (const record of progress) {
    const existing = grouped.get(record.learningItemId) ?? [];
    existing.push(record);
    grouped.set(record.learningItemId, existing);
  }

  return grouped;
}

function isLessonItemStarted(
  item: DashboardLessonItemRecord,
  progressByItem: Map<string, readonly DashboardLessonProgressRecord[]>,
): boolean {
  const progress = progressByItem.get(item.id) ?? [];

  return item.cardIds.some((cardId) => progress.some((record) => record.learningCardId === cardId));
}

function hasSatisfiedPrerequisites(
  item: DashboardLessonItemRecord,
  progressByItem: Map<string, readonly DashboardLessonProgressRecord[]>,
  itemById: Map<string, DashboardLessonItemRecord>,
): boolean {
  for (const dependency of item.dependencies) {
    const prerequisite = itemById.get(dependency.prerequisiteItemId);
    const progress = progressByItem.get(dependency.prerequisiteItemId) ?? [];
    const satisfied =
      prerequisite === undefined
        ? progress.some((record) => record.stageIndex >= dependency.requiredStage)
        : prerequisite.cardIds.length > 0 &&
          prerequisite.cardIds.every((cardId) =>
            progress.some(
              (record) =>
                record.learningCardId === cardId && record.stageIndex >= dependency.requiredStage,
            ),
          );

    if (!satisfied) {
      return false;
    }
  }

  return true;
}

function getRemainingDailyLessons(
  user: CurrentUserDto,
  progress: readonly DashboardLessonProgressRecord[],
  now: Date,
): number {
  const dailyLimit =
    Number.isInteger(user.settings.dailyLessonLimit) && user.settings.dailyLessonLimit > 0
      ? user.settings.dailyLessonLimit
      : DEFAULT_DAILY_LESSON_LIMIT;
  const today = getLocalDateKey(now, user.settings.timezone);
  const completedItemIds = new Set(
    progress
      .filter((record) => getLocalDateKey(record.createdAt, user.settings.timezone) === today)
      .map((record) => record.learningItemId),
  );

  return Math.max(0, dailyLimit - completedItemIds.size);
}

function getLocalDateKey(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    return `${readDatePart(parts, "year")}-${readDatePart(parts, "month")}-${readDatePart(parts, "day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function readDatePart(
  parts: Intl.DateTimeFormatPart[],
  type: Intl.DateTimeFormatPartTypes,
): string {
  return parts.find((part) => part.type === type)?.value ?? "00";
}

function findCurrentLevelProgress(
  levels: readonly DashboardCourseLevelProgressRecord[],
): DashboardLevelProgressDto {
  const progressByLevel = levels.map(toLevelProgress);
  const currentLevel =
    progressByLevel.find(
      (level) => level.totalItems > 0 && level.completedItems < level.totalItems,
    ) ??
    findLastLevelWithItems(progressByLevel) ??
    progressByLevel[0];

  return (
    currentLevel ?? {
      level: 0,
      completedItems: 0,
      totalItems: 0,
      completedCards: 0,
      totalCards: 0,
      percent: 0,
    }
  );
}

function findLastLevelWithItems(
  levels: readonly DashboardLevelProgressDto[],
): DashboardLevelProgressDto | undefined {
  for (let index = levels.length - 1; index >= 0; index -= 1) {
    const level = levels[index];

    if (level !== undefined && level.totalItems > 0) {
      return level;
    }
  }

  return undefined;
}

function toLevelProgress(level: DashboardCourseLevelProgressRecord): DashboardLevelProgressDto {
  const lessonItems = level.items.filter((item) => item.cardIds.length > 0);
  const totalItems = lessonItems.length;
  const completedItems = lessonItems.filter(isCompletedLessonItem).length;
  const totalCards = lessonItems.reduce((sum, item) => sum + item.cardIds.length, 0);
  const completedCards = lessonItems.reduce((sum, item) => sum + countCompletedCards(item), 0);

  return {
    level: level.levelNumber,
    completedItems,
    totalItems,
    completedCards,
    totalCards,
    percent: totalItems === 0 ? 0 : Math.round((completedItems / totalItems) * 100),
  };
}

function isCompletedLessonItem(item: DashboardCourseItemProgressRecord): boolean {
  const startedCards = new Set(item.startedCardIds);

  return item.cardIds.every((cardId) => startedCards.has(cardId));
}

function countCompletedCards(item: DashboardCourseItemProgressRecord): number {
  const startedCards = new Set(item.startedCardIds);

  return item.cardIds.filter((cardId) => startedCards.has(cardId)).length;
}

function toReviewForecastDto(
  states: readonly DashboardSrsStateRecord[],
  now: Date,
  timezone: string,
): readonly ReviewForecastBucketDto[] {
  const bucketsByKey = new Map<string, ReviewForecastBucketDto>();

  for (const group of groupForecastStatesBySrsSystem(states)) {
    const buckets = buildReviewForecast({
      states: group.states.map(toForecastableState),
      now,
      timezone,
      granularity: "hour",
      horizonDays: FORECAST_HORIZON_DAYS,
      includeOverdue: true,
      stageConfig: {
        stages: group.stages,
      },
    });

    for (const bucket of buckets) {
      const existing = bucketsByKey.get(bucket.bucketKey);

      if (existing === undefined) {
        bucketsByKey.set(bucket.bucketKey, toReviewForecastBucketDto(bucket));
      } else {
        bucketsByKey.set(bucket.bucketKey, {
          ...existing,
          dueCount: existing.dueCount + bucket.dueCount,
        });
      }
    }
  }

  return [...bucketsByKey.values()].sort((left, right) =>
    left.bucketKey.localeCompare(right.bucketKey),
  );
}

function groupForecastStatesBySrsSystem(states: readonly DashboardSrsStateRecord[]): readonly {
  readonly stages: DashboardSrsStateRecord["stages"];
  readonly states: readonly DashboardSrsStateRecord[];
}[] {
  const grouped = new Map<
    string,
    {
      stages: DashboardSrsStateRecord["stages"];
      states: DashboardSrsStateRecord[];
    }
  >();

  for (const state of states) {
    const existing = grouped.get(state.srsSystemId);

    if (existing === undefined) {
      grouped.set(state.srsSystemId, {
        stages: state.stages,
        states: [state],
      });
    } else {
      existing.states.push(state);
    }
  }

  return [...grouped.values()];
}

function toForecastableState(state: DashboardSrsStateRecord): ForecastableSrsState {
  return {
    id: state.id,
    learningCardId: state.learningCardId,
    stageIndex: state.stageIndex,
    availableAt: state.availableAt,
    burnedAt: state.burnedAt,
  };
}

function toReviewForecastBucketDto(bucket: ReviewForecastBucket): ReviewForecastBucketDto {
  return {
    bucketKey: bucket.bucketKey,
    localDate: bucket.localDate,
    localHour: bucket.localHour,
    dueCount: bucket.dueCount,
  };
}

function toRecentReviewStatsDto(
  counts: readonly DashboardReviewResultCountRecord[],
  since: Date,
): DashboardRecentReviewStatsDto {
  const countByResult = new Map<DashboardReviewResult, number>(
    counts.map((entry) => [entry.result, entry.count]),
  );
  const correct = countByResult.get("correct") ?? 0;
  const wrong = countByResult.get("wrong") ?? 0;
  const typo = countByResult.get("typo") ?? 0;
  const reveal = countByResult.get("reveal") ?? 0;
  const manualIgnore = countByResult.get("manual-ignore") ?? 0;
  const resurrect = countByResult.get("resurrect") ?? 0;
  const total = correct + wrong + typo + reveal + manualIgnore + resurrect;
  const gradedTotal = correct + wrong + typo + reveal;

  return {
    since: since.toISOString(),
    total,
    correct,
    wrong,
    typo,
    reveal,
    manualIgnore,
    resurrect,
    accuracy: gradedTotal === 0 ? null : roundRatio((correct + typo) / gradedTotal),
  };
}

function roundRatio(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}
