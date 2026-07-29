import {
  type AdminCurriculumCandidatePlanItemDto,
  type AdminCurriculumCandidatePlanSummaryDto,
  type CourseBand,
  CURRICULUM_SCALE_TARGETS,
  SUPPORTED_COURSE_BANDS,
} from "@kanji-srs/shared";

import {
  type ImportedCandidateRankingInput,
  rankImportedCandidates,
} from "./imported-candidate-ranking";

export const CURRICULUM_CANDIDATE_POLICY_VERSION =
  "independent-frequency-prerequisites-v3" as const;

export type CurriculumCandidatePlanSource = ImportedCandidateRankingInput & {
  readonly sourceGroupId: string | null;
};

export type CurriculumCandidatePlanInput = {
  readonly existingItems: Readonly<Record<"kanji" | "word", number>>;
  readonly existingKanji: readonly {
    readonly character: string;
    readonly band: CourseBand | null;
    readonly primaryReading: string | null;
    readonly sourcePriority: number | null;
  }[];
  readonly candidates: readonly CurriculumCandidatePlanSource[];
  readonly poolTruncated: Readonly<Record<"kanji" | "word", boolean>>;
};

export type CurriculumCandidatePlan = {
  readonly summary: AdminCurriculumCandidatePlanSummaryDto;
  readonly candidates: Readonly<
    Record<"kanji" | "word", readonly AdminCurriculumCandidatePlanItemDto[]>
  >;
};

export function buildCurriculumCandidatePlan(
  input: CurriculumCandidatePlanInput,
): CurriculumCandidatePlan {
  assertPlanInput(input);

  const candidateSlots = {
    kanji: Math.max(CURRICULUM_SCALE_TARGETS.kanji - input.existingItems.kanji, 0),
    word: Math.max(CURRICULUM_SCALE_TARGETS.word - input.existingItems.word, 0),
  };
  const kanjiCandidates = input.candidates.filter((candidate) => candidate.itemType === "kanji");
  const wordCandidates = input.candidates.filter((candidate) => candidate.itemType === "word");
  const rankedKanji = rankAll(kanjiCandidates);
  const selectedKanji = rankedKanji.slice(0, candidateSlots.kanji);
  const availableKanji = buildAvailableKanji(input.existingKanji, selectedKanji);
  const rankedWords = rankAll(wordCandidates);
  let excludedWordsMissingKanji = 0;
  const eligibleWords = rankedWords
    .filter((candidate) => {
      const prerequisiteKanji = extractKanjiCharacters(candidate.japanese);

      if (prerequisiteKanji.every((character) => availableKanji.has(character))) {
        return true;
      }

      excludedWordsMissingKanji += 1;
      return false;
    })
    .map((candidate) => applyWordPrerequisiteBand(candidate, availableKanji));
  const representativeWords = collapseWordAlternatives(eligibleWords, availableKanji);
  const collapsedWordAlternatives = eligibleWords.length - representativeWords.length;

  const selectedWords = representativeWords.sort(comparePlannedWords).slice(0, candidateSlots.word);
  const candidates = {
    kanji: selectedKanji.map((candidate, index) => toPlanItem(candidate, index + 1)),
    word: selectedWords.map((candidate, index) => toPlanItem(candidate, index + 1)),
  };
  const selectedItems = {
    kanji: candidates.kanji.length,
    word: candidates.word.length,
  };

  return {
    summary: {
      policyVersion: CURRICULUM_CANDIDATE_POLICY_VERSION,
      targetItems: CURRICULUM_SCALE_TARGETS,
      existingItems: input.existingItems,
      candidateSlots,
      candidatePool: {
        kanji: kanjiCandidates.length,
        word: wordCandidates.length,
      },
      poolTruncated: input.poolTruncated,
      selectedItems,
      unfilledSlots: {
        kanji: candidateSlots.kanji - selectedItems.kanji,
        word: candidateSlots.word - selectedItems.word,
      },
      excludedWordsMissingKanji,
      collapsedWordAlternatives,
      bands: SUPPORTED_COURSE_BANDS.map((band) => ({
        band,
        kanjiItems: candidates.kanji.filter((candidate) => candidate.suggestedBand === band).length,
        wordItems: candidates.word.filter((candidate) => candidate.suggestedBand === band).length,
      })),
    },
    candidates,
  };
}

function rankAll(candidates: readonly CurriculumCandidatePlanSource[]) {
  if (candidates.length === 0) {
    return [];
  }

  const sourceGroupIdByTargetId = new Map(
    candidates.map((candidate) => [candidate.targetId, candidate.sourceGroupId]),
  );

  return rankImportedCandidates(candidates, candidates.length).map((candidate) => ({
    ...candidate,
    sourceGroupId: sourceGroupIdByTargetId.get(candidate.targetId) ?? null,
  }));
}

type RankedCandidate = ReturnType<typeof rankImportedCandidates>[number];

type PlannedCandidate = RankedCandidate & {
  readonly sourceGroupId: string | null;
};

type AvailableKanji = {
  readonly band: CourseBand;
  readonly primaryReading: string | null;
  readonly sourcePriority: number | null;
};

function buildAvailableKanji(
  existingKanji: CurriculumCandidatePlanInput["existingKanji"],
  selectedKanji: readonly PlannedCandidate[],
): ReadonlyMap<string, AvailableKanji> {
  const availableKanji = new Map<string, AvailableKanji>();

  for (const kanji of existingKanji) {
    for (const character of extractKanjiCharacters(kanji.character)) {
      setAvailableKanji(availableKanji, character, {
        band: kanji.band ?? "n2",
        primaryReading: kanji.primaryReading,
        sourcePriority: kanji.sourcePriority,
      });
    }
  }

  for (const candidate of selectedKanji) {
    for (const character of extractKanjiCharacters(candidate.japanese)) {
      setAvailableKanji(availableKanji, character, {
        band: candidate.suggestedBand,
        primaryReading: candidate.reading,
        sourcePriority: candidate.sourcePriority,
      });
    }
  }

  return availableKanji;
}

function setAvailableKanji(
  availableKanji: Map<string, AvailableKanji>,
  character: string,
  candidate: AvailableKanji,
): void {
  const current = availableKanji.get(character);

  if (current === undefined) {
    availableKanji.set(character, candidate);
    return;
  }

  availableKanji.set(character, {
    band: compareBands(current.band, candidate.band) < 0 ? candidate.band : current.band,
    primaryReading: current.primaryReading ?? candidate.primaryReading,
    sourcePriority: earlierSourcePriority(current.sourcePriority, candidate.sourcePriority),
  });
}

function applyWordPrerequisiteBand(
  candidate: PlannedCandidate,
  availableKanji: ReadonlyMap<string, AvailableKanji>,
): PlannedCandidate {
  const prerequisiteBands = extractKanjiCharacters(candidate.japanese).flatMap((character) => {
    const kanji = availableKanji.get(character);
    return kanji === undefined ? [] : [kanji.band];
  });
  const suggestedBand = prerequisiteBands.reduce(
    (latest, band) => (compareBands(latest, band) < 0 ? band : latest),
    candidate.suggestedBand,
  );

  return { ...candidate, suggestedBand };
}

function collapseWordAlternatives(
  candidates: readonly PlannedCandidate[],
  availableKanji: ReadonlyMap<string, AvailableKanji>,
): PlannedCandidate[] {
  const representatives = new Map<string, PlannedCandidate>();

  for (const candidate of candidates) {
    const groupId = candidate.sourceGroupId ?? `target:${candidate.targetId}`;
    const current = representatives.get(groupId);

    if (
      current === undefined ||
      compareWordRepresentatives(candidate, current, availableKanji) < 0
    ) {
      representatives.set(groupId, candidate);
    }
  }

  return [...representatives.values()];
}

function compareWordRepresentatives(
  left: PlannedCandidate,
  right: PlannedCandidate,
  availableKanji: ReadonlyMap<string, AvailableKanji>,
): number {
  return (
    (left.sourcePriority ?? Number.MAX_SAFE_INTEGER) -
      (right.sourcePriority ?? Number.MAX_SAFE_INTEGER) ||
    wordOrthographyPenalty(left.japanese) - wordOrthographyPenalty(right.japanese) ||
    singleKanjiReadingPenalty(left, availableKanji) -
      singleKanjiReadingPenalty(right, availableKanji) ||
    wordKanjiFrequencyPenalty(left.japanese, availableKanji) -
      wordKanjiFrequencyPenalty(right.japanese, availableKanji) ||
    right.score - left.score ||
    compareBands(left.suggestedBand, right.suggestedBand) ||
    compareText(left.japanese, right.japanese) ||
    compareText(left.reading ?? "", right.reading ?? "") ||
    compareText(left.targetId, right.targetId)
  );
}

function comparePlannedWords(left: PlannedCandidate, right: PlannedCandidate): number {
  return (
    compareBands(left.suggestedBand, right.suggestedBand) ||
    right.score - left.score ||
    (left.sourcePriority ?? Number.MAX_SAFE_INTEGER) -
      (right.sourcePriority ?? Number.MAX_SAFE_INTEGER) ||
    extractKanjiCharacters(left.japanese).length - extractKanjiCharacters(right.japanese).length ||
    compareText(left.japanese, right.japanese) ||
    compareText(left.reading ?? "", right.reading ?? "") ||
    compareText(left.targetId, right.targetId)
  );
}

function wordOrthographyPenalty(value: string): number {
  let penalty = 0;

  if (/\p{Script=Han}/u.test(value) && /\p{Script=Katakana}/u.test(value)) {
    penalty += 4;
  }

  if (/(\p{Script=Han})\1/u.test(value)) {
    penalty += 2;
  }

  if (/[A-Za-z0-9]/u.test(value)) {
    penalty += 1;
  }

  return penalty;
}

function singleKanjiReadingPenalty(
  candidate: PlannedCandidate,
  availableKanji: ReadonlyMap<string, AvailableKanji>,
): number {
  const characters = extractKanjiCharacters(candidate.japanese);

  if (characters.length !== 1 || candidate.japanese !== characters[0]) {
    return 0;
  }

  const primaryReading = availableKanji.get(characters[0])?.primaryReading;

  if (primaryReading === null || primaryReading === undefined || candidate.reading === null) {
    return 1;
  }

  return normalizeKanaReading(candidate.reading) === normalizeKanaReading(primaryReading) ? 0 : 1;
}

function wordKanjiFrequencyPenalty(
  value: string,
  availableKanji: ReadonlyMap<string, AvailableKanji>,
): number {
  const ranks = extractKanjiCharacters(value).map(
    (character) => availableKanji.get(character)?.sourcePriority ?? 10_000,
  );

  if (ranks.length === 0) {
    return 0;
  }

  return Math.max(...ranks) * 100 + ranks.reduce((total, rank) => total + rank, 0);
}

function normalizeKanaReading(value: string): string {
  return [...value.trim()]
    .map((character) => {
      const codePoint = character.codePointAt(0);

      return codePoint !== undefined && codePoint >= 0x30a1 && codePoint <= 0x30f6
        ? String.fromCodePoint(codePoint - 0x60)
        : character;
    })
    .join("");
}

function earlierSourcePriority(left: number | null, right: number | null): number | null {
  if (left === null) return right;
  if (right === null) return left;
  return Math.min(left, right);
}

function compareBands(left: CourseBand, right: CourseBand): number {
  return SUPPORTED_COURSE_BANDS.indexOf(left) - SUPPORTED_COURSE_BANDS.indexOf(right);
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function toPlanItem(
  candidate: RankedCandidate,
  selectionRank: number,
): AdminCurriculumCandidatePlanItemDto {
  return {
    selectionRank,
    targetId: candidate.targetId,
    itemType: candidate.itemType,
    japanese: candidate.japanese,
    reading: candidate.reading,
    score: candidate.score,
    sourcePriority: candidate.sourcePriority,
    sourceName: candidate.sourceName,
    suggestedBand: candidate.suggestedBand,
    prerequisiteKanji:
      candidate.itemType === "word" ? extractKanjiCharacters(candidate.japanese) : [],
    coverage: {
      russianMeaning: candidate.meanings.ru.length > 0,
      englishMeaning: candidate.meanings.en.length > 0,
      reading: candidate.reading !== null,
      strokeData:
        candidate.itemType === "kanji"
          ? candidate.reasons.some((reason) => reason.code === "stroke-data")
          : null,
    },
  };
}

function extractKanjiCharacters(value: string): readonly string[] {
  return [...new Set([...value.matchAll(/\p{Script=Han}/gu)].map((match) => match[0]))];
}

function assertPlanInput(input: CurriculumCandidatePlanInput): void {
  for (const [itemType, count] of Object.entries(input.existingItems)) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error(`Existing ${itemType} item count must be a non-negative integer.`);
    }
  }

  const targetIds = new Set<string>();

  for (const candidate of input.candidates) {
    const targetKey = `${candidate.itemType}:${candidate.targetId}`;

    if (targetIds.has(targetKey)) {
      throw new Error(`Duplicate curriculum candidate target: ${candidate.targetId}.`);
    }

    targetIds.add(targetKey);
  }
}
