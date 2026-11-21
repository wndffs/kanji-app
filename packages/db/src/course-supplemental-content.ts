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
import { COURSE_SUPPLEMENTAL_THIRD_A1 } from "./course-supplemental-third-a1";
import { COURSE_SUPPLEMENTAL_THIRD_A2 } from "./course-supplemental-third-a2";
import { COURSE_SUPPLEMENTAL_THIRD_A3 } from "./course-supplemental-third-a3";
import { COURSE_SUPPLEMENTAL_THIRD_A4 } from "./course-supplemental-third-a4";
import { COURSE_SUPPLEMENTAL_THIRD_A5 } from "./course-supplemental-third-a5";
import { COURSE_SUPPLEMENTAL_THIRD_B1 } from "./course-supplemental-third-b1";
import { COURSE_SUPPLEMENTAL_THIRD_B2 } from "./course-supplemental-third-b2";
import { COURSE_SUPPLEMENTAL_THIRD_B3 } from "./course-supplemental-third-b3";
import { COURSE_SUPPLEMENTAL_THIRD_B4 } from "./course-supplemental-third-b4";
import { COURSE_SUPPLEMENTAL_THIRD_B5 } from "./course-supplemental-third-b5";
import { COURSE_SUPPLEMENTAL_THIRD_C1 } from "./course-supplemental-third-c1";
import { COURSE_SUPPLEMENTAL_THIRD_C2 } from "./course-supplemental-third-c2";
import { COURSE_SUPPLEMENTAL_THIRD_C3 } from "./course-supplemental-third-c3";
import { COURSE_SUPPLEMENTAL_THIRD_C4 } from "./course-supplemental-third-c4";
import { COURSE_SUPPLEMENTAL_THIRD_C5 } from "./course-supplemental-third-c5";
import type { SupplementalWordRow } from "./course-supplemental-word-rows";

export const FIRST_SUPPLEMENTAL_WORD_PREFIX = "full-course-vocabulary-supplemental-first-";
export const SECOND_SUPPLEMENTAL_WORD_PREFIX = "full-course-vocabulary-supplemental-second-";
export const THIRD_SUPPLEMENTAL_WORD_PREFIX = "full-course-vocabulary-supplemental-third-";
export const SUPPLEMENTAL_CAPSTONE_WORD_PREFIX = "full-course-vocabulary-supplemental-capstone-";

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

const third = [
  ...COURSE_SUPPLEMENTAL_THIRD_A1,
  ...COURSE_SUPPLEMENTAL_THIRD_A2,
  ...COURSE_SUPPLEMENTAL_THIRD_A3,
  ...COURSE_SUPPLEMENTAL_THIRD_A4,
  ...COURSE_SUPPLEMENTAL_THIRD_A5,
  ...COURSE_SUPPLEMENTAL_THIRD_B1,
  ...COURSE_SUPPLEMENTAL_THIRD_B2,
  ...COURSE_SUPPLEMENTAL_THIRD_B3,
  ...COURSE_SUPPLEMENTAL_THIRD_B4,
  ...COURSE_SUPPLEMENTAL_THIRD_B5,
  ...COURSE_SUPPLEMENTAL_THIRD_C1,
  ...COURSE_SUPPLEMENTAL_THIRD_C2,
  ...COURSE_SUPPLEMENTAL_THIRD_C3,
  ...COURSE_SUPPLEMENTAL_THIRD_C4,
  ...COURSE_SUPPLEMENTAL_THIRD_C5,
];

const capstoneExpressions = new Set([
  "総意",
  "息吹",
  "端緒",
  "通例",
  "天災",
  "損益",
  "濃淡",
  "敗因",
  "脈絡",
  "無条件",
  "名残",
  "落とし穴",
  "領収書",
  "励み",
  "腕前",
  "無生物",
  "要注意",
  "振り出し",
  "見せ場",
  "第一声",
  "肉声",
  "世界観",
  "重き",
  "親交",
  "切り捨て",
  "評伝",
  "休学",
  "休講",
  "休養",
  "拒絶",
  "緊迫",
  "苦慮",
  "更ける",
  "後押し",
  "誤る",
  "採集",
  "四捨五入",
  "察する",
  "残らず",
  "思う存分",
  "巧妙",
  "窮屈",
  "厄介",
  "丁重",
  "完璧",
  "平易",
  "手っ取り早い",
  "総力",
  "物事",
  "法則",
]);

function registerSupplementalWords(
  prefix: string,
  entries: readonly SupplementalWordRow[],
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
  minimumLevel?: number,
): readonly MainCourseWordBatch[] {
  const rows = supplementWordRows(entries);
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, {
    prefix,
    metadata,
    targetWordsPerLevel: 160,
    minimumLevel,
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

export function thirdSupplementalWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  const core: SupplementalWordRow[] = [];
  const capstone: SupplementalWordRow[] = [];
  for (const row of third) (capstoneExpressions.has(row[0]) ? capstone : core).push(row);
  if (capstone.length !== capstoneExpressions.size)
    throw new Error("The level 60 vocabulary set does not match the reviewed expressions.");

  const placed = registerSupplementalWords(THIRD_SUPPLEMENTAL_WORD_PREFIX, core, kanji, previous);
  const last = registerSupplementalWords(
    SUPPLEMENTAL_CAPSTONE_WORD_PREFIX,
    capstone,
    kanji,
    [...previous, ...placed],
    60,
  );
  return [...placed, ...last];
}
