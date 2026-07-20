import { type DashboardNewLearnerGuideDto } from "@kanji-srs/shared";

export type NewLearnerStepStatus = "complete" | "current" | "upcoming" | "parallel" | "waiting";

export type NewLearnerGuideState = {
  readonly visible: boolean;
  readonly kana: NewLearnerStepStatus;
  readonly lesson: NewLearnerStepStatus;
  readonly review: NewLearnerStepStatus;
};

export function resolveNewLearnerGuideState(
  guide: DashboardNewLearnerGuideDto,
  dueReviews: number,
): NewLearnerGuideState {
  const hiraganaReady =
    guide.kana.hiragana.totalCount > 0 &&
    guide.kana.hiragana.masteredCount >= guide.kana.hiragana.totalCount;

  return {
    visible: !guide.firstReviewCompleted,
    kana: hiraganaReady ? "complete" : guide.firstLessonCompleted ? "parallel" : "current",
    lesson: guide.firstLessonCompleted ? "complete" : hiraganaReady ? "current" : "upcoming",
    review: guide.firstLessonCompleted ? (dueReviews > 0 ? "current" : "waiting") : "upcoming",
  };
}
