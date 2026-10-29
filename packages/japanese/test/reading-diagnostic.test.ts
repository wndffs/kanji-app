import { describe, expect, it } from "vitest";
import { diagnoseReadingDifference, validateAnswer } from "../src/index";
describe("conservative post-answer reading explanations", () => {
  it.each([
    ["がこう", "がっこう", "small-tsu"],
    ["がつこう", "がっこう", "small-tsu"],
    ["きよう", "きょう", "small-kana"],
    ["おばさん", "おばあさん", "vowel-spelling"],
    ["ときょ", "とうきょう", "vowel-spelling"],
    ["おお", "おう", "vowel-spelling"],
  ])("explains %s without accepting it", (answer, expected, diagnostic) => {
    expect(diagnoseReadingDifference(answer, [expected])).toBe(diagnostic);
    expect(
      validateAnswer({ answerKind: "reading", answer, acceptedAnswers: [expected] }).accepted,
    ).toBe(false);
  });
  it("does not diagnose exact/private alternatives or unrelated/oversized answers", () => {
    expect(diagnoseReadingDifference("ガッコウ", ["がっこう"])).toBeNull();
    expect(diagnoseReadingDifference("はし", ["くち"])).toBeNull();
    expect(diagnoseReadingDifference("x".repeat(200), ["いち"])).toBeNull();
  });
});
