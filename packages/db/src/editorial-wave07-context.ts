import { buildMainCourseContentBatches } from "./main-course-content";
import { buildMainCourseWordBatches } from "./main-course-word-content";

// The frozen proposal preview uses its original context, not its promoted copy.
export const preWave07KanjiBatches = () => buildMainCourseContentBatches().slice(0, 6);
export const preWave07WordBatches = () => buildMainCourseWordBatches().slice(0, 6);
export const wave07IsPromoted = () =>
  buildMainCourseContentBatches().some(
    (batch) => batch.id === "task-118-course-kanji-07" && batch.reviewedAt !== null,
  ) &&
  buildMainCourseWordBatches().some(
    (batch) => batch.id === "task-127-course-words-07" && batch.reviewedAt !== null,
  );
