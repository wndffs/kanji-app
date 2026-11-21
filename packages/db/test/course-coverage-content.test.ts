import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  COVERAGE_KANJI_BATCH,
  COVERAGE_PRIOR_WORD_ENDS,
  COVERAGE_REINFORCEMENT,
  COVERAGE_WORD_PREFIX,
  coverageKanji,
  coverageWords,
} from "../src/course-coverage-content";
import { unpackDeepeningReinforcement } from "../src/course-deepening-builders";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";
import { beforeCourseBatch } from "./course-registry-fixture";

const sha = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const registeredKanji = buildMainCourseContentBatches();
const registeredWords = buildMainCourseWordBatches();
const beforeKanji = beforeCourseBatch(registeredKanji, COVERAGE_KANJI_BATCH);
const beforeWords = beforeCourseBatch(registeredWords, `${COVERAGE_WORD_PREFIX}01`);
const addedKanji = coverageKanji(beforeKanji);
const kanji = [...beforeKanji, addedKanji];
const addedWords = coverageWords(kanji, beforeWords);

describe("reviewed course coverage block", () => {
  it("seals the exact 200 kanji and 784 words without modifying prior manifests", () => {
    expect(sha(beforeKanji)).toBe(
      "71d58215b0d605d9761c8e356debb0382d8184d35e311c918321ac0e77a5f88d",
    );
    expect(sha(beforeWords)).toBe(
      "b06e6d056c19070ac9e2721f7d08fb48a184a4ab4450bdc4864d884bbc2378e1",
    );
    expect(sha([addedKanji, ...addedWords])).toBe(
      "1c005f272a819af9a4b09306b69943b29f83376824a075b254c6c78edb2ac0e0",
    );
    expect(registeredKanji.find((b) => b.id === COVERAGE_KANJI_BATCH)).toEqual(addedKanji);
    expect(registeredWords.filter((b) => b.id.startsWith(COVERAGE_WORD_PREFIX))).toEqual(
      addedWords,
    );
    expect([addedKanji, ...addedWords].every((b) => b.reviewedAt === "2026-11-21")).toBe(true);
    expect(addedKanji.kanji).toHaveLength(200);
    expect(addedKanji.kanji.every((item) => item.requireStrokeData)).toBe(true);
    expect(addedWords).toHaveLength(28);
    expect(addedWords.flatMap((b) => b.words)).toHaveLength(784);
  });

  it("uses exact earlier prerequisites and allocates unique slots after the frozen baseline", () => {
    const ends = new Map<number, number>();
    for (const b of beforeWords)
      for (const word of b.words)
        ends.set(b.levelNumber, Math.max(ends.get(b.levelNumber) ?? 0, word.sortOrder));
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(COVERAGE_PRIOR_WORD_ENDS);
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    expect(validateMainCourseWordBatches([...beforeWords, ...addedWords])).toEqual([]);
    const levels = new Map(kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber])));
    const slots = [
      ...kanji.flatMap((b) => [
        ...b.kanji.map((k) => `${k.levelNumber}:${k.sortOrder}`),
        ...b.components.map(
          (_, i) => `${b.componentLevelNumber}:${(b.componentSortOrderStart ?? 1) + i}`,
        ),
      ]),
      ...[...beforeWords, ...addedWords].flatMap((b) =>
        b.words.map((w) => `${b.levelNumber}:${w.sortOrder}`),
      ),
    ];
    expect(new Set(slots).size).toBe(slots.length);
    for (const batch of addedWords)
      for (const word of batch.words)
        expect(
          1 +
            Math.max(
              ...wordHanCharacters(word.expression + word.example.japaneseText).map(
                (c) => levels.get(c)!,
              ),
            ),
          word.expression,
        ).toBe(batch.levelNumber);
  });

  it("keeps standard repeated spellings and exact compound or alternate readings", () => {
    const vocabulary = addedWords.flatMap((b) => b.words);
    expect(vocabulary.find((w) => w.expression === "様々")).toMatchObject({
      reading: "さまざま",
      jmdictEntryId: "jmdict:1593830",
    });
    expect(vocabulary.find((w) => w.expression === "早急")).toMatchObject({
      reading: "さっきゅう",
      acceptedReadings: ["そうきゅう"],
    });
    const { bindings } = unpackDeepeningReinforcement(COVERAGE_REINFORCEMENT);
    expect(bindings).toHaveLength(200);
    expect(bindings.find(([char]) => char === "疾")).toEqual([
      "疾",
      "しつ",
      "疾患",
      "しっかん",
      0,
      0,
      "1320580",
      "tsu-sokuon",
    ]);
    expect(addedKanji.kanji.find((k) => k.character === "疾")?.reading.accepted).toEqual(["しつ"]);
  });
});
