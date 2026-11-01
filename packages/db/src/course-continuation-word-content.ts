import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { CONTINUATION_KANJI } from "./course-continuation-kanji-content";
import { CONTINUATION_VOCABULARY_A } from "./course-continuation-vocabulary-a";
import { CONTINUATION_VOCABULARY_B } from "./course-continuation-vocabulary-b";

const ROWS = [...CONTINUATION_VOCABULARY_A, ...CONTINUATION_VOCABULARY_B];
const ALTERNATIVES: Readonly<Record<string, readonly string[]>> = {
  奥義: ["おくぎ"],
  外壁: ["そとかべ"],
  私立: ["わたくしりつ"],
  早口: ["はやぐち"],
  村長: ["むらおさ"],
  誰: ["だあれ"],
  難しい: ["むつかしい"],
  毎朝: ["まいちょう"],
  行き: ["ゆき"],
  来客: ["らいかく"],
  涼風: ["すずかぜ"],
  暖かい: ["あったかい"],
  言う: ["ゆう"],
  寒い: ["さぶい"],
  軽い: ["かろい"],
  冷たい: ["つべたい"],
  買い物: ["かいもん"],
  怒る: ["いかる"],
};
const BLOCKS: Readonly<Record<string, { ru?: readonly string[]; en?: readonly string[] }>> = {
  返す: { ru: ["возвращаться"] },
  渡る: { ru: ["пересекаться"] },
  教える: { ru: ["преподаватель"], en: ["to construct"] },
  講師: { ru: ["преподавать"] },
  続く: { ru: ["продолжать"] },
  続ける: { ru: ["продолжаться"] },
  決める: { ru: ["определяться", "устанавливаться"] },
  決まる: { ru: ["определять"], en: ["to be seated"] },
  動かす: { ru: ["передвигаться", "перемещаться"] },
  消す: { ru: ["включать"] },
  点く: { ru: ["выключаться"] },
  終わる: { ru: ["заканчивать"] },
  切れる: { ru: ["пересекаться"] },
  冷水: { en: ["cold weather"] },
  寒い: { en: ["cold water"] },
  厚い: { en: ["thin in depth"] },
  薄い: { en: ["thick in depth"] },
  建てる: { en: ["to instruct"] },
  座る: { en: ["to be settled"] },
  着る: { en: ["to put in"] },
  入れる: { en: ["to put on"] },
};
const VARIANT_NOTES: Readonly<Record<string, readonly [string, string]>> = {
  寒い: [
    "Основное нейтральное чтение さむい; さぶい — дополнительный, неосновной вариант.",
    "Prefer neutral さむい; さぶい is an additional nonprimary variant.",
  ],
  軽い: [
    "Основное нейтральное чтение かるい; かろい — дополнительный, неосновной вариант.",
    "Prefer neutral かるい; かろい is an additional nonprimary variant.",
  ],
  冷たい: [
    "Основное нейтральное чтение つめたい; つべたい — дополнительный, неосновной вариант.",
    "Prefer neutral つめたい; つべたい is an additional nonprimary variant.",
  ],
  買い物: [
    "Основное нейтральное чтение かいもの; かいもん — дополнительный, неосновной вариант.",
    "Prefer neutral かいもの; かいもん is an additional nonprimary variant.",
  ],
  怒る: [
    "いかる — книжный или формальный вариант со значением «гневаться»; основное чтение おこる.",
    "いかる is a formal or literary variant meaning to get angry; おこる remains primary.",
  ],
  良い: [
    "Обычный разговорный вариант いい также принимается; основное чтение よい.",
    "The ordinary conversational form いい is also accepted; よい remains primary.",
  ],
};
const REALIZED: Readonly<Record<string, string>> = { 決: "けっ", 骨: "こっ" };
const VERBS = new Set([
  "買う",
  "売る",
  "教える",
  "習う",
  "練る",
  "泳ぐ",
  "遊ぶ",
  "寝る",
  "起きる",
  "座る",
  "歩く",
  "走る",
  "待つ",
  "思う",
  "考える",
  "言う",
  "持つ",
  "取る",
  "返す",
  "借りる",
  "貸す",
  "探す",
  "渡る",
  "泊まる",
  "登る",
  "押す",
  "引く",
  "曲がる",
  "落ちる",
  "拾う",
  "捨てる",
  "覚える",
  "忘れる",
  "死ぬ",
  "続く",
  "続ける",
  "結ぶ",
  "治る",
  "泣く",
  "笑う",
  "怒る",
  "喜ぶ",
  "困る",
  "選ぶ",
  "決める",
  "決まる",
  "残る",
  "残す",
  "追う",
  "加える",
  "折る",
  "折れる",
  "建てる",
  "働く",
  "動く",
  "動かす",
  "開く",
  "開ける",
  "閉まる",
  "閉める",
  "消える",
  "消す",
  "点く",
  "着る",
  "乗る",
  "送る",
  "始まる",
  "始める",
  "終わる",
  "切る",
  "切れる",
  "入れる",
  "出す",
  "話し合う",
  "疲れる",
  "足りる",
]);
const I_ADJECTIVES = new Set([
  "高い",
  "低い",
  "暗い",
  "弱い",
  "太い",
  "細い",
  "広い",
  "狭い",
  "遅い",
  "速い",
  "軽い",
  "重い",
  "短い",
  "近い",
  "遠い",
  "深い",
  "浅い",
  "厚い",
  "薄い",
  "暑い",
  "熱い",
  "冷たい",
  "暖かい",
  "涼しい",
  "難しい",
  "易しい",
  "忙しい",
  "若い",
  "眠い",
  "無い",
  "悪い",
  "良い",
  "美しい",
  "悲しい",
  "強い",
  "楽しい",
  "寒い",
  "新しい",
  "古い",
  "安い",
  "少ない",
  "明るい",
]);
const NA_ADJECTIVES = new Set([
  "狭小",
  "高速",
  "軽度",
  "薄弱",
  "安易",
  "多忙",
  "不安",
  "主要",
  "皆無",
  "困難",
  "必要",
  "微弱",
  "静か",
  "大切",
  "大事",
  "有利",
  "不利",
  "不便",
  "不明",
  "無理",
  "不要",
  "上手",
  "下手",
]);
function partOfSpeech(expression: string) {
  if (VERBS.has(expression)) return "verb" as const;
  if (I_ADJECTIVES.has(expression)) return "i-adjective" as const;
  if (NA_ADJECTIVES.has(expression)) return "na-adjective" as const;
  if (["誰", "僕"].includes(expression)) return "pronoun" as const;
  if (["毎朝", "毎晩", "今夜"].includes(expression)) return "adverb" as const;
  return "noun" as const;
}
const localize = ([ru, en]: readonly [string, string]) => ({ ru, en });
const han = (s: string) => [...new Set([...s].filter((c) => /\p{Script=Han}/u.test(c)))];

export const CONTINUATION_READING_LINKS = CONTINUATION_KANJI.map((r) => {
  const pair = ROWS.find((w) => w[0] === r[9] && w[1] === r[10]);
  if (!pair) throw new Error(`Missing authored reinforcement for ${r[0]}`);
  return {
    character: r[0],
    kanjiReading: normalizeJapaneseReading(r[1]),
    realizedReading: REALIZED[r[0]] ?? normalizeJapaneseReading(r[1]),
    expression: r[9],
    wordReading: r[10],
    jmdictEntryId: `jmdict:${pair[2]}`,
  };
});

export function validateContinuationReadings(
  kanji: readonly MainCourseContentBatch[],
  words: readonly MainCourseWordBatch[],
): readonly string[] {
  const issues: string[] = [];
  const all = words.flatMap((b) => b.words);
  const targets = kanji.flatMap((b) => b.kanji);
  for (const link of CONTINUATION_READING_LINKS) {
    if (
      !targets.some(
        (k) => k.character === link.character && k.reading.primary === link.kanjiReading,
      )
    )
      issues.push(`Taught reading mismatch: ${link.character}`);
    if (
      !all.some(
        (w) =>
          w.expression === link.expression &&
          w.reading === link.wordReading &&
          w.jmdictEntryId === link.jmdictEntryId &&
          w.expression.includes(link.character) &&
          w.reading.includes(link.realizedReading),
      )
    )
      issues.push(`Missing primary reinforcement: ${link.character}`);
  }
  return issues;
}

export function buildCourseContinuationWordBatches(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  if (ROWS.length !== 300) throw new Error(`Expected 300 continuation words, got ${ROWS.length}`);
  const levels = new Map(
    kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
  );
  const staged = ROWS.map((row, index) => {
    const chars = han(row[0] + row[8][0]);
    const missing = chars.filter((c) => !levels.has(c));
    if (missing.length) throw new Error(`Unknown kanji in ${row[0]}: ${missing.join(" ")}`);
    return { row, index, earliest: Math.max(2, ...chars.map((c) => levels.get(c)! + 1)) };
  }).sort((a, b) => a.earliest - b.earliest || a.index - b.index);
  const occupied = new Set<string>([
    ...previous.flatMap((b) => b.words.map((w) => `${b.levelNumber}:${w.sortOrder}`)),
    ...kanji.flatMap((b) => [
      ...b.kanji.map((k) => `${k.levelNumber}:${k.sortOrder}`),
      ...b.components.map(
        (_, i) => `${b.componentLevelNumber}:${(b.componentSortOrderStart ?? 1) + i}`,
      ),
    ]),
  ]);
  const batches: MainCourseWordBatch[] = [];
  const grouped = new Map<number, typeof staged>();
  for (const row of staged) {
    const group = grouped.get(row.earliest) ?? [];
    group.push(row);
    grouped.set(row.earliest, group);
  }
  const groups = [...grouped].flatMap(([level, rows]) =>
    Array.from({ length: Math.ceil(rows.length / 200) }, (_, i) => ({
      level,
      rows: rows.slice(i * 200, (i + 1) * 200),
    })),
  );
  for (const { level, rows } of groups) {
    if (level > 60) throw new Error("Word prerequisites exceed the 60-level course");
    let start = 1;
    while (rows.some((_, i) => occupied.has(`${level}:${start + i}`))) start++;
    rows.forEach((_, i) => occupied.add(`${level}:${start + i}`));
    batches.push({
      id: `full-course-vocabulary-continuation-${String(batches.length + 1).padStart(2, "0")}`,
      version: "1",
      authoredAt: "2026-11-01",
      reviewedAt: "2026-11-01",
      reviewNotes:
        "Independently AI-reviewed RU/EN scopes, original examples, readings and pinned JMdict evidence; seventeen same-entry variants, one explicit separate-entry variant and one strictly proven sense-note reading. No human linguistic certification or publication receipt is claimed.",
      sourceFile: "packages/db/src/course-continuation-word-content.ts",
      courseSlug: "japanese-ru-n2",
      levelNumber: level,
      sortOrderStart: start,
      wordCount: rows.length,
      words: rows.map(
        ({ row: [expression, reading, sequence, ru, en, scope, image, sound, ex] }, i) => {
          const meanings = (locale: "ru" | "en", accepted: readonly string[]) => ({
            primary: accepted[0]!,
            accepted,
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
            partOfSpeech: partOfSpeech(expression),
            jmdictEntryId: `jmdict:${sequence}`,
            sortOrder: start + i,
            ...(ALTERNATIVES[expression] ? { acceptedReadings: ALTERNATIVES[expression] } : {}),
            ...(expression === "怒る"
              ? { acceptedReadingEntryIds: { いかる: "jmdict:2859682" } }
              : {}),
            ...(expression === "良い"
              ? {
                  sourceNoteReadings: [
                    {
                      reading: "いい",
                      sourceRecordId: "jmdict:1605820",
                      sourceVersion: "2026-10-31",
                      sourceDocumentSha256:
                        "8bcf995518688032b5ca2d370109dd138377bb9830ef7ac9a1c1f3ed874efd9c",
                      note: "also いい (all senses)",
                    },
                  ],
                }
              : {}),
            meanings: { ru: meanings("ru", ru), en: meanings("en", en) },
            meaningHint: localize(scope),
            meaningMnemonic: localize(image),
            readingMnemonic: localize(sound),
            readingHint: {
              ru: `Чтение целого слова: ${reading}.${ALTERNATIVES[expression] ? ` Также принимаются: ${ALTERNATIVES[expression]!.join("、")}.` : ""}${VARIANT_NOTES[expression] ? ` ${VARIANT_NOTES[expression]![0]}` : ""}`,
              en: `Whole-word reading: ${reading}.${ALTERNATIVES[expression] ? ` Also accepted: ${ALTERNATIVES[expression]!.join(", ")}.` : ""}${VARIANT_NOTES[expression] ? ` ${VARIANT_NOTES[expression]![1]}` : ""}`,
            },
            example: {
              japaneseText: ex[0],
              readingText: ex[1],
              translationRu: ex[2],
              translationEn: ex[3],
            },
          };
        },
      ),
    });
  }
  const issues = validateContinuationReadings(kanji, batches);
  if (issues.length) throw new Error(issues.join("\n"));
  return batches;
}
