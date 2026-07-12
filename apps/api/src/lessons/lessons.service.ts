import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type ActiveLessonSessionResponse,
  type BilingualTextDto,
  type CompleteLessonItemRequestDto,
  type CompleteLessonItemResponse,
  type FinishLessonSessionResponse,
  type ItemSummary,
  type LearningCardDto,
  type LessonQueueItem,
  type LessonQueueResponse,
  type LessonQueueSourceDto,
  type LessonSessionPhase,
  type LocalizedTextDto,
  type SrsStateSummaryDto,
  type StartLessonSessionResponse,
  type UpdateLessonSessionProgressResponse,
  type TranslationBundleDto,
  type TranslationDisplayMode,
  getContentLocalesForDisplayMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { OverridesService } from "../overrides/overrides.service";
import { LessonsRepository } from "./lessons.repository";
import {
  type CourseLessonItemRecord,
  type DeckLessonRecord,
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
    const { availableItems, displayMode, remainingToday, source } = await this.getAvailableItems(
      user,
      new Date(),
      deckId,
    );
    const selectableItems = availableItems
      .slice(0, remainingToday)
      .map((item) => toLessonQueueItem(item.item, item.unlockedBy, displayMode));

    return {
      items: selectableItems.slice(0, DEFAULT_LESSON_BATCH_LIMIT),
      availableItems: selectableItems,
      batchLimit: DEFAULT_LESSON_BATCH_LIMIT,
      remainingToday,
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
    const requestedItemIds =
      request.itemIds ??
      availableItems
        .slice(0, Math.min(DEFAULT_LESSON_BATCH_LIMIT, remainingToday))
        .map((entry) => entry.item.id);
    const maxBatchSize = Math.min(DEFAULT_LESSON_BATCH_LIMIT, remainingToday);

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
      await this.lessonsRepository.finishLessonSession(user.id, existingSession.id, now);
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
    deckId: string | null,
    allowArchivedDeck = false,
  ): Promise<{
    readonly availableItems: readonly AvailableLessonItem[];
    readonly displayMode: TranslationDisplayMode;
    readonly progress: readonly UserItemProgressRecord[];
    readonly remainingToday: number;
    readonly source: LessonQueueSourceDto;
  }> {
    const progressPromise = this.lessonsRepository.listUserProgress(user.id);
    const displayMode = user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;

    if (deckId !== null) {
      const [deck, progress] = await Promise.all([
        this.lessonsRepository.findDeckLesson(user.id, deckId),
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

      return {
        availableItems: findAvailableDeckItems(deck, progress),
        displayMode,
        progress,
        remainingToday,
        source,
      };
    }

    const [courseItems, progress] = await Promise.all([
      this.lessonsRepository.listCourseLessonItems(user.id),
      progressPromise,
    ]);
    const remainingToday = getRemainingDailyLessons(user, progress, now);
    const source: LessonQueueSourceDto = { kind: "course" };

    if (remainingToday <= 0 || courseItems.length === 0) {
      return { availableItems: [], displayMode, progress, remainingToday, source };
    }

    const availableItems = findAvailableCourseItems(courseItems, progress);

    return { availableItems, displayMode, progress, remainingToday, source };
  }
}

type AvailableLessonItem = {
  readonly item: LessonItemRecord;
  readonly unlockedBy: readonly LessonItemRecord[];
  readonly courseId: string;
  readonly courseLevelNumber: number;
  readonly sortOrder: number;
};

function findAvailableDeckItems(
  deck: DeckLessonRecord,
  progress: readonly UserItemProgressRecord[],
): readonly AvailableLessonItem[] {
  const progressByItem = groupProgressByItem(progress);
  const itemById = new Map(deck.items.map((entry) => [entry.item.id, entry.item]));

  return deck.items
    .flatMap((entry) => {
      if (!hasLessonCards(entry.item) || isItemStarted(entry.item, progressByItem)) {
        return [];
      }

      const unlockedBy = getSatisfiedPrerequisites(entry.item, progressByItem, itemById);

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

  return { cardId, answerType: record.answerType, answer };
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
    deckId: session.deckId,
    itemIds: session.itemIds,
    currentItemId: session.currentItemId,
    phase: session.phase,
  };
}
