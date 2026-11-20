import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import {
  assertBroadeningReadingLinks,
  buildBroadeningKanji,
  buildBroadeningWords,
} from "./course-broadening-builders";
import { BROADENING_KANJI_A } from "./course-broadening-kanji-a";
import { BROADENING_KANJI_B } from "./course-broadening-kanji-b";
import { BROADENING_VOCABULARY_A } from "./course-broadening-vocabulary-a";
import { BROADENING_VOCABULARY_B } from "./course-broadening-vocabulary-b";
import { BROADENING_VOCABULARY_C } from "./course-broadening-vocabulary-c";
import { BROADENING_VOCABULARY_D } from "./course-broadening-vocabulary-d";

export const BROADENING_KANJI_ROWS = [...BROADENING_KANJI_A, ...BROADENING_KANJI_B];
export const BROADENING_WORD_ROWS = [
  ...BROADENING_VOCABULARY_A,
  ...BROADENING_VOCABULARY_B,
  ...BROADENING_VOCABULARY_C,
  ...BROADENING_VOCABULARY_D,
];

export function buildCourseBroadeningKanji(previous: readonly MainCourseContentBatch[]) {
  if (BROADENING_KANJI_ROWS.length !== 200)
    throw new Error("Expected 200 independently authored broadening kanji.");
  return buildBroadeningKanji(previous, BROADENING_KANJI_ROWS);
}

export function buildCourseBroadeningWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  if (BROADENING_WORD_ROWS.length !== 500)
    throw new Error("Expected 500 independently authored broadening words.");
  assertBroadeningReadingLinks(BROADENING_KANJI_ROWS, BROADENING_WORD_ROWS);
  return buildBroadeningWords(kanji, previous, BROADENING_WORD_ROWS);
}
