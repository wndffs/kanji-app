import { describe, expect, it } from "vitest";
import { parseSearchFilters, parseSearchPage, searchHref } from "../src/lib/search-location";

describe("search locations", () => {
  it("preserves validated filters when changing pages", () => {
    expect(searchHref("本", 3, parseSearchFilters("kanji", "7"))).toBe("/search?q=%E6%9C%AC&page=3&itemType=kanji&level=7");
    expect(parseSearchFilters("kana", "61")).toEqual({});
    expect(parseSearchFilters(null, null)).toEqual({});
  });
  it.each([null, "", "0", "-2", "1.2", "10001", "garbage"])("resets invalid page %s", (value) => {
    expect(parseSearchPage(value)).toBe(1);
  });
  it("preserves a valid page through URLs and encodes literal search input", () => {
    expect(parseSearchPage("12")).toBe(12);
    expect(searchHref(" 本 & school ", 2)).toBe("/search?q=%E6%9C%AC+%26+school&page=2");
    expect(searchHref("本", 1)).toBe("/search?q=%E6%9C%AC");
    expect(searchHref(" ", 2)).toBe("/search");
  });
});
