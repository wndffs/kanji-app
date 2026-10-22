import { ITEM_KINDS, type ItemKind, type SearchFilters } from "@kanji-srs/shared";

export function parseSearchPage(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export function searchHref(query: string, page = 1, filters: SearchFilters = {}): string {
  const trimmed = query.trim();
  if (trimmed === "") return "/search";
  const params = new URLSearchParams({ q: trimmed });
  if (page > 1) params.set("page", String(page));
  if (filters.itemType !== undefined) params.set("itemType", filters.itemType);
  if (filters.level !== undefined) params.set("level", String(filters.level));
  return `/search?${params.toString()}`;
}
export function parseSearchFilters(itemType: string | null, rawLevel: string | null): SearchFilters {
  const level = Number(rawLevel);
  return {
    ...((ITEM_KINDS as readonly string[]).includes(itemType ?? "") ? { itemType: itemType as ItemKind } : {}),
    ...(Number.isInteger(level) && level >= 1 && level <= 60 ? { level } : {}),
  };
}

