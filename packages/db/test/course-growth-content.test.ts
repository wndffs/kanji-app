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
  buildCourseGrowthWordBatches,
  validateCourseGrowthReadings,
  COURSE_GROWTH_READING_LINKS,
} from "../src/course-growth-word-content";
import { buildEditorialRegistryInventory } from "../src/editorial-registry-inventory";

const kanji = buildMainCourseContentBatches().filter((batch) => !batch.id.includes("expansion"));
const words = buildMainCourseWordBatches().filter((batch) => !batch.id.includes("expansion"));
const batch = kanji.find((b) => b.id === "full-course-kanji-growth")!;
const block = words.filter((b) => b.id.startsWith("full-course-vocabulary-growth-"));
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(v)).digest("hex");

describe("large course growth content block", () => {
  it("freezes the independently reviewed payloads selected for publication", () => {
    expect([batch, ...block].map((b) => [b.id, hash(b)])).toEqual([
      [
        "full-course-kanji-growth",
        "e8f8fc13ac5668b37619c6a6265e16acf1f848708d883c4f6fe40ca906925c3a",
      ],
      [
        "full-course-vocabulary-growth-01",
        "b63db294c4d092c9cd100adc998c821e602cf10bccf99855961de4fc8aec6d8d",
      ],
      [
        "full-course-vocabulary-growth-02",
        "f60a017a829c409ed4f8ffd92566921955d42d86cc19977dcd34c82c6fdfa179",
      ],
      [
        "full-course-vocabulary-growth-03",
        "18115c0c11305be0c47c481a83caadae98e7910fa630997ff8149e2b8da27298",
      ],
      [
        "full-course-vocabulary-growth-04",
        "177ba7fc69a0ea1bb94388e7f6cf0de1065e15c875b4ba752d6171ffdf89ab94",
      ],
      [
        "full-course-vocabulary-growth-05",
        "7ea189716d4bd635eb87831e46ebc51d1437d0964c3ef9ea9f32dd7d3b49096e",
      ],
      [
        "full-course-vocabulary-growth-06",
        "06636d84a5df596b0fce30c6198529bcf216866d91166b794705b7bff8b4aa26",
      ],
      [
        "full-course-vocabulary-growth-07",
        "b724671bf51ff8d720b6358e05e11ee16f47754d77f24c057f9abdfc3b92c92d",
      ],
      [
        "full-course-vocabulary-growth-08",
        "aa29f1f5c4c49356d30bf55bca9d2f3c6fec25ec852ceea6b1c771c0eb0745bc",
      ],
    ]);
  });
  it("preserves every previously published main manifest and all finite seals", () => {
    expect(hash(kanji.filter((b) => b !== batch && !b.id.includes("continuation")))).toBe(
      "9600256da1c8a55f945006855ee3839d67c121c5da150af9e48b3ef68a537955",
    );
    expect(hash(words.filter((b) => !block.includes(b) && !b.id.includes("continuation")))).toBe(
      "c4c4fba195d20df8f8cde19461a2464193b27f22c3ad786ff8840876b6e277ed",
    );
    expect(
      buildEditorialRegistryInventory().sourceSeals.every((s) => s.status === "complete"),
    ).toBe(true);
  });
  it("adds 106 kanji and 160 primary pairs with closed prerequisites and free slots", () => {
    expect(batch.kanji).toHaveLength(106);
    expect(batch.components).toHaveLength(48);
    expect(block).toHaveLength(8);
    expect(block.every((b) => b.words.length === 20)).toBe(true);
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    expect(validateMainCourseWordBatches(words)).toEqual([]);
    const componentLevels = new Map(
      kanji.flatMap((b) => b.components.map((c) => [c.key, b.componentLevelNumber] as const)),
    );
    const kanjiLevels = new Map(
      kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
    );
    for (const k of batch.kanji) {
      expect(k.requireStrokeData).toBe(true);
      expect(k.reading.accepted).toEqual([k.reading.primary]);
      for (const key of k.componentKeys)
        expect(componentLevels.get(key)!).toBeLessThan(k.levelNumber);
    }
    for (const b of block)
      for (const w of b.words) {
        for (const c of wordHanCharacters(w.expression + w.example.japaneseText))
          expect(kanjiLevels.get(c)!).toBeLessThan(b.levelNumber);
        expect(w.example.readingText).toMatch(/^[ぁ-ゖー、。！？\s]+$/u);
        expect(w.meaningHint).not.toEqual(w.meaningMnemonic);
        expect(w.readingHint).not.toEqual(w.readingMnemonic);
        expect(Object.keys(w.meanings).sort()).toEqual(["en", "ru"]);
        for (const locale of ["ru", "en"] as const) {
          const m = w.meanings[locale];
          expect(m.primary).toBe(m.accepted[0]);
          for (const a of m.accepted)
            expect(
              validateAnswer({
                answerKind: "meaning",
                answer: a,
                acceptedAnswers: m.accepted,
                blockedAnswers: m.blocked?.map((b) => b.text),
              }).accepted,
            ).toBe(true);
          for (const text of [w.meaningHint, w.meaningMnemonic, w.readingHint, w.readingMnemonic])
            expect(text[locale].trim()).not.toBe("");
        }
      }
    const report = buildEditorialRegistryInventory({ kanjiBatches: kanji, wordBatches: words });
    expect(report.prepared.distinctTotals).toMatchObject({ kanji: 514, words: 800 });
    expect(report.validation).toEqual({ valid: true, issues: [] });
  });
  it("links all 106 new taught readings and ten earlier gaps to real primary words", () => {
    expect(COURSE_GROWTH_READING_LINKS).toHaveLength(116);
    expect(new Set(COURSE_GROWTH_READING_LINKS.map((l) => l.character)).size).toBe(116);
    expect(validateCourseGrowthReadings(kanji, words)).toEqual([]);
    const glyphs = new Set(
      words.flatMap((b) => b.words.flatMap((w) => wordHanCharacters(w.expression))),
    );
    expect(kanji.flatMap((b) => b.kanji).filter((k) => !glyphs.has(k.character))).toEqual([]);
  });
  it.each(["missing", "example-only", "alternate-only", "wrong-id"])(
    "rejects %s reinforcement",
    (mode) => {
      const changed = structuredClone(block);
      const b = changed.find((b) => b.words.some((w) => w.expression === "電車"))!;
      const index = b.words.findIndex((w) => w.expression === "電車");
      const w = b.words[index]!;
      if (mode === "missing" || mode === "example-only") {
        (b.words as unknown[]).splice(index, 1);
        if (mode === "example-only")
          Object.assign(b.words[0]!.example, { japaneseText: w.example.japaneseText });
      } else if (mode === "alternate-only")
        Object.assign(w, { reading: "でんぐるま", acceptedReadings: [w.reading] });
      else Object.assign(w, { jmdictEntryId: "jmdict:1" });
      expect(validateCourseGrowthReadings(kanji, changed)).toContain(
        "Missing primary word reinforcement: 電",
      );
    },
  );
  it("rejects a changed taught reading in manifest construction itself", () => {
    const changed = structuredClone(kanji);
    Object.assign(changed.flatMap((b) => b.kanji).find((k) => k.character === "鼻")!.reading, {
      primary: "び",
    });
    expect(() => buildCourseGrowthWordBatches(changed)).toThrow("Taught reading mismatch: 鼻");
  });
  it.each([
    ["宿題", "ru", "домашнее здание"],
    ["留学", "ru", "облучение за границей"],
    ["留学", "en", "studying aboard"],
    ["身長", "en", "human weight"],
    ["出発", "en", "deporting"],
    ["竹林", "en", "bamboo groove"],
    ["直線", "en", "straight lane"],
    ["科学", "en", "chemistry"],
    ["以上", "en", "strictly greater than"],
    ["以下", "en", "strictly less than"],
    ["人類", "ru", "гуманность"],
    ["性別", "en", "sexual orientation"],
    ["百万", "en", "one billion"],
    ["学期", "en", "school team"],
    ["郵便", "en", "portal service"],
    ["電池", "en", "electric bell"],
    ["関係", "en", "convection"],
    ["出血", "ru", "кроволечение"],
    ["三毛猫", "en", "calico cap"],
  ] as const)("blocks the semantically wrong %s %s answer %s", (expression, locale, answer) => {
    const w = block.flatMap((b) => b.words).find((w) => w.expression === expression)!;
    const m = w.meanings[locale];
    expect(
      validateAnswer({
        answerKind: "meaning",
        answer,
        acceptedAnswers: m.accepted,
        blockedAnswers: m.blocked?.map((b) => b.text),
      }),
    ).toMatchObject({ accepted: false, result: "blocked" });
  });
  it("accepts all 24 exact same-sense variants, without making them primary", () => {
    const entries = block.flatMap((b) => b.words);
    const alternatives = entries.flatMap((w) =>
      (w.acceptedReadings ?? []).map((reading) => ({ w, reading })),
    );
    expect(alternatives).toHaveLength(24);
    for (const { w, reading } of alternatives) {
      expect(reading).not.toBe(w.reading);
      expect(
        validateAnswer({
          answerKind: "reading",
          answer: reading,
          acceptedAnswers: [w.reading, ...w.acceptedReadings!],
        }).accepted,
      ).toBe(true);
      expect(w.readingHint.ru).toContain(reading);
      expect(w.readingHint.en).toContain(reading);
    }
    expect(entries.find((w) => w.expression === "鼻血")!.reading).toBe("はなぢ");
    expect(entries.find((w) => w.expression === "以下")!.readingHint.en).toContain("historical");
  });
  it("blocks all reviewed kanji near-misses before fuzzy acceptance", () => {
    let count = 0;
    for (const k of batch.kanji)
      for (const locale of ["ru", "en"] as const) {
        const m = k.meanings[locale];
        for (const b of m.blocked ?? []) {
          count++;
          expect(
            validateAnswer({
              answerKind: "meaning",
              answer: b.text,
              acceptedAnswers: m.accepted,
              blockedAnswers: m.blocked!.map((b) => b.text),
            }),
          ).toMatchObject({ accepted: false, result: "blocked" });
        }
      }
    expect(count).toBe(14);
  });
  it("does not turn a comma-separated tooth-decay gloss into an accepted bare tooth", () => {
    const item = block.flatMap((b) => b.words).find((w) => w.expression === "虫歯")!;
    const acceptedAnswers = item.meanings.ru.accepted;
    for (const answer of acceptedAnswers)
      expect(validateAnswer({ answerKind: "meaning", answer, acceptedAnswers }).accepted).toBe(
        true,
      );
    expect(validateAnswer({ answerKind: "meaning", answer: "зуб", acceptedAnswers }).accepted).toBe(
      false,
    );
  });
});
