import { expect, it } from "vitest";

import { prepareStudyAnswer, resolveStudyAnswerMode } from "../src/lib/study-answer";

const readingCard = (japanese: string) => ({
  answerType: "reading" as const,
  promptType: "reading" as const,
  prompt: { japanese, reading: "カナ" },
});

it.each([
  ["日本", "hiragana"],
  ["食べる", "hiragana"],
  ["東京タワー", "hiragana"],
  ["カナを読む", "hiragana"],
  ["ひらがな", "hiragana"],
  ["「コーヒー・ショップ」", "katakana"],
  ["Tシャツ", "katakana"],
  ["ﾗｰﾒﾝ", "katakana"],
  ["ー", "hiragana"],
])("chooses the input script from the visible prompt %s", (japanese, mode) => {
  expect(resolveStudyAnswerMode(readingCard(japanese))).toBe(mode);
});

it("does not infer the script from an audio answer or convert a meaning", () => {
  const card = readingCard("コーヒー");
  expect(resolveStudyAnswerMode({ ...card, promptType: "listening" })).toBe("hiragana");
  expect(resolveStudyAnswerMode({ ...card, answerType: "meaning" })).toBe("meaning");
  expect(resolveStudyAnswerMode(card, "珈琲")).toBe("hiragana");
  expect(resolveStudyAnswerMode(null)).toBe("meaning");
});

it("finalizes romaji only for reading answers", () => {
  expect(prepareStudyAnswer(" ラーメn ", "katakana")).toBe("ラーメン");
  expect(prepareStudyAnswer(" にほn ", "hiragana")).toBe("にほん");
  expect(prepareStudyAnswer(" にほん ", "katakana")).toBe("にほん");
  expect(prepareStudyAnswer(" ニホン ", "hiragana")).toBe("ニホン");
  expect(prepareStudyAnswer("   ", "hiragana")).toBe("");
  expect(prepareStudyAnswer(" Japan ", "meaning")).toBe("Japan");
  expect(prepareStudyAnswer(" Япония ", "meaning")).toBe("Япония");
});
