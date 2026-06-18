export const JAPANESE_PACKAGE_NAME = "@kanji-srs/japanese";

export type AnswerKind = "meaning" | "reading";
export type MeaningLocale = "ru-RU" | "en-US";

export type AnswerMatchSource = "global" | "user";

export type AnswerValidationResultType = "correct" | "typo" | "blocked" | "wrong";

export type TypoToleranceConfig = {
  readonly enabled?: boolean;
  readonly minLength?: number;
  readonly maxDistance?: number;
  readonly maxRatio?: number;
  readonly requireSameFirstCharacter?: boolean;
};

export type AnswerValidationInput = {
  readonly answerKind: AnswerKind;
  readonly answer: string;
  readonly acceptedAnswers: readonly string[];
  readonly blockedAnswers?: readonly string[];
  readonly userAcceptedAnswers?: readonly string[];
  readonly typoTolerance?: TypoToleranceConfig;
};

export type ReadingAcceptanceInput = Pick<
  AnswerValidationInput,
  "answer" | "acceptedAnswers" | "blockedAnswers" | "userAcceptedAnswers"
>;

export type MeaningAcceptanceInput = Omit<AnswerValidationInput, "answerKind"> & {
  readonly answerKind?: "meaning";
};

export type AnswerValidationResult = {
  readonly answerKind: AnswerKind;
  readonly accepted: boolean;
  readonly result: AnswerValidationResultType;
  readonly normalizedAnswer: string;
  readonly matchedAnswer: string | null;
  readonly matchSource: AnswerMatchSource | null;
  readonly distance: number | null;
  readonly reason:
    | "exact-match"
    | "user-exact-match"
    | "conservative-typo"
    | "blocked-answer"
    | "no-match";
};

type NormalizedAnswerCandidate = {
  readonly raw: string;
  readonly normalized: string;
  readonly source: AnswerMatchSource;
};

type NormalizedBlockedAnswer = {
  readonly raw: string;
  readonly normalized: string;
};

type ConservativeTypoOptions = Required<TypoToleranceConfig>;

const DEFAULT_TYPO_TOLERANCE = {
  enabled: true,
  minLength: 6,
  maxDistance: 2,
  maxRatio: 0.18,
  requireSameFirstCharacter: true,
} as const satisfies ConservativeTypoOptions;

const RUSSIAN_LIST_SEPARATOR_PATTERN = /[,;|/]+/u;
const RUSSIAN_PUNCTUATION_PATTERN = /[!"#$%&'()*+\-.:<=>?@[\\\]^_`{}~«»„“”‘’…№]+/gu;
const WHITESPACE_PATTERN = /\s+/gu;

export type AnswerValidationPackageStatus = {
  packageName: typeof JAPANESE_PACKAGE_NAME;
  implemented: true;
};

export const answerValidationPackageStatus: AnswerValidationPackageStatus = {
  packageName: JAPANESE_PACKAGE_NAME,
  implemented: true,
};

export function katakanaToHiragana(input: string): string {
  return Array.from(input, (character) => {
    const codePoint = character.codePointAt(0);

    if (codePoint === undefined) {
      return character;
    }

    if (codePoint >= 0x30a1 && codePoint <= 0x30f6) {
      return String.fromCodePoint(codePoint - 0x60);
    }

    return character;
  }).join("");
}

export function normalizeKana(input: string): string {
  return katakanaToHiragana(input.normalize("NFKC")).trim().replace(WHITESPACE_PATTERN, " ");
}

export function normalizeJapaneseReading(input: string): string {
  return normalizeKana(input).replace(WHITESPACE_PATTERN, "");
}

export function normalizeRussianMeaning(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/gu, "е")
    .replace(RUSSIAN_LIST_SEPARATOR_PATTERN, " ")
    .replace(RUSSIAN_PUNCTUATION_PATTERN, " ")
    .trim()
    .replace(WHITESPACE_PATTERN, " ");
}

export function normalizeEnglishMeaning(input: string): string {
  return input
    .normalize("NFKC")
    .toLocaleLowerCase("en-US")
    .replace(RUSSIAN_LIST_SEPARATOR_PATTERN, " ")
    .replace(RUSSIAN_PUNCTUATION_PATTERN, " ")
    .trim()
    .replace(WHITESPACE_PATTERN, " ");
}

export function normalizeMeaning(input: string, locale: MeaningLocale = "ru-RU"): string {
  return locale === "en-US" ? normalizeEnglishMeaning(input) : normalizeRussianMeaning(input);
}

export function splitRussianMeaningList(input: string): string[] {
  return input
    .split(RUSSIAN_LIST_SEPARATOR_PATTERN)
    .map((candidate) => normalizeRussianMeaning(candidate))
    .filter((candidate) => candidate.length > 0);
}

export function calculateStringDistance(left: string, right: string): number {
  const leftCharacters = Array.from(left);
  const rightCharacters = Array.from(right);
  let previousRow = Array.from({ length: rightCharacters.length + 1 }, (_, index) => index);

  for (let leftIndex = 0; leftIndex < leftCharacters.length; leftIndex += 1) {
    const currentRow = [leftIndex + 1];

    for (let rightIndex = 0; rightIndex < rightCharacters.length; rightIndex += 1) {
      const substitutionCost = leftCharacters[leftIndex] === rightCharacters[rightIndex] ? 0 : 1;
      currentRow[rightIndex + 1] = Math.min(
        currentRow[rightIndex] + 1,
        previousRow[rightIndex + 1] + 1,
        previousRow[rightIndex] + substitutionCost,
      );
    }

    previousRow = currentRow;
  }

  return previousRow[rightCharacters.length];
}

export function isConservativeTypo(
  answer: string,
  acceptedAnswer: string,
  config?: TypoToleranceConfig,
): boolean {
  const options = resolveTypoTolerance(config);

  if (!options.enabled || answer === acceptedAnswer) {
    return false;
  }

  const answerLength = Array.from(answer).length;
  const acceptedLength = Array.from(acceptedAnswer).length;
  const longerLength = Math.max(answerLength, acceptedLength);

  if (longerLength < options.minLength) {
    return false;
  }

  if (
    options.requireSameFirstCharacter &&
    Array.from(answer)[0] !== Array.from(acceptedAnswer)[0]
  ) {
    return false;
  }

  const distance = calculateStringDistance(answer, acceptedAnswer);
  const lengthAwareMaxDistance = Math.min(options.maxDistance, longerLength >= 12 ? 2 : 1);

  return (
    distance > 0 &&
    distance <= lengthAwareMaxDistance &&
    distance / longerLength <= options.maxRatio
  );
}

export function isReadingAccepted(input: ReadingAcceptanceInput): boolean {
  return validateAnswer({
    ...input,
    answerKind: "reading",
  }).accepted;
}

export function isMeaningAccepted(input: MeaningAcceptanceInput): boolean {
  return validateAnswer({
    ...input,
    answerKind: "meaning",
  }).accepted;
}

export function validateAnswer(input: AnswerValidationInput): AnswerValidationResult {
  return input.answerKind === "reading"
    ? validateReadingAnswer(input)
    : validateMeaningAnswer(input);
}

function validateReadingAnswer(input: AnswerValidationInput): AnswerValidationResult {
  const normalizedAnswer = normalizeJapaneseReading(input.answer);
  const blockedAnswer = buildReadingBlockedAnswers(input.blockedAnswers ?? []).find(
    (candidate) => candidate.normalized === normalizedAnswer,
  );

  if (blockedAnswer !== undefined) {
    return blockedResult("reading", normalizedAnswer, blockedAnswer.raw);
  }

  const acceptedAnswer = buildReadingAcceptedAnswers(input).find(
    (candidate) => candidate.normalized === normalizedAnswer,
  );

  if (acceptedAnswer !== undefined) {
    return exactResult("reading", normalizedAnswer, acceptedAnswer);
  }

  return wrongResult("reading", normalizedAnswer);
}

function validateMeaningAnswer(input: AnswerValidationInput): AnswerValidationResult {
  const normalizedCandidates = splitRussianMeaningList(input.answer);
  const normalizedAnswer = normalizeRussianMeaning(input.answer);
  const blockedAnswers = buildMeaningBlockedAnswers(input.blockedAnswers ?? []);
  const blockedAnswer = blockedAnswers.find((blocked) =>
    normalizedCandidates.includes(blocked.normalized),
  );

  if (blockedAnswer !== undefined) {
    return blockedResult("meaning", normalizedAnswer, blockedAnswer.raw);
  }

  const acceptedAnswers = buildMeaningAcceptedAnswers(input);
  const exactMatch = acceptedAnswers.find((accepted) =>
    normalizedCandidates.includes(accepted.normalized),
  );

  if (exactMatch !== undefined) {
    return exactResult("meaning", normalizedAnswer, exactMatch);
  }

  const typoMatch = findTypoMatch(normalizedCandidates, acceptedAnswers, input.typoTolerance);

  if (typoMatch !== null) {
    return {
      answerKind: "meaning",
      accepted: true,
      result: "typo",
      normalizedAnswer,
      matchedAnswer: typoMatch.match.raw,
      matchSource: typoMatch.match.source,
      distance: typoMatch.distance,
      reason: "conservative-typo",
    };
  }

  return wrongResult("meaning", normalizedAnswer);
}

function buildReadingAcceptedAnswers(input: AnswerValidationInput): NormalizedAnswerCandidate[] {
  return [
    ...input.acceptedAnswers.map((answer) => ({
      raw: answer,
      normalized: normalizeJapaneseReading(answer),
      source: "global" as const,
    })),
    ...(input.userAcceptedAnswers ?? []).map((answer) => ({
      raw: answer,
      normalized: normalizeJapaneseReading(answer),
      source: "user" as const,
    })),
  ].filter((candidate) => candidate.normalized.length > 0);
}

function buildReadingBlockedAnswers(answers: readonly string[]): NormalizedBlockedAnswer[] {
  return answers
    .map((answer) => ({
      raw: answer,
      normalized: normalizeJapaneseReading(answer),
    }))
    .filter((candidate) => candidate.normalized.length > 0);
}

function buildMeaningAcceptedAnswers(input: AnswerValidationInput): NormalizedAnswerCandidate[] {
  return [
    ...expandMeaningAnswers(input.acceptedAnswers, "global"),
    ...expandMeaningAnswers(input.userAcceptedAnswers ?? [], "user"),
  ];
}

function buildMeaningBlockedAnswers(answers: readonly string[]): NormalizedBlockedAnswer[] {
  return answers.flatMap((answer) =>
    splitRussianMeaningList(answer).map((normalized) => ({
      raw: answer,
      normalized,
    })),
  );
}

function expandMeaningAnswers(
  answers: readonly string[],
  source: AnswerMatchSource,
): NormalizedAnswerCandidate[] {
  return answers.flatMap((answer) =>
    splitRussianMeaningList(answer).map((normalized) => ({
      raw: answer,
      normalized,
      source,
    })),
  );
}

function findTypoMatch(
  normalizedAnswers: readonly string[],
  acceptedAnswers: readonly NormalizedAnswerCandidate[],
  config?: TypoToleranceConfig,
): { readonly match: NormalizedAnswerCandidate; readonly distance: number } | null {
  for (const normalizedAnswer of normalizedAnswers) {
    for (const acceptedAnswer of acceptedAnswers) {
      if (isConservativeTypo(normalizedAnswer, acceptedAnswer.normalized, config)) {
        return {
          match: acceptedAnswer,
          distance: calculateStringDistance(normalizedAnswer, acceptedAnswer.normalized),
        };
      }
    }
  }

  return null;
}

function exactResult(
  answerKind: AnswerKind,
  normalizedAnswer: string,
  match: NormalizedAnswerCandidate,
): AnswerValidationResult {
  return {
    answerKind,
    accepted: true,
    result: "correct",
    normalizedAnswer,
    matchedAnswer: match.raw,
    matchSource: match.source,
    distance: 0,
    reason: match.source === "user" ? "user-exact-match" : "exact-match",
  };
}

function blockedResult(
  answerKind: AnswerKind,
  normalizedAnswer: string,
  blockedAnswer: string,
): AnswerValidationResult {
  return {
    answerKind,
    accepted: false,
    result: "blocked",
    normalizedAnswer,
    matchedAnswer: blockedAnswer,
    matchSource: null,
    distance: 0,
    reason: "blocked-answer",
  };
}

function wrongResult(answerKind: AnswerKind, normalizedAnswer: string): AnswerValidationResult {
  return {
    answerKind,
    accepted: false,
    result: "wrong",
    normalizedAnswer,
    matchedAnswer: null,
    matchSource: null,
    distance: null,
    reason: "no-match",
  };
}

function resolveTypoTolerance(config?: TypoToleranceConfig): ConservativeTypoOptions {
  return {
    ...DEFAULT_TYPO_TOLERANCE,
    ...config,
  };
}
