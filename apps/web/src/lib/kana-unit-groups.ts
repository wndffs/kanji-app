import {
  type KanaAssessmentItemDto,
  type KanaLessonUnitDto,
  type KanaVariant,
} from "@kanji-srs/shared";

export const KANA_GROUP_LABELS: Readonly<Record<KanaVariant | "all", string>> = {
  basic: "Базовые знаки",
  dakuten: "Дакутэн: が・ざ・だ・ば",
  handakuten: "Хандакутэн: ぱ",
  yoon: "Сочетания: きゃ",
  sokuon: "Удвоение согласных: っ",
  "long-vowel": "Долгие гласные",
  all: "Все элементы",
};

export const KANA_UNIT_STATUS_LABELS = {
  all: "Все уроки",
  available: "Доступные",
  started: "Начаты",
  unfinished: "Не освоены",
  mastered: "Освоены",
} as const;
export type KanaUnitStatus = keyof typeof KANA_UNIT_STATUS_LABELS;

export function filterKanaUnitStatus(units: readonly KanaLessonUnitDto[], status: KanaUnitStatus) {
  return units.filter((unit) => {
    switch (status) {
      case "available": return unit.unlocked;
      case "started": return unit.items.some((item) => item.attemptCount > 0);
      case "unfinished": return !unit.complete;
      case "mastered": return unit.complete;
      default: return true;
    }
  });
}

const CONTENT_CATEGORIES = [
  { id: "basic", label: "Основные знаки", variants: ["basic"] },
  { id: "modified", label: "Дакутэн и хандакутэн", variants: ["dakuten", "handakuten"] },
  { id: "combinations", label: "Сочетания", variants: ["yoon"] },
  { id: "exercises", label: "Упражнения", variants: ["sokuon", "long-vowel"] },
] as const;

export function summarizeKanaContent(
  items: readonly Pick<KanaAssessmentItemDto, "variant" | "mastered">[],
) {
  return CONTENT_CATEGORIES.map((category) => {
    const included = items.filter((item) =>
      (category.variants as readonly KanaVariant[]).includes(item.variant),
    );
    return {
      id: category.id,
      label: category.label,
      total: included.length,
      mastered: included.filter((item) => item.mastered).length,
    };
  }).filter((category) => category.total > 0);
}

export function groupKanaCharacters(items: readonly KanaAssessmentItemDto[]) {
  return (Object.keys(KANA_GROUP_LABELS) as (KanaVariant | "all")[])
    .filter((variant): variant is KanaVariant => variant !== "all")
    .map((variant) => ({
      variant,
      label: KANA_GROUP_LABELS[variant],
      items: items.filter((item) => item.variant === variant),
    }))
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

export function selectKanaResumeUnit(units: readonly KanaLessonUnitDto[]): KanaLessonUnitDto | null {
  const available = units.filter((unit) => unit.unlocked && unit.items.length > 0);
  return available.find((unit) => !unit.complete) ?? available.at(-1) ?? null;
}

export function findKanaPrerequisite(units: readonly KanaLessonUnitDto[], unitId: string) {
  const index = units.findIndex((unit) => unit.id === unitId);
  if (index < 0 || units[index]?.unlocked) return null;
  return units.slice(0, index).find((unit) => !unit.complete) ?? null;
}

export function summarizeKanaUnits(units: readonly KanaLessonUnitDto[]) {
  const items = units.flatMap((unit) => unit.items);
  return {
    total: items.length,
    mastered: items.filter((item) => item.mastered).length,
    started: items.filter((item) => item.attemptCount > 0).length,
  };
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
