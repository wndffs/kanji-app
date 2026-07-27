import {
  type KanaLessonItemDto,
  type KanaPracticeAnswerRequest,
  type KanaPracticeExerciseDto,
  type KanaPracticeExerciseKind,
} from "@kanji-srs/shared";

export function isKanaCharacterChoiceExercise(kind: KanaPracticeExerciseKind): boolean {
  return (
    kind === "reverse-choice" ||
    kind === "matching" ||
    kind === "listening-choice" ||
    kind === "tracing"
  );
}

export function buildKanaPracticeAnswer(
  sessionId: string,
  exercise: KanaPracticeExerciseDto,
  value: string,
): KanaPracticeAnswerRequest {
  return isKanaCharacterChoiceExercise(exercise.exerciseKind)
    ? {
        sessionId,
        exerciseId: exercise.id,
        selectedCharacter: value,
      }
    : {
        sessionId,
        exerciseId: exercise.id,
        answer: value,
      };
}

export function toKanaLessonItem(exercise: KanaPracticeExerciseDto): KanaLessonItemDto {
  return {
    character: exercise.character,
    script: exercise.script,
    romaji: exercise.romaji,
    row: "adaptive",
    order: 0,
    variant: "basic",
    baseCharacter: exercise.character,
    attemptCount: 0,
    correctCount: 0,
    currentStreak: 0,
    mastered: false,
    lastAnsweredAt: null,
  };
}
