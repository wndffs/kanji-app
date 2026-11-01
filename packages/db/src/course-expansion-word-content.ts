import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import type { MainCourseContentBatch } from "./main-course-content";
import type { MainCourseWordBatch } from "./main-course-word-content";
import { EXPANSION_KANJI } from "./course-expansion-kanji-rows";
import { EXPANSION_VOCABULARY_A } from "./course-expansion-vocabulary-a";
import { EXPANSION_VOCABULARY_B } from "./course-expansion-vocabulary-b";
import { EXPANSION_WORD_BLOCKS } from "./course-expansion-semantic-blocks";
import {
  EXPANSION_READING_ALIGNMENTS,
  isReviewedExpansionReadingAlignment,
} from "./course-expansion-reading-alignments";

const ROWS = [...EXPANSION_VOCABULARY_A, ...EXPANSION_VOCABULARY_B];
const localize = ([ru, en]: readonly [string, string]) => ({ ru, en });
const han = (text: string) => [
  ...new Set([...text].filter((character) => /\p{Script=Han}/u.test(character))),
];
export const EXPANSION_READING_LINKS = EXPANSION_READING_ALIGNMENTS.map((alignment) => {
  const row = EXPANSION_KANJI.find((row) => row[0] === alignment.character);
  if (
    !row ||
    normalizeJapaneseReading(row[1]) !== alignment.kanjiReading ||
    row[9] !== alignment.expression ||
    row[10] !== alignment.wordReading ||
    !isReviewedExpansionReadingAlignment(alignment)
  )
    throw new Error(`Unreviewed expansion reading alignment for ${alignment.character}`);
  const word = ROWS.find(
    (word) => word[0] === alignment.expression && word[1] === alignment.wordReading,
  );
  if (!word) throw new Error(`Missing expansion primary reinforcement for ${alignment.character}`);
  return {
    ...alignment,
    jmdictEntryId: `jmdict:${word[2]}`,
  };
});
export function validateExpansionReadings(
  kanji: readonly MainCourseContentBatch[],
  words: readonly MainCourseWordBatch[],
): readonly string[] {
  const issues: string[] = [];
  const targets = kanji.flatMap((batch) => batch.kanji);
  const vocabulary = words.flatMap((batch) => batch.words);
  for (const link of EXPANSION_READING_LINKS) {
    if (!isReviewedExpansionReadingAlignment(link))
      issues.push(`Unreviewed expansion reading alignment: ${link.character}`);
    if (
      !targets.some(
        (kanji) =>
          kanji.character === link.character && kanji.reading.primary === link.kanjiReading,
      )
    )
      issues.push(`Taught expansion reading mismatch: ${link.character}`);
    if (
      !vocabulary.some(
        (word) =>
          word.expression === link.expression &&
          word.reading === link.wordReading &&
          word.jmdictEntryId === link.jmdictEntryId &&
          [...word.expression][link.characterIndex] === link.character &&
          word.reading.slice(link.readingOffset, link.readingOffset + link.kanjiReading.length) ===
            link.kanjiReading,
      )
    )
      issues.push(`Missing expansion primary reinforcement: ${link.character}`);
  }
  return issues;
}
export function buildCourseExpansionWordBatches(
  kanji: readonly MainCourseContentBatch[],
  previous: readonly MainCourseWordBatch[],
): readonly MainCourseWordBatch[] {
  if (ROWS.length !== 500) throw new Error(`Expected 500 expansion words, got ${ROWS.length}`);
  const levels = new Map(
    kanji.flatMap((batch) =>
      batch.kanji.map((kanji) => [kanji.character, kanji.levelNumber] as const),
    ),
  );
  const staged = ROWS.map((row, index) => {
    const chars = han(row[0] + row[8][0]);
    const missing = chars.filter((character) => !levels.has(character));
    if (missing.length)
      throw new Error(`Unknown expansion kanji in ${row[0]}: ${missing.join(" ")}`);
    return {
      row,
      index,
      earliest: Math.max(2, ...chars.map((character) => levels.get(character)! + 1)),
    };
  }).sort((a, b) => a.earliest - b.earliest || a.index - b.index);
  const occupied = new Set([
    ...previous.flatMap((batch) =>
      batch.words.map((word) => `${batch.levelNumber}:${word.sortOrder}`),
    ),
    ...kanji.flatMap((batch) => [
      ...batch.kanji.map((kanji) => `${kanji.levelNumber}:${kanji.sortOrder}`),
      ...batch.components.map(
        (_, index) =>
          `${batch.componentLevelNumber}:${(batch.componentSortOrderStart ?? 1) + index}`,
      ),
    ]),
  ]);
  const grouped = new Map<number, typeof staged>();
  for (const item of staged) {
    const group = grouped.get(item.earliest) ?? [];
    group.push(item);
    grouped.set(item.earliest, group);
  }
  const batches: MainCourseWordBatch[] = [];
  for (const [level, items] of grouped) {
    if (level > 60) throw new Error("Expansion word prerequisites exceed sixty levels.");
    for (let offset = 0; offset < items.length; offset += 200) {
      const group = items.slice(offset, offset + 200);
      let start = 1;
      while (group.some((_, index) => occupied.has(`${level}:${start + index}`))) start++;
      group.forEach((_, index) => occupied.add(`${level}:${start + index}`));
      batches.push({
        id: `full-course-vocabulary-expansion-${String(batches.length + 1).padStart(2, "0")}`,
        version: "1",
        authoredAt: "2026-11-01",
        reviewedAt: "2026-11-01",
        reviewNotes:
          "Independently AI-reviewed RU/EN scopes, original examples, grammatical metadata, thirteen same-entry alternatives and semantic near-miss blocks. Exact pinned JMdict evidence stays separate; authored Russian may translate verified English senses where imported Russian is incomplete. No human linguistic certification or publication receipt is claimed.",
        sourceFile: "packages/db/src/course-expansion-word-content.ts",
        courseSlug: "japanese-ru-n2",
        levelNumber: level,
        wordCount: group.length,
        sortOrderStart: start,
        words: group.map(
          (
            {
              row: [expression, reading, sequence, ru, en, scope, image, sound, example, metadata],
            },
            index,
          ) => {
            const meanings = (locale: "ru" | "en", accepted: readonly string[]) => {
              const blocked = [
                ...new Set([
                  ...(locale === "ru" ? (metadata.blockedRu ?? []) : (metadata.blockedEn ?? [])),
                  ...(EXPANSION_WORD_BLOCKS[expression]?.[locale] ?? []),
                ]),
              ];
              return {
                primary: accepted[0]!,
                accepted,
                ...(blocked?.length
                  ? {
                      blocked: blocked.map((text) => ({
                        text,
                        reason: scope[locale === "ru" ? 0 : 1],
                      })),
                    }
                  : {}),
              };
            };
            return {
              expression,
              reading,
              jmdictEntryId: `jmdict:${sequence}`,
              partOfSpeech: metadata.partOfSpeech,
              sortOrder: start + index,
              ...(metadata.acceptedReadings?.length
                ? { acceptedReadings: metadata.acceptedReadings }
                : {}),
              meanings: { ru: meanings("ru", ru), en: meanings("en", en) },
              meaningHint: localize(scope),
              meaningMnemonic: localize(image),
              readingMnemonic: localize(sound),
              readingHint: {
                ru: `Чтение целого слова: ${reading}.${metadata.acceptedReadings?.length ? ` Также принимаются: ${metadata.acceptedReadings.join("、")}.` : ""}${metadata.variantNotes ? ` ${metadata.variantNotes[0]}` : ""}`,
                en: `Whole-word reading: ${reading}.${metadata.acceptedReadings?.length ? ` Also accepted: ${metadata.acceptedReadings.join(", ")}.` : ""}${metadata.variantNotes ? ` ${metadata.variantNotes[1]}` : ""}`,
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
  const issues = validateExpansionReadings(kanji, batches);
  if (issues.length) throw new Error(issues.join("\n"));
  return batches;
}
