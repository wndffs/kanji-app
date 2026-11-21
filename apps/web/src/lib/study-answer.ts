import { romajiToKanaInput, type KanaScript } from "@kanji-srs/japanese";
import { type ReviewQueueCardDto } from "@kanji-srs/shared";

export type StudyAnswerMode = "meaning" | KanaScript;

type StudyAnswerCard = Pick<ReviewQueueCardDto, "answerType" | "promptType" | "prompt">;

export function resolveStudyAnswerMode(
  card: StudyAnswerCard | null,
  visibleJapanese = card?.prompt.japanese ?? "",
): StudyAnswerMode {
  if (card?.answerType !== "reading") return "meaning";
  if (card.promptType === "listening") return "hiragana";

  // Infer the script from what the learner can see, not from the expected reading.
  return /\p{Script=Katakana}/u.test(visibleJapanese) &&
    !/[\p{Script=Han}\p{Script=Hiragana}]/u.test(visibleJapanese)
    ? "katakana"
    : "hiragana";
}

export function prepareStudyAnswer(value: string, mode: StudyAnswerMode): string {
  const answer = value.trim();
  return mode === "meaning" ? answer : romajiToKanaInput(answer, mode, true);
}
