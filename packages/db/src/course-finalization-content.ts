import { buildBroadeningKanji, buildBroadeningWords } from "./course-broadening-builders";
import {
  requireNewCourseWordEvidence,
  unpackDeepeningReinforcement,
} from "./course-deepening-builders";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { COURSE_FINALIZATION_REINFORCEMENT_A } from "./course-finalization-reinforcement-a";
import { COURSE_FINALIZATION_REINFORCEMENT_B } from "./course-finalization-reinforcement-b";
import { COURSE_FINALIZATION_REINFORCEMENT_C } from "./course-finalization-reinforcement-c";
import { COURSE_FINALIZATION_REINFORCEMENT_D } from "./course-finalization-reinforcement-d";
import { COURSE_FINALIZATION_REINFORCEMENT_E } from "./course-finalization-reinforcement-e";
import { COURSE_FINALIZATION_REINFORCEMENT_F } from "./course-finalization-reinforcement-f";

export const FINALIZATION_KANJI_BATCH = "full-course-kanji-finalization";
export const FINALIZATION_WORD_PREFIX = "full-course-vocabulary-finalization-";
export const FINALIZATION_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
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
  [35, 64],
  [36, 939],
  [37, 790],
  [38, 667],
  [39, 346],
  [40, 197],
  [41, 157],
  [42, 131],
  [43, 98],
  [44, 76],
  [45, 24],
  [46, 80],
  [47, 80],
  [48, 81],
  [49, 81],
  [50, 40],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed 160 original bilingual reinforcement pairs, including precise reading alignment, scope and natural JP/kana examples. Matched 160 exact JMdict pairs, 160 KANJIDIC2 readings, 160 KanjiVG primary sequences and 432 component groups. No human or server publishing certification.",
  sourceFile: "packages/db/src/course-finalization-content.ts",
};

const reinforcement = unpackDeepeningReinforcement([
  ...COURSE_FINALIZATION_REINFORCEMENT_A,
  ...COURSE_FINALIZATION_REINFORCEMENT_B,
  ...COURSE_FINALIZATION_REINFORCEMENT_C,
  ...COURSE_FINALIZATION_REINFORCEMENT_D,
  ...COURSE_FINALIZATION_REINFORCEMENT_E,
  ...COURSE_FINALIZATION_REINFORCEMENT_F,
]);

export function finalizationKanji(previous: readonly MainCourseContentBatch[]) {
  return buildBroadeningKanji(previous, reinforcement.kanji, {
    id: FINALIZATION_KANJI_BATCH,
    metadata,
    priorWordSlots: FINALIZATION_PRIOR_WORD_ENDS,
    meaningBlocks: {
      ru: {
        克: [
          { text: "побуждать", reason: "Здесь справляются с препятствием, а не побуждают к делу." },
        ],
        唆: [{ text: "побеждать", reason: "Речь о побуждении к действию, а не о победе." }],
      },
    },
  });
}

export function finalizationWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  requireNewCourseWordEvidence(previous, reinforcement.words);
  return buildBroadeningWords(kanji, previous, reinforcement.words, {
    prefix: FINALIZATION_WORD_PREFIX,
    metadata,
  });
}
