import { type KanaLessonUnitDto, type KanaVariant } from "@kanji-srs/shared";

export const KANA_GROUP_LABELS: Readonly<Record<KanaVariant | "all", string>> = {
  basic: "Базовые знаки", dakuten: "Дакутэн: が・ざ・だ・ば", handakuten: "Хандакутэн: ぱ",
  yoon: "Сочетания: きゃ", sokuon: "Удвоение согласных: っ", "long-vowel": "Долгие гласные", all: "Все знаки",
};

export function filterKanaUnits(units: readonly KanaLessonUnitDto[], group: KanaVariant | "all"): readonly KanaLessonUnitDto[] {
  if (group === "all") return units;
  return units.flatMap((unit) => {
    const items = unit.items.filter((item) => item.variant === group);
    if (items.length === 0) return [];
    return [{ ...unit, items, totalCount: items.length, masteredCount: items.filter((item) => item.mastered).length, complete: items.every((item) => item.mastered) }];
  });
}
