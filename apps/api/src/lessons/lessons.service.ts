import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type BilingualTextDto,
  type CompleteLessonItemResponse,
  type FinishLessonSessionResponse,
  type ItemSummary,
  type LearningCardDto,
  type LessonQueueItem,
  type LessonQueueResponse,
  type SrsStateSummaryDto,
  type StartLessonSessionResponse,
  type TranslationBundleDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { LessonsRepository } from "./lessons.repository";
import {
  type CompleteLessonItemRequest,
  type CourseLessonItemRecord,
  type LessonCardRecord,
  type LessonItemRecord,
  type LessonSessionRecord,
  type SrsSystemRecord,
  type UserItemProgressRecord,
} from "./lessons.types";

const DEFAULT_DAILY_LESSON_LIMIT = 10;

@Injectable()
export class LessonsService {
  constructor(@Inject(LessonsRepository) private readonly lessonsRepository: LessonsRepository) {}

  async getQueue(user: CurrentUserDto): Promise<LessonQueueResponse> {
    const { availableItems, displayMode } = await this.getAvailableItems(user, new Date());

    return {
      items: availableItems.map((item) =>
        toLessonQueueItem(item.item, item.unlockedBy, displayMode),
      ),
    };
  }

  async startSession(user: CurrentUserDto): Promise<StartLessonSessionResponse> {
    const session = await this.lessonsRepository.createLessonSession(user.id, new Date());

    return {
      session: toLessonSessionDto(session),
    };
  }

  async completeItem(
    sessionId: string,
    user: CurrentUserDto,
    body: unknown,
  ): Promise<CompleteLessonItemResponse> {
    const request = parseCompleteLessonItemRequest(body);
    const session = await this.lessonsRepository.findActiveLessonSession(user.id, sessionId);

    if (session === null) {
      throw new NotFoundException("Active lesson session not found.");
    }

    const now = new Date();
    const { availableItems } = await this.getAvailableItems(user, now);
    const lessonItem = availableItems.find((candidate) => candidate.item.id === request.itemId);

    if (lessonItem === undefined) {
      throw new BadRequestException("Lesson item is not currently available.");
    }

    const srsSystem = await this.lessonsRepository.getDefaultSrsSystem();

    if (srsSystem === null) {
      throw new NotFoundException("Default SRS system not found.");
    }

    const initialStage = getInitialStage(srsSystem);
    const availableAt = getInitialAvailableAt(initialStage.intervalMinutes, now);
    const result = await this.lessonsRepository.completeLessonItem({
      userId: user.id,
      sessionId: session.id,
      item: lessonItem.item,
      srsSystem,
      initialStageIndex: initialStage.stageIndex,
      availableAt,
    });
    const srs = toSrsSummary(initialStage, availableAt);

    return {
      itemId: lessonItem.item.id,
      createdSrsStateCount: result.createdSrsStateCount,
      cards: lessonItem.item.cards.map((card) => ({
        cardId: card.id,
        srs,
      })),
    };
  }

  async finishSession(
    sessionId: string,
    user: CurrentUserDto,
  ): Promise<FinishLessonSessionResponse> {
    const session = await this.lessonsRepository.finishLessonSession(
      user.id,
      sessionId,
      new Date(),
    );

    if (session === null) {
      throw new NotFoundException("Active lesson session not found.");
    }

    return {
      session: toLessonSessionDto(session),
    };
  }

  private async getAvailableItems(
    user: CurrentUserDto,
    now: Date,
  ): Promise<{
    readonly availableItems: readonly AvailableLessonItem[];
    readonly displayMode: TranslationDisplayMode;
  }> {
    const [courseItems, progress] = await Promise.all([
      this.lessonsRepository.listCourseLessonItems(user.id),
      this.lessonsRepository.listUserProgress(user.id),
    ]);
    const displayMode = user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;
    const remainingToday = getRemainingDailyLessons(user, progress, now);

    if (remainingToday <= 0 || courseItems.length === 0) {
      return { availableItems: [], displayMode };
    }

    const availableItems = findAvailableCourseItems(courseItems, progress).slice(0, remainingToday);

    return { availableItems, displayMode };
  }
}

type AvailableLessonItem = {
  readonly item: LessonItemRecord;
  readonly unlockedBy: readonly LessonItemRecord[];
  readonly courseId: string;
  readonly courseLevelNumber: number;
  readonly sortOrder: number;
};

function findAvailableCourseItems(
  courseItems: readonly CourseLessonItemRecord[],
  progress: readonly UserItemProgressRecord[],
): readonly AvailableLessonItem[] {
  const progressByItem = groupProgressByItem(progress);
  const itemById = new Map(courseItems.map((entry) => [entry.item.id, entry.item]));
  const groupedByCourse = groupCourseItems(courseItems);
  const available: AvailableLessonItem[] = [];

  for (const [courseId, entries] of groupedByCourse) {
    const firstOpenLevel = findFirstOpenLevel(entries, progressByItem);

    if (firstOpenLevel === null) {
      continue;
    }

    for (const entry of firstOpenLevel) {
      if (!hasLessonCards(entry.item) || isItemStarted(entry.item, progressByItem)) {
        continue;
      }

      const unlockedBy = getSatisfiedPrerequisites(entry.item, progressByItem, itemById);

      if (unlockedBy === null) {
        continue;
      }

      available.push({
        item: entry.item,
        unlockedBy,
        courseId,
        courseLevelNumber: entry.courseLevelNumber,
        sortOrder: entry.sortOrder,
      });
    }
  }

  return available.sort(
    (left, right) =>
      left.courseId.localeCompare(right.courseId) ||
      left.courseLevelNumber - right.courseLevelNumber ||
      left.sortOrder - right.sortOrder ||
      left.item.id.localeCompare(right.item.id),
  );
}

function groupCourseItems(
  courseItems: readonly CourseLessonItemRecord[],
): Map<string, readonly CourseLessonItemRecord[]> {
  const grouped = new Map<string, CourseLessonItemRecord[]>();

  for (const item of courseItems) {
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
          left.item.id.localeCompare(right.item.id),
      ),
    ]),
  );
}

function findFirstOpenLevel(
  courseItems: readonly CourseLessonItemRecord[],
  progressByItem: Map<string, readonly UserItemProgressRecord[]>,
): readonly CourseLessonItemRecord[] | null {
  const levels = new Map<number, CourseLessonItemRecord[]>();

  for (const entry of courseItems) {
    const existing = levels.get(entry.courseLevelNumber) ?? [];
    existing.push(entry);
    levels.set(entry.courseLevelNumber, existing);
  }

  for (const [, items] of [...levels.entries()].sort((left, right) => left[0] - right[0])) {
    if (
      items.some(
        (entry) => hasLessonCards(entry.item) && !isItemStarted(entry.item, progressByItem),
      )
    ) {
      return items;
    }
  }

  return null;
}

function groupProgressByItem(
  progress: readonly UserItemProgressRecord[],
): Map<string, readonly UserItemProgressRecord[]> {
  const grouped = new Map<string, UserItemProgressRecord[]>();

  for (const record of progress) {
    const existing = grouped.get(record.learningItemId) ?? [];
    existing.push(record);
    grouped.set(record.learningItemId, existing);
  }

  return grouped;
}

function hasLessonCards(item: LessonItemRecord): boolean {
  return item.cards.length > 0;
}

function isItemStarted(
  item: LessonItemRecord,
  progressByItem: Map<string, readonly UserItemProgressRecord[]>,
): boolean {
  const progress = progressByItem.get(item.id) ?? [];

  return item.cards.some((card) => progress.some((record) => record.learningCardId === card.id));
}

function getSatisfiedPrerequisites(
  item: LessonItemRecord,
  progressByItem: Map<string, readonly UserItemProgressRecord[]>,
  itemById: Map<string, LessonItemRecord>,
): readonly LessonItemRecord[] | null {
  const unlockedBy: LessonItemRecord[] = [];

  for (const dependency of item.dependencies) {
    const prerequisite = itemById.get(dependency.prerequisiteItemId);
    const progress = progressByItem.get(dependency.prerequisiteItemId) ?? [];
    const satisfied =
      prerequisite === undefined
        ? progress.some((record) => record.stageIndex >= dependency.requiredStage)
        : prerequisite.cards.length > 0 &&
          prerequisite.cards.every((card) =>
            progress.some(
              (record) =>
                record.learningCardId === card.id && record.stageIndex >= dependency.requiredStage,
            ),
          );

    if (!satisfied) {
      return null;
    }

    if (prerequisite !== undefined) {
      unlockedBy.push(prerequisite);
    }
  }

  return unlockedBy;
}

function getRemainingDailyLessons(
  user: CurrentUserDto,
  progress: readonly UserItemProgressRecord[],
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

function parseCompleteLessonItemRequest(body: unknown): Required<CompleteLessonItemRequest> {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const itemId = (body as CompleteLessonItemRequest).itemId;

  if (typeof itemId !== "string" || itemId.trim() === "") {
    throw new BadRequestException("itemId must be a non-empty string.");
  }

  return { itemId: itemId.trim() };
}

function getInitialStage(srsSystem: SrsSystemRecord): SrsSystemRecord["stages"][number] {
  const stage = srsSystem.stages
    .filter((candidate) => !candidate.isBurned)
    .sort((left, right) => left.stageIndex - right.stageIndex)[0];

  if (stage === undefined) {
    throw new BadRequestException("SRS system has no non-burned initial stage.");
  }

  return stage;
}

function getInitialAvailableAt(intervalMinutes: number | null, now: Date): Date | null {
  return intervalMinutes === null ? null : new Date(now.getTime() + intervalMinutes * 60_000);
}

function toLessonQueueItem(
  item: LessonItemRecord,
  unlockedBy: readonly LessonItemRecord[],
  displayMode: TranslationDisplayMode,
): LessonQueueItem {
  return {
    item: toItemSummary(item, displayMode),
    cards: item.cards.map((card) => toLearningCard(item, card, displayMode)),
    unlockedBy: unlockedBy.map((prerequisite) => toItemSummary(prerequisite, displayMode)),
  };
}

function toItemSummary(item: LessonItemRecord, displayMode: TranslationDisplayMode): ItemSummary {
  return {
    id: item.id,
    itemType: item.itemType,
    slug: `${item.itemType}:${item.target.japanese}`,
    japanese: item.target.japanese,
    reading: item.target.reading,
    translations: toTranslationBundle(item.target.translations, displayMode),
    level: item.level,
    jlptLevel: item.target.jlptLevel,
    srs: null,
  };
}

function toLearningCard(
  item: LessonItemRecord,
  card: LessonCardRecord,
  displayMode: TranslationDisplayMode,
): LearningCardDto {
  return {
    id: card.id,
    learningItemId: item.id,
    itemType: item.itemType,
    cardType: card.cardType,
    promptType: card.promptType,
    answerType: card.answerType,
    translationDisplayMode: displayMode,
    prompt: {
      japanese: item.target.japanese,
      reading: item.target.reading,
    },
    translations: toTranslationBundle(item.target.translations, displayMode),
    acceptedAnswers: card.answers.map((answer) => ({
      locale: answer.locale,
      text: answer.text,
      isPrimary: answer.isPrimary,
      sourceKind: answer.sourceKind,
    })),
    blockedAnswers: card.blockedAnswers.map((answer) => ({
      locale: answer.locale,
      text: answer.text,
      sourceKind: answer.sourceKind,
    })),
    sortOrder: card.sortOrder,
  };
}

function toTranslationBundle(
  translations: BilingualTextDto,
  displayMode: TranslationDisplayMode,
): TranslationBundleDto {
  return {
    ...translations,
    displayMode,
    primaryRu:
      translations.ru.find((text) => text.isPrimary)?.text ?? translations.ru[0]?.text ?? null,
    primaryEn:
      translations.en.find((text) => text.isPrimary)?.text ?? translations.en[0]?.text ?? null,
  };
}

function toSrsSummary(
  stage: SrsSystemRecord["stages"][number],
  availableAt: Date | null,
): SrsStateSummaryDto {
  return {
    stageIndex: stage.stageIndex,
    stageName: stage.name,
    availableAt: availableAt?.toISOString() ?? null,
    burnedAt: null,
    wrongCount: 0,
    correctStreak: 0,
  };
}

function toLessonSessionDto(session: LessonSessionRecord) {
  return {
    id: session.id,
    startedAt: session.startedAt.toISOString(),
    finishedAt: session.finishedAt?.toISOString() ?? null,
    mode: session.mode,
  };
}
