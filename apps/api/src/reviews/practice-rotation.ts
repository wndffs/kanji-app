export function rotatePracticeCandidates<T>(
  candidates: readonly T[],
  id: (value: T) => string,
  previousCardIds: readonly string[],
  limit: number,
): readonly T[] {
  if (limit <= 0) return [];
  const last = previousCardIds.at(-1);
  const previous =
    last === undefined ? -1 : candidates.findIndex((candidate) => id(candidate) === last);
  const start = previous < 0 ? 0 : (previous + 1) % Math.max(1, candidates.length);
  return [...candidates.slice(start), ...candidates.slice(0, start)].slice(0, limit);
}
