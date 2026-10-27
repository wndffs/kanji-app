import { describe, expect, it } from "vitest";
import { itemTranslationRows, itemViewHref, parseItemView } from "../src/lib/item-workspace";

describe("material workspace", () => {
  it.each([null, "", "invalid", "PERSONAL", "//other.test"])(
    "defaults unknown view %s without navigation",
    (value) => {
      expect(parseItemView(value)).toBe("study");
    },
  );
  it.each(["study", "personal", "history", "sources"] as const)(
    "accepts only known view %s",
    (view) => {
      expect(parseItemView(view)).toBe(view);
    },
  );
  it("changes only the view, preserving encoded return context without mutating inputs", () => {
    const params = new URLSearchParams({
      catalogue: "/characters?tab=kanji&q=一&view=list",
      view: "history",
    });
    const result = new URL(
      itemViewHref("/kanji/%E4%B8%80", params, "personal"),
      "https://app.test",
    );
    expect(result.searchParams.get("catalogue")).toBe(params.get("catalogue"));
    expect(result.searchParams.get("view")).toBe("personal");
    expect(params.get("view")).toBe("history");
    expect(
      new URL(
        itemViewHref(result.pathname, result.searchParams, "study"),
        result.origin,
      ).searchParams.has("view"),
    ).toBe(false);
  });
  it("labels selected translations with explicit absence and no cross-language fallback", () => {
    expect(itemTranslationRows(null, "one", "ru")).toEqual([
      { locale: "ru-RU", label: "RU", text: null },
    ]);
    expect(itemTranslationRows("один", "  ", "en")).toEqual([
      { locale: "en-US", label: "EN", text: null },
    ]);
    expect(itemTranslationRows(" один ", "one", "ru-en").map((row) => row.text)).toEqual([
      "один",
      "one",
    ]);
  });
});
