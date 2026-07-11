import { describe, expect, it } from "vitest";

import { type KanaLessonItemDto } from "@kanji-srs/shared";

import { buildKanaExerciseChoices, selectKanaExerciseKind } from "../src/lib/kana-exercises";

describe("kana exercise selection", () => {
  it("rotates through all exercise kinds as attempts accumulate", () => {
    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 0))).toBe("typing");
    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 1))).toBe("recognition-choice");
    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 2))).toBe("reverse-choice");
    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 3))).toBe("matching");
    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 4))).toBe("typing");

    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 4), { listeningAvailable: true })).toBe(
      "listening-choice",
    );
    expect(selectKanaExerciseKind(buildItem("あ", "a", 0, 5), { listeningAvailable: true })).toBe(
      "typing",
    );
  });

  it("keeps the target and removes ambiguous duplicate readings", () => {
    const ji = buildItem("じ", "ji", 0);
    const choices = buildKanaExerciseChoices(
      [ji, buildItem("ぢ", "ji", 1), buildItem("ず", "zu", 2), buildItem("ぜ", "ze", 3)],
      ji,
      4,
    );

    expect(choices).toHaveLength(3);
    expect(choices).toEqual(expect.arrayContaining([ji]));
    expect(choices.map((item) => item.romaji)).toEqual(expect.arrayContaining(["ji", "zu", "ze"]));
    expect(new Set(choices.map((item) => item.romaji)).size).toBe(choices.length);
  });

  it("orders choices deterministically without mutating the source", () => {
    const source = [
      buildItem("あ", "a", 0),
      buildItem("い", "i", 1),
      buildItem("う", "u", 2),
      buildItem("え", "e", 3),
      buildItem("お", "o", 4),
    ];
    const before = [...source];

    const first = buildKanaExerciseChoices(source, source[2]!, 4);
    const second = buildKanaExerciseChoices(source, source[2]!, 4);

    expect(first).toEqual(second);
    expect(first).toHaveLength(4);
    expect(first).toEqual(expect.arrayContaining([source[2]]));
    expect(source).toEqual(before);
  });
});

function buildItem(
  character: string,
  romaji: string,
  order: number,
  attemptCount = 0,
): KanaLessonItemDto {
  return {
    character,
    romaji,
    script: "hiragana",
    row: "vowels",
    order,
    variant: "basic",
    baseCharacter: character,
    attemptCount,
    correctCount: 0,
    currentStreak: 0,
    mastered: false,
    lastAnsweredAt: null,
  };
}
