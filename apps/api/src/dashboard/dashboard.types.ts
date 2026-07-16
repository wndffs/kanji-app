import { type SrsStage } from "@kanji-srs/srs";
import { type BilingualTextDto, type ItemKind } from "@kanji-srs/shared";

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

export type DashboardSrsStageSpreadRecord = {
  readonly srsSystemId: string;
  readonly srsSystemTitle: string;
  readonly stages: readonly {
    readonly stageIndex: number;
    readonly name: string;
    readonly isBurned: boolean;
    readonly cardsByItemType: Readonly<Record<ItemKind, number>>;
  }[];
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
  readonly itemType: ItemKind;
  readonly cardIds: readonly string[];
  readonly startedCardIds: readonly string[];
  readonly burnedCardIds: readonly string[];
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

export type DashboardLeechItemRecord = {
  readonly id: string;
  readonly itemType: ItemKind;
  readonly japanese: string;
  readonly reading: string | null;
  readonly translations: BilingualTextDto;
  readonly level: number | null;
  readonly jlptLevel: string | null;
};

export type DashboardLeechSignalRecord = {
  readonly id: string;
  readonly learningCardId: string;
  readonly srsSystemId: string;
  readonly stageIndex: number;
  readonly availableAt: Date | null;
  readonly burnedAt: Date | null;
  readonly wrongCount: number;
  readonly correctStreak: number;
  readonly stages: readonly SrsStage[];
  readonly recentWrongCount: number;
  readonly stageDropCount: number;
  readonly stageDropMagnitude: number;
  readonly item: DashboardLeechItemRecord;
};
