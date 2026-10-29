import { describe, expect, it } from "vitest";
import { VISUAL_KANJI_CONTRASTS, visualContrastFor } from "@kanji-srs/shared";
import { buildMainCourseContentBatches } from "../src/main-course-content";

describe("original bounded visual contrasts", () => {
  it("only teaches already reviewed placed kanji, with both languages", () => {
    const characters = new Set(
      buildMainCourseContentBatches().flatMap((b) => b.kanji.map((k) => k.character)),
    );
    for (const contrast of VISUAL_KANJI_CONTRASTS) {
      for (const character of contrast.characters) expect(characters.has(character)).toBe(true);
      expect(contrast.ru.length).toBeGreaterThan(60);
      expect(contrast.en.length).toBeGreaterThan(60);
    }
    expect(visualContrastFor("日")?.characters).toEqual(["日", "目"]);
    expect(visualContrastFor("水")).toBeNull();
  });
});
