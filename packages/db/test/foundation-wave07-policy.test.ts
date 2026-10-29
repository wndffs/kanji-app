import { describe, expect, it } from "vitest";
import { FOUNDATION_WAVE07_LEVELS } from "../src/foundation-wave07-policy";
import { nextEditorialWave } from "../src/editorial-wave";
import { auditWavePlacement } from "../src/editorial-wave-placement";
import { wordHanCharacters } from "../src/main-course-word-content";
import { buildMainCourseContentBatches } from "../src/main-course-content";

describe("foundation wave07 prerequisite and progression plan", () => {
  it("selects the actual core kind at each new level without changing interval rules", () => {
    expect(FOUNDATION_WAVE07_LEVELS.map((level) => [level.levelNumber, level.passPolicyJson.itemKind])).toEqual([
      [8, "COMPONENT"], [9, "KANJI"], [10, "WORD"],
    ]);
    expect(FOUNDATION_WAVE07_LEVELS.every((level) => level.passPolicyJson.passStageIndex === 5 && level.passPolicyJson.requiredPercentage === 90)).toBe(true);
    const wave = nextEditorialWave();
    expect(wave.kanji.componentLevelNumber).toBe(8);
    expect(wave.kanji.kanji.every((item) => item.levelNumber === 9)).toBe(true);
    expect(wave.words.levelNumber).toBe(10);
  });
  it("closes all word and example kanji before level10 without inventing prerequisites", () => {
    const wave = nextEditorialWave();
    const placed = new Map([...buildMainCourseContentBatches(), wave.kanji].flatMap((batch) => batch.kanji.map((item) => [item.character, item.levelNumber] as const)));
    for (const word of wave.words.words) for (const character of wordHanCharacters(word.expression + word.example.japaneseText)) {
      expect(placed.has(character)).toBe(true);
      expect(placed.get(character)).toBeLessThan(10);
    }
    expect(auditWavePlacement().valid).toBe(true);
  });
});
