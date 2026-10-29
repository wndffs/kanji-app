export type LexicalKind = "verb" | "i-adjective" | "noun";
export type LexicalCandidate = {
  readonly expression: string;
  readonly reading: string;
  readonly kind: LexicalKind;
  readonly usefulness: number;
  readonly sourceRecordId: string | null;
  readonly matches: number;
  readonly bilingual: boolean;
  readonly sourceRank: number | null;
};

export const lexicalPairKey = (pair: { expression: string; reading: string }) =>
  JSON.stringify([pair.expression, pair.reading]);

export function rankLexicalCandidates(
  candidates: readonly LexicalCandidate[],
  options: {
    readonly existingPairs: ReadonlySet<string>;
    readonly prerequisiteLevels: ReadonlyMap<string, number>;
    readonly wordLevel: number;
  },
) {
  if (!Number.isInteger(options.wordLevel) || options.wordLevel < 1)
    throw new Error("Invalid lexical placement level.");
  const selected: LexicalCandidate[] = [];
  const rejected: { key: string; reason: string }[] = [];
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = lexicalPairKey(candidate);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const candidate of candidates) {
    const key = lexicalPairKey(candidate);
    const missing = [...new Set(candidate.expression.match(/\p{Script=Han}/gu) ?? [])].some(
      (character) => {
        const level = options.prerequisiteLevels.get(character);
        return (
          level === undefined || !Number.isInteger(level) || level < 1 || level >= options.wordLevel
        );
      },
    );
    const reason =
      !candidate.expression ||
      candidate.expression.trim() !== candidate.expression ||
      !/^[\u3041-\u3096\u30fc]+$/u.test(candidate.reading) ||
      !["verb", "i-adjective", "noun"].includes(candidate.kind) ||
      !Number.isInteger(candidate.usefulness) ||
      candidate.usefulness < 1 ||
      candidate.usefulness > 3 ||
      (candidate.sourceRank !== null &&
        (!Number.isInteger(candidate.sourceRank) || candidate.sourceRank < 1))
        ? "invalid-metadata"
        : options.existingPairs.has(key)
          ? "already-registered"
          : counts.get(key)! > 1
            ? "duplicate-proposal"
            : candidate.matches !== 1 || !/^jmdict:\d+$/u.test(candidate.sourceRecordId ?? "")
              ? "missing-or-ambiguous-source"
              : !candidate.bilingual
                ? "missing-bilingual-source"
                : missing
                  ? "missing-earlier-kanji"
                  : null;
    if (reason) rejected.push({ key, reason });
    else selected.push(candidate);
  }
  selected.sort((a, b) => {
    const priority = b.usefulness - a.usefulness;
    if (priority) return priority;
    const leftRank = a.sourceRank ?? Infinity;
    const rightRank = b.sourceRank ?? Infinity;
    if (leftRank !== rightRank) return leftRank < rightRank ? -1 : 1;
    const left = lexicalPairKey(a);
    const right = lexicalPairKey(b);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return { selected, rejected, publicationApproved: false as const };
}

export function selectLexicalBackbone(ranked: readonly LexicalCandidate[]) {
  const quotas = { verb: 10, "i-adjective": 5, noun: 5 } as const;
  const selected = Object.entries(quotas).flatMap(([kind, count]) => {
    const group = ranked.filter((entry) => entry.kind === kind);
    if (group.length < count) throw new Error(`Insufficient verified ${kind} candidates.`);
    return group.slice(0, count);
  });
  const keys = new Set(selected.map(lexicalPairKey));
  if (keys.size !== 20) throw new Error("Backbone requires twenty distinct exact pairs.");
  return {
    selected,
    deferred: ranked.filter((entry) => !keys.has(lexicalPairKey(entry))),
    publicationApproved: false as const,
  };
}
