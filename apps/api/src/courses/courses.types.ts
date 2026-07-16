export type EnrolledCourseRecord = {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string | null;
  readonly targetLevel: string | null;
  readonly band: string;
  readonly courseType: string;
  readonly enrollmentStatus: string;
  readonly startedAt: Date;
};

export type CourseSelectionRecord = {
  readonly savedCurrentCourseId: string | null;
  readonly courses: readonly EnrolledCourseRecord[];
};
