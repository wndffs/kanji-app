import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";
import {
  FIRST_SUPPLEMENTAL_WORD_PREFIX,
  firstSupplementalWords,
} from "../src/course-supplemental-content";
import { beforeCourseBatch } from "./course-registry-fixture";

const seal = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const kanji = buildMainCourseContentBatches();
const registered = buildMainCourseWordBatches();
const prior = beforeCourseBatch(registered, `${FIRST_SUPPLEMENTAL_WORD_PREFIX}01`);
const first = firstSupplementalWords(kanji, prior);

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
    for (const batch of first) {
      const total = (wordCounts.get(batch.levelNumber) ?? 0) + batch.words.length;
      expect(total).toBeLessThanOrEqual(160);
      wordCounts.set(batch.levelNumber, total);
      for (const word of batch.words)
        for (const character of wordHanCharacters(word.expression + word.example.japaneseText))
          expect(levels.get(character)).toBeLessThan(batch.levelNumber);
    }
  });
});
