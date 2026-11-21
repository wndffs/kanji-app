import {
  boundCourseKana,
  selectAuthoredSourceReading,
  selectedCourseSourceKana,
  type CourseReinforcementSoundChange,
} from "./course-kanji-source-reading";
import type { ExpansionKanjiRow, ExpansionWordRow } from "./course-expansion-content-types";
import type { MainCourseAcceptedMeanings, MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { BROADENING_READING_LINKS } from "./course-broadening-reading-links";
import { wordHanCharacters } from "./course-word-orthography";

const COURSE_SLUG = "japanese-ru-n2";
const AUTHORED_AT = "2026-11-21";
const review = {
  reviewedAt: "2026-11-21",
  reviewNotes:
    "Independently AI-reviewed bilingual meanings, examples, visual cues, phonology and exact reading alignments. Checked 504 exact JMdict pairs, 200 KANJIDIC2 readings and 200 KanjiVG sequences against the pinned 2026-10-31 snapshot. No human linguistic certification or server publication claimed.",
} as const;
export const BROADENING_KANJI_BATCH = "full-course-kanji-broadening";
export const BROADENING_WORD_PREFIX = "full-course-vocabulary-broadening-";

type BlockMetadata = Pick<
  MainCourseWordBatch,
  "authoredAt" | "reviewedAt" | "reviewNotes" | "sourceFile"
>;
export type CourseBlockReadingLink = readonly [
  ...(typeof BROADENING_READING_LINKS)[number],
  soundChange?: CourseReinforcementSoundChange,
];

const KANJI_RU_BLOCKS: Readonly<Record<string, MainCourseAcceptedMeanings["blocked"]>> = {
  破: [
    { text: "разрешать", reason: "Речь о том, чтобы сломать или прорвать, а не дать разрешение." },
  ],
  壊: [{ text: "разрешать", reason: "Кандзи обозначает разрушение, а не разрешение." }],
  許: [{ text: "разрушать", reason: "Кандзи обозначает разрешение, а не разрушение." }],
  伸: [{ text: "втягиваться", reason: "Речь о том, чтобы вытягиваться или расти." }],
  廃: [{ text: "превращать", reason: "Здесь прекращают или упраздняют, а не меняют форму." }],
  弁: [{ text: "разлучать", reason: "Различить доводы не значит разлучить людей." }],
  効: [{ text: "эффектность", reason: "Речь об эффективности, а не о внешнем впечатлении." }],
  聴: [{ text: "высушивать", reason: "Знак связан со слушанием, а не с сушкой." }],
  措: [{ text: "устраиваться", reason: "Здесь что-то устраивают или принимают меры." }],
};

const WORD_BLOCKS: Readonly<Record<string, { ru?: readonly string[]; en?: readonly string[] }>> = {
  許可: { ru: ["разрушение"] },
  破壊: { ru: ["разрешение"] },
  お守り: { en: ["protective care"] },
  愛護: { en: ["protective charm"] },
  医学: { en: ["medicines"] },
  司会: { en: ["holding an event"] },
};

// Highest occupied vocabulary slot per level in the previous 1,300-word release.
// Keep this immutable; the regression test checks it against those exact manifests.
export const BROADENING_PRIOR_WORD_ENDS: readonly (readonly [number, number])[] = [
  [3, 47],
  [4, 49],
  [5, 127],
  [6, 111],
  [7, 57],
  [8, 29],
  [10, 45],
  [12, 23],
  [15, 21],
  [18, 76],
  [19, 81],
  [20, 70],
  [21, 73],
  [22, 10],
  [24, 29],
  [27, 73],
  [30, 100],
  [33, 126],
  [36, 216],
  [37, 197],
  [38, 197],
  [39, 28],
];

const BROADENING_METADATA = {
  authoredAt: AUTHORED_AT,
  ...review,
  sourceFile: "packages/db/src/course-broadening-builders.ts",
} satisfies BlockMetadata;

const BROADENING_KANJI_OPTIONS = {
  id: BROADENING_KANJI_BATCH,
  metadata: BROADENING_METADATA,
  priorWordSlots: BROADENING_PRIOR_WORD_ENDS,
  meaningBlocks: { ru: KANJI_RU_BLOCKS },
};

const BROADENING_WORD_OPTIONS = {
  prefix: BROADENING_WORD_PREFIX,
  metadata: BROADENING_METADATA,
  meaningBlocks: WORD_BLOCKS,
};

function coursePlacementEnds(
  kanji: readonly MainCourseContentBatch[],
  wordEnds: readonly (readonly [number, number])[],
): Map<number, number> {
  const ends = new Map<number, number>();
  function reserve(level: number, order: number) {
    ends.set(level, Math.max(order, ends.get(level) ?? 0));
  }
  for (const [level, end] of wordEnds) reserve(level, end);
  for (const batch of kanji) {
    if (batch.courseSlug !== COURSE_SLUG) continue;
    for (const item of batch.kanji) reserve(item.levelNumber, item.sortOrder);
    if (batch.components.length)
      reserve(
        batch.componentLevelNumber,
        (batch.componentSortOrderStart ?? 1) + batch.components.length - 1,
      );
  }
  return ends;
}

export function buildBroadeningKanji(
  previous: readonly MainCourseContentBatch[],
  rows: readonly ExpansionKanjiRow[],
  options: Readonly<{
    id: string;
    metadata: BlockMetadata;
    priorWordSlots: readonly (readonly [number, number])[];
    newComponents?: {
      readonly levelNumber: number;
      readonly items: MainCourseContentBatch["components"];
    };
    meaningBlocks?: Readonly<Partial<Record<"ru" | "en", typeof KANJI_RU_BLOCKS>>>;
  }> = BROADENING_KANJI_OPTIONS,
): MainCourseContentBatch {
  const scoped = previous.filter((batch) => batch.courseSlug === COURSE_SLUG);
  const cues = new Map(
    scoped.flatMap((batch) =>
      batch.components.map(
        (cue) => [cue.symbol, { key: cue.key, level: batch.componentLevelNumber }] as const,
      ),
    ),
  );
  const ends = coursePlacementEnds(scoped, options.priorWordSlots);
  const componentLevelNumber = options.newComponents?.levelNumber ?? 1;
  const newComponents = options.newComponents?.items ?? [];
  const componentSortOrderStart = (ends.get(componentLevelNumber) ?? 0) + 1;
  if (newComponents.length) {
    ends.set(componentLevelNumber, componentSortOrderStart + newComponents.length - 1);
    const usedKeys = new Set([...cues.values()].map((cue) => cue.key));
    for (const component of newComponents) {
      if (cues.has(component.symbol) || usedKeys.has(component.key))
        throw new Error(`Duplicate broadening component ${component.symbol}.`);
      cues.set(component.symbol, { key: component.key, level: componentLevelNumber });
      usedKeys.add(component.key);
    }
  }
  const counts = new Map<number, number>();
  const seen = new Set<string>();
  for (const batch of scoped)
    for (const item of batch.kanji) {
      counts.set(item.levelNumber, (counts.get(item.levelNumber) ?? 0) + 1);
      seen.add(item.character);
    }
  return {
    id: options.id,
    version: "1",
    ...options.metadata,
    courseSlug: COURSE_SLUG,
    componentLevelNumber,
    ...(newComponents.length ? { componentSortOrderStart } : {}),
    components: newComponents,
    kanji: rows.map(
      ([character, source, ru, en, symbols, imageRu, imageEn, soundRu, soundEn, word, kana]) => {
        if (seen.has(character)) throw new Error(`Duplicate broadening kanji ${character}.`);
        seen.add(character);
        const components = symbols.map((symbol) => {
          const cue = cues.get(symbol);
          if (!cue) throw new Error(`Missing earlier cue ${symbol} for ${character}.`);
          return cue;
        });
        let level = Math.max(componentLevelNumber + 1, ...components.map((cue) => cue.level + 1));
        // Leave a later level for each kanji's word reinforcement.
        while (level < 60 && (counts.get(level) ?? 0) >= 40) level++;
        if (level >= 60)
          throw new Error(`No broadening kanji capacity before level 60: ${character}.`);
        const order = (ends.get(level) ?? 0) + 1;
        ends.set(level, order);
        counts.set(level, (counts.get(level) ?? 0) + 1);
        const selection = selectAuthoredSourceReading(source);
        const reading = selectedCourseSourceKana(selection);
        if (!reading) throw new Error(`Invalid selected reading for ${character}.`);
        const ruBlocks = options.meaningBlocks?.ru?.[character];
        const enBlocks = options.meaningBlocks?.en?.[character];
        return {
          character,
          levelNumber: level,
          sortOrder: order,
          meanings: {
            ru: {
              primary: ru[0]!,
              accepted: ru,
              ...(ruBlocks ? { blocked: ruBlocks } : {}),
            },
            en: { primary: en[0]!, accepted: en, ...(enBlocks ? { blocked: enBlocks } : {}) },
          },
          reading: {
            ...selection,
            primary: reading,
            accepted: [reading],
          },
          componentKeys: components.map((cue) => cue.key),
          meaningMnemonic: {
            ru: `Образ для памяти, не этимология: ${imageRu}`,
            en: `Memory image, not etymology: ${imageEn}`,
          },
          readingMnemonic: {
            ru: `${soundRu} Закрепите в слове ${word}（${kana}）.`,
            en: `${soundEn} Reinforce it in ${word} (${kana}).`,
          },
          requireStrokeData: true,
        };
      },
    ),
  };
}

const localize = ([ru, en]: readonly [string, string]) => ({ ru, en });
export function assertBroadeningReadingLinks(
  kanjiRows: readonly ExpansionKanjiRow[],
  wordRows: readonly ExpansionWordRow[],
  links: readonly CourseBlockReadingLink[] = BROADENING_READING_LINKS,
): void {
  const known = new Map(kanjiRows.map((row) => [row[0], row]));
  const words = new Map(wordRows.map((row) => [row[0], row]));
  const linked = new Set<string>();
  for (const [
    character,
    reading,
    expression,
    wordReading,
    index,
    offset,
    sequence,
    soundChange,
  ] of links) {
    const row = known.get(character);
    const word = words.get(expression);
    const characters = [...expression];
    const source = row ? selectAuthoredSourceReading(row[1]) : null;
    if (
      linked.has(character) ||
      !row ||
      !source ||
      selectedCourseSourceKana(source) !== reading ||
      row[9] !== expression ||
      row[10] !== wordReading ||
      !word ||
      word[1] !== wordReading ||
      word[2] !== sequence ||
      characters[index] !== character ||
      boundCourseKana(source, characters, index, wordReading, offset, soundChange) === null
    )
      throw new Error(`Invalid broadening reading reinforcement for ${character}.`);
    linked.add(character);
  }
  if (linked.size !== kanjiRows.length)
    throw new Error("Each broadening kanji requires exactly one checked reading link.");
}

export function buildBroadeningWords(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
  rows: readonly ExpansionWordRow[],
  options: Readonly<{
    prefix: string;
    metadata: BlockMetadata;
    meaningBlocks?: typeof WORD_BLOCKS;
  }> = BROADENING_WORD_OPTIONS,
): readonly MainCourseWordBatch[] {
  const levels = new Map(
    kanji
      .filter((batch) => batch.courseSlug === COURSE_SLUG)
      .flatMap((batch) => batch.kanji.map((item) => [item.character, item.levelNumber] as const)),
  );
  const words = previous.filter((batch) => batch.courseSlug === COURSE_SLUG);
  const ends = coursePlacementEnds(
    kanji,
    words.flatMap((batch) =>
      batch.words.map((word) => [batch.levelNumber, word.sortOrder] as const),
    ),
  );
  const seen = new Set(words.flatMap((batch) => batch.words.map((word) => word.expression)));
  const byLevel = new Map<number, ExpansionWordRow[]>();
  for (const row of rows) {
    const [expression] = row;
    if (seen.has(expression)) throw new Error(`Duplicate broadening word form: ${expression}.`);
    seen.add(expression);
    const level = Math.max(
      2,
      ...wordHanCharacters(expression + row[8][0]).map((char) => {
        const prerequisite = levels.get(char);
        if (prerequisite === undefined)
          throw new Error(`Unknown prerequisite ${char} for ${expression}.`);
        return prerequisite + 1;
      }),
    );
    if (level > 60) throw new Error(`Vocabulary prerequisite exceeds level 60: ${expression}.`);
    const group = byLevel.get(level) ?? [];
    group.push(row);
    byLevel.set(level, group);
  }
  const result: MainCourseWordBatch[] = [];
  for (const [level, group] of [...byLevel].sort(([a], [b]) => a - b)) {
    for (let offset = 0; offset < group.length; offset += 200) {
      const slice = group.slice(offset, offset + 200);
      const start = (ends.get(level) ?? 0) + 1;
      ends.set(level, start + slice.length - 1);
      result.push({
        id: options.prefix + String(result.length + 1).padStart(2, "0"),
        version: "1",
        ...options.metadata,
        courseSlug: COURSE_SLUG,
        levelNumber: level,
        wordCount: slice.length,
        sortOrderStart: start,
        words: slice.map(
          (
            [expression, reading, sequence, ru, en, scope, image, sound, example, metadata],
            index,
          ) => {
            const meanings = (
              accepted: readonly string[],
              blocked: readonly string[],
              reason: string,
            ) => ({
              primary: accepted[0]!,
              accepted,
              ...(blocked.length
                ? { blocked: [...new Set(blocked)].map((text) => ({ text, reason })) }
                : {}),
            });
            const alternatives = metadata.acceptedReadings;
            return {
              expression,
              reading,
              jmdictEntryId: `jmdict:${sequence}`,
              partOfSpeech: metadata.partOfSpeech,
              ...(alternatives?.length ? { acceptedReadings: alternatives } : {}),
              sortOrder: start + index,
              meanings: {
                ru: meanings(
                  ru,
                  [
                    ...(metadata.blockedRu ?? []),
                    ...(options.meaningBlocks?.[expression]?.ru ?? []),
                  ],
                  scope[0],
                ),
                en: meanings(
                  en,
                  [
                    ...(metadata.blockedEn ?? []),
                    ...(options.meaningBlocks?.[expression]?.en ?? []),
                  ],
                  scope[1],
                ),
              },
              meaningHint: localize(scope),
              meaningMnemonic: localize(image),
              readingMnemonic: localize(sound),
              readingHint: {
                ru: `Чтение целого слова: ${reading}.${alternatives?.length ? ` Также принимаются: ${alternatives.join("、")}.` : ""}${metadata.variantNotes ? ` ${metadata.variantNotes[0]}` : ""}`,
                en: `Whole-word reading: ${reading}.${alternatives?.length ? ` Also accepted: ${alternatives.join(", ")}.` : ""}${metadata.variantNotes ? ` ${metadata.variantNotes[1]}` : ""}`,
              },
              example: {
                japaneseText: example[0],
                readingText: example[1],
                translationRu: example[2],
                translationEn: example[3],
              },
            };
          },
        ),
      });
    }
  }
  return result;
}
