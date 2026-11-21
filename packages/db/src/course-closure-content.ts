import { buildBroadeningKanji, buildBroadeningWords } from "./course-broadening-builders";
import {
  requireNewCourseWordEvidence,
  unpackDeepeningReinforcement,
} from "./course-deepening-builders";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { COURSE_CLOSURE_REINFORCEMENT_A } from "./course-closure-reinforcement-a";
import { COURSE_CLOSURE_REINFORCEMENT_B } from "./course-closure-reinforcement-b";
import { COURSE_CLOSURE_REINFORCEMENT_C } from "./course-closure-reinforcement-c";
import { COURSE_CLOSURE_REINFORCEMENT_D } from "./course-closure-reinforcement-d";
import { COURSE_CLOSURE_REINFORCEMENT_E } from "./course-closure-reinforcement-e";
import { COURSE_CLOSURE_REINFORCEMENT_F } from "./course-closure-reinforcement-f";
import { COURSE_CLOSURE_STANDARD_A } from "./course-closure-standard-a";
import { COURSE_CLOSURE_STANDARD_B } from "./course-closure-standard-b";
import { COURSE_CLOSURE_STANDARD_C } from "./course-closure-standard-c";
import { COURSE_CLOSURE_STANDARD_CUES } from "./course-closure-standard-cues";

export const CLOSURE_KANJI_BATCH = "full-course-kanji-closure";
export const CLOSURE_WORD_PREFIX = "full-course-vocabulary-closure-";
export const CLOSURE_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 51],
  [5, 136],
  [6, 116],
  [7, 63],
  [8, 87],
  [9, 45],
  [10, 103],
  [11, 46],
  [12, 78],
  [13, 47],
  [14, 52],
  [15, 79],
  [16, 84],
  [17, 45],
  [18, 129],
  [19, 145],
  [20, 95],
  [21, 200],
  [22, 84],
  [23, 64],
  [24, 209],
  [25, 60],
  [26, 66],
  [27, 362],
  [28, 61],
  [29, 64],
  [30, 392],
  [31, 73],
  [32, 61],
  [33, 378],
  [34, 99],
  [35, 74],
  [36, 941],
  [37, 791],
  [38, 667],
  [39, 346],
  [40, 198],
  [41, 157],
  [42, 131],
  [43, 98],
  [44, 76],
  [45, 82],
  [46, 81],
  [47, 80],
  [48, 81],
  [49, 81],
  [50, 40],
  [51, 80],
  [52, 80],
  [53, 47],
  [54, 7],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independent AI editorial review of 226 original bilingual reinforcement pairs and 5 new cues. Matched 229 JMdict readings, 226 KANJIDIC2 readings, 226 KanjiVG primary sequences and 321 cue groups. No human or server publication certification.",
  sourceFile: "packages/db/src/course-closure-content.ts",
};

const reinforcement = unpackDeepeningReinforcement([
  ...COURSE_CLOSURE_REINFORCEMENT_A,
  ...COURSE_CLOSURE_REINFORCEMENT_B,
  ...COURSE_CLOSURE_REINFORCEMENT_C,
  ...COURSE_CLOSURE_REINFORCEMENT_D,
  ...COURSE_CLOSURE_REINFORCEMENT_E,
  ...COURSE_CLOSURE_REINFORCEMENT_F,
  ...COURSE_CLOSURE_STANDARD_A,
  ...COURSE_CLOSURE_STANDARD_B,
  ...COURSE_CLOSURE_STANDARD_C,
]);

export function closureKanji(previous: readonly MainCourseContentBatch[]) {
  return buildBroadeningKanji(previous, reinforcement.kanji, {
    id: CLOSURE_KANJI_BATCH,
    metadata,
    priorWordSlots: CLOSURE_PRIOR_WORD_ENDS,
    newComponents: { levelNumber: 44, items: COURSE_CLOSURE_STANDARD_CUES },
  });
}

export function closureWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  requireNewCourseWordEvidence(previous, reinforcement.words);
  return buildBroadeningWords(kanji, previous, reinforcement.words, {
    prefix: CLOSURE_WORD_PREFIX,
    metadata,
  });
}
