import { type SrsStage } from "@kanji-srs/srs";

export type DashboardSrsStateRecord = {
  readonly id: string;
  readonly learningCardId: string;
  readonly srsSystemId: string;
  readonly stageIndex: number;
  readonly availableAt: Date | null;
  readonly burnedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly stages: readonly SrsStage[];
};

export type DashboardLessonDependencyRecord = {
  readonly prerequisiteItemId: string;
  readonly requiredStage: number;
};

export type DashboardLessonItemRecord = {
  readonly courseId: string;
  readonly courseLevelNumber: number;
  readonly sortOrder: number;
  readonly id: string;
  readonly cardIds: readonly string[];
  readonly dependencies: readonly DashboardLessonDependencyRecord[];
};

export type DashboardLessonProgressRecord = {
  readonly learningItemId: string;
  readonly learningCardId: string;
  readonly stageIndex: number;
  readonly createdAt: Date;
};

export type DashboardCourseItemProgressRecord = {
  readonly id: string;
  readonly cardIds: readonly string[];
  readonly startedCardIds: readonly string[];
};

export type DashboardCourseLevelProgressRecord = {
  readonly levelNumber: number;
  readonly items: readonly DashboardCourseItemProgressRecord[];
};

export type DashboardCourseProgressRecord = {
  readonly id: string;
  readonly title: string;
  readonly levels: readonly DashboardCourseLevelProgressRecord[];
};

export type DashboardReviewResult =
  | "correct"
  | "wrong"
  | "typo"
  | "reveal"
  | "manual-ignore"
  | "resurrect";

export type DashboardReviewResultCountRecord = {
  readonly result: DashboardReviewResult;
  readonly count: number;
};
