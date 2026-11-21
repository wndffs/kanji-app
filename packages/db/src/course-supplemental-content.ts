import { buildBroadeningWords } from "./course-broadening-builders";
import { requireNewCourseWordEvidence } from "./course-deepening-builders";
import { supplementWordRows } from "./course-supplemental-word-rows";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { COURSE_SUPPLEMENTAL_FIRST_A1 } from "./course-supplemental-first-a1";
import { COURSE_SUPPLEMENTAL_FIRST_A2 } from "./course-supplemental-first-a2";
import { COURSE_SUPPLEMENTAL_FIRST_A3 } from "./course-supplemental-first-a3";
import { COURSE_SUPPLEMENTAL_FIRST_A4 } from "./course-supplemental-first-a4";
import { COURSE_SUPPLEMENTAL_FIRST_A5 } from "./course-supplemental-first-a5";
import { COURSE_SUPPLEMENTAL_FIRST_B1 } from "./course-supplemental-first-b1";
import { COURSE_SUPPLEMENTAL_FIRST_B2 } from "./course-supplemental-first-b2";
import { COURSE_SUPPLEMENTAL_FIRST_B3 } from "./course-supplemental-first-b3";
import { COURSE_SUPPLEMENTAL_FIRST_B4 } from "./course-supplemental-first-b4";
import { COURSE_SUPPLEMENTAL_FIRST_B5 } from "./course-supplemental-first-b5";
import { COURSE_SUPPLEMENTAL_FIRST_C1 } from "./course-supplemental-first-c1";
import { COURSE_SUPPLEMENTAL_FIRST_C2 } from "./course-supplemental-first-c2";
import { COURSE_SUPPLEMENTAL_FIRST_C3 } from "./course-supplemental-first-c3";
import { COURSE_SUPPLEMENTAL_FIRST_C4 } from "./course-supplemental-first-c4";
import { COURSE_SUPPLEMENTAL_FIRST_C5 } from "./course-supplemental-first-c5";

export const FIRST_SUPPLEMENTAL_WORD_PREFIX = "full-course-vocabulary-supplemental-first-";

const first = [
  ...COURSE_SUPPLEMENTAL_FIRST_A1,
  ...COURSE_SUPPLEMENTAL_FIRST_A2,
  ...COURSE_SUPPLEMENTAL_FIRST_A3,
  ...COURSE_SUPPLEMENTAL_FIRST_A4,
  ...COURSE_SUPPLEMENTAL_FIRST_A5,
  ...COURSE_SUPPLEMENTAL_FIRST_B1,
  ...COURSE_SUPPLEMENTAL_FIRST_B2,
  ...COURSE_SUPPLEMENTAL_FIRST_B3,
  ...COURSE_SUPPLEMENTAL_FIRST_B4,
  ...COURSE_SUPPLEMENTAL_FIRST_B5,
  ...COURSE_SUPPLEMENTAL_FIRST_C1,
  ...COURSE_SUPPLEMENTAL_FIRST_C2,
  ...COURSE_SUPPLEMENTAL_FIRST_C3,
  ...COURSE_SUPPLEMENTAL_FIRST_C4,
  ...COURSE_SUPPLEMENTAL_FIRST_C5,
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Original bilingual course text and Japanese examples, independently AI-editorial-reviewed and matched to exact licensed JMdict evidence in the pinned 2026-10-31 snapshot. Not human certification or server publication.",
  sourceFile: "packages/db/src/course-supplemental-content.ts",
};

export function firstSupplementalWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  const rows = supplementWordRows(first);
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, {
    prefix: FIRST_SUPPLEMENTAL_WORD_PREFIX,
    metadata,
    targetWordsPerLevel: 160,
  });
}
