import { describe, expect, it } from "vitest";

import { itemReadingPresentation, resolveItemReadingPreferences } from "../src/lib/item-reading";

describe("item reading presentation", () => {
  it("defaults to kana without unsolicited romaji", () => {
    expect(resolveItemReadingPreferences()).toEqual({ mode: "kana", showRomaji: false });
    expect(itemReadingPresentation(" にほんご ", resolveItemReadingPreferences())).toEqual({
      hidden: false,
      kana: "にほんご",
      furigana: null,
      romaji: null,
    });
  });

  it("uses the complete known reading as one ruby annotation, never inferred alignment", () => {
    expect(itemReadingPresentation("にほんご", { mode: "furigana", showRomaji: false })).toEqual({
      hidden: false,
      kana: null,
      furigana: "にほんご",
      romaji: null,
    });
  });

  it("hides reading by a local action and reveals it explicitly without leaking romaji", () => {
    const preferences = { mode: "hide", showRomaji: true } as const;
    expect(itemReadingPresentation("にほんご", preferences)).toEqual({
      hidden: true,
      kana: null,
      furigana: null,
      romaji: null,
    });
    expect(itemReadingPresentation("にほんご", preferences, true)).toEqual({
      hidden: false,
      kana: "にほんご",
      furigana: null,
      romaji: "nihongo",
    });
  });

  it.each(["hide", "other", null, 1])(
    "does not treat unknown persisted mode %s as a new supported setting",
    (lessonPronunciationMode) => {
      expect(resolveItemReadingPreferences({ lessonPronunciationMode }).mode).toBe("kana");
    },
  );

  it.each(["kana", "furigana"] as const)(
    "shows romaji only with explicit opt-in in %s mode",
    (mode) => {
      expect(itemReadingPresentation("にほんご", { mode, showRomaji: false }).romaji).toBeNull();
      expect(itemReadingPresentation("にほんご", { mode, showRomaji: true }).romaji).toBe(
        "nihongo",
      );
      expect(
        resolveItemReadingPreferences({ lessonPronunciationMode: mode, lessonRomaji: "true" })
          .showRomaji,
      ).toBe(false);
    },
  );

  it.each([null, undefined, "", " "])(
    "does not invent a reading or reveal action when absent %#",
    (reading) => {
      expect(itemReadingPresentation(reading, { mode: "hide", showRomaji: true })).toEqual({
        hidden: false,
        kana: null,
        furigana: null,
        romaji: null,
      });
    },
  );

  it("applies the same policy to full example readings independently of item reveal", () => {
    const preferences = { mode: "hide", showRomaji: false } as const;
    expect(itemReadingPresentation("にほんご", preferences, true).kana).toBe("にほんご");
    expect(itemReadingPresentation("にほんごです", preferences).hidden).toBe(true);
    expect(
      itemReadingPresentation("にほんごです", { mode: "furigana", showRomaji: false }).furigana,
    ).toBe("にほんごです");
  });
});
