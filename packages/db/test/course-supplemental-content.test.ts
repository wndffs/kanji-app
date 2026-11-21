import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatch,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";
import {
  FIRST_SUPPLEMENTAL_WORD_PREFIX,
  SECOND_SUPPLEMENTAL_WORD_PREFIX,
  SUPPLEMENTAL_CAPSTONE_WORD_PREFIX,
  THIRD_SUPPLEMENTAL_WORD_PREFIX,
  firstSupplementalWords,
  secondSupplementalWords,
  thirdSupplementalWords,
} from "../src/course-supplemental-content";
import { beforeCourseBatch } from "./course-registry-fixture";

const seal = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const kanji = buildMainCourseContentBatches();
const registered = buildMainCourseWordBatches();
const prior = beforeCourseBatch(registered, `${FIRST_SUPPLEMENTAL_WORD_PREFIX}01`);
const first = firstSupplementalWords(kanji, prior);
const preSecond = beforeCourseBatch(registered, `${SECOND_SUPPLEMENTAL_WORD_PREFIX}01`);
const second = secondSupplementalWords(kanji, preSecond);
const preThird = beforeCourseBatch(registered, `${THIRD_SUPPLEMENTAL_WORD_PREFIX}01`);
const third = thirdSupplementalWords(kanji, preThird);

describe("reviewed supplemental vocabulary", () => {
  it("appends 700 original bilingual words without altering earlier payloads", () => {
    expect(seal(prior)).toBe("c1db89943a6837044746cfc9bab79a6e1fdc006d750c2cd7929f696af3fc23cd");
    expect(seal(first)).toBe("805745e95225a5295689c1f8bfa2b830f98153d0e411397fb80c58e7904b9104");
    expect(first).toHaveLength(35);
    expect(first.flatMap((batch) => batch.words)).toHaveLength(700);
    expect(
      first.flatMap((batch) => batch.words.flatMap((word) => word.acceptedReadings ?? [])),
    ).toHaveLength(4);
    expect(
      registered.filter((batch) => batch.id.startsWith(FIRST_SUPPLEMENTAL_WORD_PREFIX)),
    ).toEqual(first);
    expect(validateMainCourseWordBatches(registered)).toEqual([]);
  });

  it("adds no words to overloaded levels and keeps all examples after their kanji", () => {
    const wordCounts = new Map<number, number>();
    for (const batch of prior)
      wordCounts.set(
        batch.levelNumber,
        (wordCounts.get(batch.levelNumber) ?? 0) + batch.words.length,
      );
    const levels = new Map(
      kanji.flatMap((batch) =>
        batch.kanji.map((item) => [item.character, item.levelNumber] as const),
      ),
    );
    for (const batch of [...first, ...second, ...third]) {
      const total = (wordCounts.get(batch.levelNumber) ?? 0) + batch.words.length;
      expect(total).toBeLessThanOrEqual(160);
      wordCounts.set(batch.levelNumber, total);
      for (const word of batch.words)
        for (const character of wordHanCharacters(word.expression + word.example.japaneseText))
          expect(levels.get(character)).toBeLessThan(batch.levelNumber);
    }
  });

  it("appends 710 more reviewed words without changing the first supplement", () => {
    expect(seal(preSecond)).toBe(
      "43a53b29d339b5cd905e2b515b7584d3f3a1e3fe7b5b4599190fe4a27adbb7dd",
    );
    expect(seal(second)).toBe("8cbbc23571b87614ad0552c896d0f904baf7cf0b3dab26af9904319a2aedfe9f");
    expect(second).toHaveLength(33);
    expect(second.flatMap((batch) => batch.words)).toHaveLength(710);
    expect(
      second.flatMap((batch) => batch.words.flatMap((word) => word.acceptedReadings ?? [])),
    ).toHaveLength(4);
    expect(
      registered.filter((batch) => batch.id.startsWith(SECOND_SUPPLEMENTAL_WORD_PREFIX)),
    ).toEqual(second);
  });

  it("allows native quotation marks in the kana example but rejects Latin text", () => {
    const batch = second.find((b) => b.words.some(({ expression }) => expression === "姉さん"))!;
    const copy = structuredClone(batch);
    const word = copy.words.find(({ expression }) => expression === "姉さん")!;
    expect(word.example.readingText).toContain("「ねえさん、");
    expect(validateMainCourseWordBatch(batch)).toEqual([]);
    Object.assign(word.example, { readingText: `${word.example.readingText} romaji` });
    expect(validateMainCourseWordBatch(copy)).toContain(
      "Incomplete original example for 姉さん:ねえさん.",
    );
  });

  it("reaches 8,000 distinct study forms and completes all sixty planned levels", () => {
    expect(seal(preThird)).toBe("58a19c202858e5e1b239cda1486a00ef53ef4a89614ca045ae26f06871e53ef5");
    expect(seal(third)).toBe("ed33e355c0a88ba325592fbd3ea2b77c0267db9a0c384f3ec3889c29d2f47a95");
    expect(third).toHaveLength(33);
    expect(third.flatMap((batch) => batch.words)).toHaveLength(710);
    expect(registered.slice(preThird.length)).toEqual(third);
    expect(third.at(-1)).toMatchObject({
      id: `${SUPPLEMENTAL_CAPSTONE_WORD_PREFIX}01`,
      levelNumber: 60,
      wordCount: 50,
    });
    const words = registered.flatMap((batch) => batch.words);
    expect(words).toHaveLength(8000);
    expect(new Set(words.map((word) => word.expression)).size).toBe(8000);
    // Earlier lessons deliberately distinguish 早い (early) from 速い (fast).
    expect(new Set(words.map((word) => word.jmdictEntryId)).size).toBe(7999);
    const populatedLevels = new Set([
      ...kanji
        .filter((batch) => batch.components.length)
        .map((batch) => batch.componentLevelNumber),
      ...kanji.flatMap((batch) => batch.kanji.map((item) => item.levelNumber)),
      ...registered.map((batch) => batch.levelNumber),
    ]);
    expect([...populatedLevels].sort((a, b) => a - b)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
  });
});
