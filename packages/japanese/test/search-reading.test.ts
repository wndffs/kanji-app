import { describe, expect, it } from "vitest";
import { normalizeKanaSearchReading } from "../src/index";

describe("kana-only search reading", () => {
  it.each(["がっこう", "ガッコウ", "ｶﾞｯｺｳ", " ガッ コウ "])(
    "normalizes %s without romaji inference",
    (input) => {
      expect(normalizeKanaSearchReading(input)).toBe("がっこう");
    },
  );
  it.each(["", "school", "学校", "ichi", "し-", "123", "%_"])(
    "keeps non-kana %s out of reading equivalence",
    (input) => {
      expect(normalizeKanaSearchReading(input)).toBeNull();
    },
  );
  it("retains small kana, dakuten and long vowels instead of conflating sounds", () => {
    expect(normalizeKanaSearchReading("キョウ")).toBe("きょう");
    expect(normalizeKanaSearchReading("コー")).toBe("こー");
    expect(normalizeKanaSearchReading("コ")).toBe("こ");
  });
});
