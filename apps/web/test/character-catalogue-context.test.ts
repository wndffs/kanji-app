import { describe, expect, it } from "vitest";
import {
  characterCatalogueItemHref,
  characterCatalogueReturnHref,
} from "../src/lib/character-catalogue-context";

describe("kanji catalogue return context", () => {
  it("retains normalized filters and options and removes unknown parameters", () => {
    const raw =
      "/characters?tab=kanji&page=2&q=ichi&sort=reading&view=list&level=3&untrusted=admin";
    const href = characterCatalogueReturnHref(raw)!;
    expect(href).toContain("page=2");
    expect(href).toContain("level=3");
    expect(href).toContain("view=list");
    expect(href).not.toContain("untrusted");
    const item = new URL(characterCatalogueItemHref("一", href), "https://app.test");
    expect(item.pathname).toBe("/kanji/%E4%B8%80");
    expect(item.searchParams.get("catalogue")).toBe(href);
  });
  it.each([
    undefined,
    ["x"],
    "//evil.test/characters?tab=kanji",
    "https://evil.test/characters?tab=kanji",
    "/characters/../admin?tab=kanji",
    "/characters?tab=hiragana",
    "/characters?tab=kanji#admin",
    "/characters?tab=kanji\n",
    "/characters?tab=kanji\\evil",
    "/characters?tab=kanji&q=" + "x".repeat(2049),
  ])("rejects unsafe or unrelated return context %j", (input) => {
    expect(characterCatalogueReturnHref(input)).toBeNull();
  });
});
