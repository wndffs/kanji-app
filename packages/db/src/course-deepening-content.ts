import { buildCourseDeepeningKanji, buildCourseDeepeningWords } from "./course-deepening-builders";
import { COURSE_DEEPENING_REINFORCEMENT_A } from "./course-deepening-reinforcement-a";
import { COURSE_DEEPENING_REINFORCEMENT_B } from "./course-deepening-reinforcement-b";
import { COURSE_DEEPENING_REINFORCEMENT_C } from "./course-deepening-reinforcement-c";
import { COURSE_DEEPENING_REINFORCEMENT_D } from "./course-deepening-reinforcement-d";
import { COURSE_DEEPENING_REINFORCEMENT_E } from "./course-deepening-reinforcement-e";
import { COURSE_DEEPENING_REINFORCEMENT_F } from "./course-deepening-reinforcement-f";
import { COURSE_DEEPENING_VOCABULARY_A } from "./course-deepening-vocabulary-a";
import { COURSE_DEEPENING_VOCABULARY_B } from "./course-deepening-vocabulary-b";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";

export const DEEPENING_REINFORCEMENT = [
  ...COURSE_DEEPENING_REINFORCEMENT_A,
  ...COURSE_DEEPENING_REINFORCEMENT_B,
  ...COURSE_DEEPENING_REINFORCEMENT_C,
  ...COURSE_DEEPENING_REINFORCEMENT_D,
  ...COURSE_DEEPENING_REINFORCEMENT_E,
  ...COURSE_DEEPENING_REINFORCEMENT_F,
];

export function deepeningKanji(previous: readonly MainCourseContentBatch[]) {
  return buildCourseDeepeningKanji(previous, DEEPENING_REINFORCEMENT);
}

export function deepeningWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  return buildCourseDeepeningWords(kanji, previous, DEEPENING_REINFORCEMENT, [
    ...COURSE_DEEPENING_VOCABULARY_A,
    ...COURSE_DEEPENING_VOCABULARY_B,
  ]);
}
