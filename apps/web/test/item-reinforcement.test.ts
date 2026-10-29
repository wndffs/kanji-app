import { describe, expect, it } from "vitest";
import { type ItemDetails, type ItemSummary } from "@kanji-srs/shared";
import { selectReinforcementWords } from "../src/lib/item-reinforcement";

describe("published kanji vocabulary reinforcement", () => {
  const word = (id: string, japanese = "日本"): ItemSummary =>
    ({ id, japanese, itemType: "word", reading: "にほん" }) as ItemSummary;
  const item = (words: readonly ItemSummary[], itemType = "kanji") => ({
    itemType: itemType as ItemDetails["itemType"],
    japanese: "日",
    relationGroups: [{ kind: "vocabulary" as const, items: words, total: words.length }],
  });
  it("keeps exact published relationships, deduplicates and bounds the preview", () => {
    expect(
      selectReinforcementWords(
        item([
          word("a"),
          word("a"),
          word("b", "水"),
          ...[1, 2, 3, 4, 5].map((n) => word(String(n))),
        ]),
      ).map((w) => w.id),
    ).toEqual(["a", "1", "2", "3"]);
  });
  it("does not invent reinforcement for non-kanji targets", () => {
    expect(selectReinforcementWords(item([word("a")], "word"))).toEqual([]);
  });
});
