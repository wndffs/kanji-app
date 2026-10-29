import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import {
  buildCuratedMeaningBlocks,
  validateCuratedMeaningBlocks,
} from "../src/curated-meaning-blocks";
import { buildKanjiDraft07 } from "../src/editorial-draft-kanji-07";
import { buildWordDraft07 } from "../src/editorial-draft-words-07";

describe("curated semantic meaning blocks", () => {
  it("rejects known semantic near-matches before fuzzy matching or private accepted answers", () => {
    for (const [expression, answer] of [
      ["父母", "father and brother"],
      ["兄", "other brother"],
      ["兄", "старый брат"],
      ["姉", "other sister"],
    ]) {
      const word = buildWordDraft07().words.find((item) => item.expression === expression)!;
      const acceptedAnswers = [...word.meanings.ru.accepted, ...word.meanings.en.accepted];
      expect(
        validateAnswer({ answerKind: "meaning", answer: answer!, acceptedAnswers }).accepted,
      ).toBe(true);
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer: answer!,
          acceptedAnswers,
          blockedAnswers: buildCuratedMeaningBlocks(word.meanings).map((block) => block.text),
          userAcceptedAnswers: [answer!],
        }),
      ).toMatchObject({ accepted: false, result: "blocked" });
    }
  });
  it("keeps every intended RU/EN answer valid on all thirty new reading/meaning items", () => {
    const items = [...buildKanjiDraft07().kanji, ...buildWordDraft07().words];
    expect(items).toHaveLength(30);
    for (const item of items) {
      expect(validateCuratedMeaningBlocks(item.meanings)).toEqual([]);
      const acceptedAnswers = [...item.meanings.ru.accepted, ...item.meanings.en.accepted];
      const blockedAnswers = buildCuratedMeaningBlocks(item.meanings).map((block) => block.text);
      for (const answer of acceptedAnswers)
        expect(
          validateAnswer({ answerKind: "meaning", answer, acceptedAnswers, blockedAnswers }),
        ).toMatchObject({ accepted: true, result: "correct" });
    }
  });
  it("rejects blank reasons, duplicate normalized blocks and accepted-answer collisions", () => {
    const base = {
      ru: { accepted: ["отец"], blocked: [] as { text: string; reason: string }[] },
      en: { accepted: ["father"] },
    };
    for (const blocked of [
      [{ text: "", reason: "reason" }],
      [{ text: "wrong", reason: "" }],
      [{ text: "отец", reason: "reason" }],
      [{ text: "father", reason: "reason" }],
      [
        { text: "ошибка", reason: "reason" },
        { text: "ОШИБКА!", reason: "reason" },
      ],
    ])
      expect(
        validateCuratedMeaningBlocks({ ...base, ru: { ...base.ru, blocked } }).length,
      ).toBeGreaterThan(0);
  });
});
