import { describe, expect, it } from "vitest";

import { normalizeJapaneseReading, romajiToKanaInput } from "../src";

describe("romaji input", () => {
  it.each([
    ["ichi", "いち", "イチ"],
    ["GAKKOU", "がっこう", "ガッコウ"],
    ["kyou", "きょう", "キョウ"],
    ["ko-hi-", "こーひー", "コーヒー"],
    ["kan'you", "かんよう", "カンヨウ"],
    ["honn", "ほん", "ホン"],
  ])("converts %s into the chosen script", (input, hiragana, katakana) => {
    expect(romajiToKanaInput(input, "hiragana")).toBe(hiragana);
    expect(romajiToKanaInput(input, "katakana")).toBe(katakana);
  });

  it("leaves unfinished keystrokes in place and commits a final n on submission", () => {
    expect(romajiToKanaInput("ky", "hiragana")).toBe("ky");
    expect(romajiToKanaInput("nihon", "hiragana")).toBe("にほn");
    expect(romajiToKanaInput("にほn", "hiragana", true)).toBe("にほん");
    expect(romajiToKanaInput("nihon", "katakana")).toBe("ニホn");
    expect(romajiToKanaInput("ニホn", "katakana", true)).toBe("ニホン");
    expect(normalizeJapaneseReading(romajiToKanaInput("ニホn", "katakana", true))).toBe("にほん");
  });

  it("preserves kana, kanji, and spaces already in the input", () => {
    expect(romajiToKanaInput("今日 は コーヒーとocha。", "katakana")).toBe(
      "今日 は コーヒーとオチャ。",
    );
    expect(romajiToKanaInput("今日 は コーヒーとocha。", "hiragana")).toBe(
      "今日 は コーヒーとおちゃ。",
    );
    expect(romajiToKanaInput(" かんじ ガク ", "katakana")).toBe(" かんじ ガク ");
  });
});
