import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  CLOSURE_KANJI_BATCH,
  CLOSURE_PRIOR_WORD_ENDS,
  CLOSURE_WORD_PREFIX,
  closureKanji,
  closureWords,
} from "../src/course-closure-content";
import { buildBroadeningWords } from "../src/course-broadening-builders";
import { supplementWordRows, type SupplementalWordRow } from "../src/course-supplemental-word-rows";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatch,
} from "../src/main-course-word-content";
import { beforeCourseBatch } from "./course-registry-fixture";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const allKanji = buildMainCourseContentBatches();
const allWords = buildMainCourseWordBatches();
const priorKanji = beforeCourseBatch(allKanji, CLOSURE_KANJI_BATCH);
const priorWords = beforeCourseBatch(allWords, `${CLOSURE_WORD_PREFIX}01`);
const kanji = closureKanji(priorKanji);
const words = closureWords([...priorKanji, kanji], priorWords);

describe("reviewed final kanji block", () => {
  it("reaches the kanji goal and keeps earlier content and occupied slots unchanged", () => {
    expect(hash(priorKanji)).toBe(
      "6375ac8708bb889b659a0010067a1962c4a19c602a255962b07136e7312d8ba4",
    );
    expect(hash(priorWords)).toBe(
      "22d483e7563af40a10600c8edbaa2af0468362e3f5c5581dbb14db17eff360e1",
    );
    expect(hash([kanji, ...words])).toBe(
      "8cc3dd0ccb72dd0658d9a395c16a98f9a20d2e7adfb540bffa6415202cbd4623",
    );
    const ends = new Map<number, number>();
    for (const batch of priorWords)
      for (const word of batch.words)
        ends.set(batch.levelNumber, Math.max(ends.get(batch.levelNumber) ?? 0, word.sortOrder));
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(CLOSURE_PRIOR_WORD_ENDS);
    expect(allKanji.find((b) => b.id === CLOSURE_KANJI_BATCH)).toEqual(kanji);
    expect(allWords.filter((b) => b.id.startsWith(CLOSURE_WORD_PREFIX))).toEqual(words);
    expect(allKanji.flatMap((b) => b.kanji)).toHaveLength(2300);
    expect(kanji.kanji).toHaveLength(226);
    expect(kanji.components.map(({ symbol }) => symbol)).toEqual(["𠂊", "⻌", "乙", "臼", "缶"]);
    expect(kanji.kanji.map(({ character }) => character)).toEqual(
      expect.arrayContaining(["角", "逮", "巡", "缶", "挨", "拶", "犠", "牲"]),
    );
    expect(words.flatMap((b) => b.words)).toHaveLength(226);
    expect(kanji.kanji.every((item) => item.requireStrokeData)).toBe(true);
    expect(words.every((b) => b.reviewedAt === "2026-11-21")).toBe(true);
  });

  it("distinguishes a connective from a noun without rejecting the authored batch", () => {
    for (const expression of ["但し", "乃ち", "又は", "且つ"]) {
      const batch = words.find((b) => b.words.some((word) => word.expression === expression))!;
      expect(batch.words.find((word) => word.expression === expression)?.partOfSpeech).toBe(
        "conjunction",
      );
      expect(validateMainCourseWordBatch(batch)).toEqual([]);
    }
  });
});

describe("supplementary vocabulary", () => {
  const authored: SupplementalWordRow = [
    "芯材",
    "しんざい",
    "2849986",
    "noun",
    ["материал сердцевины"],
    ["core material"],
    ["Материал, из которого сделана сердцевина.", "The material forming an inner core."],
    [
      "この芯材は軽い。",
      "このしんざいはかるい。",
      "Этот материал сердцевины лёгкий.",
      "This core material is light.",
    ],
    { readingChunks: "しん・ざい" },
  ];
  const metadata = {
    authoredAt: "2026-11-21",
    reviewedAt: "2026-11-21",
    reviewNotes: "Test fixture only.",
    sourceFile: "fixture",
  };

  it("retains original examples and rejects reading chunks that change the word", () => {
    const [row] = supplementWordRows([authored]);
    expect(row?.[8]).toEqual(authored[7]);
    expect(row?.[7][0]).toContain("しん・ざい");
    const [...wrong] = authored;
    wrong[8] = { readingChunks: "じん・ざい" };
    expect(() => supplementWordRows([wrong])).toThrow("Invalid reading chunks");
  });

  it("passes a saturated level only when requested, respecting all prerequisites", () => {
    const rows = supplementWordRows([authored]);
    const options = { prefix: "fixture-", metadata };
    const [defaultBatch] = buildBroadeningWords(allKanji, [], rows, options);
    const naturalLevel = defaultBatch!.levelNumber;
    const existing = [
      { ...defaultBatch!, words: [{ ...defaultBatch!.words[0]!, expression: "占位" }] },
    ];
    const [shifted] = buildBroadeningWords(allKanji, existing, rows, {
      ...options,
      targetWordsPerLevel: 1,
    });
    const [unshifted] = buildBroadeningWords(allKanji, existing, rows, options);
    expect(shifted!.levelNumber).toBe(naturalLevel + 1);
    expect(unshifted!.levelNumber).toBe(naturalLevel);
    expect(existing[0]?.levelNumber).toBe(naturalLevel);
  });
});
