import { buildBroadeningKanji, buildBroadeningWords } from "./course-broadening-builders";
import {
  requireNewCourseWordEvidence,
  unpackDeepeningReinforcement,
} from "./course-deepening-builders";
import type { MainCourseWordBatch } from "./main-course-word-content";
import type { MainCourseAcceptedMeanings, MainCourseContentBatch } from "./main-course-content";
import { COURSE_CONSOLIDATION_REINFORCEMENT_A } from "./course-consolidation-reinforcement-a";
import { COURSE_CONSOLIDATION_REINFORCEMENT_B } from "./course-consolidation-reinforcement-b";
import { COURSE_CONSOLIDATION_REINFORCEMENT_C } from "./course-consolidation-reinforcement-c";
import { COURSE_CONSOLIDATION_REINFORCEMENT_D } from "./course-consolidation-reinforcement-d";
import { COURSE_CONSOLIDATION_REINFORCEMENT_E } from "./course-consolidation-reinforcement-e";
import { COURSE_CONSOLIDATION_REINFORCEMENT_F } from "./course-consolidation-reinforcement-f";
import { COURSE_CONSOLIDATION_VOCABULARY_A } from "./course-consolidation-vocabulary-a";
import { COURSE_CONSOLIDATION_VOCABULARY_B } from "./course-consolidation-vocabulary-b";

export const CONSOLIDATION_KANJI_BATCH = "full-course-kanji-consolidation";
export const CONSOLIDATION_WORD_PREFIX = "full-course-vocabulary-consolidation-";
export const CONSOLIDATION_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 51],
  [5, 133],
  [6, 116],
  [7, 62],
  [8, 84],
  [9, 44],
  [10, 100],
  [11, 46],
  [12, 77],
  [13, 47],
  [14, 50],
  [15, 61],
  [16, 82],
  [17, 44],
  [18, 119],
  [19, 133],
  [20, 91],
  [21, 175],
  [22, 76],
  [23, 60],
  [24, 167],
  [25, 58],
  [26, 62],
  [27, 296],
  [28, 57],
  [29, 43],
  [30, 277],
  [33, 291],
  [34, 63],
  [36, 693],
  [37, 563],
  [38, 491],
  [39, 238],
  [40, 165],
  [41, 126],
  [42, 111],
  [43, 58],
  [44, 8],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed all 200 reinforcement pairs and 554 supplementary words for bilingual meanings, reading boundaries, example kana, scope and component cues. Confirmed 754 exact JMdict pairs, 200 KANJIDIC2 readings, 200 primary KanjiVG sequences and 519 exact component groups against the pinned snapshot. No human or live publication approval implied.",
  sourceFile: "packages/db/src/course-consolidation-content.ts",
};

const kanjiRuBlocks: Readonly<Record<string, MainCourseAcceptedMeanings["blocked"]>> = {
  悼: [{ text: "оплачивать", reason: "Здесь оплакивают утрату, а не платят деньги." }],
  赴: [
    { text: "оправляться", reason: "Здесь отправляются куда-либо, а не восстанавливаются." },
    { text: "отправлять", reason: "Действие выполняет сам отправляющийся, а не посылающий его." },
  ],
  搬: [{ text: "переводить", reason: "Здесь перевозят груз, а не переводят речь или текст." }],
  忍: [{ text: "срываться", reason: "Знак связан с сокрытием или выдержкой, а не со срывом." }],
  漬: [
    { text: "заманивать", reason: "Здесь погружают в жидкость или маринуют." },
    { text: "затачивать", reason: "Речь о замачивании, а не о заточке инструмента." },
  ],
  燥: [{ text: "выслушивать", reason: "Здесь сушат, а не слушают." }],
  娯: [{ text: "развлекаться", reason: "Здесь развлекают или забавляют, а не развлекаются сами." }],
  閲: [
    { text: "присматривать", reason: "Здесь просматривают текст, а не присматривают за кем-либо." },
  ],
  戯: [{ text: "предоставление", reason: "Здесь речь об игре или представлении, а не о выдаче." }],
  堪: [{ text: "выдёргивать", reason: "Здесь выдерживают нагрузку, а не вытаскивают предмет." }],
};

const wordBlocks = {
  申し出る: { ru: ["предполагать"] },
  思いなおす: { ru: ["придумывать"], en: ["to consider"] },
  見苦しい: { ru: ["непроглядный"] },
  男らしい: { ru: ["множественный"] },
  飲みこむ: { ru: ["прокладывать"] },
  とり入れる: { ru: ["выключать"] },
  引きしめる: { ru: ["затягиваться"] },
  書きなおす: { ru: ["предписывать"] },
  海峡: { ru: ["морской прилив"] },
  動機: { ru: ["пробуждение"] },
  交錯: { ru: ["переселение"] },
  受けとる: { ru: ["прижимать"] },
  持ちこたえる: { ru: ["продолжаться"] },
  持ちなおす: { ru: ["поправлять"] },
  落ちつく: { ru: ["успокаивать"] },
  着換える: { ru: ["передаваться"] },
  不変: { ru: ["неизбежность"] },
  さし出す: { ru: ["продавать"] },
  見のがす: { ru: ["припускать"] },
  巻きこむ: { ru: ["вытягивать"] },
  立ちなおる: { ru: ["отправляться"] },
  立ち去る: { ru: ["ударяться"] },
  言いかえす: { en: ["to report"] },
  立ち止まる: { en: ["to stop working"] },
  突き当たる: { en: ["to turn into"] },
  短大: { en: ["junior colleague"] },
  多大: { en: ["considerate"] },
  和らげる: { en: ["to believe"] },
  打ち消す: { en: ["to refuse"] },
  短期: { en: ["Showa period"] },
  寝ころぶ: { en: ["to die down", "to stretch taut"] },
  探偵: { en: ["defective"] },
  調停: { en: ["medication"] },
  変革: { en: ["transportation"] },
  搬送: { en: ["transformation"] },
  普遍: { en: ["university"] },
};

export const CONSOLIDATION_REINFORCEMENT = [
  ...COURSE_CONSOLIDATION_REINFORCEMENT_A,
  ...COURSE_CONSOLIDATION_REINFORCEMENT_B,
  ...COURSE_CONSOLIDATION_REINFORCEMENT_C,
  ...COURSE_CONSOLIDATION_REINFORCEMENT_D,
  ...COURSE_CONSOLIDATION_REINFORCEMENT_E,
  ...COURSE_CONSOLIDATION_REINFORCEMENT_F,
];

const reinforcement = unpackDeepeningReinforcement(CONSOLIDATION_REINFORCEMENT);

export function consolidationKanji(previous: readonly MainCourseContentBatch[]) {
  return buildBroadeningKanji(previous, reinforcement.kanji, {
    id: CONSOLIDATION_KANJI_BATCH,
    metadata,
    priorWordSlots: CONSOLIDATION_PRIOR_WORD_ENDS,
    meaningBlocks: { ru: kanjiRuBlocks },
  });
}

export function consolidationWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
) {
  const rows = [
    ...reinforcement.words,
    ...COURSE_CONSOLIDATION_VOCABULARY_A,
    ...COURSE_CONSOLIDATION_VOCABULARY_B,
  ];
  requireNewCourseWordEvidence(previous, rows);
  return buildBroadeningWords(kanji, previous, rows, {
    prefix: CONSOLIDATION_WORD_PREFIX,
    metadata,
    meaningBlocks: wordBlocks,
  });
}
