import { DEEPENING_KANJI_BLOCKS, DEEPENING_WORD_BLOCKS } from "./course-deepening-answer-blocks";
import {
  kanjidic2Okurigana,
  selectAuthoredSourceReading,
  selectedCourseSourceKana,
} from "./course-kanji-source-reading";
import {
  assertBroadeningReadingLinks,
  buildBroadeningKanji,
  buildBroadeningWords,
  type CourseBlockReadingLink,
} from "./course-broadening-builders";
import type {
  ExpansionKanjiRow,
  ExpansionReinforcementRow,
  ExpansionWordRow,
} from "./course-expansion-content-types";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { matchesAuthoredExampleReading } from "./curated-example-reading";

export const DEEPENING_KANJI_BATCH = "full-course-kanji-deepening";
export const DEEPENING_WORD_PREFIX = "full-course-vocabulary-deepening-";

// Frozen placement baseline. Do not recompute from a registry that includes this block.
export const DEEPENING_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 49],
  [5, 127],
  [6, 111],
  [7, 58],
  [8, 71],
  [9, 42],
  [10, 88],
  [11, 4],
  [12, 23],
  [15, 23],
  [18, 86],
  [19, 89],
  [20, 72],
  [21, 113],
  [22, 41],
  [23, 33],
  [24, 43],
  [27, 107],
  [30, 124],
  [33, 159],
  [36, 324],
  [37, 284],
  [38, 273],
  [39, 103],
  [40, 35],
];

const metadata = {
  authoredAt: "2026-11-21",
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed bilingual meanings, examples, grammar, components and reading bindings. Parent resolved editorial findings, checked semantic answer contrasts and confirmed 642 exact JMdict pairs, 200 KANJIDIC2 readings and 200 KanjiVG sequences on the pinned snapshot. No human certification or server publication claimed.",
  sourceFile: "packages/db/src/course-deepening-builders.ts",
};

export function unpackDeepeningReinforcement(rows: readonly ExpansionReinforcementRow[]) {
  const kanji: ExpansionKanjiRow[] = [];
  const words: ExpansionWordRow[] = [];
  const bindings: CourseBlockReadingLink[] = [];
  for (const [
    [character, source, symbols, meaningsRu, meaningsEn, image],
    [index, offset],
    [expression, reading, sequence, wordRu, wordEn, scope, wordImage, example, details],
  ] of rows) {
    const selection = selectAuthoredSourceReading(source);
    const kana = selectedCourseSourceKana(selection);
    const ending =
      selection.sourceForm === "okurigana-stem" ? kanjidic2Okurigana(source)?.ending : undefined;
    const symbolsInWord = [...expression];
    if (
      !Number.isSafeInteger(index) ||
      !Number.isSafeInteger(offset) ||
      offset < 0 ||
      !kana ||
      symbolsInWord[index] !== character ||
      reading.slice(offset, offset + kana.length) !== kana ||
      (ending !== undefined &&
        (!symbolsInWord
          .slice(index + 1)
          .join("")
          .startsWith(ending) ||
          !reading.startsWith(ending, offset + kana.length)))
    ) {
      throw new Error(`Unaligned reinforcement reading for ${character} in ${expression}.`);
    }
    const aligned = [reading.slice(0, offset), kana, reading.slice(offset + kana.length)]
      .filter(Boolean)
      .join("・");
    const promptRu = `В слове ${expression} знак ${character} даёт ${kana}: ${aligned}.${ending ? ` Окуригана ${ending} пишется после знака.` : ""}`;
    const promptEn = `In ${expression}, ${character} supplies ${kana}: ${aligned}.${ending ? ` The okurigana ${ending} is written after the kanji.` : ""}`;
    kanji.push([
      character,
      source,
      meaningsRu,
      meaningsEn,
      symbols,
      image[0],
      image[1],
      promptRu,
      promptEn,
      expression,
      reading,
    ]);
    words.push([
      expression,
      reading,
      sequence,
      wordRu,
      wordEn,
      scope,
      wordImage,
      [
        `Произнесите ${aligned} слитно: ${kana} здесь соответствует ${character}.`,
        `Say ${aligned} as one word: ${kana} is the part written ${character}.`,
      ],
      example,
      details ?? { partOfSpeech: "noun" },
    ]);
    bindings.push([character, kana, expression, reading, index, offset, sequence]);
  }
  assertBroadeningReadingLinks(kanji, words, bindings);
  return { kanji, words, bindings };
}

export function buildCourseDeepeningKanji(
  previous: readonly MainCourseContentBatch[],
  reinforcement: readonly ExpansionReinforcementRow[],
) {
  return buildBroadeningKanji(previous, unpackDeepeningReinforcement(reinforcement).kanji, {
    id: DEEPENING_KANJI_BATCH,
    metadata,
    priorWordSlots: DEEPENING_PRIOR_WORD_ENDS,
    meaningBlocks: DEEPENING_KANJI_BLOCKS,
  });
}

export function buildCourseDeepeningWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
  reinforcement: readonly ExpansionReinforcementRow[],
  extraWords: readonly ExpansionWordRow[],
) {
  const previousEntries = new Set(
    previous.flatMap((batch) => batch.words.map((item) => item.jmdictEntryId)),
  );
  const rows = [...unpackDeepeningReinforcement(reinforcement).words, ...extraWords];
  for (const [expression, reading, sequence, , , , , , [sentence, sentenceReading]] of rows) {
    const id = `jmdict:${sequence}`;
    if (previousEntries.has(id))
      throw new Error(`Reused course source entry ${id} for ${expression}.`);
    previousEntries.add(id);
    if (!matchesAuthoredExampleReading(expression, reading, sentence, sentenceReading))
      throw new Error(`Unaligned example kana for ${expression}.`);
  }
  return buildBroadeningWords(kanji, previous, rows, {
    prefix: DEEPENING_WORD_PREFIX,
    metadata,
    meaningBlocks: DEEPENING_WORD_BLOCKS,
  });
}
