import { type KanaLessonItemDto } from "@kanji-srs/shared";

export const KANA_EXERCISE_KINDS = [
  "typing",
  "recognition-choice",
  "reverse-choice",
  "matching",
  "listening-choice",
] as const;

export type KanaExerciseKind = (typeof KANA_EXERCISE_KINDS)[number];

const SILENT_KANA_EXERCISE_KINDS = KANA_EXERCISE_KINDS.filter(
  (kind) => kind !== "listening-choice",
);

export function selectKanaExerciseKind(
  item: Pick<KanaLessonItemDto, "attemptCount" | "order">,
  options: { readonly listeningAvailable?: boolean } = {},
): KanaExerciseKind {
  const kinds = options.listeningAvailable ? KANA_EXERCISE_KINDS : SILENT_KANA_EXERCISE_KINDS;

  return kinds[(item.order + item.attemptCount) % kinds.length]!;
}

export function buildKanaExerciseChoices(
  items: readonly KanaLessonItemDto[],
  current: KanaLessonItemDto,
  limit: number,
): readonly KanaLessonItemDto[] {
  const candidates = [
    current,
    ...items
      .filter((item) => item.character !== current.character)
      .sort(
        (left, right) =>
          Math.abs(left.order - current.order) - Math.abs(right.order - current.order) ||
          left.order - right.order,
      ),
  ];
  const uniqueReadings = new Set<string>();
  const selected: KanaLessonItemDto[] = [];

  for (const candidate of candidates) {
    if (uniqueReadings.has(candidate.romaji)) {
      continue;
    }

    uniqueReadings.add(candidate.romaji);
    selected.push(candidate);

    if (selected.length === limit) {
      break;
    }
  }

  if (selected.length < 2) {
    return selected;
  }

  const offset = current.order % selected.length;

  return [...selected.slice(offset), ...selected.slice(0, offset)];
}
