import { describe, expect, it } from "vitest";
import { REFERENCE_MATERIALS, referenceMeaning } from "../src/app/design-reference/reference-data";
import {
  REFERENCE_QUESTIONS,
  referenceFeedback,
} from "../src/app/design-reference/reference-model";

describe("isolated design reference", () => {
  it("keeps twelve independent examples and twenty-four deterministic questions", () => {
    expect(new Set(REFERENCE_MATERIALS.map((item) => item.glyph)).size).toBe(12);
    expect(REFERENCE_QUESTIONS).toHaveLength(24);
    expect(
      REFERENCE_QUESTIONS.slice(0, 2).map((question) => [question.item.glyph, question.answerKind]),
    ).toEqual([
      ["水", "meaning"],
      ["水", "reading"],
    ]);
  });
  it.each([
    ["ru", "вода"],
    ["en", "water"],
    ["ru-en", "вода / water"],
  ] as const)("renders %s content without other languages", (mode, expected) => {
    expect(referenceMeaning(REFERENCE_MATERIALS[3], mode)).toBe(expected);
  });
  it("respects the selected language and does not apply typo tolerance", () => {
    const question = REFERENCE_QUESTIONS[0]!;
    expect(referenceFeedback(" ВОДА ", question, "ru").kind).toBe("correct");
    expect(referenceFeedback("water", question, "ru").kind).toBe("wrong");
    expect(referenceFeedback("вода", question, "en").kind).toBe("wrong");
    expect(referenceFeedback("water", question, "ru-en").kind).toBe("correct");
    expect(referenceFeedback("вод", question, "ru").kind).toBe("wrong");
  });
  it("uses existing kana normalization without accepting romaji", () => {
    const question = REFERENCE_QUESTIONS[1]!;
    expect(referenceFeedback("ミズ", question, "ru")).toEqual({
      kind: "correct",
      expected: "みず",
    });
    expect(referenceFeedback("mizu", question, "ru").kind).toBe("wrong");
  });
});
