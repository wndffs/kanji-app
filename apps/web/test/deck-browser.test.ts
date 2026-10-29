import { describe, expect, it } from "vitest";
import type { DeckItemDto } from "@kanji-srs/shared";
import { deckLessonHref, filterDeckContents } from "../src/lib/deck-browser";

const item: DeckItemDto = {
  item: {
    id: "one",
    itemType: "kanji",
    slug: "one",
    japanese: "一",
    reading: "いち",
    level: 1,
    jlptLevel: null,
    srs: null,
    translations: {
      displayMode: "ru-en",
      primaryRu: "один",
      primaryEn: "one",
      ru: [{ locale: "ru-RU", text: "один" }],
      en: [{ locale: "en-US", text: "one" }],
    },
  },
  sortOrder: 1,
  reasons: [],
  isNewForUser: true,
};
describe("private deck browser", () => {
  it("filters translations/readings without treating started items as mastered", () => {
    expect(filterDeckContents([item], { kind: "kanji", state: "new", query: "イチ" })).toEqual([
      item,
    ]);
    expect(filterDeckContents([item], { kind: "", state: "all", query: "ONE" })).toEqual([item]);
    expect(filterDeckContents([item], { kind: "", state: "all", query: "一 ONE" })).toEqual([item]);
    expect(filterDeckContents([item], { kind: "word", state: "all", query: "" })).toEqual([]);
    expect(filterDeckContents([item], { kind: "", state: "started", query: "" })).toEqual([]);
  });
  it("carries text/type into the existing lesson picker, not a second scheduler", () => {
    const url = new URL(deckLessonHref("deck-1", "kanji", "один"), "https://example.test");
    expect(url.searchParams.get("deckId")).toBe("deck-1");
    expect(url.searchParams.get("kind")).toBe("kanji");
    expect(url.searchParams.get("q")).toBe("один");
  });
});
