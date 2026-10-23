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
