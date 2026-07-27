import { describe, expect, it } from "vitest";

import { type CharacterHubKanjiItemDto } from "@kanji-srs/shared";

import {
  buildCharacterHubHref,
  filterCharacterHubKanji,
  parseCharacterHubQuery,
} from "../src/lib/character-hub";

describe("character hub query", () => {
  it("parses supported URL filters and rejects invalid values", () => {
    expect(
      parseCharacterHubQuery(
        new URLSearchParams("tab=kanji&level=12&band=n3&jlpt=n2&state=weak"),
      ),
    ).toEqual({
      tab: "kanji",
      filters: { level: 12, band: "n3", jlpt: "n2", state: "weak" },
    });

    expect(parseCharacterHubQuery(new URLSearchParams("tab=words&level=-2&band=n1"))).toEqual({
      tab: "hiragana",
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

  it("filters kanji without conflating weak items with SRS states", () => {
    const items = [
      buildItem("一", "learning", true),
      buildItem("二", "passed", false),
    ];

    expect(
      filterCharacterHubKanji(items, {
        level: 1,
        band: "n5",
        jlpt: "n5",
        state: "weak",
      }).map((item) => item.character),
    ).toEqual(["一"]);
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
