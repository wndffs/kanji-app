import { type ItemDetails, type ItemSummary } from "@kanji-srs/shared";

export function selectReinforcementWords(
  item: Pick<ItemDetails, "itemType" | "japanese" | "relationGroups">,
): readonly ItemSummary[] {
  if (item.itemType !== "kanji") return [];
  const words = item.relationGroups.flatMap((group) =>
    group.kind === "vocabulary" ? group.items : [],
  );
  const seen = new Set<string>();
  return words
    .filter((word) => {
      if (word.itemType !== "word" || !word.japanese.includes(item.japanese) || seen.has(word.id))
        return false;
      seen.add(word.id);
      return true;
    })
    .slice(0, 4);
}
