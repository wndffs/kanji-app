import { ConflictException } from "@nestjs/common";

import { type ReviewSessionProgressDto } from "@kanji-srs/shared";

import { buildReviewSessionSummary } from "./review-summary";
import {
  type ReviewSessionProgressRecord,
  type ScheduledReviewAnswerRecord,
  type ScheduledReviewState,
} from "./reviews.types";

export const MAX_SCHEDULED_REVIEW_CARDS = 100;

export function parseScheduledReviewState(value: unknown): ScheduledReviewState | null {
  if (!isRecord(value) || value.reviewVersion === undefined) return null;
  const scheduledCardIds = value.scheduledCardIds;
  const correctedCardIds = value.correctedCardIds;
  if (
    value.reviewVersion !== 1 ||
    !isCardIdList(scheduledCardIds) ||
    !isCardIdList(correctedCardIds) ||
    correctedCardIds.some((id) => !scheduledCardIds.includes(id))
  ) {
    throw new ConflictException("Сохранённая сессия повторений повреждена. Обновите страницу.");
  }
  return {
    reviewVersion: 1,
    scheduledCardIds: [...scheduledCardIds],
    correctedCardIds: [...correctedCardIds],
  };
}

export function createScheduledReviewState(cardIds: readonly string[]): ScheduledReviewState {
  return parseScheduledReviewState({
    reviewVersion: 1,
    scheduledCardIds: cardIds,
    correctedCardIds: [],
  })!;
}

export function getPendingReviewCardIds(
  state: ScheduledReviewState,
  answers: readonly ScheduledReviewAnswerRecord[],
): { readonly scheduled: readonly string[]; readonly corrections: readonly string[] } {
  const answered = new Set(answers.map((answer) => answer.cardId));
  const missed = new Set(answers.filter(isMissedReviewAnswer).map((answer) => answer.cardId));
  if (
    answers.length > MAX_SCHEDULED_REVIEW_CARDS ||
    answered.size !== answers.length ||
    answers.some((answer) => !state.scheduledCardIds.includes(answer.cardId)) ||
    state.correctedCardIds.some((id) => !missed.has(id))
  ) {
    throw new ConflictException("История сессии повторений не соответствует её снимку.");
  }
  return {
    scheduled: state.scheduledCardIds.filter((id) => !answered.has(id)),
    corrections: state.scheduledCardIds.filter(
      (id) => missed.has(id) && !state.correctedCardIds.includes(id),
    ),
  };
}

export function isMissedReviewAnswer(answer: ScheduledReviewAnswerRecord): boolean {
  return answer.result === "wrong" || answer.result === "reveal";
}

export function toReviewSessionProgress(
  record: ReviewSessionProgressRecord,
  now: Date,
): ReviewSessionProgressDto {
  const state = record.session.reviewState;
  if (state === null || state === undefined)
    throw new ConflictException("Сессия не поддерживает восстановление.");
  getPendingReviewCardIds(state, record.answers);
  return {
    scheduledTotal: state.scheduledCardIds.length,
    scheduledAnswered: record.answers.length,
    correctionsRequired: record.answers.filter(isMissedReviewAnswer).length,
    correctedCardIds: state.correctedCardIds,
    original: buildReviewSessionSummary({
      answers: record.answers,
      startedAt: record.session.startedAt,
      finishedAt: record.session.finishedAt ?? now,
    }),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCardIdList(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.length <= MAX_SCHEDULED_REVIEW_CARDS &&
    value.every((id) => typeof id === "string" && id.length > 0 && id.length <= 200) &&
    new Set(value).size === value.length
  );
}
