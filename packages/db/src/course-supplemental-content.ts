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
import { COURSE_SUPPLEMENTAL_SECOND_A1 } from "./course-supplemental-second-a1";
import { COURSE_SUPPLEMENTAL_SECOND_A2 } from "./course-supplemental-second-a2";
import { COURSE_SUPPLEMENTAL_SECOND_A3 } from "./course-supplemental-second-a3";
import { COURSE_SUPPLEMENTAL_SECOND_A4 } from "./course-supplemental-second-a4";
import { COURSE_SUPPLEMENTAL_SECOND_A5 } from "./course-supplemental-second-a5";
import { COURSE_SUPPLEMENTAL_SECOND_B1 } from "./course-supplemental-second-b1";
import { COURSE_SUPPLEMENTAL_SECOND_B2 } from "./course-supplemental-second-b2";
import { COURSE_SUPPLEMENTAL_SECOND_B3 } from "./course-supplemental-second-b3";
import { COURSE_SUPPLEMENTAL_SECOND_B4 } from "./course-supplemental-second-b4";
import { COURSE_SUPPLEMENTAL_SECOND_B5 } from "./course-supplemental-second-b5";
import { COURSE_SUPPLEMENTAL_SECOND_C1 } from "./course-supplemental-second-c1";
import { COURSE_SUPPLEMENTAL_SECOND_C2 } from "./course-supplemental-second-c2";
import { COURSE_SUPPLEMENTAL_SECOND_C3 } from "./course-supplemental-second-c3";
import { COURSE_SUPPLEMENTAL_SECOND_C4 } from "./course-supplemental-second-c4";
import { COURSE_SUPPLEMENTAL_SECOND_C5 } from "./course-supplemental-second-c5";
import type { SupplementalWordRow } from "./course-supplemental-word-rows";

export const FIRST_SUPPLEMENTAL_WORD_PREFIX = "full-course-vocabulary-supplemental-first-";
export const SECOND_SUPPLEMENTAL_WORD_PREFIX = "full-course-vocabulary-supplemental-second-";

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

const second = [
  ...COURSE_SUPPLEMENTAL_SECOND_A1,
  ...COURSE_SUPPLEMENTAL_SECOND_A2,
  ...COURSE_SUPPLEMENTAL_SECOND_A3,
  ...COURSE_SUPPLEMENTAL_SECOND_A4,
  ...COURSE_SUPPLEMENTAL_SECOND_A5,
  ...COURSE_SUPPLEMENTAL_SECOND_B1,
  ...COURSE_SUPPLEMENTAL_SECOND_B2,
  ...COURSE_SUPPLEMENTAL_SECOND_B3,
  ...COURSE_SUPPLEMENTAL_SECOND_B4,
  ...COURSE_SUPPLEMENTAL_SECOND_B5,
  ...COURSE_SUPPLEMENTAL_SECOND_C1,
  ...COURSE_SUPPLEMENTAL_SECOND_C2,
  ...COURSE_SUPPLEMENTAL_SECOND_C3,
  ...COURSE_SUPPLEMENTAL_SECOND_C4,
  ...COURSE_SUPPLEMENTAL_SECOND_C5,
];

function registerSupplementalWords(
  prefix: string,
  entries: readonly SupplementalWordRow[],
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  const rows = supplementWordRows(entries);
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, {
    prefix,
    metadata,
    targetWordsPerLevel: 160,
  });
}

export function firstSupplementalWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  return registerSupplementalWords(FIRST_SUPPLEMENTAL_WORD_PREFIX, first, kanji, previous);
}

export function secondSupplementalWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  return registerSupplementalWords(SECOND_SUPPLEMENTAL_WORD_PREFIX, second, kanji, previous);
}
