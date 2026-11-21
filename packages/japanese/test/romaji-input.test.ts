import { describe, expect, it } from "vitest";

import { normalizeJapaneseReading, romajiToKatakanaInput } from "../src";

describe("romaji input", () => {
  it.each([
    ["ichi", "イチ"],
    ["GAKKOU", "ガッコウ"],
    ["kyou", "キョウ"],
    ["ko-hi-", "コーヒー"],
    ["kan'you", "カンヨウ"],
    ["honn", "ホン"],
  ])("converts %s to %s", (input, expected) => {
    expect(romajiToKatakanaInput(input)).toBe(expected);
  });

  it("leaves unfinished keystrokes in place and commits a final n on submission", () => {
    expect(romajiToKatakanaInput("kyo")).toBe("キョ");
    expect(romajiToKatakanaInput("ky")).toBe("ky");
    expect(romajiToKatakanaInput("nihon")).toBe("ニホn");
    expect(romajiToKatakanaInput("ニホn", true)).toBe("ニホン");
    expect(normalizeJapaneseReading(romajiToKatakanaInput("ニホn", true))).toBe("にほん");
  });

  it("preserves kana, kanji, and spaces already in the input", () => {
    expect(romajiToKatakanaInput("今日 は コーヒーとocha。")).toBe("今日 は コーヒーとオチャ。");
    expect(romajiToKatakanaInput(" かんじ ")).toBe(" かんじ ");
  });
});
