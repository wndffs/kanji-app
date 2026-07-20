import { type ConfusablePairRankingInput } from "./confusables.types";

export function rankConfusablePairs<T extends ConfusablePairRankingInput>(
  pairs: readonly T[],
): readonly T[] {
  return [...pairs].sort(
    (left, right) =>
      right.recentWrongCount - left.recentWrongCount ||
      right.strength - left.strength ||
      left.id.localeCompare(right.id),
  );
}
