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
import { type ItemKind } from "./index";


export type CourseMaterialDto = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly japanese: string;
  readonly title: string;
};
export type CourseMaterialPageDto = {
  readonly courseId: string;
  readonly levelNumber: number;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly items: readonly CourseMaterialDto[];
};
