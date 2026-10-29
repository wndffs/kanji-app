import type { DeckItemDto, ItemKind } from "@kanji-srs/shared";
import { normalizeKana, normalizeRussianMeaning } from "@kanji-srs/japanese";
import { DEFAULT_LESSON_BROWSER, lessonBrowserHref } from "./lesson-browser";

export type DeckContentFilter = {
  readonly kind: ItemKind | "";
  readonly state: string;
  readonly query: string;
};

export function filterDeckContents(items: readonly DeckItemDto[], filter: DeckContentFilter) {
  const normalize = (value: string) =>
    normalizeRussianMeaning(normalizeKana(value.normalize("NFKC")));
  const words = normalize(filter.query).split(/\s+/u).filter(Boolean);
  return items.filter(({ item, isNewForUser }) => {
    if (filter.kind !== "" && item.itemType !== filter.kind) return false;
    if (filter.state !== "all" && isNewForUser !== (filter.state === "new")) return false;
    const fields = [
      item.japanese,
      item.reading ?? "",
      ...(item.translations?.ru.map((row) => row.text) ?? []),
      ...(item.translations?.en.map((row) => row.text) ?? []),
    ].map(normalize);
    return words.every((word) => fields.some((field) => field.includes(word)));
  });
}

export function deckLessonHref(deckId: string, kind: ItemKind | "", query: string) {
  return lessonBrowserHref(deckId, { ...DEFAULT_LESSON_BROWSER, kind: kind || "all", q: query });
}
