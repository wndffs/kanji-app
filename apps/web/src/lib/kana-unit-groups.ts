import { type KanaAssessmentItemDto, type KanaLessonUnitDto, type KanaVariant } from "@kanji-srs/shared";

export const KANA_GROUP_LABELS: Readonly<Record<KanaVariant | "all", string>> = {
  basic: "Базовые знаки",
  dakuten: "Дакутэн: が・ざ・だ・ば",
  handakuten: "Хандакутэн: ぱ",
  yoon: "Сочетания: きゃ",
  sokuon: "Удвоение согласных: っ",
  "long-vowel": "Долгие гласные",
  all: "Все знаки",
};

export function groupKanaCharacters(items: readonly KanaAssessmentItemDto[]) {
  return (Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[])
    .filter((variant): variant is KanaVariant => variant !== "all")
    .map((variant) => ({ variant, label: KANA_GROUP_LABELS[variant], items: items.filter((item) => item.variant === variant) }))
    .filter((group) => group.items.length > 0);
}

export function filterKanaUnits(
  units: readonly KanaLessonUnitDto[],
  group: KanaVariant | "all",
): readonly KanaLessonUnitDto[] {
  if (group === "all") return units;
  return units.flatMap((unit) => {
    const items = unit.items.filter((item) => item.variant === group);
    if (items.length === 0) return [];
    return [
      {
        ...unit,
        items,
        totalCount: items.length,
        masteredCount: items.filter((item) => item.mastered).length,
        complete: items.every((item) => item.mastered),
      },
    ];
  });
}

export function findKanaLessonUnits(
  units: readonly KanaLessonUnitDto[],
  query: string,
  group: KanaVariant | "all",
) {
  const normalize = (value: string) => value.normalize("NFKC").trim().toLocaleLowerCase("ru-RU");
  const needle = normalize(query);
  return units.filter((unit) => {
    const eligible = unit.items.filter((item) => group === "all" || item.variant === group);
    return (
      eligible.length > 0 &&
      (normalize(unit.title).includes(needle) ||
        eligible.some(
          (item) =>
            normalize(item.character).includes(needle) || normalize(item.romaji).includes(needle),
        ))
    );
  });
}
