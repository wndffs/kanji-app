import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import { COURSE_GROWTH_KANJI } from "./course-growth-kanji-content";
import { GROWTH_VOCABULARY_A } from "./course-growth-vocabulary-a";
import { GROWTH_VOCABULARY_B } from "./course-growth-vocabulary-b";

type Pair = readonly [ru: string, en: string];
export type GrowthWordRow = readonly [
  expression: string,
  reading: string,
  sequence: string,
  ru: readonly string[],
  en: readonly string[],
  scope: Pair,
  image: Pair,
  sound: Pair,
  example: readonly [japanese: string, kana: string, ru: string, en: string],
];
const localize = ([ru, en]: Pair) => ({ ru, en });
const AUTHORED_PAIRS = [...GROWTH_VOCABULARY_A, ...GROWTH_VOCABULARY_B];
// Exact same-sense source variants; these do not replace the preferred lesson reading.
const ALTERNATIVES: Readonly<Record<string, readonly string[]>> = {
  以下: ["いげ"],
  外国: ["そとぐに"],
  月末: ["つきずえ"],
  失礼: ["しつらい", "しちらい"],
  初夏: ["はつなつ"],
  晴天: ["せいでん"],
  草原: ["くさはら", "くさわら"],
  台所: ["だいどこ"],
  竹林: ["たけばやし"],
  店員: ["ていいん"],
  東西: ["ひがしにし"],
  東南: ["ひがしみなみ"],
  馬車: ["うまぐるま"],
  今朝: ["こんちょう"],
  昨日: ["さくじつ"],
  前半: ["ぜんぱん"],
  昼間: ["ちゅうかん"],
  南東: ["みなみひがし"],
  半年: ["はんねん"],
  鼻血: ["はなじ"],
  北東: ["きたひがし"],
  夕飯: ["ゆうめし"],
};
const HISTORICAL = new Set(["以下", "外国", "失礼", "晴天", "東西", "馬車"]);
const BLOCKS: Readonly<Record<string, { ru?: readonly string[]; en?: readonly string[] }>> = {
  宿題: { ru: ["домашнее здание"] },
  留学: { ru: ["облучение за границей"], en: ["studying aboard"] },
  身長: { en: ["human weight"] },
  出発: { en: ["deporting"] },
  竹林: { en: ["bamboo groove"] },
  直線: { en: ["straight lane"] },
  科学: { ru: ["химия"], en: ["chemistry"] },
  以上: { ru: ["строго больше"], en: ["strictly greater than"] },
  以下: { ru: ["строго меньше"], en: ["strictly less than"] },
  人類: { ru: ["гуманность"], en: ["humaneness"] },
  性別: { ru: ["сексуальная ориентация"], en: ["sexual orientation"] },
  百万: { en: ["one billion"] },
  学期: { en: ["school team"] },
  郵便: { en: ["portal service"] },
  電池: { en: ["electric bell"] },
  関係: { en: ["convection"] },
  出血: { ru: ["кроволечение"] },
  三毛猫: { en: ["calico cap"] },
};

const EARLIER_GAPS = [
  ["百", "百万", "ひゃくまん"],
  ["千", "千切り", "せんぎり"],
  ["止", "中止", "ちゅうし"],
  ["花", "開花", "かいか"],
  ["草", "草原", "そうげん"],
  ["馬", "馬車", "ばしゃ"],
  ["鳥", "野鳥", "やちょう"],
  ["魚", "金魚", "きんぎょ"],
  ["米", "米国", "べいこく"],
  ["門", "正門", "せいもん"],
] as const;

// Explicit editorial word links, not inferred kanji-to-word reading rules.
export const COURSE_GROWTH_READING_LINKS = [
  ...COURSE_GROWTH_KANJI.map((r) => ({
    character: r[0],
    kanjiReading: normalizeJapaneseReading(r[1]),
    expression: r[9],
    wordReading: r[10],
  })),
  ...EARLIER_GAPS.map(([character, expression, wordReading]) => ({
    character,
    expression,
    wordReading,
  })),
].map((link) => {
  const row = AUTHORED_PAIRS.find((r) => r[0] === link.expression && r[1] === link.wordReading);
  if (!row) throw new Error(`Missing authored reinforcement pair: ${link.character}`);
  return { ...link, jmdictEntryId: `jmdict:${row[2]}` };
});

export function validateCourseGrowthReadings(
  kanji: readonly MainCourseContentBatch[],
  words: readonly MainCourseWordBatch[],
): readonly string[] {
  const targets = new Map(kanji.flatMap((b) => b.kanji.map((k) => [k.character, k] as const)));
  const all = words.flatMap((b) => b.words);
  const issues: string[] = [];
  for (const link of COURSE_GROWTH_READING_LINKS) {
    const target = targets.get(link.character);
    if (!target || ("kanjiReading" in link && target.reading.primary !== link.kanjiReading))
      issues.push(`Taught reading mismatch: ${link.character}`);
    const word = all.find(
      (w) =>
        w.expression === link.expression &&
        w.reading === link.wordReading &&
        w.jmdictEntryId === link.jmdictEntryId,
    );
    if (
      !word ||
      !word.expression.includes(link.character) ||
      !target ||
      !word.reading.includes(target.reading.primary)
    )
      issues.push(`Missing primary word reinforcement: ${link.character}`);
  }
  return issues;
}

export function buildCourseGrowthWordBatches(
  kanji: readonly MainCourseContentBatch[],
): readonly MainCourseWordBatch[] {
  const rows = [...GROWTH_VOCABULARY_A, ...GROWTH_VOCABULARY_B];
  if (rows.length !== 160) throw new Error(`Expected 160 growth words, got ${rows.length}`);
  const levels = new Map(
    kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
  );
  const missing = rows.flatMap((r) =>
    [...new Set([...(r[0] + r[8][0])].filter((c) => /\p{Script=Han}/u.test(c)))]
      .filter((c) => !levels.has(c) || levels.get(c)! >= 37)
      .map((c) => `${r[0]}:${c}`),
  );
  if (missing.length) throw new Error(`Missing earlier kanji: ${missing.join(", ")}`);
  const batches: readonly MainCourseWordBatch[] = Array.from({ length: 8 }, (_, i) => ({
    id: `full-course-vocabulary-growth-${String(i + 1).padStart(2, "0")}`,
    version: "1",
    authoredAt: "2026-11-01",
    reviewedAt: "2026-11-01",
    reviewNotes:
      "Original A/B vocabulary content; independent AI editorial review by Jason and source/reading review by Huygens, with corrections. 160 exact primary JMdict pairs and 24 same-sense alternatives checked against pinned 2026-10-31 sources. Not human certification or a server publication receipt.",
    sourceFile: "packages/db/src/course-growth-word-content.ts",
    courseSlug: "japanese-ru-n2",
    levelNumber: 37 + Math.floor(i / 4),
    sortOrderStart: (i % 4) * 20 + 1,
    words: rows
      .slice(i * 20, (i + 1) * 20)
      .map(([expression, reading, sequence, ru, en, scope, image, sound, ex], index) => {
        const meanings = (locale: "ru" | "en", answers: readonly string[]) => ({
          primary: answers[0]!,
          accepted: answers,
          ...(BLOCKS[expression]?.[locale]
            ? {
                blocked: BLOCKS[expression]![locale]!.map((text) => ({
                  text,
                  reason: scope[locale === "ru" ? 0 : 1],
                })),
              }
            : {}),
        });
        return {
          expression,
          reading,
          jmdictEntryId: `jmdict:${sequence}`,
          sortOrder: (i % 4) * 20 + index + 1,
          ...(ALTERNATIVES[expression] ? { acceptedReadings: ALTERNATIVES[expression] } : {}),
          meanings: { ru: meanings("ru", ru), en: meanings("en", en) },
          meaningMnemonic: localize(image),
          meaningHint: localize(scope),
          readingMnemonic: localize(sound),
          readingHint: {
            ru: `Чтение целого слова: ${reading}.${ALTERNATIVES[expression] ? ` Также принимаются ${HISTORICAL.has(expression) ? "исторические, неосновные варианты" : expression === "鼻血" || expression === "店員" ? "словарные нестандартные написания" : "варианты"}: ${ALTERNATIVES[expression]!.join("、")}.` : ""}`,
            en: `Whole-word reading: ${reading}.${ALTERNATIVES[expression] ? ` Also accepted ${HISTORICAL.has(expression) ? "historical, nonpreferred readings" : expression === "鼻血" || expression === "店員" ? "dictionary-attested irregular spellings" : "variants"}: ${ALTERNATIVES[expression]!.join(", ")}.` : ""}`,
          },
          example: {
            japaneseText: ex[0],
            readingText: ex[1],
            translationRu: ex[2],
            translationEn: ex[3],
          },
        };
      }),
  }));
  const issues = validateCourseGrowthReadings(kanji, batches);
  if (issues.length) throw new Error(issues.join("\n"));
  return batches;
}
