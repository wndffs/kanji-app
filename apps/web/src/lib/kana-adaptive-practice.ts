import {
  type KanaLessonItemDto,
  type KanaPracticeAnswerRequest,
  type KanaPracticeExerciseDto,
  type KanaPracticeExerciseKind,
} from "@kanji-srs/shared";
import { findKana } from "@kanji-srs/japanese";

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
  effectiveKind: KanaPracticeExerciseKind = exercise.exerciseKind,
): KanaPracticeAnswerRequest {
  return isKanaCharacterChoiceExercise(exercise.exerciseKind)
    ? {
        sessionId,
        exerciseId: exercise.id,
        selectedCharacter: value,
        ...(effectiveKind !== exercise.exerciseKind ? { exerciseKind: "reverse-choice" as const } : {}),
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
    variant: findKana(exercise.character)?.variant ?? "basic",
    baseCharacter: findKana(exercise.character)?.baseCharacter ?? exercise.character,
    attemptCount: 0,
    correctCount: 0,
    currentStreak: 0,
    mastered: false,
    lastAnsweredAt: null,
  };
}
