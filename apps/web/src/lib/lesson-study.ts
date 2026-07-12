import { type LessonQueueItem } from "@kanji-srs/shared";

export type LessonStudyPhase = "meaning" | "reading" | "context";

export function getLessonStudyPhases(lesson: LessonQueueItem): readonly LessonStudyPhase[] {
  const phases: LessonStudyPhase[] = ["meaning"];
  const hasReading =
    lesson.item.reading !== null ||
    lesson.cards.some((card) => card.answerType === "reading") ||
    lesson.mnemonics.some((group) => group.purpose === "reading") ||
    lesson.hints.some((group) => group.purpose === "reading");
  const hasContext =
    lesson.exampleSentences.length > 0 ||
    lesson.mnemonics.some((group) => group.purpose === "story") ||
    lesson.hints.some((group) => group.purpose === "usage");

  if (hasReading) {
    phases.push("reading");
  }

  if (hasContext) {
    phases.push("context");
  }

  return phases;
}

export function getLessonPronunciationText(lesson: LessonQueueItem): string | null {
  const itemReading = lesson.item.reading?.trim() ?? "";

  if (itemReading !== "") {
    return itemReading;
  }

  for (const card of lesson.cards) {
    if (card.answerType !== "reading") {
      continue;
    }

    const acceptedReading = card.acceptedAnswers.find((answer) => answer.text.trim() !== "");
    if (acceptedReading !== undefined) {
      return acceptedReading.text;
    }
  }

  return null;
}
