import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import {
  calculateNextReview,
  type ReviewResult as SrsReviewResult,
  type SrsStage,
  type UserSrsStateSnapshot,
} from "@kanji-srs/srs";
import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  getContentLocalesForDisplayMode,
  type LocalizedTextDto,
  type PracticeAnswerRequest,
  type PracticeAnswerResponse,
  type PracticeQueueResponse,
  type PracticeSource,
  type ReviewAnswerResultType,
  type ReviewOrderMode,
  type ReviewQueueItem,
  type SrsStateSummaryDto,
  isReviewOrderMode,
} from "@kanji-srs/shared";

import { type CurrentUserDto } from "../auth/auth.types";
import { OverridesService } from "../overrides/overrides.service";
import { ReviewsRepository } from "./reviews.repository";
import {
  type FinishReviewSessionResponse,
  type ParsedReviewAnswerRequest,
  type ReviewAnswerRequestBody,
  type ReviewAnswerTargetRecord,
  type ReviewQueueRecord,
  type ReviewQueueResponse,
  type ReviewSrsStateRecord,
  type StartReviewSessionResponse,
  type SubmitReviewAnswerResponse,
} from "./reviews.types";

const DEFAULT_REVIEW_QUEUE_LIMIT = 100;
const MAX_REVIEW_ANSWER_LENGTH = 500;
const PRACTICE_QUEUE_LIMIT = 20;
const RECENT_LESSON_DAYS = 14;
const RECENT_MISTAKE_DAYS = 30;

@Injectable()
export class ReviewsService {
  constructor(
    @Inject(ReviewsRepository) private readonly reviewsRepository: ReviewsRepository,
    @Inject(OverridesService) private readonly overridesService: OverridesService,
  ) {}

  async getQueue(user: CurrentUserDto): Promise<ReviewQueueResponse> {
    const now = new Date();
    const limit = resolveQueueLimit(user.settings.reviewBudget);
    const records = await this.reviewsRepository.listDueReviewCards(user.id, now, limit);
    const orderMode = getReviewOrderMode(user);
    const orderedRecords = orderReviewRecords(
      records,
      orderMode,
      `${user.id}:${getLocalDateKey(now, user.settings.timezone)}`,
    );

    return {
      items: orderedRecords.map(toReviewQueueItem),
      orderMode,
    };
  }

  async startSession(user: CurrentUserDto): Promise<StartReviewSessionResponse> {
    const session = await this.reviewsRepository.createReviewSession(user.id, new Date());

    return {
      session: {
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        mode: session.mode,
      },
    };
  }

  async getPracticeQueue(
    user: CurrentUserDto,
    sourceValue: unknown,
  ): Promise<PracticeQueueResponse> {
    const source = parsePracticeSource(sourceValue);
    const now = new Date();
    const since =
      source === "recent-lessons"
        ? addDays(now, -RECENT_LESSON_DAYS)
        : source === "recent-mistakes"
          ? addDays(now, -RECENT_MISTAKE_DAYS)
          : new Date(0);
    const records = await this.reviewsRepository.listPracticeCards(
      user.id,
      source,
      since,
      PRACTICE_QUEUE_LIMIT,
    );

    return {
      source,
      items: records.map(toReviewQueueItem),
    };
  }

  async submitPracticeAnswer(user: CurrentUserDto, body: unknown): Promise<PracticeAnswerResponse> {
    const request = parsePracticeAnswerRequest(body);
    const target = await this.reviewsRepository.findPracticeCard(user.id, request.cardId);

    if (target === null) {
      throw new NotFoundException("Practice card not found.");
    }

    if (target.card.answerType !== request.answerType) {
      throw new BadRequestException(`answerType must be ${target.card.answerType} for this card.`);
    }

    const validation = await this.overridesService.validateAnswerForUser({
      userId: user.id,
      cardId: request.cardId,
      answerKind: request.answerType,
      answer: request.answer,
    });
    const displayMode = user.settings.translationDisplayMode ?? DEFAULT_TRANSLATION_DISPLAY_MODE;

    return {
      cardId: target.card.id,
      accepted: validation.accepted,
      result: validation.result,
      normalizedAnswer: validation.normalizedAnswer,
      matchedAnswer: validation.matchedAnswer,
      retry: validation.relatedAnswer !== undefined && validation.relatedAnswer !== null,
      feedback: {
        message: getFeedbackMessage(validation.result, validation.relatedAnswer),
        expected: toExpectedAnswersForDisplay(target, displayMode),
        blockedReason: getBlockedReason(target, validation.matchedAnswer),
        diagnostic: toAnswerDiagnostic(validation.relatedAnswer),
      },
    };
  }

  async submitAnswer(
    sessionId: string,
    user: CurrentUserDto,
    body: unknown,
  ): Promise<SubmitReviewAnswerResponse> {
    const request = parseReviewAnswerRequest(body);
    const answeredAt = new Date();
    const target = await this.reviewsRepository.findAnswerTarget(
      user.id,
      sessionId,
      request.cardId,
      answeredAt,
    );

    if (target === null) {
      throw new NotFoundException("Review session or card not found.");
    }

    if (target.card.answerType !== request.answerType) {
      throw new BadRequestException(`answerType must be ${target.card.answerType} for this card.`);
    }

    const validation =
      request.revealRequested || request.manualIgnore
        ? null
        : await this.overridesService.validateAnswerForUser({
            userId: user.id,
            cardId: request.cardId,
            answerKind: request.answerType,
            answer: request.answer,
          });

    if (validation?.relatedAnswer !== undefined && validation.relatedAnswer !== null) {
      const srs = toSrsSummary(target.state, target.stages);

      return {
        cardId: target.card.id,
        accepted: false,
        result: "wrong",
        normalizedAnswer: validation.normalizedAnswer,
        matchedAnswer: null,
        retry: true,
        feedback: {
          message: getFeedbackMessage("wrong", validation.relatedAnswer),
          expected: toExpectedAnswers(target),
          blockedReason: null,
          diagnostic: toAnswerDiagnostic(validation.relatedAnswer),
        },
        previousSrs: srs,
        nextSrs: srs,
      };
    }

    const responseResult = getResponseResult(request, validation?.result ?? "wrong");
    const recordedResult = getSrsResult(responseResult);
    const normalizedAnswer =
      validation?.normalizedAnswer ?? normalizeAnswer(request.answer, request.answerType);
    const scheduling = calculateNextReview({
      state: toSrsSnapshot(target.state),
      result: recordedResult,
      now: answeredAt,
      stageConfig: {
        stages: target.stages,
        rules: {
          typoBehavior: user.settings.strictMode ? "stay" : "advance",
        },
      },
    });

    await this.reviewsRepository.recordReviewAnswer({
      userId: user.id,
      sessionId: target.session.id,
      stateId: target.state.id,
      cardId: target.card.id,
      answerText: request.answer,
      normalizedAnswer,
      answeredAt,
      recordedResult,
      responseResult,
      previousStageIndex: scheduling.previousStage.stageIndex,
      nextStageIndex: scheduling.nextStage.stageIndex,
      nextState: {
        stageIndex: scheduling.nextState.stageIndex,
        availableAt: scheduling.nextState.availableAt,
        burnedAt: scheduling.nextState.burnedAt,
        resurrectedAt: scheduling.nextState.resurrectedAt,
        wrongCount: scheduling.nextState.wrongCount,
        correctStreak: scheduling.nextState.correctStreak,
        lastReviewedAt: scheduling.nextState.lastReviewedAt,
      },
      details: {
        responseResult,
        validation:
          validation === null
            ? null
            : {
                result: validation.result,
                reason: validation.reason,
                matchedAnswer: validation.matchedAnswer,
                matchSource: validation.matchSource,
                distance: validation.distance,
                relatedAnswer: validation.relatedAnswer ?? null,
              },
        scheduling: {
          action: scheduling.details.action,
          penaltyApplied: scheduling.penaltyApplied,
          nextAvailableAt: scheduling.nextAvailableAt?.toISOString() ?? null,
        },
      },
    });

    return {
      cardId: target.card.id,
      accepted: responseResult === "correct" || responseResult === "typo",
      result: responseResult,
      normalizedAnswer,
      matchedAnswer: validation?.matchedAnswer ?? null,
      retry: false,
      feedback: {
        message: getFeedbackMessage(responseResult, validation?.relatedAnswer),
        expected: toExpectedAnswers(target),
        blockedReason: getBlockedReason(target, validation?.matchedAnswer ?? null),
        diagnostic: toAnswerDiagnostic(validation?.relatedAnswer),
      },
      previousSrs: toSrsSummary(target.state, target.stages),
      nextSrs: toSrsSummary(
        {
          ...target.state,
          stageIndex: scheduling.nextState.stageIndex,
          availableAt: scheduling.nextState.availableAt,
          burnedAt: scheduling.nextState.burnedAt,
          wrongCount: scheduling.nextState.wrongCount,
          correctStreak: scheduling.nextState.correctStreak,
        },
        target.stages,
      ),
    };
  }

  async finishSession(
    sessionId: string,
    user: CurrentUserDto,
  ): Promise<FinishReviewSessionResponse> {
    const session = await this.reviewsRepository.finishReviewSession(
      user.id,
      sessionId,
      new Date(),
    );

    if (session === null || session.finishedAt === null) {
      throw new NotFoundException("Active review session not found.");
    }

    return {
      session: {
        id: session.id,
        startedAt: session.startedAt.toISOString(),
        finishedAt: session.finishedAt.toISOString(),
        mode: session.mode,
      },
    };
  }
}

function parseReviewAnswerRequest(body: unknown): ParsedReviewAnswerRequest {
  const record = parseRecord(body);
  parseOptionalAnsweredAt(record.answeredAt);

  return {
    cardId: parseRequiredString(record.cardId, "cardId"),
    answer: parseRequiredString(record.answer, "answer", MAX_REVIEW_ANSWER_LENGTH),
    answerType: parseAnswerType(record.answerType),
    revealRequested: parseOptionalBoolean(record.revealRequested, "revealRequested"),
    manualIgnore: parseOptionalBoolean(record.manualIgnore, "manualIgnore"),
  };
}

function parsePracticeAnswerRequest(body: unknown): PracticeAnswerRequest {
  const record = parseRecord(body);

  return {
    cardId: parseRequiredString(record.cardId, "cardId"),
    answer: parseRequiredString(record.answer, "answer", MAX_REVIEW_ANSWER_LENGTH),
    answerType: parseAnswerType(record.answerType),
  };
}

function parsePracticeSource(value: unknown): PracticeSource {
  if (value === "recent-lessons" || value === "recent-mistakes" || value === "burned") {
    return value;
  }

  throw new BadRequestException("source must be recent-lessons, recent-mistakes, or burned.");
}

function parseRecord(value: unknown): ReviewAnswerRequestBody {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException("Request body must be a JSON object.");
  }

  return value as ReviewAnswerRequestBody;
}

function parseRequiredString(value: unknown, key: string, maxLength?: number): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new BadRequestException(`${key} must be a non-empty string.`);
  }

  const trimmed = value.trim();

  if (maxLength !== undefined && trimmed.length > maxLength) {
    throw new BadRequestException(`${key} is too long.`);
  }

  return trimmed;
}

function parseAnswerType(value: unknown): "meaning" | "reading" {
  if (value === "meaning" || value === "reading") {
    return value;
  }

  throw new BadRequestException("answerType must be meaning or reading.");
}

function parseOptionalAnsweredAt(value: unknown): void {
  if (value === undefined || value === null || value === "") {
    return;
  }

  if (typeof value !== "string") {
    throw new BadRequestException("answeredAt must be an ISO date string.");
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new BadRequestException("answeredAt must be a valid ISO date string.");
  }
}

function parseOptionalBoolean(value: unknown, key: string): boolean {
  if (value === undefined || value === null) {
    return false;
  }

  if (typeof value !== "boolean") {
    throw new BadRequestException(`${key} must be a boolean.`);
  }

  return value;
}

function resolveQueueLimit(limit: number): number {
  if (!Number.isInteger(limit) || limit <= 0) {
    return DEFAULT_REVIEW_QUEUE_LIMIT;
  }

  return Math.min(limit, DEFAULT_REVIEW_QUEUE_LIMIT);
}

function getReviewOrderMode(user: CurrentUserDto): ReviewOrderMode {
  return isReviewOrderMode(user.settings.reviewOrderMode)
    ? user.settings.reviewOrderMode
    : "shuffled";
}

function orderReviewRecords(
  records: readonly ReviewQueueRecord[],
  mode: ReviewOrderMode,
  shuffleSeed: string,
): readonly ReviewQueueRecord[] {
  if (mode === "oldest-first" || records.length < 2) {
    return [...records];
  }

  if (mode === "lower-levels-first") {
    return [...records].sort(
      (left, right) =>
        (left.card.target.level ?? Number.MAX_SAFE_INTEGER) -
          (right.card.target.level ?? Number.MAX_SAFE_INTEGER) ||
        compareReviewDueAt(left, right) ||
        left.card.id.localeCompare(right.card.id),
    );
  }

  return [...records].sort(
    (left, right) =>
      getStableShuffleRank(`${shuffleSeed}:${left.card.id}`) -
        getStableShuffleRank(`${shuffleSeed}:${right.card.id}`) ||
      left.card.id.localeCompare(right.card.id),
  );
}

function compareReviewDueAt(left: ReviewQueueRecord, right: ReviewQueueRecord): number {
  return (
    (left.state.availableAt?.getTime() ?? Number.MAX_SAFE_INTEGER) -
    (right.state.availableAt?.getTime() ?? Number.MAX_SAFE_INTEGER)
  );
}

function getStableShuffleRank(value: string): number {
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}

function getLocalDateKey(date: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const partByType = new Map(parts.map((part) => [part.type, part.value]));

    return `${partByType.get("year")}-${partByType.get("month")}-${partByType.get("day")}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getResponseResult(
  request: ParsedReviewAnswerRequest,
  validationResult: ReviewAnswerResultType,
): ReviewAnswerResultType {
  if (request.manualIgnore) {
    return "manual-ignore";
  }

  if (request.revealRequested) {
    return "reveal";
  }

  return validationResult;
}

function getSrsResult(result: ReviewAnswerResultType): SrsReviewResult {
  switch (result) {
    case "correct":
      return "correct";
    case "typo":
      return "typo";
    case "reveal":
      return "reveal";
    case "manual-ignore":
      return "manual-ignore";
    default:
      return "wrong";
  }
}

function normalizeAnswer(answer: string, answerType: "meaning" | "reading"): string {
  return answerType === "reading" ? normalizeJapaneseReading(answer) : normalizeMeaning(answer);
}

function toReviewQueueItem(record: ReviewQueueRecord): ReviewQueueItem {
  return {
    card: {
      id: record.card.id,
      learningItemId: record.card.learningItemId,
      itemType: record.card.itemType,
      cardType: record.card.cardType,
      promptType: record.card.promptType,
      answerType: record.card.answerType,
      prompt: {
        japanese: record.card.target.japanese,
        reading: record.card.target.reading,
      },
      sortOrder: record.card.sortOrder,
    },
    item: {
      id: record.card.target.id,
      itemType: record.card.target.itemType,
      slug: `${record.card.target.itemType}:${record.card.target.japanese}`,
      japanese: record.card.target.japanese,
      reading: record.card.target.reading,
      level: record.card.target.level,
      jlptLevel: record.card.target.jlptLevel,
    },
    dueAt: record.state.availableAt?.toISOString() ?? new Date(0).toISOString(),
    srs: toSrsSummary(record.state, record.stages),
  };
}

function toSrsSnapshot(state: ReviewSrsStateRecord): UserSrsStateSnapshot {
  return {
    id: state.id,
    learningCardId: state.learningCardId,
    stageIndex: state.stageIndex,
    availableAt: state.availableAt,
    burnedAt: state.burnedAt,
    resurrectedAt: state.resurrectedAt,
    wrongCount: state.wrongCount,
    correctStreak: state.correctStreak,
    lastReviewedAt: state.lastReviewedAt,
  };
}

function toSrsSummary(
  state: Pick<
    ReviewSrsStateRecord,
    "stageIndex" | "availableAt" | "burnedAt" | "wrongCount" | "correctStreak"
  >,
  stages: readonly SrsStage[],
): SrsStateSummaryDto {
  const stage = stages.find((candidate) => candidate.stageIndex === state.stageIndex);

  return {
    stageIndex: state.stageIndex,
    stageName: stage?.name ?? `Stage ${state.stageIndex}`,
    availableAt: state.availableAt?.toISOString() ?? null,
    burnedAt: state.burnedAt?.toISOString() ?? null,
    wrongCount: state.wrongCount,
    correctStreak: state.correctStreak,
  };
}

function toExpectedAnswers(target: ReviewAnswerTargetRecord): readonly LocalizedTextDto[] {
  return target.card.acceptedAnswers.map((answer) => ({
    locale: answer.locale,
    text: answer.text,
    isPrimary: answer.isPrimary,
    sourceKind: answer.sourceKind,
  }));
}

function toExpectedAnswersForDisplay(
  target: ReviewQueueRecord,
  displayMode: CurrentUserDto["settings"]["translationDisplayMode"],
): readonly LocalizedTextDto[] {
  const locales = getContentLocalesForDisplayMode(displayMode);

  return target.card.acceptedAnswers
    .filter((answer) => target.card.answerType === "reading" || locales.includes(answer.locale))
    .map((answer) => ({
      locale: answer.locale,
      text: answer.text,
      isPrimary: answer.isPrimary,
      sourceKind: answer.sourceKind,
    }));
}

function getBlockedReason(target: ReviewQueueRecord, matchedAnswer: string | null): string | null {
  if (matchedAnswer === null) {
    return null;
  }

  return target.card.blockedAnswers.find((answer) => answer.text === matchedAnswer)?.reason ?? null;
}

function getFeedbackMessage(result: ReviewAnswerResultType, relatedAnswer?: string | null): string {
  if (result === "wrong" && relatedAnswer !== undefined && relatedAnswer !== null) {
    return "Это существующее чтение кандзи, но эта карточка ожидает другое чтение.";
  }

  switch (result) {
    case "correct":
      return "Ответ принят.";
    case "typo":
      return "Ответ принят как опечатка.";
    case "blocked":
      return "Этот ответ специально отклонен для этой карточки.";
    case "reveal":
      return "Ответ раскрыт, карточка будет повторяться раньше.";
    case "manual-ignore":
      return "Ответ проигнорирован без изменения SRS.";
    default:
      return "Ответ не принят.";
  }
}

function toAnswerDiagnostic(relatedAnswer?: string | null) {
  return relatedAnswer === undefined || relatedAnswer === null
    ? null
    : ({ kind: "alternative-reading", matchedAnswer: relatedAnswer } as const);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1_000);
}
