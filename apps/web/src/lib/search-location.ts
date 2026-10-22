export function parseSearchPage(value: string | null): number {
  const page = Number(value);
  return Number.isSafeInteger(page) && page >= 1 && page <= 10_000 ? page : 1;
}

export function searchHref(query: string, page = 1): string {
  const trimmed = query.trim();
  if (trimmed === "") return "/search";
  const params = new URLSearchParams({ q: trimmed });
  if (page > 1) params.set("page", String(page));
  return `/search?${params.toString()}`;
}
