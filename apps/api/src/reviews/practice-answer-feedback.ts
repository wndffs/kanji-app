import {
  getContentLocalesForDisplayMode,
  type LocalizedTextDto,
  type ReviewAnswerResultType,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { type ReviewCardRecord } from "./reviews.types";
import { diagnoseReadingDifference } from "@kanji-srs/japanese";

export function getCardFeedbackMessage(card: ReviewCardRecord, result: ReviewAnswerResultType, answer: string, relatedAnswer?: string | null): string {
  if (result === "wrong" && !relatedAnswer && card.answerType === "reading") {
    const difference = diagnoseReadingDifference(answer, card.acceptedAnswers.map(expected=>expected.text));
    if (difference === "small-tsu") return "Ответ не принят. Проверьте маленькую っ: это не обычный слог つ и не пропущенный знак.";
    if (difference === "small-kana") return "Ответ не принят. Проверьте размер каны: ゃ・ゅ・ょ отличаются от や・ゆ・よ.";
    if (difference === "vowel-spelling") return "Ответ не принят. Проверьте долготу гласных и запись каны; おう, おお и ー не заменяют друг друга автоматически.";
  }
  return getPracticeFeedbackMessage(result, relatedAnswer);
}

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
