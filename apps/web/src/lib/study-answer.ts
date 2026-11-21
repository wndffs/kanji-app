import { romajiToKatakanaInput } from "@kanji-srs/japanese";
import { type CardAnswerType } from "@kanji-srs/shared";

export function prepareStudyAnswer(value: string, answerType: CardAnswerType): string {
  const answer = value.trim();
  return answerType === "reading" ? romajiToKatakanaInput(answer, true) : answer;
}
