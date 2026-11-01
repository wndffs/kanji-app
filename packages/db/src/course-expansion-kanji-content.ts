import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import type { MainCourseContentBatch } from "./main-course-content";
import { EXPANSION_CUES, EXPANSION_KANJI } from "./course-expansion-kanji-rows";
import { EXPANSION_KANJI_BLOCKS } from "./course-expansion-semantic-blocks";

// Frozen placement ranges of all 800 previously published vocabulary pairs.
const PRIOR_WORD_RANGES: readonly (readonly [number, number, number])[] = [
  [4, 42, 43],
  [5, 1, 80],
  [5, 96, 97],
  [6, 1, 40],
  [6, 57, 59],
  [8, 10, 14],
  [10, 1, 23],
  [12, 1, 22],
  [15, 1, 20],
  [18, 41, 53],
  [19, 2, 34],
  [21, 1, 29],
  [24, 1, 15],
  [27, 1, 17],
  [27, 21, 40],
  [30, 1, 28],
  [30, 41, 80],
  [33, 1, 98],
  [36, 54, 151],
  [37, 1, 80],
  [37, 92, 113],
  [38, 1, 110],
];

export function buildCourseExpansionKanji(
  previous: readonly MainCourseContentBatch[],
): MainCourseContentBatch {
  if (EXPANSION_KANJI.length !== 200) throw new Error("Expansion requires 200 authored kanji.");
  const priorComponents = previous.flatMap((batch) =>
    batch.components.map((component, index) => ({
      ...component,
      level: batch.componentLevelNumber,
      order: (batch.componentSortOrderStart ?? 1) + index,
    })),
  );
  const components = EXPANSION_CUES.map(([symbol, ru, en, shapeRu, shapeEn]) => ({
    key: `component-expansion-${symbol.codePointAt(0)!.toString(16)}`,
    symbol,
    displayName: { ru, en },
    meaning: { ru, en },
    shapeDescription: { ru: shapeRu, en: shapeEn },
    mnemonic: {
      ru: `Зрительный образ «${ru}»: ${shapeRu}. Условное имя формы, не этимология.`,
      en: `Visual image '${en}': ${shapeEn}. A shape label, not etymology.`,
    },
  }));
  const componentMap = new Map(
    [
      ...priorComponents,
      ...components.map((component) => ({ ...component, level: 1, order: 0 })),
    ].map((component) => [component.symbol, component]),
  );
  if (
    new Set(components.map((component) => component.symbol)).size !== components.length ||
    components.some((component) =>
      priorComponents.some((prior) => prior.symbol === component.symbol),
    )
  )
    throw new Error("Expansion component symbols must be new and unique.");
  const occupied = new Set([
    ...priorComponents.map((component) => `${component.level}:${component.order}`),
    ...previous.flatMap((batch) =>
      batch.kanji.map((kanji) => `${kanji.levelNumber}:${kanji.sortOrder}`),
    ),
    ...PRIOR_WORD_RANGES.flatMap(([level, start, end]) =>
      Array.from({ length: end - start + 1 }, (_, index) => `${level}:${start + index}`),
    ),
  ]);
  const counts = new Map<number, number>();
  for (const kanji of previous.flatMap((batch) => batch.kanji))
    counts.set(kanji.levelNumber, (counts.get(kanji.levelNumber) ?? 0) + 1);
  const componentStart =
    Math.max(
      0,
      ...priorComponents
        .filter((component) => component.level === 1)
        .map((component) => component.order),
    ) + 1;
  components.forEach((_, index) => occupied.add(`1:${componentStart + index}`));
  return {
    id: "full-course-kanji-expansion",
    version: "1",
    authoredAt: "2026-11-01",
    reviewedAt: "2026-11-01",
    reviewNotes:
      "Independently AI-reviewed RU/EN meanings, thirteen visual cues, 200 frozen reading alignments, phonology, semantic near-miss blocks and pinned KANJIDIC2/KanjiVG evidence. No human linguistic certification or publication receipt is claimed.",
    sourceFile: "packages/db/src/course-expansion-kanji-content.ts",
    courseSlug: "japanese-ru-n2",
    componentLevelNumber: 1,
    componentSortOrderStart: componentStart,
    components,
    kanji: EXPANSION_KANJI.map(
      ([character, source, ru, en, symbols, imageRu, imageEn, soundRu, soundEn, word, kana]) => {
        const cues = symbols.map((symbol) => {
          const cue = componentMap.get(symbol);
          if (!cue) throw new Error(`Unknown expansion cue ${symbol} for ${character}`);
          return cue;
        });
        let level = Math.max(2, ...cues.map((cue) => cue.level + 1));
        while (level <= 60 && (counts.get(level) ?? 0) >= 40) level++;
        if (level > 60) throw new Error("No remaining kanji capacity within sixty levels.");
        let order = 1;
        while (occupied.has(`${level}:${order}`)) order++;
        occupied.add(`${level}:${order}`);
        counts.set(level, (counts.get(level) ?? 0) + 1);
        return {
          character,
          levelNumber: level,
          sortOrder: order,
          meanings: {
            ru: {
              primary: ru[0]!,
              accepted: ru,
              ...(EXPANSION_KANJI_BLOCKS[character]
                ? { blocked: EXPANSION_KANJI_BLOCKS[character] }
                : {}),
            },
            en: { primary: en[0]!, accepted: en },
          },
          reading: {
            source,
            sourceType: /[ァ-ヶ]/u.test(source) ? "ja_on" : "ja_kun",
            primary: normalizeJapaneseReading(source),
            accepted: [normalizeJapaneseReading(source)],
          },
          componentKeys: cues.map((cue) => cue.key),
          meaningMnemonic: {
            ru: `Образ для памяти, не этимология: ${imageRu} Связи называют зрительные опоры, не полный состав штрихов.`,
            en: `Memory image, not etymology: ${imageEn} Linked forms are visual cues, not a complete stroke decomposition.`,
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
