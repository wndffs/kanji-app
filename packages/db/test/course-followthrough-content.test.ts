import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import {
  FOLLOWTHROUGH_KANJI_BATCH,
  FOLLOWTHROUGH_PRIOR_WORD_ENDS,
  FOLLOWTHROUGH_REINFORCEMENT,
  FOLLOWTHROUGH_WORD_PREFIX,
  followthroughKanji,
  followthroughWords,
} from "../src/course-followthrough-content";
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

const sha = (data: unknown) => createHash("sha256").update(JSON.stringify(data)).digest("hex");
const registeredKanji = buildMainCourseContentBatches();
const registeredWords = buildMainCourseWordBatches();
const priorKanji = registeredKanji.slice(
  0,
  registeredKanji.findIndex(({ id }) => id === "full-course-kanji-deepening") + 1,
);
const priorWords = registeredWords.slice(
  0,
  registeredWords.findIndex(({ id }) => id === "full-course-vocabulary-deepening-29") + 1,
);
const addedKanji = followthroughKanji(priorKanji);
const kanji = [...priorKanji, addedKanji];
const addedWords = followthroughWords(kanji, priorWords);
const words = [...priorWords, ...addedWords];
const vocabulary = addedWords.flatMap((batch) => batch.words);

describe("next full-course block", () => {
  it("retains every prior reviewed manifest and the frozen vocabulary slot baseline", () => {
    expect(sha(priorKanji)).toBe(
      "b99d498e9828aba97e9652e723d23c0327bdcd1631bc8a819b5afc0e1e133aad",
    );
    expect(sha(priorWords)).toBe(
      "df30b9405b8b354aea38e888053ef8f4b0fd14fb77da4f5bb333af091740a963",
    );
    const slots = new Map<number, number>();
    for (const batch of priorWords)
      for (const word of batch.words)
        slots.set(batch.levelNumber, Math.max(slots.get(batch.levelNumber) ?? 0, word.sortOrder));
    expect([...slots].sort(([a], [b]) => a - b)).toEqual(FOLLOWTHROUGH_PRIOR_WORD_ENDS);
  });

  it("registers the independently reviewed manifests under explicit selectors", () => {
    expect(registeredKanji.find(({ id }) => id === FOLLOWTHROUGH_KANJI_BATCH)).toEqual(addedKanji);
    expect(registeredWords.filter(({ id }) => id.startsWith(FOLLOWTHROUGH_WORD_PREFIX))).toEqual(
      addedWords,
    );
    expect([addedKanji, ...addedWords].every(({ reviewedAt }) => reviewedAt === "2026-11-21")).toBe(
      true,
    );
    expect(sha([addedKanji, ...addedWords])).toBe(
      "9bbbc07401ef1b8c88d84bdc460cf3803f5327e7a95ddae125bc349619f7f0ce",
    );
  });

  it("keeps all 200 reinforced kanji, examples and earlier prerequisite placements distinct", () => {
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    expect(validateMainCourseWordBatches(words)).toEqual([]);
    expect(addedKanji.kanji).toHaveLength(200);
    expect(addedKanji.kanji.every((item) => item.requireStrokeData)).toBe(true);
    expect(vocabulary).toHaveLength(746);
    const places: [string, string][] = [];
    const formatPlace = (level: number, slot: number) => `${level}:${slot}`;
    for (const batch of kanji) {
      places.push(
        ...batch.kanji.map((k): [string, string] => [
          k.character,
          formatPlace(k.levelNumber, k.sortOrder),
        ]),
      );
      places.push(
        ...batch.components.map((cue, i): [string, string] => [
          cue.key,
          formatPlace(batch.componentLevelNumber, (batch.componentSortOrderStart ?? 1) + i),
        ]),
      );
    }
    for (const batch of words)
      for (const word of batch.words)
        places.push([word.expression, formatPlace(batch.levelNumber, word.sortOrder)]);
    expect(new Set(places.map(([, place]) => place)).size).toBe(places.length);
    const levels = new Map(kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber])));
    for (const batch of addedWords)
      for (const word of batch.words)
        expect(
          Math.max(
            2,
            ...wordHanCharacters(word.expression + word.example.japaneseText).map(
              (character) => levels.get(character)! + 1,
            ),
          ),
          word.expression,
        ).toBe(batch.levelNumber);
    expect(addedWords.length).toBeLessThanOrEqual(40);
    expect(new Set(vocabulary.map((w) => w.jmdictEntryId)).size).toBe(vocabulary.length);
    expect(unpackDeepeningReinforcement(FOLLOWTHROUGH_REINFORCEMENT).bindings).toHaveLength(200);
  });

  it("uses attested okurigana in vocabulary without grading it as the kanji stem", () => {
    const kanji = addedKanji.kanji.find((item) => item.character === "戻");
    const word = vocabulary.find((item) => item.expression === "戻る");
    expect(kanji?.reading).toEqual({
      source: "もど.る",
      sourceType: "ja_kun",
      sourceForm: "okurigana-stem",
      primary: "もど",
      accepted: ["もど"],
    });
    expect(word?.reading).toBe("もどる");
    expect(word?.readingMnemonic.en).toContain("もど・る");
  });

  it.each([
    ["薬剤", "en", "medication", "mediation"],
    ["仲介", "en", "mediation", "medication"],
    ["道徳", "en", "morality", "mortality"],
    ["戻る", "ru", "возвращаться", "возвращать"],
  ] as const)(
    "distinguishes %s (%s) from a different near-answer",
    (expression, locale, right, wrong) => {
      const meanings = vocabulary.find((word) => word.expression === expression)!.meanings[locale];
      const check = (answer: string) =>
        validateAnswer({
          answerKind: "meaning",
          answer,
          acceptedAnswers: meanings.accepted,
          blockedAnswers: meanings.blocked?.map(({ text }) => text),
        });
      expect(check(right)).toMatchObject({ result: "correct", accepted: true });
      expect(check(wrong)).toMatchObject({ result: "blocked", accepted: false });
    },
  );
});
