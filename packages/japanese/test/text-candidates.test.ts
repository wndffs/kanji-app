import { describe, expect, it } from "vitest";
import { extractJapaneseTextCandidates, originalTextSpan, JapaneseTextBudgetError } from "../src";
describe("local bounded dictionary analysis", () => {
  it("normalizes half-width and decomposed marks while preserving original offsets", () => {
    const text = "😀ｶﾞ 学校 カ\u3099";
    const result = extractJapaneseTextCandidates(text);
    expect(result.normalizedText).toBe("😀ガ 学校 ガ");
    const start = result.normalizedText.indexOf("ガ");
    const span = originalTextSpan(result, start, 1)!;
    expect(text.slice(span.start, span.end)).toBe("ｶﾞ");
    expect(result.wordCandidates).toContain("学校");
  });
  it("exposes genuine ICU boundaries without claiming lemmatization", () => {
    const result = extractJapaneseTextCandidates("学校で日本語を学びます。");
    expect(result.analyzer).toBe("icu-word-boundaries");
    expect(result.boundaries.length).toBeGreaterThan(0);
    expect(result.wordCandidates).toContain("日本語");
    expect(extractJapaneseTextCandidates("食べました").wordCandidates).not.toContain("食べる");
  });
  it.each([
    null,
    () => {
      throw new Error("unsupported");
    },
  ])("reports bounded fallback for absent or failed ICU", (segmentWords) => {
    const result = extractJapaneseTextCandidates("学校。日本語", { segmentWords });
    expect(result.analyzer).toBe("bounded-dictionary-fallback");
    expect(result.wordCandidates).toContain("学校");
    expect(result.wordCandidates).not.toContain("校日");
  });
  it("rejects excessive candidates instead of silently truncating or querying the DB", () => {
    const text = Array.from({ length: 600 }, (_, i) => String.fromCodePoint(0x4e00 + i)).join("");
    expect(() => extractJapaneseTextCandidates(text, { segmentWords: null })).toThrow(
      JapaneseTextBudgetError,
    );
  });
});
