import { buildBroadeningKanji, buildBroadeningWords } from "./course-broadening-builders";
import {
  requireNewCourseWordEvidence,
  unpackDeepeningReinforcement,
} from "./course-deepening-builders";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { COURSE_EXTENSION_COMPONENTS } from "./course-extension-components";
import { COURSE_EXTENSION_REINFORCEMENT_A } from "./course-extension-reinforcement-a";
import { COURSE_EXTENSION_REINFORCEMENT_B } from "./course-extension-reinforcement-b";
import { COURSE_EXTENSION_REINFORCEMENT_C } from "./course-extension-reinforcement-c";
import { COURSE_EXTENSION_REINFORCEMENT_D } from "./course-extension-reinforcement-d";
import { COURSE_EXTENSION_REINFORCEMENT_E } from "./course-extension-reinforcement-e";
import { COURSE_EXTENSION_REINFORCEMENT_F } from "./course-extension-reinforcement-f";
import { COURSE_EXTENSION_REINFORCEMENT_G } from "./course-extension-reinforcement-g";
import { COURSE_EXTENSION_REINFORCEMENT_H } from "./course-extension-reinforcement-h";
import { COURSE_EXTENSION_VOCABULARY_A } from "./course-extension-vocabulary-a";
import { COURSE_EXTENSION_VOCABULARY_B } from "./course-extension-vocabulary-b";

export const EXTENSION_KANJI_BATCH = "full-course-kanji-extension";
export const EXTENSION_WORD_PREFIX = "full-course-vocabulary-extension-";
export const EXTENSION_COMPONENT_LEVEL = 44;
export const EXTENSION_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 51],
  [5, 134],
  [6, 116],
  [7, 63],
  [8, 85],
  [9, 44],
  [10, 100],
  [11, 46],
  [12, 78],
  [13, 47],
  [14, 50],
  [15, 78],
  [16, 82],
  [17, 44],
  [18, 122],
  [19, 139],
  [20, 92],
  [21, 185],
  [22, 80],
  [23, 63],
  [24, 186],
  [25, 59],
  [26, 64],
  [27, 329],
  [28, 57],
  [29, 62],
  [30, 361],
  [31, 72],
  [32, 61],
  [33, 343],
  [34, 98],
  [35, 64],
  [36, 825],
  [37, 696],
  [38, 581],
  [39, 294],
  [40, 183],
  [41, 142],
  [42, 121],
  [43, 98],
  [44, 66],
  [45, 24],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed all 200 reinforcement pairs, seven component cues and 570 additional words. Matched 774 exact bilingual JMdict pairs, 200 KANJIDIC2 readings, 200 KanjiVG primary sequences and 534 actual component groups in the pinned snapshot. Not human certification or evidence of server publication.",
  sourceFile: "packages/db/src/course-extension-content.ts",
};

const wordBlocks = {
  広がる: { ru: ["распространять"], en: ["to expend"] },
  近よる: { ru: ["приближать", "подносить ближе"] },
  寄る: { ru: ["приближать"] },
  散る: { ru: ["рассеивать", "расплетаться"] },
  解ける: { ru: ["разлетаться"] },
  転がる: { ru: ["перекатывать"] },
  くっ付く: { ru: ["прикреплять"] },
  突つく: { ru: ["подтачивать"] },
  虫食む: { ru: ["подталкивать"] },
  方策: { ru: ["способ лечения"] },
  費やす: { en: ["to expand", "to extend"] },
  急かす: { en: ["to dress someone"] },
  固まる: { en: ["to be unsettled"] },
  退く: { en: ["to set aside"] },
  達者: { en: ["in poor health"] },
};

export const EXTENSION_REINFORCEMENT = [
  ...COURSE_EXTENSION_REINFORCEMENT_A,
  ...COURSE_EXTENSION_REINFORCEMENT_B,
  ...COURSE_EXTENSION_REINFORCEMENT_C,
  ...COURSE_EXTENSION_REINFORCEMENT_D,
  ...COURSE_EXTENSION_REINFORCEMENT_E,
  ...COURSE_EXTENSION_REINFORCEMENT_F,
  ...COURSE_EXTENSION_REINFORCEMENT_G,
  ...COURSE_EXTENSION_REINFORCEMENT_H,
];

const reinforcement = unpackDeepeningReinforcement(EXTENSION_REINFORCEMENT);

export function extensionKanji(previous: readonly MainCourseContentBatch[]) {
  return buildBroadeningKanji(previous, reinforcement.kanji, {
    id: EXTENSION_KANJI_BATCH,
    metadata,
    priorWordSlots: EXTENSION_PRIOR_WORD_ENDS,
    newComponents: { levelNumber: EXTENSION_COMPONENT_LEVEL, items: COURSE_EXTENSION_COMPONENTS },
    meaningBlocks: {
      ru: {
        卑: [{ text: "неизменный", reason: "Здесь речь о том, что низменно или принижено." }],
      },
      en: {
        某: [
          { text: "ascertain", reason: "A certain person or thing, not finding something out." },
        ],
      },
    },
  });
}

export function extensionWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  const rows = [
    ...reinforcement.words,
    ...COURSE_EXTENSION_VOCABULARY_A,
    ...COURSE_EXTENSION_VOCABULARY_B,
  ];
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, {
    prefix: EXTENSION_WORD_PREFIX,
    metadata,
    meaningBlocks: wordBlocks,
  });
}
