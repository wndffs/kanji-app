import { type LessonQueueItem } from "@kanji-srs/shared";

export type LessonStudyPhase = "meaning" | "reading" | "context";

export function lessonStudyPosition(
  itemIndex: number,
  itemCount: number,
  phaseIndex: number,
  phaseCount: number,
) {
  const total = Math.max(0, itemCount);
  return {
    item: total === 0 ? 0 : Math.min(total, Math.max(1, itemIndex + 1)),
    total,
    phase: phaseCount === 0 ? 0 : Math.min(phaseCount, Math.max(1, phaseIndex + 1)),
    phaseTotal: Math.max(0, phaseCount),
  };
}

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
