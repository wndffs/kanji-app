import {
  type AdminImportedCandidateDto,
  type AdminImportedCandidateReasonDto,
  type CourseBand,
} from "@kanji-srs/shared";

export type ImportedCandidateRankingInput = {
  readonly targetId: string;
  readonly itemType: "kanji" | "word";
  readonly japanese: string;
  readonly reading: string | null;
  readonly meanings: {
    readonly ru: readonly string[];
    readonly en: readonly string[];
  };
  readonly jlptLevel: AdminImportedCandidateDto["jlptLevel"];
  readonly sourcePriority: number | null;
  readonly schoolGrade: number | null;
  readonly hasStrokeData: boolean;
  readonly sourceName: AdminImportedCandidateDto["sourceName"];
};

export function rankImportedCandidates(
  candidates: readonly ImportedCandidateRankingInput[],
  limit: number,
): readonly AdminImportedCandidateDto[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Candidate ranking limit must be a positive integer.");
  }

  return candidates
    .map(scoreCandidate)
    .sort(compareCandidates)
    .slice(0, limit)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}

function scoreCandidate(
  candidate: ImportedCandidateRankingInput,
): Omit<AdminImportedCandidateDto, "rank"> {
  const reasons: AdminImportedCandidateReasonDto[] = [];

  if (candidate.itemType === "kanji") {
    addReason(reasons, "source-frequency", scoreKanjiFrequency(candidate.sourcePriority));
    addReason(reasons, "jlpt", scoreJlpt(candidate.jlptLevel));
    addReason(reasons, "school-grade", scoreSchoolGrade(candidate.schoolGrade));
    addReason(reasons, "ru-coverage", candidate.meanings.ru.length > 0 ? 15 : 0);
    addReason(reasons, "en-coverage", candidate.meanings.en.length > 0 ? 10 : 0);
    addReason(reasons, "reading", candidate.reading === null ? 0 : 10);
    addReason(reasons, "stroke-data", candidate.hasStrokeData ? 5 : 0);
  } else {
    addReason(reasons, "source-priority", scoreWordPriority(candidate.sourcePriority));
    addReason(reasons, "ru-coverage", candidate.meanings.ru.length > 0 ? 15 : 0);
    addReason(reasons, "en-coverage", candidate.meanings.en.length > 0 ? 15 : 0);
    addReason(reasons, "reading", candidate.reading === null ? 0 : 10);
    addReason(reasons, "kanji-orthography", containsKanji(candidate.japanese) ? 5 : 0);
  }

  return {
    score: reasons.reduce((total, reason) => total + reason.points, 0),
    targetId: candidate.targetId,
    itemType: candidate.itemType,
    japanese: candidate.japanese,
    reading: candidate.reading,
    meanings: candidate.meanings,
    jlptLevel: candidate.jlptLevel,
    sourcePriority: candidate.sourcePriority,
    sourceName: candidate.sourceName,
    suggestedBand: suggestBand(candidate),
    suggestedTitle:
      candidate.itemType === "kanji"
        ? `Кандзи ${candidate.japanese}`
        : `Слово ${candidate.japanese}`,
    reasons,
  };
}

function scoreKanjiFrequency(rank: number | null): number {
  if (rank === null) return 0;
  if (rank <= 500) return 35;
  if (rank <= 1_500) return 28;
  if (rank <= 3_000) return 20;
  return 10;
}

function scoreWordPriority(rank: number | null): number {
  if (rank === null) return 0;
  if (rank <= 2_500) return 55;
  if (rank <= 5_000) return 50;
  if (rank <= 10_000) return 42;
  if (rank <= 20_000) return 30;
  return 20;
}

function scoreJlpt(level: ImportedCandidateRankingInput["jlptLevel"]): number {
  switch (level) {
    case "N5":
      return 15;
    case "N4":
      return 12;
    case "N3":
      return 9;
    case "N2":
      return 6;
    default:
      return 0;
  }
}

function scoreSchoolGrade(grade: number | null): number {
  if (grade === null) return 0;
  if (grade <= 2) return 10;
  if (grade <= 6) return 6;
  return 3;
}

function suggestBand(candidate: ImportedCandidateRankingInput): CourseBand {
  if (candidate.jlptLevel !== null) {
    return candidate.jlptLevel.toLowerCase() as CourseBand;
  }

  if (candidate.itemType === "kanji") {
    if (candidate.schoolGrade !== null && candidate.schoolGrade <= 2) return "foundation";
    if (candidate.schoolGrade !== null && candidate.schoolGrade <= 4) return "n4";
    if (candidate.schoolGrade !== null && candidate.schoolGrade <= 6) return "n3";
    return "n2";
  }

  if (candidate.sourcePriority !== null && candidate.sourcePriority <= 5_000) return "n5";
  if (candidate.sourcePriority !== null && candidate.sourcePriority <= 10_000) return "n4";
  return "n3";
}

function addReason(
  reasons: AdminImportedCandidateReasonDto[],
  code: AdminImportedCandidateReasonDto["code"],
  points: number,
): void {
  if (points > 0) {
    reasons.push({ code, points });
  }
}

function containsKanji(value: string): boolean {
  return /[\p{Script=Han}]/u.test(value);
}

function compareCandidates(
  left: Omit<AdminImportedCandidateDto, "rank">,
  right: Omit<AdminImportedCandidateDto, "rank">,
): number {
  return (
    right.score - left.score ||
    (left.sourcePriority ?? Number.MAX_SAFE_INTEGER) -
      (right.sourcePriority ?? Number.MAX_SAFE_INTEGER) ||
    itemTypePriority(left.itemType) - itemTypePriority(right.itemType) ||
    compareText(left.japanese, right.japanese) ||
    compareText(left.targetId, right.targetId)
  );
}

function itemTypePriority(itemType: AdminImportedCandidateDto["itemType"]): number {
  return itemType === "kanji" ? 0 : 1;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
