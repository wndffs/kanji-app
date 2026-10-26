import { validateAnswer } from "@kanji-srs/japanese";
import { REFERENCE_MATERIALS, referenceMeaning, type ReferenceMode } from "./reference-data";

export const REFERENCE_QUESTIONS = [
  ...REFERENCE_MATERIALS.slice(3),
  ...REFERENCE_MATERIALS.slice(0, 3),
].flatMap((item) => [
  { item, answerKind: "meaning" as const },
  { item, answerKind: "reading" as const },
]);
export type ReferenceQuestion = (typeof REFERENCE_QUESTIONS)[number];
export type ReferenceFeedback = { kind: "correct" | "wrong" | "revealed"; expected: string };

export function referenceExpected(question: ReferenceQuestion, mode: ReferenceMode): string {
  return question.answerKind === "reading"
    ? question.item.reading
    : referenceMeaning(question.item, mode);
}

export function referenceFeedback(
  answer: string,
  question: ReferenceQuestion,
  mode: ReferenceMode,
): ReferenceFeedback {
  const acceptedAnswers =
    question.answerKind === "reading"
      ? [question.item.reading]
      : mode === "ru"
        ? [question.item.ru]
        : mode === "en"
          ? [question.item.en]
          : [question.item.ru, question.item.en];
  const result = validateAnswer({
    answerKind: question.answerKind,
    answer,
    acceptedAnswers,
    typoTolerance: { enabled: false },
  });
  return {
    kind: result.accepted ? "correct" : "wrong",
    expected: referenceExpected(question, mode),
  };
}
