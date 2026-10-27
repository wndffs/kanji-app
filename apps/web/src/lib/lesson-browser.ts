export function parseLessonSource(params: URLSearchParams): { readonly deckId: string | null; readonly invalid: boolean } {
  const values = params.getAll("deckId");
  const value = values[0]?.trim() ?? "";
  const invalid = values.length > 1 || (value !== "" && !/^[a-zA-Z0-9_-]{1,128}$/u.test(value));
  return { deckId: invalid || value === "" ? null : value, invalid };
}

export function lessonSourceHref(deckId: string | null): string {
  return `/lessons${deckId === null ? "" : `?${new URLSearchParams({ deckId })}`}`;
}
