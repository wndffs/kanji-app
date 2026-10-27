import { describe, expect, it } from "vitest";
import { type LessonQueueItem } from "@kanji-srs/shared";
import {
  DEFAULT_LESSON_BROWSER,
  filterLessonBrowser,
  lessonBrowserHref,
  lessonSourceHref,
  mergeLessonBrowser,
  normalizeLessonSearch,
  parseLessonBrowser,
  parseLessonSource,
} from "../src/lib/lesson-browser";

const lesson: LessonQueueItem = {
  item: {
    id: "one",
    itemType: "kanji",
    slug: "kanji:一",
    japanese: "一",
    reading: "いち",
    translations: {
      displayMode: "ru-en",
      primaryRu: "один",
      primaryEn: "one",
      ru: [{ locale: "ru-RU", text: "единица" }],
      en: [],
    },
    level: 1,
    jlptLevel: "N5",
    srs: null,
  },
  cards: [],
  unlockedBy: [],
  mnemonics: [],
  hints: [],
  exampleSentences: [],
};

describe("lesson source and browser", () => {
  it("keeps compatible source identifiers but rejects ambiguous and unsafe source input", () => {
    expect(parseLessonSource(new URLSearchParams())).toEqual({ deckId: null, invalid: false });
    for (const value of ["deck-saved", "a7cd_123", "b4326dc9-1dd1-4680-a84c-bbe1b3dc5e20"])
      expect(parseLessonSource(new URLSearchParams({ deckId: value }))).toEqual({
        deckId: value,
        invalid: false,
      });
    for (const value of ["../other", "https://evil.test", "a".repeat(129), "bad\nvalue"])
      expect(parseLessonSource(new URLSearchParams({ deckId: value })).invalid).toBe(true);
    expect(parseLessonSource(new URLSearchParams("deckId=one&deckId=two")).invalid).toBe(true);
    expect(lessonSourceHref("deck-saved")).toBe("/lessons?deckId=deck-saved");
  });
  it("bounds integer and enum options and normalizes search", () => {
    expect(
      parseLessonBrowser(new URLSearchParams("page=-1&level=99&kind=other&selected=yes")),
    ).toEqual(DEFAULT_LESSON_BROWSER);
    expect(parseLessonBrowser(new URLSearchParams("page=10001&level=0"))).toEqual(
      DEFAULT_LESSON_BROWSER,
    );
    expect(
      parseLessonBrowser(
        new URLSearchParams({
          q: "  ONE   one ",
          level: "2",
          page: "4",
          selected: "1",
          kind: "word",
        }),
      ),
    ).toEqual({ q: "ONE one", level: 2, page: 4, selected: true, kind: "word" });
    expect(normalizeLessonSearch("x".repeat(81))).toBe("");
    expect(normalizeLessonSearch("line\nbreak")).toBe("");
  });
  it.each(["一", "イチ", "ichi", "ОДИН", "one", "единица", "一 one"])(
    "searches independently loaded educational fields: %s",
    (q) => {
      expect(filterLessonBrowser([lesson], { ...DEFAULT_LESSON_BROWSER, q }, new Set())).toEqual([
        lesson,
      ]);
    },
  );
  it("combines filters without changing eligibility, selection or source order", () => {
    const word = {
      ...lesson,
      item: { ...lesson.item, id: "word", itemType: "word" as const, level: 2 },
    };
    const items = [lesson, word];
    const snapshot = structuredClone(items);
    const selected = new Set(["word", "not-eligible"]);
    expect(
      filterLessonBrowser(
        items,
        { ...DEFAULT_LESSON_BROWSER, kind: "word", level: 2, selected: true },
        selected,
      ),
    ).toEqual([word]);
    expect(
      filterLessonBrowser(items, { ...DEFAULT_LESSON_BROWSER, q: "unmatched" }, selected),
    ).toEqual([]);
    expect(items).toEqual(snapshot);
    expect([...selected]).toEqual(["word", "not-eligible"]);
  });
  it("merges rapid partial filter choices and resets pages without losing intent", () => {
    const first = mergeLessonBrowser(
      { ...DEFAULT_LESSON_BROWSER, page: 4, q: "one" },
      { kind: "kanji" },
    );
    const second = mergeLessonBrowser(first, { level: 1 });
    expect(second).toEqual({ ...DEFAULT_LESSON_BROWSER, q: "one", kind: "kanji", level: 1 });
    expect(mergeLessonBrowser(second, { page: 2 })).toEqual({ ...second, page: 2 });
    const href = lessonBrowserHref("deck-saved", { ...second, selected: true });
    expect(href).toBe("/lessons?deckId=deck-saved&q=one&kind=kanji&level=1&selected=1");
    expect(parseLessonBrowser(new URL(href, "https://app.test").searchParams)).toEqual({
      ...second,
      selected: true,
    });
  });
});
