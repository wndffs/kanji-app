import { describe, expect, it } from "vitest";

import { type CharacterHubKanjiItemDto } from "@kanji-srs/shared";

import {
  buildCharacterHubHref,
  filterCharacterHubKanji,
  parseCharacterHubQuery,
  DEFAULT_CHARACTER_CATALOGUE,
  sortCharacterHubKanji,
  characterMeaningRows,
} from "../src/lib/character-hub";

describe("character hub query", () => {
  it("parses supported URL filters and rejects invalid values", () => {
    expect(
      parseCharacterHubQuery(new URLSearchParams("tab=kanji&level=12&band=n3&jlpt=n2&state=weak")),
    ).toEqual({
      tab: "kanji",
      kanaGroup: "basic",
      kanaStatus: "all",
      catalogue: DEFAULT_CHARACTER_CATALOGUE,
      filters: { level: 12, band: "n3", jlpt: "n2", state: "weak" },
    });

    expect(parseCharacterHubQuery(new URLSearchParams("tab=words&level=-2&band=n1"))).toEqual({
      tab: "hiragana",
      kanaGroup: "basic",
      kanaStatus: "all",
      catalogue: DEFAULT_CHARACTER_CATALOGUE,
      filters: { level: null, band: null, jlpt: null, state: null },
    });
  });

  it("builds stable tab and filter links", () => {
    expect(
      buildCharacterHubHref("kanji", {
        level: 3,
        band: "n5",
        jlpt: null,
        state: "learning",
      }),
    ).toBe("/characters?tab=kanji&level=3&band=n5&state=learning");
  });
  it("keeps view options in canonical links without inventing unsupported views", () => {
    expect(parseCharacterHubQuery(new URLSearchParams("view=list")).catalogue.view).toBe("list");
    expect(parseCharacterHubQuery(new URLSearchParams("view=custom")).catalogue.view).toBe("grid");
    expect(
      buildCharacterHubHref("kanji", undefined, "basic", "all", {
        ...DEFAULT_CHARACTER_CATALOGUE,
        view: "list",
      }),
    ).toBe("/characters?tab=kanji&view=list");
  });
  it("requires an explicit hidden-readings URL option", () => {
    expect(parseCharacterHubQuery(new URLSearchParams()).catalogue.showReadings).toBe(true);
    expect(
      parseCharacterHubQuery(new URLSearchParams("readings=invalid")).catalogue.showReadings,
    ).toBe(true);
    expect(
      parseCharacterHubQuery(new URLSearchParams("readings=hidden")).catalogue.showReadings,
    ).toBe(false);
    expect(
      buildCharacterHubHref("kanji", undefined, "basic", "all", {
        ...DEFAULT_CHARACTER_CATALOGUE,
        showReadings: false,
      }),
    ).toBe("/characters?tab=kanji&readings=hidden");
  });
  it("round trips the entire workspace and rejects malformed options", () => {
    const catalogue = {
      ...DEFAULT_CHARACTER_CATALOGUE,
      page: 2,
      q: " 一 ONE ",
      view: "list" as const,
      sort: "reading" as const,
      showReadings: false,
    };
    const href = buildCharacterHubHref(
      "kanji",
      { level: 2, band: "n5", jlpt: null, state: "weak" },
      "yoon",
      "started",
      catalogue,
    );
    const parsed = parseCharacterHubQuery(new URLSearchParams(href.split("?")[1]));
    expect(parsed.catalogue).toEqual({ ...catalogue, q: "一 ONE" });
    expect(parsed.filters).toEqual({ level: 2, band: "n5", jlpt: null, state: "weak" });
    expect(parsed.kanaGroup).toBe("yoon");
    expect(parsed.kanaStatus).toBe("started");
    expect(
      parseCharacterHubQuery(new URLSearchParams("sort=unsafe&view=unsafe&q=%0A")).catalogue,
    ).toEqual(DEFAULT_CHARACTER_CATALOGUE);
  });
  it("accepts only bounded positive decimal catalogue pages", () => {
    for (const value of ["0", "-1", "1.2", "Infinity", "1e2", "10001", "999999999999999999"])
      expect(parseCharacterHubQuery(new URLSearchParams({ page: value })).catalogue.page).toBe(1);
    expect(parseCharacterHubQuery(new URLSearchParams("page=3")).catalogue.page).toBe(3);
    expect(
      buildCharacterHubHref("kanji", undefined, "basic", "all", {
        ...DEFAULT_CHARACTER_CATALOGUE,
        page: 3,
      }),
    ).toBe("/characters?tab=kanji&page=3");
  });
  it("round trips kana groups without changing kanji filters", () => {
    const href = buildCharacterHubHref("katakana", undefined, "handakuten");
    expect(href).toBe("/characters?tab=katakana&group=handakuten");
    expect(parseCharacterHubQuery(new URLSearchParams(href.split("?")[1])).kanaGroup).toBe(
      "handakuten",
    );
    expect(parseCharacterHubQuery(new URLSearchParams("group=invalid")).kanaGroup).toBe("basic");
    expect(parseCharacterHubQuery(new URLSearchParams("kanaState=mastered")).kanaStatus).toBe(
      "mastered",
    );
    expect(parseCharacterHubQuery(new URLSearchParams("kanaState=invalid")).kanaStatus).toBe("all");
    expect(buildCharacterHubHref("hiragana", undefined, "basic", "started")).toBe(
      "/characters?tab=hiragana&kanaState=started",
    );
  });

  it("filters kanji without conflating weak items with SRS states", () => {
    const items = [buildItem("一", "learning", true), buildItem("二", "passed", false)];

    expect(
      filterCharacterHubKanji(items, {
        level: 1,
        band: "n5",
        jlpt: "n5",
        state: "weak",
      }).map((item) => item.character),
    ).toEqual(["一"]);
  });
  it("matches glyph, kana, romaji and both normalized learning languages", () => {
    const item = {
      ...buildItem("一", "learning", false),
      reading: "いち",
      meaningRu: "Ёлка",
      meaningEn: "One",
    };
    for (const q of ["一", "イチ", " ＩＣＨＩ ", "елка", "ONE", "一 one"])
      expect(
        filterCharacterHubKanji([item], { level: null, band: null, jlpt: null, state: null }, q),
      ).toEqual([item]);
    expect(
      filterCharacterHubKanji(
        [item],
        { level: null, band: null, jlpt: null, state: null },
        "absent",
      ),
    ).toEqual([]);
    expect(parseCharacterHubQuery(new URLSearchParams({ q: "x".repeat(81) })).catalogue.q).toBe("");
  });
  it("sorts a copy with stable ties, missing values last and the selected meaning language", () => {
    const a = {
      ...buildItem("一", "learning", true),
      reading: "いち",
      meaningRu: "я",
      meaningEn: "a",
      weaknessScore: 10,
    };
    const b = {
      ...buildItem("二", "passed", false),
      reading: "に",
      meaningRu: "а",
      meaningEn: "z",
    };
    const missing = buildItem("三", "not-started", false);
    const source = [missing, b, a];
    expect(sortCharacterHubKanji(source, "course", "ru")).toBe(source);
    expect(sortCharacterHubKanji(source, "reading", "ru")).toEqual([a, b, missing]);
    expect(sortCharacterHubKanji(source, "meaning", "ru")).toEqual([b, a, missing]);
    expect(sortCharacterHubKanji(source, "meaning", "en")).toEqual([a, b, missing]);
    expect(sortCharacterHubKanji(source, "weakness", "ru")[0]).toBe(a);
    expect(source).toEqual([missing, b, a]);
  });
  it("labels both learning languages and never substitutes EN for a missing Russian meaning", () => {
    const item = { meaningRu: " ", meaningEn: " one " };
    expect(characterMeaningRows(item, "ru")).toEqual([{ lang: "ru", label: "RU", text: null }]);
    expect(characterMeaningRows(item, "en")).toEqual([{ lang: "en", label: "EN", text: "one" }]);
    expect(characterMeaningRows(item, "ru-en")).toEqual([
      { lang: "ru", label: "RU", text: null },
      { lang: "en", label: "EN", text: "one" },
    ]);
  });
});

function buildItem(
  character: string,
  studyState: CharacterHubKanjiItemDto["studyState"],
  weak: boolean,
): CharacterHubKanjiItemDto {
  return {
    id: `item-${character}`,
    character,
    reading: null,
    meaningRu: null,
    meaningEn: null,
    level: 1,
    band: "n5",
    jlptLevel: "n5",
    studyState,
    stageIndex: null,
    stageName: null,
    weaknessScore: weak ? 10 : 0,
    weak,
    href: `/kanji/${character}`,
  };
}
