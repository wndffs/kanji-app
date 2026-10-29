import { type KanaLessonItemDto } from "@kanji-srs/shared";
import { buildDistinctKanaChoices } from "@kanji-srs/japanese";

export const KANA_EXERCISE_KINDS = [
  "typing",
  "recognition-choice",
  "reverse-choice",
  "matching",
  "listening-choice",
  "tracing",
] as const;

export type KanaExerciseKind = (typeof KANA_EXERCISE_KINDS)[number];

export function selectKanaExerciseKind(
  item: Pick<KanaLessonItemDto, "attemptCount" | "order">,
  options: {
    readonly listeningAvailable?: boolean;
    readonly tracingAvailable?: boolean;
  } = {},
): KanaExerciseKind {
  const kinds = KANA_EXERCISE_KINDS.filter(
    (kind) =>
      (options.listeningAvailable === true || kind !== "listening-choice") &&
      (options.tracingAvailable === true || kind !== "tracing"),
  );

  return kinds[(item.order + item.attemptCount) % kinds.length]!;
}

export function buildKanaExerciseChoices(
  items: readonly KanaLessonItemDto[],
  current: KanaLessonItemDto,
  limit: number,
): readonly KanaLessonItemDto[] {
  return buildDistinctKanaChoices(items, current, limit);
}
