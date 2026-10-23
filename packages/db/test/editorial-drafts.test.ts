import { describe, expect, it } from "vitest";
import { buildMainCourseContentBatches, validateMainCourseContentBatches } from "../src/main-course-content";
import { buildKanjiDraft07 } from "../src/editorial-draft-kanji-07";

describe("isolated editorial drafts", () => {
  it("keeps ten bilingual kanji and nine components pending outside the curator", () => {
    const draft = buildKanjiDraft07();
    expect(draft.reviewedAt).toBeNull();
    expect(draft.kanji).toHaveLength(10);
    expect(draft.components).toHaveLength(9);
    expect(buildMainCourseContentBatches().some((batch) => batch.id === draft.id)).toBe(false);
    expect(validateMainCourseContentBatches([...buildMainCourseContentBatches(), draft])).toEqual([]);
    expect(draft.kanji.find((item) => item.character === "今")?.reading).toMatchObject({ primary: "こん", accepted: ["こん"] });
    expect(draft.kanji.every((item) => item.meaningMnemonic.ru && item.meaningMnemonic.en && item.readingMnemonic.ru && item.readingMnemonic.en)).toBe(true);
  });
});
