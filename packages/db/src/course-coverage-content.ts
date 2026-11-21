import { buildBroadeningKanji, buildBroadeningWords } from "./course-broadening-builders";
import {
  requireNewCourseWordEvidence,
  unpackDeepeningReinforcement,
} from "./course-deepening-builders";
import type { MainCourseAcceptedMeanings, MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { COURSE_COVERAGE_REINFORCEMENT_A } from "./course-coverage-reinforcement-a";
import { COURSE_COVERAGE_REINFORCEMENT_B } from "./course-coverage-reinforcement-b";
import { COURSE_COVERAGE_REINFORCEMENT_C } from "./course-coverage-reinforcement-c";
import { COURSE_COVERAGE_REINFORCEMENT_D } from "./course-coverage-reinforcement-d";
import { COURSE_COVERAGE_REINFORCEMENT_E } from "./course-coverage-reinforcement-e";
import { COURSE_COVERAGE_REINFORCEMENT_F } from "./course-coverage-reinforcement-f";
import { COURSE_COVERAGE_REINFORCEMENT_G } from "./course-coverage-reinforcement-g";
import { COURSE_COVERAGE_VOCABULARY_A } from "./course-coverage-vocabulary-a";
import { COURSE_COVERAGE_VOCABULARY_B } from "./course-coverage-vocabulary-b";
import { COURSE_COVERAGE_VOCABULARY_C } from "./course-coverage-vocabulary-c";

export const COVERAGE_KANJI_BATCH = "full-course-kanji-coverage";
export const COVERAGE_WORD_PREFIX = "full-course-vocabulary-coverage-";
export const COVERAGE_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 51],
  [5, 132],
  [6, 116],
  [7, 62],
  [8, 83],
  [9, 44],
  [10, 100],
  [11, 46],
  [12, 77],
  [13, 46],
  [14, 50],
  [15, 61],
  [16, 41],
  [18, 111],
  [19, 129],
  [20, 87],
  [21, 167],
  [22, 69],
  [23, 57],
  [24, 151],
  [25, 58],
  [26, 53],
  [27, 220],
  [30, 234],
  [33, 242],
  [34, 53],
  [36, 578],
  [37, 443],
  [38, 367],
  [39, 168],
  [40, 125],
  [41, 106],
  [42, 58],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed 200 kanji/word reinforcement pairs and 584 additional words, including bilingual meanings, example kana, morphology and source IDs. Verified 787 exact bilingual JMdict pairs, 200 KANJIDIC2 readings and 200 primary KanjiVG sequences on the pinned snapshot. No human certification or server application claimed.",
  sourceFile: "packages/db/src/course-coverage-content.ts",
};

const meaningBlocks: Readonly<Record<string, MainCourseAcceptedMeanings["blocked"]>> = {
  覧: [
    {
      text: "присматривать",
      reason: "Здесь осматривают или просматривают, а не присматривают за кем-либо.",
    },
  ],
  拓: [
    { text: "прокалывать", reason: "Этот знак связан с освоением и расчисткой, а не с проколом." },
  ],
  召: [{ text: "прибывать", reason: "Здесь призывают или вызывают кого-то, а не прибывают сами." }],
  憂: [{ text: "толковать", reason: "Речь о тревоге или печали, а не о толковании." }],
};

export const COVERAGE_REINFORCEMENT = [
  ...COURSE_COVERAGE_REINFORCEMENT_A,
  ...COURSE_COVERAGE_REINFORCEMENT_B,
  ...COURSE_COVERAGE_REINFORCEMENT_C,
  ...COURSE_COVERAGE_REINFORCEMENT_D,
  ...COURSE_COVERAGE_REINFORCEMENT_E,
  ...COURSE_COVERAGE_REINFORCEMENT_F,
  ...COURSE_COVERAGE_REINFORCEMENT_G,
];

export function coverageKanji(previous: readonly MainCourseContentBatch[]) {
  return buildBroadeningKanji(
    previous,
    unpackDeepeningReinforcement(COVERAGE_REINFORCEMENT).kanji,
    {
      id: COVERAGE_KANJI_BATCH,
      metadata,
      priorWordSlots: COVERAGE_PRIOR_WORD_ENDS,
      meaningBlocks: { ru: meaningBlocks },
    },
  );
}

export function coverageWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  const rows = [
    ...unpackDeepeningReinforcement(COVERAGE_REINFORCEMENT).words,
    ...COURSE_COVERAGE_VOCABULARY_A,
    ...COURSE_COVERAGE_VOCABULARY_B,
    ...COURSE_COVERAGE_VOCABULARY_C,
  ];
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, { prefix: COVERAGE_WORD_PREFIX, metadata });
}
