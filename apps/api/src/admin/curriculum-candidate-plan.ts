import {
  type AdminCurriculumCandidatePlanItemDto,
  type AdminCurriculumCandidatePlanSummaryDto,
  CURRICULUM_SCALE_TARGETS,
  SUPPORTED_COURSE_BANDS,
} from "@kanji-srs/shared";

import {
  type ImportedCandidateRankingInput,
  rankImportedCandidates,
} from "./imported-candidate-ranking";

export const CURRICULUM_CANDIDATE_POLICY_VERSION =
  "independent-frequency-prerequisites-v1" as const;

export type CurriculumCandidatePlanInput = {
  readonly existingItems: Readonly<Record<"kanji" | "word", number>>;
  readonly existingKanji: readonly string[];
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
  const availableKanji = new Set([
    ...input.existingKanji.flatMap(extractKanjiCharacters),
    ...selectedKanji.flatMap((candidate) => extractKanjiCharacters(candidate.japanese)),
  ]);
  const rankedWords = rankAll(wordCandidates);
  let excludedWordsMissingKanji = 0;
  const eligibleWords = rankedWords.filter((candidate) => {
    const prerequisiteKanji = extractKanjiCharacters(candidate.japanese);

    if (prerequisiteKanji.every((character) => availableKanji.has(character))) {
      return true;
    }

    excludedWordsMissingKanji += 1;
    return false;
  });

  const selectedWords = eligibleWords.slice(0, candidateSlots.word);
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

function toPlanItem(
  candidate: ReturnType<typeof rankImportedCandidates>[number],
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
