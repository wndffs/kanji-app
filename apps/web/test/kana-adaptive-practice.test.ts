import { describe, expect, it } from "vitest";

import {
  buildKanaPracticeAnswer,
  isKanaCharacterChoiceExercise,
  toKanaLessonItem,
} from "../src/lib/kana-adaptive-practice";
import { type KanaPracticeExerciseDto, type KanaPracticeExerciseKind } from "@kanji-srs/shared";

describe("adaptive kana practice UI contract", () => {
  it("records an audio/tracing fallback as reverse choice, not listening", () => {
    expect(
      buildKanaPracticeAnswer("s", exercise("listening-choice"), "あ", "reverse-choice"),
    ).toEqual({
      sessionId: "s",
      exerciseId: "exercise-listening-choice",
      selectedCharacter: "あ",
      exerciseKind: "reverse-choice",
    });
  });
  it("retains sokuon metadata for audible context", () => {
    expect(toKanaLessonItem({ ...exercise("listening-choice"), character: "っか" }).variant).toBe(
      "sokuon",
    );
  });
  it("sends romaji for typing and recognition exercises", () => {
    for (const kind of ["typing", "recognition-choice"] as const) {
      expect(buildKanaPracticeAnswer("session-1", exercise(kind), "a")).toEqual({
        sessionId: "session-1",
        exerciseId: `exercise-${kind}`,
        answer: "a",
      });
    }
  });

  it("sends the selected glyph for character-directed exercises", () => {
    for (const kind of ["reverse-choice", "matching", "listening-choice", "tracing"] as const) {
      expect(isKanaCharacterChoiceExercise(kind)).toBe(true);
      expect(buildKanaPracticeAnswer("session-1", exercise(kind), "あ")).toEqual({
        sessionId: "session-1",
        exerciseId: `exercise-${kind}`,
        selectedCharacter: "あ",
      });
    }
  });
});

function exercise(kind: KanaPracticeExerciseKind): KanaPracticeExerciseDto {
  return {
    id: `exercise-${kind}`,
    character: "あ",
    script: "hiragana",
    romaji: "a",
    exerciseKind: kind,
    choices: [
      { character: "あ", script: "hiragana", romaji: "a" },
      { character: "お", script: "hiragana", romaji: "o" },
    ],
    focusReason: "weak",
  };
}
