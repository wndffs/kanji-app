import { buildBroadeningKanji, buildBroadeningWords } from "./course-broadening-builders";
import {
  requireNewCourseWordEvidence,
  unpackDeepeningReinforcement,
} from "./course-deepening-builders";
import {
  FOLLOWTHROUGH_KANJI_BLOCKS,
  FOLLOWTHROUGH_WORD_BLOCKS,
} from "./course-followthrough-answer-blocks";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_A } from "./course-followthrough-reinforcement-a";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_B } from "./course-followthrough-reinforcement-b";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_C } from "./course-followthrough-reinforcement-c";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_D } from "./course-followthrough-reinforcement-d";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_E } from "./course-followthrough-reinforcement-e";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_F } from "./course-followthrough-reinforcement-f";
import { COURSE_FOLLOWTHROUGH_REINFORCEMENT_G } from "./course-followthrough-reinforcement-g";
import { COURSE_FOLLOWTHROUGH_VOCABULARY_A } from "./course-followthrough-vocabulary-a";
import { COURSE_FOLLOWTHROUGH_VOCABULARY_B } from "./course-followthrough-vocabulary-b";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";

export const FOLLOWTHROUGH_KANJI_BATCH = "full-course-kanji-followthrough";
export const FOLLOWTHROUGH_WORD_PREFIX = "full-course-vocabulary-followthrough-";

// The exact slot baseline at the end of the 2,440-word reviewed registry.
export const FOLLOWTHROUGH_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 50],
  [5, 129],
  [6, 115],
  [7, 61],
  [8, 78],
  [9, 43],
  [10, 97],
  [11, 45],
  [12, 68],
  [13, 5],
  [15, 27],
  [18, 100],
  [19, 117],
  [20, 77],
  [21, 150],
  [22, 64],
  [23, 49],
  [24, 122],
  [25, 10],
  [27, 159],
  [30, 178],
  [33, 195],
  [34, 49],
  [36, 442],
  [37, 355],
  [38, 315],
  [39, 135],
  [40, 90],
  [41, 39],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed all 200 kanji, 200 reinforcement entries and 546 additional words, including bilingual meanings, grammar, readings and original examples. Verified 754 exact bilingual JMdict pairs, 200 KANJIDIC2 readings and 200 KanjiVG sequences on the pinned snapshot. No human certification or server application claimed.",
  sourceFile: "packages/db/src/course-followthrough-content.ts",
};

export const FOLLOWTHROUGH_REINFORCEMENT = [
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_A,
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_B,
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_C,
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_D,
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_E,
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_F,
  ...COURSE_FOLLOWTHROUGH_REINFORCEMENT_G,
];

export function followthroughKanji(previous: readonly MainCourseContentBatch[]) {
  const { kanji } = unpackDeepeningReinforcement(FOLLOWTHROUGH_REINFORCEMENT);
  return buildBroadeningKanji(previous, kanji, {
    id: FOLLOWTHROUGH_KANJI_BATCH,
    metadata,
    priorWordSlots: FOLLOWTHROUGH_PRIOR_WORD_ENDS,
    meaningBlocks: FOLLOWTHROUGH_KANJI_BLOCKS,
  });
}

export function followthroughWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  const rows = [
    ...unpackDeepeningReinforcement(FOLLOWTHROUGH_REINFORCEMENT).words,
    ...COURSE_FOLLOWTHROUGH_VOCABULARY_A,
    ...COURSE_FOLLOWTHROUGH_VOCABULARY_B,
  ];
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, {
    prefix: FOLLOWTHROUGH_WORD_PREFIX,
    metadata,
    meaningBlocks: FOLLOWTHROUGH_WORD_BLOCKS,
  });
}
