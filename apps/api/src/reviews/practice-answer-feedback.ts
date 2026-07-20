import {
  getContentLocalesForDisplayMode,
  type LocalizedTextDto,
  type ReviewAnswerResultType,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { type ReviewCardRecord } from "./reviews.types";

export function toExpectedPracticeAnswers(
  card: ReviewCardRecord,
  displayMode: TranslationDisplayMode,
): readonly LocalizedTextDto[] {
  const locales = getContentLocalesForDisplayMode(displayMode);

  return card.acceptedAnswers
    .filter((answer) => card.answerType === "reading" || locales.includes(answer.locale))
    .map((answer) => ({
      locale: answer.locale,
      text: answer.text,
      isPrimary: answer.isPrimary,
      sourceKind: answer.sourceKind,
    }));
}

export function getPracticeBlockedReason(
  card: ReviewCardRecord,
  matchedAnswer: string | null,
): string | null {
  if (matchedAnswer === null) {
    return null;
  }

  return card.blockedAnswers.find((answer) => answer.text === matchedAnswer)?.reason ?? null;
}

export function getPracticeFeedbackMessage(
  result: ReviewAnswerResultType,
  relatedAnswer?: string | null,
): string {
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

export function toPracticeAnswerDiagnostic(relatedAnswer?: string | null) {
  return relatedAnswer === undefined || relatedAnswer === null
    ? null
    : ({ kind: "alternative-reading", matchedAnswer: relatedAnswer } as const);
}
