import { describe, expect, it } from "vitest";
import { normalizeMeaning } from "@kanji-srs/japanese";
import { buildWordDraft07 } from "../src/editorial-draft-words-07";
import { auditWaveLocale } from "../src/editorial-wave-language";

const word = (expression: string) =>
  buildWordDraft07().words.find((item) => item.expression === expression)!;

describe("wave07 reviewed teaching scope", () => {
  it("accepts ordinary Russian equivalents without erasing the selected sense", () => {
    for (const [expression, answer] of [
      ["父", "папа"], ["母", "мама"], ["父母", "родители"],
      ["兄弟", "братья"], ["校長", "школьный директор"],
      ["今年", "в этом году"],
    ]) expect(word(expression!).meanings.ru.accepted).toContain(answer);
    for (const [expression, rejected] of [
      ["校長", "директор"], ["中学校", "старшая школа"],
      ["兄", "брат"], ["姉", "младшая сестра"],
      ["弟", "старший брат"], ["妹", "сестра"],
      ["何人", "национальность"], ["今日", "сейчас"],
    ]) expect(word(expression!).meanings.ru.accepted).not.toContain(rejected);
    expect(auditWaveLocale("ru").valid).toBe(true);
  });
  it("keeps all Russian accepted sets normalized and duplicate-free", () => {
    for (const item of buildWordDraft07().words) {
      const answers = item.meanings.ru.accepted.map((answer) => normalizeMeaning(answer, "ru-RU"));
      expect(new Set(answers).size).toBe(answers.length);
      expect(answers).toContain(normalizeMeaning(item.meanings.ru.primary, "ru-RU"));
    }
  });
});
