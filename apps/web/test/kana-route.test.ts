import { describe, expect, it } from "vitest";

import { parseKanaRouteSelection } from "../src/lib/kana-route";

describe("kana route selection", () => {
  it("opens direct assessment and practice links in the requested script", () => {
    expect(parseKanaRouteSelection({ script: "katakana", mode: "assessment" })).toEqual({
      mode: "assessment",
      lessonScript: "katakana",
      practiceScript: "katakana",
    });
    expect(parseKanaRouteSelection({ script: "mixed", mode: "practice" })).toEqual({
      mode: "practice",
      lessonScript: "hiragana",
      practiceScript: "mixed",
    });
  });

  it("falls back to hiragana lessons for invalid values", () => {
    expect(parseKanaRouteSelection({ script: "kanji", mode: "review" })).toEqual({
      mode: "lessons",
      lessonScript: "hiragana",
      practiceScript: "hiragana",
    });
  });
});
