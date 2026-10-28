import { type ItemKind } from "./index";

export type CourseOutlineLevelDto = {
  readonly levelNumber: number;
  readonly title: string;
  readonly band: string;
  readonly publishedItemCount: number;
};

export type CourseOutlineDto = {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly levels: readonly CourseOutlineLevelDto[];
};
export type CourseMaterialDto = CourseReviewTimeline & {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly japanese: string;
  readonly title: string;
  readonly reading: string | null;
  readonly readingSource?: "card" | "target" | "missing";
  readonly meaningRu: string | null;
  readonly meaningEn: string | null;
  readonly meaningSources?: { readonly ru: "card" | "target" | "missing"; readonly en: "card" | "target" | "missing" };
  readonly studyState: CourseMaterialStudyState;
  readonly cardCount: number;
  readonly startedCardCount: number;
  readonly burnedCardCount: number;
  readonly progressCards: readonly CourseProgressCardDto[];
  readonly prerequisites?: CoursePrerequisiteStatus;
};
export type CoursePrerequisiteStatus = {
  readonly total: number;
  readonly unmet: number;
  readonly firstUnmet: {
    readonly itemId: string | null;
    readonly title: string;
    readonly requiredStage: number;
    readonly minimumStage: number | null;
  } | null;
};

export function satisfiesCardPrerequisite(
  cardIds: readonly string[],
  stages: ReadonlyMap<string, number> | undefined,
  requiredStage: number,
): boolean {
  return cardIds.length > 0 && cardIds.every((id) => (stages?.get(id) ?? -1) >= requiredStage);
}
export type CourseProgressCardDto = {
  readonly id: string;
  readonly promptType: string;
  readonly started: boolean;
  readonly burned: boolean;
  readonly stageIndex: number | null;
  readonly availableAt: string | null;
};
export type CourseMaterialStudyState = "not-started" | "learning" | "burned";
export type CourseReviewFilter = "due" | "scheduled";
export type CourseMaterialSort = "course" | "review-time";
export type CourseReviewTimeline = {
  readonly dueCardCount: number;
  readonly scheduledCardCount: number;
  readonly nextReviewAt: string | null;
};

export function courseReviewTimeline(
  cards: readonly {
    readonly started: boolean;
    readonly burned: boolean;
    readonly availableAt: string | null;
  }[],
  now: number,
): CourseReviewTimeline {
  let dueCardCount = 0;
  let scheduledCardCount = 0;
  let earliest = Infinity;
  for (const card of cards) {
    if (!card.started || card.burned || card.availableAt === null) continue;
    const time = Date.parse(card.availableAt);
    if (!Number.isFinite(time)) continue;
    if (time <= now) dueCardCount += 1;
    else scheduledCardCount += 1;
    earliest = Math.min(earliest, time);
  }
  return {
    dueCardCount,
    scheduledCardCount,
    nextReviewAt: Number.isFinite(earliest) ? new Date(earliest).toISOString() : null,
  };
}
export function courseMaterialStudyState(
  cards: readonly { readonly started: boolean; readonly burned: boolean }[],
): CourseMaterialStudyState {
  if (cards.length > 0 && cards.every((card) => card.started && card.burned)) return "burned";
  return cards.some((card) => card.started) ? "learning" : "not-started";
}
export type CourseMaterialPageDto = {
  readonly courseId: string;
  readonly levelNumber: number;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly items: readonly CourseMaterialDto[];
  readonly summary: CourseLevelSummaryDto;
};
export type CourseLevelSummaryDto = {
  readonly total: number;
  readonly newCount: number;
  readonly learningCount: number;
  readonly burnedCount: number;
  readonly dueItemCount: number;
  readonly byKind: Readonly<Record<ItemKind, number>>;
};
export function summarizeCourseLevel(
  items: readonly {
    readonly itemType: ItemKind;
    readonly studyState: CourseMaterialStudyState;
    readonly dueCardCount: number;
  }[],
): CourseLevelSummaryDto {
  const byKind = { component: 0, kanji: 0, word: 0, sentence: 0 };
  for (const item of items) byKind[item.itemType] += 1;
  return {
    total: items.length,
    newCount: items.filter((item) => item.studyState === "not-started").length,
    learningCount: items.filter((item) => item.studyState === "learning").length,
    burnedCount: items.filter((item) => item.studyState === "burned").length,
    dueItemCount: items.filter((item) => item.dueCardCount > 0).length,
    byKind,
  };
}
