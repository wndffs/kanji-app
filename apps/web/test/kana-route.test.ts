import { describe, expect, it } from "vitest";

import { parseKanaRouteSelection, parseKanaLessonDestination, resolveKanaLessonDestination, kanaLessonHref } from "../src/lib/kana-route";

describe("kana route selection", () => {
  it("resolves only matching unlocked lesson groups and validates destinations", () => {
    const open = { id: "hiragana-vowels", unlocked: true, items: [{ character: "い" }] };
    const locked = { id: "hiragana-ky", unlocked: false, items: [{ character: "きゃ" }] };
    const path = { units: [open, locked] } as never;
    expect(resolveKanaLessonDestination(path, open.id, "い")).toEqual({ unit: open, character: "い" });
    expect(resolveKanaLessonDestination(path, locked.id, "きゃ")).toBeNull();
    expect(resolveKanaLessonDestination(path, null, "カ")).toBeNull();
    expect(parseKanaLessonDestination({ unit: "../../admin", character: "evil" })).toEqual({ unitId: null, character: null });
    expect(kanaLessonHref("hiragana", open.id, "い")).toContain("unit=hiragana-vowels");
  });
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
