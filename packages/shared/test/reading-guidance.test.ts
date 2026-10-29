import { describe, expect, it } from "vitest";
import { READING_GUIDANCE } from "../src/reading-guidance";
describe("independent reading guidance", () => {
  it("keeps whole-word and on/kun guidance bilingual", () => {
    for (const text of Object.values(READING_GUIDANCE)) {
      expect(text.ru.length).toBeGreaterThan(40);
      expect(text.en.length).toBeGreaterThan(40);
    }
    expect(READING_GUIDANCE.word.ru).toContain("ひとり");
    expect(READING_GUIDANCE.kun.en).toContain("okurigana");
  });
});
