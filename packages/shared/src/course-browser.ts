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
export type CourseMaterialDto = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly japanese: string;
  readonly title: string;
  readonly reading: string | null;
  readonly meaningRu: string | null;
  readonly meaningEn: string | null;
  readonly studyState: CourseMaterialStudyState;
  readonly cardCount: number;
  readonly startedCardCount: number;
  readonly burnedCardCount: number;
};
export type CourseMaterialStudyState = "not-started" | "learning" | "burned";
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
};
