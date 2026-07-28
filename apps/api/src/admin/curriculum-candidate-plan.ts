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
  "independent-frequency-prerequisites-v2" as const;

export type CurriculumCandidatePlanInput = {
  readonly existingItems: Readonly<Record<"kanji" | "word", number>>;
  readonly existingKanji: readonly {
    readonly character: string;
    readonly band: CourseBand | null;
  }[];
  readonly candidates: readonly ImportedCandidateRankingInput[];
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
  const availableKanjiBands = buildAvailableKanjiBands(input.existingKanji, selectedKanji);
  const rankedWords = rankAll(wordCandidates);
  let excludedWordsMissingKanji = 0;
  const eligibleWords = rankedWords
    .filter((candidate) => {
      const prerequisiteKanji = extractKanjiCharacters(candidate.japanese);

      if (prerequisiteKanji.every((character) => availableKanjiBands.has(character))) {
        return true;
      }

      excludedWordsMissingKanji += 1;
      return false;
    })
    .map((candidate) => applyWordPrerequisiteBand(candidate, availableKanjiBands));

  const selectedWords = eligibleWords.sort(comparePlannedWords).slice(0, candidateSlots.word);
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
      bands: SUPPORTED_COURSE_BANDS.map((band) => ({
        band,
        kanjiItems: candidates.kanji.filter((candidate) => candidate.suggestedBand === band).length,
        wordItems: candidates.word.filter((candidate) => candidate.suggestedBand === band).length,
      })),
    },
    candidates,
  };
}

function rankAll(candidates: readonly ImportedCandidateRankingInput[]) {
  return candidates.length === 0 ? [] : rankImportedCandidates(candidates, candidates.length);
}

type RankedCandidate = ReturnType<typeof rankImportedCandidates>[number];

function buildAvailableKanjiBands(
  existingKanji: CurriculumCandidatePlanInput["existingKanji"],
  selectedKanji: readonly RankedCandidate[],
): ReadonlyMap<string, CourseBand> {
  const bands = new Map<string, CourseBand>();

  for (const kanji of existingKanji) {
    for (const character of extractKanjiCharacters(kanji.character)) {
      setLaterBand(bands, character, kanji.band ?? "n2");
    }
  }

  for (const candidate of selectedKanji) {
    for (const character of extractKanjiCharacters(candidate.japanese)) {
      setLaterBand(bands, character, candidate.suggestedBand);
    }
  }

  return bands;
}

function setLaterBand(
  bands: Map<string, CourseBand>,
  character: string,
  candidateBand: CourseBand,
): void {
  const currentBand = bands.get(character);

  if (currentBand === undefined || compareBands(currentBand, candidateBand) < 0) {
    bands.set(character, candidateBand);
  }
}

function applyWordPrerequisiteBand(
  candidate: RankedCandidate,
  availableKanjiBands: ReadonlyMap<string, CourseBand>,
): RankedCandidate {
  const prerequisiteBands = extractKanjiCharacters(candidate.japanese).flatMap((character) => {
    const band = availableKanjiBands.get(character);
    return band === undefined ? [] : [band];
  });
  const suggestedBand = prerequisiteBands.reduce(
    (latest, band) => (compareBands(latest, band) < 0 ? band : latest),
    candidate.suggestedBand,
  );

  return { ...candidate, suggestedBand };
}

function comparePlannedWords(left: RankedCandidate, right: RankedCandidate): number {
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
