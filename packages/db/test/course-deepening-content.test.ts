import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import {
  DEEPENING_KANJI_BATCH,
  DEEPENING_PRIOR_WORD_ENDS,
  DEEPENING_WORD_PREFIX,
  buildCourseDeepeningWords,
  unpackDeepeningReinforcement,
} from "../src/course-deepening-builders";
import {
  DEEPENING_REINFORCEMENT,
  deepeningKanji,
  deepeningWords,
} from "../src/course-deepening-content";
import type {
  ExpansionReinforcementRow,
  ExpansionWordRow,
} from "../src/course-expansion-content-types";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";

const sha = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const oldKanji = buildMainCourseContentBatches().filter(
  (batch) => batch.id !== DEEPENING_KANJI_BATCH,
);
const oldWords = buildMainCourseWordBatches().filter(
  (batch) => !batch.id.startsWith(DEEPENING_WORD_PREFIX),
);
const kanji = deepeningKanji(oldKanji);
const allKanji = [...oldKanji, kanji];
const words = deepeningWords(allKanji, oldWords);

describe("deepening course block", () => {
  it("registers only the reviewed, source-checked payloads with explicit selector IDs", () => {
    expect(
      buildMainCourseContentBatches().find((batch) => batch.id === DEEPENING_KANJI_BATCH),
    ).toEqual(kanji);
    expect(
      buildMainCourseWordBatches().filter((batch) => batch.id.startsWith(DEEPENING_WORD_PREFIX)),
    ).toEqual(words);
    expect([kanji, ...words].every((batch) => batch.reviewedAt === "2026-11-21")).toBe(true);
    expect(words.flatMap((batch) => batch.words)).toHaveLength(640);
    expect(sha([kanji, ...words])).toBe(
      "18ebed77062678bb7496e52589133911312193b666401674cbcfba74bd93affd",
    );
    expect(sha(unpackDeepeningReinforcement(DEEPENING_REINFORCEMENT).bindings)).toBe(
      "74367396ed8fc5c8888ae7bec937fa5c7ecadd2f55ab92a9c5148adf2bca78ec",
    );
  });

  it("keeps the first 914 kanji and 1,800 words byte-for-byte unchanged", () => {
    expect(sha(oldKanji)).toBe("e3b9df1d11e3a991c71edcd88dbb9a5248b97077e88eb2df77967f49a64c90af");
    expect(sha(oldWords)).toBe("0f22632683f48810dd450176c2074c1aa5df98837778ba199cb9b654dbe50d7a");
    const ends = new Map<number, number>();
    for (const batch of oldWords)
      for (const entry of batch.words)
        ends.set(batch.levelNumber, Math.max(ends.get(batch.levelNumber) ?? 0, entry.sortOrder));
    expect([...ends].sort(([a], [b]) => a - b)).toEqual(DEEPENING_PRIOR_WORD_ENDS);
  });

  it("fits new content into collision-free earlier-prerequisite placements", () => {
    const allWords = [...oldWords, ...words];
    expect(validateMainCourseContentBatches(allKanji)).toEqual([]);
    expect(validateMainCourseWordBatches(allWords)).toEqual([]);
    const slots = [
      ...allKanji.flatMap((batch) => [
        ...batch.kanji.map((item) => `${item.levelNumber}:${item.sortOrder}`),
        ...batch.components.map(
          (_, i) => `${batch.componentLevelNumber}:${(batch.componentSortOrderStart ?? 1) + i}`,
        ),
      ]),
      ...allWords.flatMap((batch) =>
        batch.words.map((word) => `${batch.levelNumber}:${word.sortOrder}`),
      ),
    ];
    expect(new Set(slots).size).toBe(slots.length);
    const levels = new Map(
      allKanji.flatMap((batch) =>
        batch.kanji.map((item) => [item.character, item.levelNumber] as const),
      ),
    );
    expect(kanji.kanji).toHaveLength(200);
    const vocabulary = words.flatMap((batch) => batch.words);
    expect(new Set(vocabulary.map((word) => word.expression)).size).toBe(vocabulary.length);
    expect(new Set(vocabulary.map((word) => word.jmdictEntryId)).size).toBe(vocabulary.length);
    expect(words.length).toBeLessThanOrEqual(40);
    for (const item of kanji.kanji) {
      expect(item.requireStrokeData).toBe(true);
      expect(
        [...levels.values()].filter((level) => level === item.levelNumber).length,
      ).toBeLessThanOrEqual(40);
    }
    for (const batch of words)
      for (const word of batch.words) {
        const prerequisites = wordHanCharacters(word.expression + word.example.japaneseText);
        expect(batch.levelNumber, word.expression).toBe(
          Math.max(2, ...prerequisites.map((char) => levels.get(char)! + 1)),
        );
      }
  });

  it("requires a source-specific reading boundary rather than an arbitrary matching kana substring", () => {
    const { bindings } = unpackDeepeningReinforcement(DEEPENING_REINFORCEMENT);
    expect(bindings).toHaveLength(200);
    expect(bindings.find(([char]) => char === "孝")).toEqual([
      "孝",
      "こう",
      "親孝行",
      "おやこうこう",
      1,
      2,
      "1365160",
    ]);
    const [first] = DEEPENING_REINFORCEMENT;
    const mismatched: ExpansionReinforcementRow = [first![0], [0, 1], first![2]];
    expect(() => unpackDeepeningReinforcement([mismatched])).toThrow("Unaligned reinforcement");
    const seed = unpackDeepeningReinforcement([first!]).words[0]!;
    expect(() => buildCourseDeepeningWords(allKanji, oldWords, [first!], [seed])).toThrow(
      "Reused course source entry",
    );
    const broken: [...ExpansionWordRow] = [...seed];
    broken[8] = [seed[8][0], "これはほしょく。", seed[8][2], seed[8][3]];
    expect(() => buildCourseDeepeningWords(allKanji, oldWords, [], [broken])).toThrow(
      "Unaligned example kana",
    );
  });

  it("distinguishes the taught kun stem from the actual written okurigana", () => {
    const row: ExpansionReinforcementRow = [
      [
        "戻",
        "もど.る",
        ["戸", "大"],
        ["возвращаться"],
        ["return"],
        ["Дверь на обратном пути.", "The door on the way back."],
      ],
      [0, 0],
      [
        "戻る",
        "もどる",
        "1535880",
        ["возвращаться"],
        ["return"],
        ["Вернуться назад.", "Go back."],
        ["Та же дверь.", "The same door."],
        ["家に戻る。", "いえにもどる。", "Я вернусь домой.", "I'll return home."],
      ],
    ];
    const { bindings, kanji, words: reinforcement } = unpackDeepeningReinforcement([row]);
    expect(bindings[0]).toEqual(["戻", "もど", "戻る", "もどる", 0, 0, "1535880"]);
    expect(kanji[0]![8]).toContain("The okurigana る is written after the kanji.");
    expect(reinforcement[0]![1]).toBe("もどる");
    const [, , [, , ...fields]] = row;
    expect(() =>
      unpackDeepeningReinforcement([[row[0], row[1], ["戻す", "もどす", ...fields]]]),
    ).toThrow("Unaligned reinforcement");
  });

  it("honors scoped extra blocks without invalidating the reviewed answers", () => {
    for (const item of [...kanji.kanji, ...words.flatMap((batch) => batch.words)]) {
      for (const locale of ["ru", "en"] as const) {
        const { accepted, blocked } = item.meanings[locale];
        const blockedAnswers = blocked?.map(({ text }) => text) ?? [];
        const check = (answer: string) =>
          validateAnswer({
            answerKind: "meaning",
            answer,
            acceptedAnswers: accepted,
            blockedAnswers,
          });
        for (const answer of accepted) expect(check(answer).result, answer).toBe("correct");
        for (const answer of blockedAnswers) expect(check(answer).result, answer).toBe("blocked");
      }
    }
  });

  it.each([
    ["補償", "ru", "компенсация", "гарантия"],
    ["補償", "en", "compensation", "guarantee"],
    ["感染", "en", "infection", "injection"],
    ["注射", "en", "injection", "infection"],
  ] as const)(
    "rejects a distinct near-answer for %s (%s)",
    (expression, locale, correct, wrong) => {
      const entry = words
        .flatMap((batch) => batch.words)
        .find((word) => word.expression === expression)!;
      const meanings = entry.meanings[locale];
      const check = (answer: string) =>
        validateAnswer({
          answerKind: "meaning",
          answer,
          acceptedAnswers: meanings.accepted,
          blockedAnswers: meanings.blocked?.map(({ text }) => text) ?? [],
        });
      expect(check(correct)).toMatchObject({ accepted: true });
      expect(check(wrong)).toMatchObject({ accepted: false, result: "blocked" });
    },
  );
});
