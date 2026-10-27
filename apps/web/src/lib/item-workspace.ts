import { getContentLocalesForDisplayMode, type TranslationDisplayMode } from "@kanji-srs/shared";

export const ITEM_VIEWS = ["study", "personal", "history", "sources"] as const;
export type ItemView = (typeof ITEM_VIEWS)[number];

export function parseItemView(value: string | null): ItemView {
  return ITEM_VIEWS.find((view) => view === value) ?? "study";
}

export function itemViewHref(pathname: string, search: URLSearchParams, view: ItemView): string {
  const params = new URLSearchParams(search);
  params.delete("view");
  if (view !== "study") params.set("view", view);
  return `${pathname}${params.size ? `?${params}` : ""}`;
}

export function itemTranslationRows(ru: string | null, en: string | null, mode: TranslationDisplayMode) {
  return getContentLocalesForDisplayMode(mode).map((locale) => ({
    locale,
    label: locale === "ru-RU" ? "RU" : "EN",
    text: (locale === "ru-RU" ? ru : en)?.trim() || null,
  }));
}
