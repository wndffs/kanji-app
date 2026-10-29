import { type KanaCharacter, type KanaScript } from "./kana";
import { kanaDistractorPriority } from "./kana-contrasts";

export const ADAPTIVE_KANA_EXERCISE_KINDS = [
  "typing",
  "recognition-choice",
  "reverse-choice",
  "matching",
  "listening-choice",
  "tracing",
] as const;

export type AdaptiveKanaExerciseKind = (typeof ADAPTIVE_KANA_EXERCISE_KINDS)[number];
export type AdaptiveKanaScriptMode = KanaScript | "mixed";
export type AdaptiveKanaFocusReason = "weak" | "overdue" | "new" | "review";

export type AdaptiveKanaCandidate = KanaCharacter & {
  readonly unlocked: boolean;
  readonly attemptCount: number;
  readonly correctCount: number;
  readonly currentStreak: number;
  readonly mastered: boolean;
  readonly lastAnsweredAt: Date | null;
};

export type KanaAttemptEvidence = {
  readonly expectedCharacter: string;
  readonly submittedAnswer: string | null;
  readonly selectedCharacter: string | null;
  readonly exerciseKind: AdaptiveKanaExerciseKind;
  readonly correct: boolean;
  readonly answeredAt: Date;
};

export type AdaptiveKanaChoice = {
  readonly character: string;
  readonly script: KanaScript;
  readonly romaji: string;
};

export type AdaptiveKanaExercise = {
  readonly id: string;
  readonly character: string;
  readonly script: KanaScript;
  readonly romaji: string;
  readonly exerciseKind: AdaptiveKanaExerciseKind;
  readonly choices: readonly AdaptiveKanaChoice[];
  readonly focusReason: AdaptiveKanaFocusReason;
};

export type BuildAdaptiveKanaSessionInput = {
  readonly candidates: readonly AdaptiveKanaCandidate[];
  readonly attempts: readonly KanaAttemptEvidence[];
  readonly script: AdaptiveKanaScriptMode;
  readonly now: Date;
  readonly seed: string | number;
  readonly size?: number;
};

const DEFAULT_SESSION_SIZE = 12;
const MAX_SESSION_SIZE = 20;
const RECENT_ATTEMPT_LIMIT = 10;
const OVERDUE_AFTER_MS = 7 * 24 * 60 * 60 * 1_000;

export function buildAdaptiveKanaSession(
  input: BuildAdaptiveKanaSessionInput,
): readonly AdaptiveKanaExercise[] {
  const candidates = input.candidates.filter(
    (candidate) =>
      candidate.unlocked && (input.script === "mixed" || candidate.script === input.script),
  );

  if (candidates.length === 0) {
    return [];
  }

  const size = Math.min(
    MAX_SESSION_SIZE,
    Math.max(1, Math.floor(input.size ?? DEFAULT_SESSION_SIZE)),
  );
  const random = createSeededRandom(input.seed);
  const jitter = new Map(candidates.map((candidate) => [candidate.character, random() * 8]));
  const attemptsByCharacter = groupAttempts(input.attempts);
  const masteredCandidates = candidates.filter((candidate) => candidate.mastered);
  const unmasteredCandidates = candidates.filter((candidate) => !candidate.mastered);
  const reviewSlots = masteredCandidates.length === 0 ? 0 : Math.max(1, Math.floor(size * 0.15));
  const usage = new Map<string, number>();
  const exercises: AdaptiveKanaExercise[] = [];
  let masteredUsed = 0;
  let previousKind: AdaptiveKanaExerciseKind | null = null;

  for (let index = 0; index < size; index += 1) {
    const remainingSlots = size - index;
    const requiredReviewSlots = reviewSlots - masteredUsed;
    const forceMastered = requiredReviewSlots > 0 && remainingSlots <= requiredReviewSlots;
    const eligible = selectEligibleCandidates(
      candidates,
      exercises.at(-1)?.character ?? null,
      forceMastered,
      masteredUsed >= reviewSlots && unmasteredCandidates.length > 0,
    );
    const candidate = [...eligible].sort((left, right) => {
      const leftScore =
        scoreCandidate(left, attemptsByCharacter.get(left.character) ?? [], input.now) -
        (usage.get(left.character) ?? 0) * 42 +
        (jitter.get(left.character) ?? 0);
      const rightScore =
        scoreCandidate(right, attemptsByCharacter.get(right.character) ?? [], input.now) -
        (usage.get(right.character) ?? 0) * 42 +
        (jitter.get(right.character) ?? 0);

      return rightScore - leftScore || left.order - right.order;
    })[0]!;
    let exerciseKind = selectExerciseKind(candidate, index, previousKind, random);
    const choices = buildChoices(
      candidate,
      candidates,
      attemptsByCharacter.get(candidate.character) ?? [],
      input.seed,
    );
    if (choices.length < 2 && exerciseKind !== "typing" && exerciseKind !== "tracing")
      exerciseKind = "typing";

    exercises.push({
      id: `${hashSeed(input.seed).toString(36)}-${index + 1}`,
      character: candidate.character,
      script: candidate.script,
      romaji: candidate.romaji,
      exerciseKind,
      choices,
      focusReason: determineFocusReason(
        candidate,
        attemptsByCharacter.get(candidate.character) ?? [],
        input.now,
      ),
    });
    usage.set(candidate.character, (usage.get(candidate.character) ?? 0) + 1);
    masteredUsed += candidate.mastered ? 1 : 0;
    previousKind = exerciseKind;
  }

  return exercises;
}

export function scoreAdaptiveKanaCandidate(
  candidate: AdaptiveKanaCandidate,
  attempts: readonly KanaAttemptEvidence[],
  now: Date,
): number {
  return scoreCandidate(candidate, attempts, now);
}

function selectEligibleCandidates(
  candidates: readonly AdaptiveKanaCandidate[],
  previousCharacter: string | null,
  forceMastered: boolean,
  excludeMastered: boolean,
): readonly AdaptiveKanaCandidate[] {
  const withoutRepeat =
    candidates.length > 1
      ? candidates.filter((candidate) => candidate.character !== previousCharacter)
      : candidates;
  const masteryFiltered = withoutRepeat.filter((candidate) =>
    forceMastered ? candidate.mastered : !(excludeMastered && candidate.mastered),
  );

  return masteryFiltered.length > 0 ? masteryFiltered : withoutRepeat;
}

function scoreCandidate(
  candidate: AdaptiveKanaCandidate,
  attempts: readonly KanaAttemptEvidence[],
  now: Date,
): number {
  const recent = [...attempts]
    .sort((left, right) => right.answeredAt.getTime() - left.answeredAt.getTime())
    .slice(0, RECENT_ATTEMPT_LIMIT);
  const recentAccuracy =
    recent.length > 0
      ? recent.filter((attempt) => attempt.correct).length / recent.length
      : candidate.attemptCount > 0
        ? candidate.correctCount / candidate.attemptCount
        : null;
  const lastAnsweredAt=recent[0]?.answeredAt ?? candidate.lastAnsweredAt;
  const age =
    lastAnsweredAt === null
      ? OVERDUE_AFTER_MS
      : Math.max(0, now.getTime() - lastAnsweredAt.getTime());
  const overdueScore = Math.min(40, Math.floor(age / OVERDUE_AFTER_MS) * 12);

  if (candidate.attemptCount === 0 && recent.length === 0) {
    return 75 + overdueScore;
  }

  return (
    (candidate.mastered ? 12 : 70) +
    (1 - (recentAccuracy ?? 0)) * 120 +
    Math.max(0, 3 - candidate.currentStreak) * 10 +
    overdueScore
  );
}

function determineFocusReason(
  candidate: AdaptiveKanaCandidate,
  attempts: readonly KanaAttemptEvidence[],
  now: Date,
): AdaptiveKanaFocusReason {
  if (candidate.attemptCount === 0 && attempts.length === 0) {
    return "new";
  }

  const recent = [...attempts]
    .sort((left, right) => right.answeredAt.getTime() - left.answeredAt.getTime())
    .slice(0, RECENT_ATTEMPT_LIMIT);
  const correct = recent.filter((attempt) => attempt.correct).length;

  if (!candidate.mastered && (recent.length === 0 || correct / recent.length < 0.8)) {
    return "weak";
  }

  if (
    (recent[0]?.answeredAt ?? candidate.lastAnsweredAt) === null ||
    now.getTime() - (recent[0]?.answeredAt ?? candidate.lastAnsweredAt)!.getTime() >= OVERDUE_AFTER_MS
  ) {
    return "overdue";
  }

  return "review";
}

function selectExerciseKind(
  candidate: AdaptiveKanaCandidate,
  index: number,
  previous: AdaptiveKanaExerciseKind | null,
  random: () => number,
): AdaptiveKanaExerciseKind {
  const supported = ADAPTIVE_KANA_EXERCISE_KINDS.filter(
    (kind) => kind !== "tracing" || Array.from(candidate.character).length === 1,
  );
  const offset = Math.floor(random() * supported.length);

  for (let step = 0; step < supported.length; step += 1) {
    const kind = supported[(index + offset + step) % supported.length]!;

    if (kind !== previous && exerciseDirection(kind) !== exerciseDirection(previous)) {
      return kind;
    }
  }

  return supported.find((kind) => kind !== previous) ?? supported[0]!;
}

function exerciseDirection(
  kind: AdaptiveKanaExerciseKind | null,
): "kana-to-sound" | "sound-to-kana" | "shape" | null {
  if (kind === null) {
    return null;
  }

  if (kind === "typing" || kind === "recognition-choice") {
    return "kana-to-sound";
  }

  return kind === "tracing" ? "shape" : "sound-to-kana";
}

function buildChoices(
  target: AdaptiveKanaCandidate,
  candidates: readonly AdaptiveKanaCandidate[],
  attempts: readonly KanaAttemptEvidence[],
  seed: string | number,
): readonly AdaptiveKanaChoice[] {
  const confusionCounts = new Map<string, number>();

  for (const attempt of attempts) {
    if (
      !attempt.correct &&
      attempt.selectedCharacter !== null &&
      attempt.selectedCharacter !== target.character
    ) {
      confusionCounts.set(
        attempt.selectedCharacter,
        (confusionCounts.get(attempt.selectedCharacter) ?? 0) + 1,
      );
    }
  }

  const rankedDistractors = candidates
    .filter((candidate) => candidate.character !== target.character)
    .sort(
      (left, right) =>
        (confusionCounts.get(right.character) ?? 0) - (confusionCounts.get(left.character) ?? 0) ||
        kanaDistractorPriority(target.character,left.character) - kanaDistractorPriority(target.character,right.character) ||
        Number(left.script !== target.script) - Number(right.script !== target.script) ||
        Math.abs(left.order - target.order) - Math.abs(right.order - target.order) ||
        seededRank(seed, target.character, left.character) -
          seededRank(seed, target.character, right.character),
    );
  const distractors: AdaptiveKanaCandidate[] = [];
  const usedRomaji = new Set([target.romaji, ...target.acceptedRomaji]);

  for (const candidate of rankedDistractors) {
    const readings = [candidate.romaji, ...candidate.acceptedRomaji];
    if (readings.some((reading) => usedRomaji.has(reading))) {
      continue;
    }

    distractors.push(candidate);
    readings.forEach((reading) => usedRomaji.add(reading));

    if (distractors.length === 3) {
      break;
    }
  }
  const choices = [target, ...distractors].map(({ character, script, romaji }) => ({
    character,
    script,
    romaji,
  }));
  const offset = seededRank(seed, target.character, "choices") % choices.length;

  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

function groupAttempts(
  attempts: readonly KanaAttemptEvidence[],
): ReadonlyMap<string, readonly KanaAttemptEvidence[]> {
  const grouped = new Map<string, KanaAttemptEvidence[]>();

  for (const attempt of attempts) {
    const current = grouped.get(attempt.expectedCharacter) ?? [];
    current.push(attempt);
    grouped.set(attempt.expectedCharacter, current);
  }

  return grouped;
}

function createSeededRandom(seed: string | number): () => number {
  let state = hashSeed(seed) || 0x6d2b79f5;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function seededRank(seed: string | number, ...parts: readonly string[]): number {
  return hashSeed([String(seed), ...parts].join(":"));
}

function hashSeed(seed: string | number): number {
  const value = String(seed);
  let hash = 2_166_136_261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return hash >>> 0;
}
