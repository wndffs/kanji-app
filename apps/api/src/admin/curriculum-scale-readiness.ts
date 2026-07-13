import {
  type AdminCurriculumScaleItemReadinessDto,
  type AdminCurriculumScaleReadinessDto,
} from "@kanji-srs/shared";

export type CurriculumScaleReadinessSource = {
  readonly itemType: "kanji" | "word";
  readonly targetItems: number;
  readonly publishedItems: number;
  readonly inCurationItems: number;
  readonly importedCandidates: number;
  readonly candidateCoverage: AdminCurriculumScaleItemReadinessDto["candidateCoverage"];
};

const ITEM_TYPES = ["kanji", "word"] as const;

export function buildCurriculumScaleReadiness(
  sources: readonly CurriculumScaleReadinessSource[],
  generatedAt: Date = new Date(),
): AdminCurriculumScaleReadinessDto {
  assertCompleteSources(sources);

  return {
    generatedAt: generatedAt.toISOString(),
    items: ITEM_TYPES.map((itemType) => {
      const source = sources.find((candidate) => candidate.itemType === itemType)!;
      const remainingToPublish = Math.max(source.targetItems - source.publishedItems, 0);
      const candidatesNeeded = Math.max(remainingToPublish - source.inCurationItems, 0);
      const fillableCandidateSlots = Math.min(candidatesNeeded, source.importedCandidates);

      return {
        ...source,
        remainingToPublish,
        candidatesNeeded,
        fillableCandidateSlots,
        capacityShortfall: candidatesNeeded - fillableCandidateSlots,
      };
    }),
  };
}

function assertCompleteSources(sources: readonly CurriculumScaleReadinessSource[]): void {
  for (const itemType of ITEM_TYPES) {
    const matches = sources.filter((source) => source.itemType === itemType);

    if (matches.length !== 1) {
      throw new Error(`Scale readiness requires exactly one ${itemType} source.`);
    }
  }

  if (sources.length !== ITEM_TYPES.length) {
    throw new Error("Scale readiness contains an unsupported item type.");
  }

  for (const source of sources) {
    const counts = [
      source.targetItems,
      source.publishedItems,
      source.inCurationItems,
      source.importedCandidates,
      source.candidateCoverage.withReading,
      source.candidateCoverage.withRussianMeaning,
      source.candidateCoverage.withEnglishMeaning,
      source.candidateCoverage.withBilingualMeanings,
      ...(source.candidateCoverage.withStrokeData === null
        ? []
        : [source.candidateCoverage.withStrokeData]),
    ];

    if (counts.some((count) => !Number.isInteger(count) || count < 0)) {
      throw new Error(
        `Scale readiness counts for ${source.itemType} must be non-negative integers.`,
      );
    }

    if (source.targetItems === 0) {
      throw new Error(`Scale readiness target for ${source.itemType} must be positive.`);
    }

    const coverageCounts = counts.slice(4);

    if (coverageCounts.some((count) => count > source.importedCandidates)) {
      throw new Error(`Scale readiness coverage exceeds ${source.itemType} candidate count.`);
    }

    if (
      source.candidateCoverage.withBilingualMeanings >
      Math.min(
        source.candidateCoverage.withRussianMeaning,
        source.candidateCoverage.withEnglishMeaning,
      )
    ) {
      throw new Error(`Bilingual ${source.itemType} coverage exceeds locale coverage.`);
    }

    if ((source.itemType === "kanji") !== (source.candidateCoverage.withStrokeData !== null)) {
      throw new Error("Stroke coverage is required only for kanji scale readiness.");
    }
  }
}
