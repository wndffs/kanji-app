export type ReferenceMode = "ru" | "en" | "ru-en";
export type ReferenceView = "dashboard" | "lesson" | "review";

// Project-authored demo fixtures, never a published course or account snapshot.
export const REFERENCE_MATERIALS = [
  { glyph: "日", reading: "にち", ru: "день", en: "day" },
  { glyph: "月", reading: "つき", ru: "луна", en: "moon" },
  { glyph: "火", reading: "ひ", ru: "огонь", en: "fire" },
  { glyph: "水", reading: "みず", ru: "вода", en: "water" },
  { glyph: "木", reading: "き", ru: "дерево", en: "tree" },
  { glyph: "金", reading: "きん", ru: "золото", en: "gold" },
  { glyph: "土", reading: "つち", ru: "земля", en: "soil" },
  { glyph: "山", reading: "やま", ru: "гора", en: "mountain" },
  { glyph: "川", reading: "かわ", ru: "река", en: "river" },
  { glyph: "人", reading: "ひと", ru: "человек", en: "person" },
  { glyph: "口", reading: "くち", ru: "рот", en: "mouth" },
  { glyph: "一", reading: "いち", ru: "один", en: "one" },
] as const;

export function referenceMeaning(item: { ru: string; en: string }, mode: ReferenceMode): string {
  return mode === "ru" ? item.ru : mode === "en" ? item.en : `${item.ru} / ${item.en}`;
}

export const REFERENCE_FORECAST = [
  { label: "18:00", count: 8 },
  { label: "20:00", count: 14 },
  { label: "22:00", count: 6 },
  { label: "Завтра", count: 18 },
] as const;
