import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  validateMainCourseWordBatches,
  wordHanCharacters,
} from "../src/main-course-word-content";
import {
  REINFORCEMENT_GAP_CHARACTERS,
  REINFORCEMENT_READING_EVIDENCE,
  validateReinforcementReadings,
} from "../src/reinforcement-reading-evidence";
import { buildEditorialRegistryInventory } from "../src/editorial-registry-inventory";
import { buildReinforcementWordBatches } from "../src/reinforcement-word-content";

const kanji = buildMainCourseContentBatches();
const words = buildMainCourseWordBatches();
const newKanji = kanji.find((b) => b.id === "full-course-kanji-reinforcement")!;
const newWords = words.filter((b) => b.id.startsWith("full-course-vocabulary-reinforcement-"));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("full-course reading reinforcement", () => {
  it("keeps every earlier kanji and word manifest byte-for-byte stable", () => {
    const oldKanji = kanji.filter((b) => !b.id.includes("reinforcement"));
    const oldWords = words.filter((b) => !b.id.includes("reinforcement"));
    expect(oldKanji.flatMap((b) => b.kanji)).toHaveLength(262);
    expect(oldWords.flatMap((b) => b.words)).toHaveLength(260);
    expect(hash(oldKanji)).toBe("c0d4e37e591858828fb88eee57385d3f3f1b1e35fc22f531c234be53bb2fc405");
    expect(hash(oldWords)).toBe("68a64db55387363a9fafdca87710f6af8e76ba0cbe4974f51603978dd0356292");
  });
  it("adds one twelve-kanji and eighty-word block with collision-free earlier prerequisites", () => {
    expect(newKanji.kanji).toHaveLength(12);
    expect(newKanji.components).toHaveLength(7);
    expect(newWords).toHaveLength(4);
    expect(newWords.every((b) => b.words.length === 20)).toBe(true);
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    expect(validateMainCourseWordBatches(words)).toEqual([]);
    const levels = new Map(
      kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
    );
    for (const b of newWords)
      for (const w of b.words) {
        for (const c of wordHanCharacters(w.expression + w.example.japaneseText))
          expect(levels.get(c)!).toBeLessThan(b.levelNumber);
        expect(w.meaningHint).not.toEqual(w.meaningMnemonic);
        expect(w.readingHint).not.toEqual(w.readingMnemonic);
        expect(w.example.readingText).toMatch(/^[ぁ-ゖー、。！？\s]+$/u);
        for (const locale of ["ru", "en"] as const) {
          expect(w.meanings[locale].accepted[0]).toBe(w.meanings[locale].primary);
          for (const text of [w.meaningHint, w.meaningMnemonic, w.readingHint, w.readingMnemonic])
            expect(text[locale].trim()).not.toBe("");
          for (const answer of w.meanings[locale].accepted)
            expect(
              validateAnswer({
                answerKind: "meaning",
                answer,
                acceptedAnswers: w.meanings[locale].accepted,
                blockedAnswers: w.meanings[locale].blocked?.map((b) => b.text),
              }).accepted,
            ).toBe(true);
        }
      }
    const report = buildEditorialRegistryInventory();
    expect(report.validation).toEqual({ valid: true, issues: [] });
    expect(report.prepared.distinctTotals).toMatchObject({ kanji: 274, words: 340 });
    expect(report.sourceSeals.every((s) => s.status === "complete")).toBe(true);
  });
  it("aligns the taught reading of all forty-five gaps and all twelve support kanji to primary word cards", () => {
    expect(REINFORCEMENT_GAP_CHARACTERS).toHaveLength(45);
    expect(new Set(REINFORCEMENT_READING_EVIDENCE.map((e) => e.character)).size).toBe(57);
    expect(validateReinforcementReadings(kanji, words)).toEqual([]);
    for (const character of [
      ...REINFORCEMENT_GAP_CHARACTERS,
      ...newKanji.kanji.map((k) => k.character),
    ]) {
      expect(REINFORCEMENT_READING_EVIDENCE.filter((e) => e.character === character)).toHaveLength(
        1,
      );
    }
    const change = REINFORCEMENT_READING_EVIDENCE.find((e) => e.character === "辺")!;
    expect(change).toMatchObject({
      kanjiReading: "へん",
      realizedReading: "ぺん",
      before: "きん",
      expression: "近辺",
    });
    expect(change.soundChange?.ru).toContain("へん");
    expect(change.soundChange?.en).toContain("ぺん");
  });
  it.each(["missing", "example-only", "alternate-only", "wrong-id"])(
    "rejects %s reinforcement instead of counting glyph occurrence",
    (mode) => {
      const changed = structuredClone(words);
      const b = changed.find((b) => b.words.some((w) => w.expression === "顔面"))!;
      const index = b.words.findIndex((w) => w.expression === "顔面");
      const original = b.words[index]!;
      if (mode === "missing" || mode === "example-only") {
        (b.words as unknown[]).splice(index, 1);
        if (mode === "example-only")
          Object.assign(b.words[0]!.example, { japaneseText: original.example.japaneseText });
      } else if (mode === "alternate-only")
        Object.assign(original, { reading: "かおめん", acceptedReadings: [original.reading] });
      else Object.assign(original, { jmdictEntryId: "jmdict:1" });
      expect(validateReinforcementReadings(kanji, changed)).toContain(
        "Missing exact primary reinforcement pair: 顔",
      );
      expect(validateReinforcementReadings(kanji, changed)).toContain(
        "Missing exact primary reinforcement pair: 面",
      );
    },
  );
  it("rejects a different selected kanji reading and missing support kanji", () => {
    const changed = structuredClone(kanji);
    Object.assign(changed.flatMap((b) => b.kanji).find((k) => k.character === "顔")!.reading, {
      primary: "かお",
    });
    expect(validateReinforcementReadings(changed, words)).toContain("Taught reading mismatch: 顔");
    expect(() => buildReinforcementWordBatches(changed)).toThrow("Taught reading mismatch: 顔");
    expect(
      validateReinforcementReadings(
        kanji.filter((b) => b !== newKanji),
        words,
      ),
    ).toContain("Taught reading mismatch: 面");
  });
  it.each([
    ["寒気", "ru", "озноб"],
    ["寒気", "en", "chills"],
    ["漢語", "ru", "китайский язык"],
    ["色紙", "en", "colored paper"],
    ["色紙", "ru", "цветная бумага"],
    ["良心", "en", "consciousness"],
    ["礼金", "en", "refundable deposit"],
    ["新雪", "ru", "доброта"],
    ["人気", "ru", "полярность"],
    ["実用", "en", "practical implication"],
    ["成立", "ru", "вступление в силу"],
    ["成立", "en", "coming into effect"],
  ] as const)("blocks semantically distinct %s / %s answer %s", (expression, locale, answer) => {
    const item = newWords.flatMap((b) => b.words).find((w) => w.expression === expression)!;
    expect(
      validateAnswer({
        answerKind: "meaning",
        answer,
        acceptedAnswers: item.meanings[locale].accepted,
        blockedAnswers: item.meanings[locale].blocked?.map((b) => b.text),
      }),
    ).toMatchObject({ accepted: false, result: "blocked" });
  });
  it.each([
    ["寒気", "さむけ"],
    ["色紙", "いろがみ"],
    ["人気", "ひとけ"],
    ["生物", "なまもの"],
  ])("does not accept the other sense's %s reading %s", (expression, answer) => {
    const item = newWords.flatMap((b) => b.words).find((w) => w.expression === expression)!;
    expect(
      validateAnswer({
        answerKind: "reading",
        answer,
        acceptedAnswers: [item.reading, ...(item.acceptedReadings ?? [])],
      }).accepted,
    ).toBe(false);
  });
  it.each([
    ["黒色", "くろいろ"],
    ["平日", "ひらび"],
    ["文字", "もんじ"],
    ["図画", "とが"],
    ["鳥肉", "ちょうにく"],
  ])(
    "accepts source-checked same-sense %s alternative %s without replacing its primary",
    (expression, answer) => {
      const item = newWords.flatMap((b) => b.words).find((w) => w.expression === expression)!;
      expect(item.acceptedReadings).toContain(answer);
      expect(item.reading).not.toBe(answer);
      expect(
        validateAnswer({
          answerKind: "reading",
          answer,
          acceptedAnswers: [item.reading, ...item.acceptedReadings!],
        }),
      ).toMatchObject({ accepted: true });
      expect(validateReinforcementReadings(kanji, words)).toEqual([]);
    },
  );
});
