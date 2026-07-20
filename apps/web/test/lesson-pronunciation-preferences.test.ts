import { describe, expect, it } from "vitest";

import { resolveLessonPronunciationPreferences } from "../src/lib/use-lesson-pronunciation-preferences";

describe("lesson pronunciation preferences", () => {
  it("uses compatible defaults and restores saved preferences", () => {
    expect(resolveLessonPronunciationPreferences(undefined)).toEqual({
      mode: "kana",
      showRomaji: false,
    });
    expect(
      resolveLessonPronunciationPreferences({
        lessonPronunciationMode: "furigana",
        lessonRomaji: true,
      }),
    ).toEqual({
      mode: "furigana",
      showRomaji: true,
    });
  });
});
