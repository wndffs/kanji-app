import { type EditorialWordDraftBatch } from "./editorial-draft-words-07";
import { type MainCourseWordBatch } from "./main-course-word-content";

export const WAVE07_SOURCE_OBSERVATION = {
  snapshotVersion: "2026-10-29",
  sourceFingerprint: "007e2a5593b48b3bd77742c13f761dd1d6ca332843307346f6d2752003065240",
  scanned: { kanjidic2: 13108, jmdict: 218975, kanjivg: 6702 },
  exactMatches: { kanji: 10, bilingualWordPairs: 20, primaryGraphics: 15 },
  independentReview: false,
  publicationApproved: false,
} as const;

// Exact identities observed in the verified local official snapshot, not gloss data.
export const WAVE07_WORD_IDENTITIES = [
  ["学校", "がっこう", "1206730"],
  ["校長", "こうちょう", "1279590"],
  ["小学校", "しょうがっこう", "1347870"],
  ["中学校", "ちゅうがっこう", "1423650"],
  ["友人", "ゆうじん", "1540150"],
  ["友", "とも", "1539980"],
  ["父", "ちち", "1497610"],
  ["母", "はは", "1514990"],
  ["父母", "ふぼ", "1497690"],
  ["兄", "あに", "1249900"],
  ["姉", "あね", "1307630"],
  ["弟", "おとうと", "1581930"],
  ["妹", "いもうと", "1524590"],
  ["兄弟", "きょうだい", "1249960"],
  ["姉妹", "しまい", "1579490"],
  ["今", "いま", "1288850"],
  ["今日", "きょう", "1579110"],
  ["今年", "ことし", "1579130"],
  ["何", "なに", "1577100"],
  ["何人", "なんにん", "1189100"],
] as const;

export function resolveWave07WordSources(draft: EditorialWordDraftBatch): MainCourseWordBatch {
  if (draft.words.length !== WAVE07_WORD_IDENTITIES.length)
    throw new Error("Wave07 requires the exact observed word-pair set.");
  const seen = new Set<string>();
  return {
    ...draft,
    words: draft.words.map((word) => {
      const key = JSON.stringify([word.expression, word.reading]);
      const identity = WAVE07_WORD_IDENTITIES.find(
        ([expression, reading]) => expression === word.expression && reading === word.reading,
      );
      if (!identity || seen.has(key)) throw new Error("Unobserved or duplicate wave07 pair.");
      seen.add(key);
      return { ...word, jmdictEntryId: `jmdict:${identity[2]}` };
    }),
  };
}
