import { describe, expect, it } from "vitest";
import { normalizeMeaning } from "@kanji-srs/japanese";
import { buildWordDraft07 } from "../src/editorial-draft-words-07";
import { auditWaveLocale } from "../src/editorial-wave-language";
import { buildKanjiDraft07 } from "../src/editorial-draft-kanji-07";
import { auditWaveReadings } from "../src/editorial-wave-readings";

const word = (expression: string) =>
  buildWordDraft07().words.find((item) => item.expression === expression)!;

describe("wave07 reviewed teaching scope", () => {
  it("scopes real reading alternatives to this card instead of teaching them as nonexistent", () => {
    for (const [expression, alternative] of [["父母", "ちちはは"], ["兄弟", "けいてい"], ["今日", "こんじつ"], ["今年", "こんねん"]]) {
      const item = word(expression!);
      expect(item.readingMnemonic.ru).toContain(alternative);
      expect(item.readingMnemonic.en).toContain("also exists");
      expect(item.acceptedReadings ?? []).toEqual([]);
    }
    expect(word("学校").readingMnemonic.ru).toContain("четыре моры");
    expect(buildKanjiDraft07().kanji.find((item) => item.character === "弟")!.readingMnemonic.ru).toContain("другое онное чтение");
    expect(auditWaveReadings().valid).toBe(true);
  });
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
  it("accepts corresponding English senses but not generic or opposite family terms", () => {
    for (const [expression, answer] of [
      ["校長", "principal"], ["小学校", "primary school"],
      ["中学校", "lower secondary school"], ["父母", "parents"],
      ["兄", "elder brother"], ["姉", "elder sister"], ["兄弟", "brothers"],
    ]) expect(word(expression!).meanings.en.accepted).toContain(answer);
    for (const [expression, rejected] of [
      ["校長", "director"], ["兄", "brother"], ["弟", "older brother"],
      ["何人", "what nationality"], ["中学校", "high school"],
    ]) expect(word(expression!).meanings.en.accepted).not.toContain(rejected);
    expect(auditWaveLocale("en").valid).toBe(true);
    for (const item of buildWordDraft07().words) {
      const answers = item.meanings.en.accepted.map((answer) => normalizeMeaning(answer, "en-US"));
      expect(new Set(answers).size).toBe(answers.length);
    }
  });
});
