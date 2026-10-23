import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  buildLearningTranslationBundle as toTranslationBundle,
  type ActiveLessonSessionResponse,
  type CheckLessonAnswerRequestDto,
  type CheckLessonAnswerResponse,
  type CompleteLessonItemRequestDto,
  type CompleteLessonItemResponse,
  type FinishLessonSessionResponse,
  type ItemSummary,
  type LearningCardDto,
  type LessonQueueItem,
  type LessonQueueResponse,
  type LessonOrderMode,
  type LessonQueueSourceDto,
  type LessonSessionPhase,
  type LocalizedTextDto,
  type ListeningPlaybackEvidenceDto,
  type SrsStateSummaryDto,
  type StartLessonSessionResponse,
  type UpdateLessonSessionProgressResponse,
  type TranslationDisplayMode,
  getContentLocalesForDisplayMode,
  isLessonOrderMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { hasCompletedListeningPlayback } from "../audio/listening-playback";
import { OverridesService } from "../overrides/overrides.service";
import { LessonsRepository } from "./lessons.repository";
import {
  type CourseLessonEligibilityRecord,
  type DeckLessonEligibilityRecord,
  type LessonEligibilityItemRecord,
  type LessonCardRecord,
  type LessonItemRecord,
  type LessonSessionRecord,
  type SrsSystemRecord,
  type UserItemProgressRecord,
} from "./lessons.types";

const DEFAULT_DAILY_LESSON_LIMIT = 10;
const DEFAULT_LESSON_BATCH_LIMIT = 5;
const MAX_LESSON_ANSWER_LENGTH = 500;

@Injectable()
export class LessonsService {
  constructor(
    @Inject(LessonsRepository) private readonly lessonsRepository: LessonsRepository,
    @Inject(OverridesService) private readonly overridesService: OverridesService,
  ) {}

  async getQueue(user: CurrentUserDto, deckIdValue?: unknown): Promise<LessonQueueResponse> {
    const deckId = parseOptionalDeckId(deckIdValue);
    const { availableItems, displayMode, remainingToday, source } = await this.getAvailableMetadata(
      user,
      new Date(),
      deckId,
    );
    const teachingItems = await this.hydrateAvailableItems(user.id, availableItems.slice(0, remainingToday));
    const selectableItems = teachingItems.map((item) => toLessonQueueItem(item.item, item.unlockedBy, displayMode));
    const batchLimit = getLessonBatchSize(user);
    const orderMode = getLessonOrderMode(user);
    const suggestedItems = orderLessonItems(
      selectableItems,
      orderMode,
      (entry) => entry.item.itemType,
    );

    return {
      items: suggestedItems.slice(0, batchLimit),
      availableItems: selectableItems,
      batchLimit,
      remainingToday,
      orderMode,
      source,
    };
  }

  async startSession(user: CurrentUserDto, body?: unknown): Promise<StartLessonSessionResponse> {
    const request = parseStartLessonRequest(body);
    const now = new Date();
    const { availableItems, remainingToday } = await this.getAvailableItems(
      user,
      now,
      request.deckId,
    );
    const batchLimit = getLessonBatchSize(user);
    const requestedItemIds =
      request.itemIds ??
      orderLessonItems(
        availableItems.slice(0, remainingToday),
        getLessonOrderMode(user),
        (entry) => entry.item.itemType,
      )
        .slice(0, batchLimit)
        .map((entry) => entry.item.id);
    const maxBatchSize = Math.min(batchLimit, remainingToday);

    if (requestedItemIds.length === 0) {
      throw new BadRequestException("No lesson items are currently available.");
    }

    if (requestedItemIds.length > maxBatchSize) {
      throw new BadRequestException("itemIds exceed the current lesson batch limit.");
    }

    const availableItemIds = new Set(availableItems.map((entry) => entry.item.id));
    if (requestedItemIds.some((itemId) => !availableItemIds.has(itemId))) {
      throw new BadRequestException("itemIds contain an unavailable lesson item.");
    }

    const existingSession = await this.lessonsRepository.findLatestActiveLessonSession(user.id);
    const session = await this.lessonsRepository.createLessonSession({
      userId: user.id,
      now,
      deckId: request.deckId,
      itemIds: requestedItemIds,
    });

    if (existingSession !== null) {
      await this.lessonsRepository.abandonLessonSession(user.id, existingSession.id, now);
    }

    return {
      session: toLessonSessionDto(session),
    };
  }

  async getActiveSession(user: CurrentUserDto): Promise<ActiveLessonSessionResponse> {
    const session = await this.lessonsRepository.findLatestActiveLessonSession(user.id);

    if (session === null || session.itemIds.length === 0) {
      return {
        session: null,
        items: [],
        source: null,
        completedItemCount: 0,
        createdSrsStateCount: 0,
      };
    }

    const { availableItems, displayMode, progress, source } = await this.getAvailableItems(
      user,
      new Date(),
      session.deckId,
      true,
    );
    const availableById = new Map(availableItems.map((entry) => [entry.item.id, entry]));
    const remainingEntries = session.itemIds.flatMap((itemId) => {
      const entry = availableById.get(itemId);
      return entry === undefined ? [] : [entry];
    });

    if (remainingEntries.length === 0) {
      return {
        session: null,
        items: [],
        source: null,
        completedItemCount: 0,
        createdSrsStateCount: 0,
      };
    }

    const currentItemId = remainingEntries.some((entry) => entry.item.id === session.currentItemId)
      ? session.currentItemId
      : remainingEntries[0]!.item.id;
    const normalizedSession =
      currentItemId === session.currentItemId
        ? session
        : ((await this.lessonsRepository.updateLessonSessionProgress({
            userId: user.id,
            sessionId: session.id,
            currentItemId,
            phase: session.phase,
          })) ?? session);

    const sessionProgress = progress.filter(
      (record) =>
        session.itemIds.includes(record.learningItemId) && record.createdAt >= session.startedAt,
    );

    return {
      session: toLessonSessionDto(normalizedSession),
      items: remainingEntries.map((entry) =>
        toLessonQueueItem(entry.item, entry.unlockedBy, displayMode),
      ),
      source,
      completedItemCount: new Set(sessionProgress.map((record) => record.learningItemId)).size,
      createdSrsStateCount: sessionProgress.length,
    };
  }

  async updateProgress(
    sessionId: string,
    user: CurrentUserDto,
    body: unknown,
  ): Promise<UpdateLessonSessionProgressResponse> {
    const request = parseLessonSessionProgress(body);
    const session = await this.lessonsRepository.findActiveLessonSession(user.id, sessionId);

    if (session === null) {
      throw new NotFoundException("Active lesson session not found.");
    }

    if (!session.itemIds.includes(request.currentItemId)) {
      throw new BadRequestException("currentItemId is not part of this lesson session.");
    }

    const updated = await this.lessonsRepository.updateLessonSessionProgress({
      userId: user.id,
      sessionId,
      currentItemId: request.currentItemId,
      phase: request.phase,
    });

    if (updated === null) {
      throw new NotFoundException("Active lesson session not found.");
    }

    return { session: toLessonSessionDto(updated) };
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

    if (session.itemIds.length > 0 && !session.itemIds.includes(request.itemId)) {
      throw new BadRequestException("Lesson item is not part of this session.");
    }

    const now = new Date();
    const { availableItems, displayMode } = await this.getAvailableItems(
      user,
      now,
      session.deckId,
      true,
    );
    const lessonItem = availableItems.find((candidate) => candidate.item.id === request.itemId);

    if (lessonItem === undefined) {
      throw new BadRequestException("Lesson item is not currently available.");
    }

    assertCompleteQuizAnswers(lessonItem.item, request.answers);
    const answers = await Promise.all(
      request.answers.map(async (answer) => {
        const card = lessonItem.item.cards.find((candidate) => candidate.id === answer.cardId);

        if (card === undefined) {
          throw new BadRequestException("Lesson answer references an unknown card.");
        }

        assertListeningPlayback(card, answer.listeningEvidence);

        const validation = await this.overridesService.validateAnswerForUser({
          userId: user.id,
          cardId: card.id,
          answerKind: card.answerType,
          answer: answer.answer,
        });

        return {
          cardId: card.id,
          answerType: card.answerType,
          accepted: validation.accepted,
          result: validation.result,
          normalizedAnswer: validation.normalizedAnswer,
          expected: getExpectedAnswers(card, displayMode),
          diagnostic: toAnswerDiagnostic(validation.relatedAnswer),
        };
      }),
    );

    if (answers.some((answer) => !answer.accepted)) {
      return {
        itemId: lessonItem.item.id,
        passed: false,
        createdSrsStateCount: 0,
        answers,
        cards: [],
      };
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
      passed: true,
      createdSrsStateCount: result.createdSrsStateCount,
      answers,
      cards: lessonItem.item.cards.map((card) => ({
        cardId: card.id,
        srs,
      })),
    };
  }

  async checkAnswer(
    sessionId: string,
    user: CurrentUserDto,
    body: unknown,
  ): Promise<CheckLessonAnswerResponse> {
    const request = parseCheckLessonAnswerRequest(body);
    const session = await this.lessonsRepository.findActiveLessonSession(user.id, sessionId);

    if (session === null) {
      throw new NotFoundException("Active lesson session not found.");
    }

    if (session.itemIds.length > 0 && !session.itemIds.includes(request.itemId)) {
      throw new BadRequestException("Lesson item is not part of this session.");
    }

    const { availableItems, displayMode } = await this.getAvailableItems(
      user,
      new Date(),
      session.deckId,
      true,
    );
    const lessonItem = availableItems.find((candidate) => candidate.item.id === request.itemId);

    if (lessonItem === undefined) {
      throw new BadRequestException("Lesson item is not currently available.");
    }

    const card = lessonItem.item.cards.find((candidate) => candidate.id === request.cardId);

    if (card === undefined) {
      throw new BadRequestException("Lesson answer references an unknown card.");
    }

    if (card.answerType !== request.answerType) {
      throw new BadRequestException(`answerType must be ${card.answerType} for card ${card.id}.`);
    }

    assertListeningPlayback(card, request.listeningEvidence);

    const validation = await this.overridesService.validateAnswerForUser({
      userId: user.id,
      cardId: card.id,
      answerKind: card.answerType,
      answer: request.answer,
    });

    return {
      cardId: card.id,
      answerType: card.answerType,
      accepted: validation.accepted,
      result: validation.result,
      normalizedAnswer: validation.normalizedAnswer,
      expected: getExpectedAnswers(card, displayMode),
      diagnostic: toAnswerDiagnostic(validation.relatedAnswer),
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

  async abandonSession(
    sessionId: string,
    user: CurrentUserDto,
  ): Promise<FinishLessonSessionResponse> {
    const session = await this.lessonsRepository.abandonLessonSession(
      user.id,
      sessionId,
      new Date(),
    );

    if (session === null) {
      throw new NotFoundException("Active lesson session not found.");
    }

    return { session: toLessonSessionDto(session) };
  }

  private async getAvailableItems(
    user: CurrentUserDto,
    now: Date,
    deckId: string | null,
    allowArchivedDeck = false,
  ) {
    const metadata = await this.getAvailableMetadata(user, now, deckId, allowArchivedDeck);
    return { ...metadata, availableItems: await this.hydrateAvailableItems(user.id, metadata.availableItems) };
  }

  private async hydrateAvailableItems(userId: string, entries: readonly AvailableLessonMetadata[]): Promise<readonly AvailableLessonItem[]> {
    const ids = entries.flatMap((entry) => [entry.item.id, ...entry.unlockedBy.map((item) => item.id)]);
    const items = await this.lessonsRepository.loadLessonItems(userId, ids);
    const requireItem = (id: string): LessonItemRecord => {
      const item = items.get(id);
      if (item === undefined || item.cards.length === 0) throw new BadRequestException("Lesson content changed. Reload the lesson queue.");
      return item;
    };
    return entries.map((entry) => ({ ...entry, item: requireItem(entry.item.id), unlockedBy: entry.unlockedBy.map((item) => requireItem(item.id)) }));
  }

  private async getAvailableMetadata(
    user: CurrentUserDto,
    now: Date,
    deckId: string | null,
    allowArchivedDeck = false,
  ): Promise<{
    readonly availableItems: readonly AvailableLessonMetadata[];
    readonly displayMode: TranslationDisplayMode;
    readonly progress: readonly UserItemProgressRecord[];
    readonly remainingToday: number;
    readonly source: LessonQueueSourceDto;
  }> {
    const progressPromise = this.lessonsRepository.listUserProgress(user.id);
    const displayMode = user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;

    if (deckId !== null) {
      const [deck, progress] = await Promise.all([
        this.lessonsRepository.findDeckEligibility(user.id, deckId),
        progressPromise,
      ]);

      if (deck === null) {
        throw new NotFoundException("Deck not found.");
      }

      if (deck.status !== "active" && !(allowArchivedDeck && deck.status === "archived")) {
        throw new NotFoundException("Deck not found.");
      }

      const remainingToday = getRemainingDailyLessons(user, progress, now);
      const source: LessonQueueSourceDto = { kind: "deck", deckId: deck.id, title: deck.title };

      if (remainingToday <= 0 || deck.items.length === 0) {
        return { availableItems: [], displayMode, progress, remainingToday, source };
      }

      const prerequisiteCardIds = await this.getExternalPrerequisiteCardIds(
        deck.items.map((entry) => entry.item),
      );

      return {
        availableItems: findAvailableDeckItems(deck, progress, prerequisiteCardIds),
        displayMode,
        progress,
        remainingToday,
        source,
      };
    }

    const progress = await progressPromise;
    const remainingToday = getRemainingDailyLessons(user, progress, now);
    const source: LessonQueueSourceDto = { kind: "course" };

    if (remainingToday <= 0) {
      return { availableItems: [], displayMode, progress, remainingToday, source };
    }

    const courseItems = await this.lessonsRepository.listCourseEligibility(user.id);
    if (courseItems.length === 0) {
      return { availableItems: [], displayMode, progress, remainingToday, source };
    }

    const prerequisiteCardIds = await this.getExternalPrerequisiteCardIds(
      courseItems.map((entry) => entry.item),
    );
    const availableItems = findAvailableCourseItems(courseItems, progress, prerequisiteCardIds);

    return { availableItems, displayMode, progress, remainingToday, source };
  }

  private async getExternalPrerequisiteCardIds(
    items: readonly LessonEligibilityItemRecord[],
  ): Promise<ReadonlyMap<string, readonly string[]>> {
    const sourceItemIds = new Set(items.map((item) => item.id));
    const externalItemIds = [
      ...new Set(
        items.flatMap((item) =>
          item.dependencies
            .map((dependency) => dependency.prerequisiteItemId)
            .filter((itemId) => !sourceItemIds.has(itemId)),
        ),
      ),
    ];

    return externalItemIds.length === 0
      ? new Map()
      : this.lessonsRepository.listPrerequisiteCardIds(externalItemIds);
  }
}

type AvailableLessonItem = {
  readonly item: LessonItemRecord;
  readonly unlockedBy: readonly LessonItemRecord[];
  readonly courseId: string;
  readonly courseLevelNumber: number;
  readonly sortOrder: number;
};

type AvailableLessonMetadata = Omit<AvailableLessonItem, "item" | "unlockedBy"> & {
  readonly item: LessonEligibilityItemRecord;
  readonly unlockedBy: readonly LessonEligibilityItemRecord[];
};

function findAvailableDeckItems(
  deck: DeckLessonEligibilityRecord,
  progress: readonly UserItemProgressRecord[],
  prerequisiteCardIds: ReadonlyMap<string, readonly string[]>,
): readonly AvailableLessonMetadata[] {
  const progressByItem = groupProgressByItem(progress);
  const itemById = new Map(deck.items.map((entry) => [entry.item.id, entry.item]));

  return deck.items
    .flatMap((entry) => {
      if (!hasLessonCards(entry.item) || isItemStarted(entry.item, progressByItem)) {
        return [];
      }

      const unlockedBy = getSatisfiedPrerequisites(
        entry.item,
        progressByItem,
        itemById,
        prerequisiteCardIds,
      );

      return unlockedBy === null
        ? []
        : [
            {
              item: entry.item,
              unlockedBy,
              courseId: `deck:${deck.id}`,
              courseLevelNumber: 0,
              sortOrder: entry.sortOrder,
            },
          ];
    })
    .sort(
      (left, right) =>
        left.sortOrder - right.sortOrder || left.item.id.localeCompare(right.item.id),
    );
}

function findAvailableCourseItems(
  courseItems: readonly CourseLessonEligibilityRecord[],
  progress: readonly UserItemProgressRecord[],
  prerequisiteCardIds: ReadonlyMap<string, readonly string[]>,
): readonly AvailableLessonMetadata[] {
  const progressByItem = groupProgressByItem(progress);
  const itemById = new Map(courseItems.map((entry) => [entry.item.id, entry.item]));
  const groupedByCourse = groupCourseItems(courseItems);
  const available: AvailableLessonMetadata[] = [];

  for (const [courseId, entries] of groupedByCourse) {
    const firstOpenLevel = findFirstOpenLevel(entries, progressByItem);

    if (firstOpenLevel === null) {
      continue;
    }

    for (const entry of firstOpenLevel) {
      if (!hasLessonCards(entry.item) || isItemStarted(entry.item, progressByItem)) {
        continue;
      }

      const unlockedBy = getSatisfiedPrerequisites(
        entry.item,
        progressByItem,
        itemById,
        prerequisiteCardIds,
      );

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
  courseItems: readonly CourseLessonEligibilityRecord[],
): Map<string, readonly CourseLessonEligibilityRecord[]> {
  const grouped = new Map<string, CourseLessonEligibilityRecord[]>();

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
  courseItems: readonly CourseLessonEligibilityRecord[],
  progressByItem: Map<string, ReadonlyMap<string, number>>,
): readonly CourseLessonEligibilityRecord[] | null {
  const levels = new Map<number, CourseLessonEligibilityRecord[]>();

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
): Map<string, ReadonlyMap<string, number>> {
  const grouped = new Map<string, Map<string, number>>();

  for (const record of progress) {
    const existing = grouped.get(record.learningItemId) ?? new Map<string, number>();
    existing.set(record.learningCardId, record.stageIndex);
    grouped.set(record.learningItemId, existing);
  }

  return grouped;
}

function hasLessonCards(item: LessonEligibilityItemRecord): boolean {
  return item.cards.length > 0;
}

function isItemStarted(
  item: LessonEligibilityItemRecord,
  progressByItem: Map<string, ReadonlyMap<string, number>>,
): boolean {
  const progress = progressByItem.get(item.id);

  return item.cards.some((card) => progress?.has(card.id));
}

function getSatisfiedPrerequisites(
  item: LessonEligibilityItemRecord,
  progressByItem: Map<string, ReadonlyMap<string, number>>,
  itemById: Map<string, LessonEligibilityItemRecord>,
  prerequisiteCardIds: ReadonlyMap<string, readonly string[]>,
): readonly LessonEligibilityItemRecord[] | null {
  const unlockedBy: LessonEligibilityItemRecord[] = [];

  for (const dependency of item.dependencies) {
    const prerequisite = itemById.get(dependency.prerequisiteItemId);
    const progress = progressByItem.get(dependency.prerequisiteItemId);
    const cardIds =
      prerequisite?.cards.map((card) => card.id) ??
      prerequisiteCardIds.get(dependency.prerequisiteItemId) ??
      [];
    const satisfied =
      cardIds.length > 0 &&
      cardIds.every((cardId) => (progress?.get(cardId) ?? -1) >= dependency.requiredStage);

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

function getLessonBatchSize(user: CurrentUserDto): number {
  const batchSize = user.settings.lessonBatchSize;

  return batchSize !== undefined &&
    Number.isInteger(batchSize) &&
    batchSize >= 1 &&
    batchSize <= DEFAULT_LESSON_BATCH_LIMIT
    ? batchSize
    : DEFAULT_LESSON_BATCH_LIMIT;
}

function getLessonOrderMode(user: CurrentUserDto): LessonOrderMode {
  return isLessonOrderMode(user.settings.lessonOrderMode)
    ? user.settings.lessonOrderMode
    : "course";
}

function orderLessonItems<T>(
  items: readonly T[],
  mode: LessonOrderMode,
  getItemType: (item: T) => string,
): readonly T[] {
  if (mode === "course" || items.length < 2) {
    return [...items];
  }

  const groups = new Map<string, T[]>();

  for (const item of items) {
    const itemType = getItemType(item);
    const group = groups.get(itemType) ?? [];
    group.push(item);
    groups.set(itemType, group);
  }

  const orderedItems: T[] = [];
  let groupIndex = 0;

  while (orderedItems.length < items.length) {
    for (const group of groups.values()) {
      const item = group[groupIndex];

      if (item !== undefined) {
        orderedItems.push(item);
      }
    }

    groupIndex += 1;
  }

  return orderedItems;
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

function parseStartLessonRequest(body: unknown): {
  readonly deckId: string | null;
  readonly itemIds: readonly string[] | null;
} {
  if (body === undefined || body === null) {
    return { deckId: null, itemIds: null };
  }

  if (typeof body !== "object" || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const deckId = parseOptionalDeckId(record.deckId);

  if (record.itemIds === undefined) {
    return { deckId, itemIds: null };
  }

  if (!Array.isArray(record.itemIds) || record.itemIds.length === 0) {
    throw new BadRequestException("itemIds must be a non-empty array.");
  }

  const itemIds = record.itemIds.map((value, index) =>
    parseRequiredString(value, `itemIds[${index}]`, 200),
  );

  if (new Set(itemIds).size !== itemIds.length) {
    throw new BadRequestException("itemIds must not contain duplicates.");
  }

  return { deckId, itemIds };
}

function parseLessonSessionProgress(body: unknown): {
  readonly currentItemId: string;
  readonly phase: LessonSessionPhase;
} {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const currentItemId = parseRequiredString(record.currentItemId, "currentItemId", 200);

  if (
    record.phase !== "meaning" &&
    record.phase !== "reading" &&
    record.phase !== "context" &&
    record.phase !== "quiz"
  ) {
    throw new BadRequestException("phase must be meaning, reading, context, or quiz.");
  }

  return { currentItemId, phase: record.phase };
}

function parseOptionalDeckId(value: unknown): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException("deckId must be a non-empty string.");
  }

  const deckId = value.trim();

  if (deckId.length > 200) {
    throw new BadRequestException("deckId is too long.");
  }

  return deckId;
}

function parseCompleteLessonItemRequest(body: unknown): CompleteLessonItemRequestDto {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const itemId = record.itemId;

  if (typeof itemId !== "string" || itemId.trim() === "") {
    throw new BadRequestException("itemId must be a non-empty string.");
  }

  if (!Array.isArray(record.answers) || record.answers.length === 0) {
    throw new BadRequestException("answers must be a non-empty array.");
  }

  const answers = record.answers.map((answer, index) => parseLessonAnswer(answer, index));
  const cardIds = new Set(answers.map((answer) => answer.cardId));

  if (cardIds.size !== answers.length) {
    throw new BadRequestException("answers must contain each card only once.");
  }

  return { itemId: itemId.trim(), answers };
}

function parseCheckLessonAnswerRequest(body: unknown): CheckLessonAnswerRequestDto {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  const record = body as Record<string, unknown>;
  const itemId = parseRequiredString(record.itemId, "itemId", 200);
  const cardId = parseRequiredString(record.cardId, "cardId", 200);
  const answer = parseRequiredString(record.answer, "answer", MAX_LESSON_ANSWER_LENGTH);

  if (record.answerType !== "meaning" && record.answerType !== "reading") {
    throw new BadRequestException("answerType must be meaning or reading.");
  }

  return {
    itemId,
    cardId,
    answerType: record.answerType,
    answer,
    listeningEvidence: parseListeningEvidence(record.listeningEvidence, "listeningEvidence"),
  };
}

function parseLessonAnswer(
  value: unknown,
  index: number,
): CompleteLessonItemRequestDto["answers"][number] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`answers[${index}] must be a JSON object.`);
  }

  const record = value as Record<string, unknown>;
  const cardId = parseRequiredString(record.cardId, `answers[${index}].cardId`, 200);
  const answer = parseRequiredString(
    record.answer,
    `answers[${index}].answer`,
    MAX_LESSON_ANSWER_LENGTH,
  );

  if (record.answerType !== "meaning" && record.answerType !== "reading") {
    throw new BadRequestException(`answers[${index}].answerType must be meaning or reading.`);
  }

  return {
    cardId,
    answerType: record.answerType,
    answer,
    listeningEvidence: parseListeningEvidence(
      record.listeningEvidence,
      `answers[${index}].listeningEvidence`,
    ),
  };
}

function parseListeningEvidence(
  value: unknown,
  label: string,
): ListeningPlaybackEvidenceDto | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a JSON object.`);
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.completed !== "boolean" ||
    typeof record.playCount !== "number" ||
    !Number.isInteger(record.playCount) ||
    record.playCount < 0
  ) {
    throw new BadRequestException(`${label} must contain completed and a non-negative playCount.`);
  }

  return { completed: record.completed, playCount: record.playCount };
}

function assertListeningPlayback(
  card: LessonCardRecord,
  evidence: ListeningPlaybackEvidenceDto | undefined,
): void {
  if (!hasCompletedListeningPlayback(card.promptType, card.audio, evidence)) {
    throw new BadRequestException(
      "Listening audio must finish successfully before this answer can be graded.",
    );
  }
}

function parseRequiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException(`${label} must be a non-empty string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > maxLength) {
    throw new BadRequestException(`${label} is too long.`);
  }

  return trimmed;
}

function assertCompleteQuizAnswers(
  item: LessonItemRecord,
  answers: CompleteLessonItemRequestDto["answers"],
): void {
  if (answers.length !== item.cards.length) {
    throw new BadRequestException("answers must contain exactly one answer for every lesson card.");
  }

  const cardById = new Map(item.cards.map((card) => [card.id, card]));

  for (const answer of answers) {
    const card = cardById.get(answer.cardId);

    if (card === undefined) {
      throw new BadRequestException("Lesson answer references an unknown card.");
    }

    if (card.answerType !== answer.answerType) {
      throw new BadRequestException(`answerType must be ${card.answerType} for card ${card.id}.`);
    }
  }
}

function getExpectedAnswers(
  card: LessonCardRecord,
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const answers =
    card.answerType === "reading"
      ? card.answers
      : card.answers.filter((answer) =>
          getContentLocalesForDisplayMode(displayMode).includes(answer.locale),
        );

  return answers.map((answer) => ({
    locale: answer.locale,
    text: answer.text,
    isPrimary: answer.isPrimary,
    sourceKind: answer.sourceKind,
  }));
}

function toAnswerDiagnostic(relatedAnswer?: string | null) {
  return relatedAnswer === undefined || relatedAnswer === null
    ? null
    : ({ kind: "alternative-reading", matchedAnswer: relatedAnswer } as const);
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
    mnemonics: item.mnemonics,
    hints: item.hints,
    exampleSentences: item.exampleSentences,
  };
}

function toItemSummary(item: LessonItemRecord, displayMode: TranslationDisplayMode): ItemSummary {
  return {
    id: item.id,
    itemType: item.itemType,
    slug: `${item.itemType}:${item.target.japanese}`,
    japanese: item.target.japanese,
    reading: item.target.reading,
    translations: toTranslationBundle(
      item.target.translations,
      displayMode,
      item.cards.filter((card) => card.answerType === "meaning").flatMap((card) => card.answers),
    ),
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
    translations: toTranslationBundle(
      item.target.translations,
      displayMode,
      item.cards.filter((card) => card.answerType === "meaning").flatMap((card) => card.answers),
    ),
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
    audio: card.audio ?? null,
    sortOrder: card.sortOrder,
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
    deckId: session.deckId,
    itemIds: session.itemIds,
    currentItemId: session.currentItemId,
    phase: session.phase,
  };
}
