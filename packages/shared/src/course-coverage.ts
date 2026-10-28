import { type ItemKind } from "./index";

export type CourseCoverageCounts = {
  readonly items: number;
  readonly cards: number;
  readonly byKind: Readonly<Record<ItemKind, number>>;
  readonly missingRu: number;
  readonly missingEn: number;
  readonly missingReading: number;
};
export type CourseCoverageDto = {
  readonly courseId: string;
  readonly observedAt: string;
  readonly scope: "published-course-core-cards";
  readonly teachingAspects?: {
    readonly assessedItems: number;
    readonly missingMeaningCards: number;
    readonly missingReadingCards: number;
    readonly withBothCardTypes: number;
  };
  readonly total: CourseCoverageCounts;
  readonly levels: readonly { readonly level: number; readonly counts: CourseCoverageCounts }[];
  readonly bands: readonly { readonly band: string; readonly counts: CourseCoverageCounts }[];
  readonly jlpt: readonly { readonly band: string; readonly counts: CourseCoverageCounts }[];
};
export type CourseCoverageRow = {
  readonly id: string;
  readonly kind: ItemKind;
  readonly level: number;
  readonly band: string;
  readonly jlpt: string | null;
  readonly cardIds: readonly string[];
  readonly hasRu: boolean;
  readonly hasEn: boolean;
  readonly hasReading: boolean;
  readonly readingRequired?: boolean;
  readonly cardAnswerTypes?: readonly ("meaning" | "reading")[];
};
export function countCourseCoverage(rows: readonly CourseCoverageRow[]): CourseCoverageCounts {
  const unique = [...new Map(rows.map((row) => [row.id, row])).values()];
  const byKind = { component: 0, kanji: 0, word: 0, sentence: 0 };
  for (const row of unique) byKind[row.kind]++;
  return {
    items: unique.length,
    cards: new Set(unique.flatMap((row) => row.cardIds)).size,
    byKind,
    missingRu: unique.filter((row) => !row.hasRu).length,
    missingEn: unique.filter((row) => !row.hasEn).length,
    missingReading: unique.filter((row) =>
      (row.readingRequired ?? (row.kind === "kanji" || row.kind === "word")) && !row.hasReading,
    ).length,
  };
}
export function buildCourseCoverage(
  courseId: string,
  rows: readonly CourseCoverageRow[],
  observedAt: string,
  declaredLevels: readonly { readonly level: number; readonly band: string }[] = [],
): CourseCoverageDto {
  const bands = [
    ...new Set([...rows.map((row) => row.band), ...declaredLevels.map((row) => row.band)]),
  ].sort();
  const jlpt = [...new Set(rows.map((row) => row.jlpt ?? "unassigned"))].sort();
  return {
    courseId,
    observedAt,
    scope: "published-course-core-cards",
    teachingAspects: countTeachingAspects(rows),
    total: countCourseCoverage(rows),
    levels: [
      ...new Set([...rows.map((row) => row.level), ...declaredLevels.map((row) => row.level)]),
    ]
      .sort((a, b) => a - b)
      .map((level) => ({
        level,
        counts: countCourseCoverage(rows.filter((row) => row.level === level)),
      })),
    bands: bands.map((band) => ({
      band,
      counts: countCourseCoverage(rows.filter((row) => row.band === band)),
    })),
    jlpt: jlpt.map((band) => ({
      band,
      counts: countCourseCoverage(rows.filter((row) => (row.jlpt ?? "unassigned") === band)),
    })),
  };
}

function countTeachingAspects(rows: readonly CourseCoverageRow[]) {
  const assessed = [...new Map(rows.map((row) => [row.id, row])).values()].filter(
    (row) => (row.kind === "kanji" || row.kind === "word") && row.cardAnswerTypes !== undefined,
  );
  const has = (row: CourseCoverageRow, type: "meaning" | "reading") => row.cardAnswerTypes!.includes(type);
  return {
    assessedItems: assessed.length,
    missingMeaningCards: assessed.filter((row) => !has(row, "meaning")).length,
    missingReadingCards: assessed.filter((row) => !has(row, "reading")).length,
    withBothCardTypes: assessed.filter((row) => has(row, "meaning") && has(row, "reading")).length,
  };
}
