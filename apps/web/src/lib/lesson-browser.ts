import { ITEM_KINDS, type ItemKind, type LessonQueueItem } from "@kanji-srs/shared";
import { normalizeKana, normalizeRussianMeaning, romanizeKana } from "@kanji-srs/japanese";
import { normalizeCourseSearch } from "./course-browser-route";

export { normalizeCourseSearch as normalizeLessonSearch } from "./course-browser-route";
export const LESSON_PICKER_PAGE_SIZE = 24;
export type LessonBrowserRoute = {
  readonly q: string;
  readonly kind: ItemKind | "all";
  readonly level: number | null;
  readonly selected: boolean;
  readonly page: number;
};
export const DEFAULT_LESSON_BROWSER: LessonBrowserRoute = {
  q: "",
  kind: "all",
  level: null,
  selected: false,
  page: 1,
};

export function parseLessonBrowser(params: URLSearchParams): LessonBrowserRoute {
  const positive = (value: string | null, max: number) =>
    value !== null && /^[1-9]\d*$/u.test(value) && Number(value) <= max ? Number(value) : null;
  const kind = params.get("kind");
  return {
    q: normalizeCourseSearch(params.get("q") ?? ""),
    kind: ITEM_KINDS.includes(kind as ItemKind) ? (kind as ItemKind) : "all",
    level: positive(params.get("level"), 60),
    selected: params.get("selected") === "1",
    page: positive(params.get("page"), 10_000) ?? 1,
  };
}

export function mergeLessonBrowser(
  current: LessonBrowserRoute,
  patch: Partial<LessonBrowserRoute>,
): LessonBrowserRoute {
  return {
    ...current,
    ...(Object.keys(patch).some((key) => key !== "page") ? { page: 1 } : {}),
    ...patch,
  };
}

export function lessonBrowserHref(deckId: string | null, route: LessonBrowserRoute): string {
  const params = new URLSearchParams();
  if (deckId !== null) params.set("deckId", deckId);
  if (route.q) params.set("q", normalizeCourseSearch(route.q));
  if (route.kind !== "all") params.set("kind", route.kind);
  if (route.level !== null) params.set("level", String(route.level));
  if (route.selected) params.set("selected", "1");
  if (route.page > 1) params.set("page", String(route.page));
  return `/lessons${params.size ? `?${params}` : ""}`;
}

export function filterLessonBrowser(
  items: readonly LessonQueueItem[],
  route: LessonBrowserRoute,
  selected: ReadonlySet<string>,
): readonly LessonQueueItem[] {
  const normalize = (text: string) =>
    normalizeRussianMeaning(normalizeKana(text.normalize("NFKC")));
  const words = normalize(route.q).split(/\s+/u).filter(Boolean);
  return items.filter(({ item, cards }) => {
    if (route.kind !== "all" && item.itemType !== route.kind) return false;
    if (route.level !== null && item.level !== route.level) return false;
    if (route.selected && !selected.has(item.id)) return false;
    if (!words.length) return true;
    const readings = [
      item.reading ?? "",
      ...cards
        .filter((card) => card.answerType === "reading")
        .flatMap((card) => card.acceptedAnswers.map((answer) => answer.text)),
    ];
    const fields = [
      item.japanese,
      ...readings,
      ...readings.map((reading) => romanizeKana(reading) ?? ""),
      item.translations.primaryRu ?? "",
      item.translations.primaryEn ?? "",
      ...item.translations.ru.map((row) => row.text),
      ...item.translations.en.map((row) => row.text),
    ].map(normalize);
    return words.every((word) => fields.some((field) => field.includes(word)));
  });
}

export function parseLessonSource(params: URLSearchParams): {
  readonly deckId: string | null;
  readonly invalid: boolean;
} {
  const values = params.getAll("deckId");
  const value = values[0]?.trim() ?? "";
  const invalid = values.length > 1 || (value !== "" && !/^[a-zA-Z0-9_-]{1,128}$/u.test(value));
  return { deckId: invalid || value === "" ? null : value, invalid };
}

export function lessonSourceHref(deckId: string | null): string {
  return `/lessons${deckId === null ? "" : `?${new URLSearchParams({ deckId })}`}`;
}
