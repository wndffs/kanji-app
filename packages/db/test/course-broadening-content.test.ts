import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeJapaneseReading, validateAnswer } from "@kanji-srs/japanese";
import type { ExpansionKanjiRow, ExpansionWordRow } from "../src/course-expansion-content-types";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  mainCourseWordAcceptedReadings,
  mainCourseWordReadingEntryId,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";
import {
  BROADENING_KANJI_ROWS,
  BROADENING_WORD_ROWS,
  buildCourseBroadeningKanji,
  buildCourseBroadeningWords,
} from "../src/course-broadening-content";
import {
  BROADENING_KANJI_BATCH,
  BROADENING_PRIOR_WORD_ENDS,
  BROADENING_WORD_PREFIX,
  assertBroadeningReadingLinks,
} from "../src/course-broadening-builders";
import { BROADENING_READING_LINKS } from "../src/course-broadening-reading-links";
import { DEEPENING_KANJI_BATCH, DEEPENING_WORD_PREFIX } from "../src/course-deepening-builders";
import { beforeCourseBatch } from "./course-registry-fixture";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const throughBroadeningKanji = beforeCourseBatch(
  buildMainCourseContentBatches(),
  DEEPENING_KANJI_BATCH,
);
const throughBroadeningWords = beforeCourseBatch(
  buildMainCourseWordBatches(),
  `${DEEPENING_WORD_PREFIX}01`,
);
const priorKanji = throughBroadeningKanji.filter((batch) => batch.id !== BROADENING_KANJI_BATCH);
const priorWords = throughBroadeningWords.filter(
  (batch) => !batch.id.startsWith(BROADENING_WORD_PREFIX),
);
const kanji = buildCourseBroadeningKanji(priorKanji);
const allKanji = [...priorKanji, kanji];
const words = buildCourseBroadeningWords(allKanji, priorWords);

describe("source-backed broadening block", () => {
  it("seals the reviewed payloads that will be applied by the explicit selector", () => {
    expect(throughBroadeningKanji.at(-1)).toEqual(kanji);
    expect(throughBroadeningWords.slice(priorWords.length)).toEqual(words);
    expect([kanji, ...words].every((batch) => batch.reviewedAt === "2026-11-21")).toBe(true);
    expect(hash([kanji, ...words])).toBe(
      "4eaca5e83feb402b340156f4dfd5001b5b2d0c3e06305e95381d0ddfdf16803a",
    );
    expect(hash(BROADENING_READING_LINKS)).toBe(
      "fee48e847347bd74f86c6f2a8c801185471fa8fd0911c8e58a4a0b789bf57bdb",
    );
  });

  it("leaves every previous payload and word slot untouched", () => {
    expect(hash(priorKanji)).toBe(
      "b52d11f0ead267a06db66f4a4ed6576e140d74da72ad08ee07464cc538076a8b",
    );
    expect(hash(priorWords)).toBe(
      "8c443aea559f8d4ab6e9c4b534ce750c1862d72b0f9c93ae634e0c9623fda873",
    );
    const ends = new Map<number, number>();
    for (const batch of priorWords)
      for (const word of batch.words) {
        ends.set(batch.levelNumber, Math.max(ends.get(batch.levelNumber) ?? 0, word.sortOrder));
      }
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(BROADENING_PRIOR_WORD_ENDS);
    const slots = [
      ...allKanji.flatMap((batch) => [
        ...batch.kanji.map((item) => `${batch.courseSlug}:${item.levelNumber}:${item.sortOrder}`),
        ...batch.components.map(
          (_, i) =>
            `${batch.courseSlug}:${batch.componentLevelNumber}:${(batch.componentSortOrderStart ?? 1) + i}`,
        ),
      ]),
      ...[...priorWords, ...words].flatMap((batch) =>
        batch.words.map((word) => `${batch.courseSlug}:${batch.levelNumber}:${word.sortOrder}`),
      ),
    ];
    expect(new Set(slots).size).toBe(slots.length);
  });

  it("adds 200 supported kanji and 500 distinct useful written forms with earlier prerequisites", () => {
    const vocab = words.flatMap((batch) => batch.words);
    expect(kanji.kanji).toHaveLength(200);
    expect(vocab).toHaveLength(500);
    expect(validateMainCourseContentBatches(allKanji)).toEqual([]);
    expect(validateMainCourseWordBatches([...priorWords, ...words])).toEqual([]);
    const known = new Map(
      allKanji.flatMap((batch) =>
        batch.kanji.map((item) => [item.character, item.levelNumber] as const),
      ),
    );
    const previous = new Set(
      priorWords.flatMap((batch) => batch.words.map((word) => word.expression)),
    );
    const countAtLevel = (level: number, batches: typeof allKanji) =>
      batches.flatMap((batch) => batch.kanji).filter((item) => item.levelNumber === level).length;
    for (const item of kanji.kanji) {
      expect(item.requireStrokeData).toBe(true);
      expect(item.levelNumber).toBeLessThan(60);
      expect(item.reading.accepted).toEqual([normalizeJapaneseReading(item.reading.source)]);
      expect(countAtLevel(item.levelNumber, allKanji)).toBeLessThanOrEqual(40);
    }
    expect(new Set(vocab.map((word) => word.expression)).size).toBe(500);
    const previousEntries = new Set(
      priorWords.flatMap((batch) => batch.words.map((word) => word.jmdictEntryId)),
    );
    expect(new Set(vocab.map((word) => word.jmdictEntryId)).size).toBe(500);
    expect(vocab.every((word) => !previousEntries.has(word.jmdictEntryId))).toBe(true);
    expect(vocab.find((word) => word.expression === "単なる")?.partOfSpeech).toBe(
      "prenominal-adjective",
    );
    expect(words.length).toBeLessThanOrEqual(40);
    for (const batch of words)
      for (const word of batch.words) {
        expect(previous.has(word.expression), word.expression).toBe(false);
        expect(word.expression).not.toMatch(/[0-9０-９]/u);
        const chars = wordHanCharacters(word.expression + word.example.japaneseText);
        expect(batch.levelNumber, word.expression).toBe(
          Math.max(2, ...chars.map((char) => known.get(char)! + 1)),
        );
      }
  });

  it("rejects reassignment of an anchored reading or its exact dictionary pair", () => {
    expect(BROADENING_READING_LINKS).toHaveLength(200);
    // There are two き in 機器; the first belongs to 機, not 器.
    expect(BROADENING_READING_LINKS.find(([character]) => character === "器")).toEqual([
      "器",
      "き",
      "機器",
      "きき",
      1,
      1,
      "1220900",
    ]);
    const [row, ...rest] = BROADENING_KANJI_ROWS;
    const differentReading: [...ExpansionKanjiRow] = [...row!];
    differentReading[1] = "シン";
    expect(() =>
      assertBroadeningReadingLinks([differentReading, ...rest], BROADENING_WORD_ROWS),
    ).toThrow("Invalid broadening reading reinforcement for 推");
    const [word, ...otherWords] = BROADENING_WORD_ROWS;
    const conflictingSource: [...ExpansionWordRow] = [...word!];
    conflictingSource[2] = "1";
    expect(() =>
      assertBroadeningReadingLinks(BROADENING_KANJI_ROWS, [conflictingSource, ...otherWords]),
    ).toThrow("Invalid broadening reading reinforcement for 推");
  });

  it("keeps reviewed semantic blocks distinct from accepted synonyms", () => {
    let blockCount = 0;
    for (const word of words.flatMap((batch) => batch.words))
      for (const key of ["ru", "en"] as const) {
        const meanings = word.meanings[key];
        const blockedAnswers = meanings.blocked?.map(({ text }) => text) ?? [];
        blockCount += blockedAnswers.length;
        const check = (answer: string) =>
          validateAnswer({
            answerKind: "meaning",
            answer,
            acceptedAnswers: meanings.accepted,
            blockedAnswers,
          });
        for (const wrong of blockedAnswers)
          expect(check(wrong), `${word.expression}: ${wrong}`).toMatchObject({
            accepted: false,
            result: "blocked",
          });
        for (const right of meanings.accepted)
          expect(check(right).accepted, `${word.expression}: ${right}`).toBe(true);
      }
    expect(blockCount).toBeGreaterThan(0);
  });

  it.each([
    ["伸", "втягиваться", "вытягиваться"],
    ["廃", "превращать", "прекращать"],
    ["弁", "разлучать", "различать"],
    ["効", "эффектность", "эффективность"],
    ["聴", "высушивать", "выслушивать"],
    ["措", "устраиваться", "устраивать"],
  ])("keeps different Russian meanings distinct for %s", (char, wrong, correct) => {
    const meanings = kanji.kanji.find((item) => item.character === char)!.meanings.ru;
    const check = (answer: string) =>
      validateAnswer({
        answerKind: "meaning",
        answer,
        acceptedAnswers: meanings.accepted,
        blockedAnswers: meanings.blocked?.map(({ text }) => text),
      });
    expect(check(wrong)).toMatchObject({ accepted: false, result: "blocked" });
    expect(check(correct)).toMatchObject({ accepted: true, result: "correct" });
  });

  it.each([
    ["谷間", "たにあい", "たにかん"],
    ["残存", "ざんそん", "ざんそ"],
    ["研究所", "けんきゅうしょ", "けんきゅう"],
    ["その他", "そのた", "そのだ"],
  ])(
    "accepts the sourced alternate reading of %s without fuzzy matching",
    (expression, variant, wrong) => {
      const word = words
        .flatMap((batch) => batch.words)
        .find((word) => word.expression === expression)!;
      const acceptedAnswers = mainCourseWordAcceptedReadings(word);
      expect(mainCourseWordReadingEntryId(word, variant)).toBe(word.jmdictEntryId);
      expect(
        validateAnswer({ answerKind: "reading", answer: variant, acceptedAnswers }).accepted,
      ).toBe(true);
      expect(
        validateAnswer({ answerKind: "reading", answer: wrong, acceptedAnswers }).accepted,
      ).toBe(false);
    },
  );
});
