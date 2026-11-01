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
  validateMainCourseWordBatch,
  wordHanCharacters,
  authoredWordPartOfSpeech,
  mainCourseWordAcceptedReadings,
} from "../src/main-course-word-content";
import { buildCourseContinuationKanji } from "../src/course-continuation-kanji-content";
import {
  buildCourseContinuationWordBatches,
  validateContinuationReadings,
  CONTINUATION_READING_LINKS,
} from "../src/course-continuation-word-content";
import { buildEditorialRegistryInventory } from "../src/editorial-registry-inventory";

const kanji = buildMainCourseContentBatches();
const words = buildMainCourseWordBatches();
const batch = kanji.find((b) => b.id === "full-course-kanji-continuation")!;
const block = words.filter((b) => b.id.startsWith("full-course-vocabulary-continuation-"));
const priorKanji = kanji.filter((b) => b !== batch);
const priorWords = words.filter((b) => !block.includes(b));
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");

describe("large balanced course continuation", () => {
  it("seals the independently reviewed content selected for publication", () => {
    expect([batch, ...block].map((b) => [b.id, hash(b)])).toEqual([
      [
        "full-course-kanji-continuation",
        "6221a5e05bee3220694c7be4590d387b7ff21504db86c94edb5ecf7de65bddd5",
      ],
      [
        "full-course-vocabulary-continuation-01",
        "8fcdf2dd238fbd8356e86299c6153a76ac5040dc1d3672d0a9a223970198fe7a",
      ],
      [
        "full-course-vocabulary-continuation-02",
        "1372f6682d9494dea1feb4b2b90f6da75f3008b99fdd4b10009ceedc287bf47d",
      ],
      [
        "full-course-vocabulary-continuation-03",
        "818008004791b71a48318127d27d5ba37970e5247c438d746975378b477c1c89",
      ],
      [
        "full-course-vocabulary-continuation-04",
        "d88cdae23a814335a027ca3eb47fd330c8d2280a86e70a84be9e78cd14c549a3",
      ],
      [
        "full-course-vocabulary-continuation-05",
        "bf3c97b9bcf161bc4b21b0809e8dc46105a54f44fc3d868722e39655bd780927",
      ],
      [
        "full-course-vocabulary-continuation-06",
        "faad68de466dd9d803006236bdb60f4f5d39ecddebb8db5840ccd87b963bf225",
      ],
      [
        "full-course-vocabulary-continuation-07",
        "b25c9145898f1fd3acfee20e2685b8b7b0f30c760037c7e23d28298608b1f7f8",
      ],
      [
        "full-course-vocabulary-continuation-08",
        "9d518ee16d8931ee0f8731e2fe173b2612eb1a15b000e47c1aaaa32b2ba07e1c",
      ],
      [
        "full-course-vocabulary-continuation-09",
        "9c6cc58bfde9490f177eb0aa491dbebc6fd01bcea4c20be015074ed12bec9154",
      ],
      [
        "full-course-vocabulary-continuation-10",
        "900b19a55c3687ea87425224ee1aba369126949d31f1b7418840f49fdf2f578e",
      ],
      [
        "full-course-vocabulary-continuation-11",
        "e8a85b39eb74be661df107c1e27098c1cc8dd8c6e9fc58092ef76fb490d08b87",
      ],
      [
        "full-course-vocabulary-continuation-12",
        "0b35fedd239274e119327013b0630f9b99b3cfcad3d03c79e7d8d9d63a4a426b",
      ],
      [
        "full-course-vocabulary-continuation-13",
        "92c4b5ec239fee7f5b42d1dcc6bbbda1956cb4f4ce3fe6b1e7c29798ea6d3e79",
      ],
      [
        "full-course-vocabulary-continuation-14",
        "05706c560a5e43b123135d92c53e52f0f298a99089739130c1148014fae4f292",
      ],
      [
        "full-course-vocabulary-continuation-15",
        "91b62d9bf1fd06b0eb7e6e2f9bcc7f41aca13890934d79cd1aa67650a60dd63a",
      ],
      [
        "full-course-vocabulary-continuation-16",
        "136d7b76a6cb0d37fd0777729357242b471f222304c84ec44f51b979fb0ae890",
      ],
    ]);
  });
  it("preserves all 380/500 earlier payloads and every finite course seal", () => {
    expect(hash(priorKanji)).toBe(
      "ae441650076e115c29c3a384272caad227166338a4885319b04c868ab82b36de",
    );
    expect(hash(priorWords)).toBe(
      "cafd810b88cde8ed1ef3b95ecc22378b8245ba69e8d4da2a72b45c1e0ed8e6a6",
    );
    expect(
      buildEditorialRegistryInventory().sourceSeals.every((s) => s.status === "complete"),
    ).toBe(true);
  });
  it("adds 134 kanji and 300 primary words without duplicates or shared slot collisions", () => {
    expect(batch.kanji).toHaveLength(134);
    expect(batch.components).toHaveLength(34);
    expect(block).toHaveLength(16);
    expect(block.every((b) => b.words.length === b.wordCount && b.words.length <= 200)).toBe(true);
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    expect(validateMainCourseWordBatches(words)).toEqual([]);
    expect(buildEditorialRegistryInventory().prepared.distinctTotals).toMatchObject({
      kanji: 514,
      words: 800,
    });
  });
  it("uses earlier free capacity instead of consuming five levels per delivery", () => {
    const count = (list: typeof batch.kanji, level: number) =>
      list.filter((k) => k.levelNumber === level).length;
    const old = priorKanji.flatMap((b) => b.kanji),
      all = kanji.flatMap((b) => b.kanji);
    for (let level = 1; level <= 60; level++)
      expect(count(all, level)).toBeLessThanOrEqual(Math.max(40, count(old, level)));
    expect(
      Math.max(...batch.kanji.map((k) => k.levelNumber), ...block.map((b) => b.levelNumber)),
    ).toBeLessThanOrEqual(38);
    expect(buildCourseContinuationKanji(priorKanji)).toEqual(batch);
    expect(buildCourseContinuationWordBatches(kanji, priorWords)).toEqual(block);
  });
  it("closes all component, word and original example prerequisites strictly earlier", () => {
    const components = new Map(
      kanji.flatMap((b) => b.components.map((c) => [c.key, b.componentLevelNumber] as const)),
    );
    const levels = new Map(
      kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
    );
    for (const k of batch.kanji) {
      expect(k.requireStrokeData).toBe(true);
      for (const key of k.componentKeys) expect(components.get(key)!).toBeLessThan(k.levelNumber);
    }
    for (const b of block)
      for (const w of b.words) {
        for (const c of wordHanCharacters(w.expression + w.example.japaneseText))
          expect(levels.get(c)!).toBeLessThan(b.levelNumber);
        for (const locale of ["ru", "en"] as const) {
          const m = w.meanings[locale];
          expect(m.primary).toBe(m.accepted[0]);
          for (const answer of m.accepted) {
            expect(answer).not.toMatch(/[,;|/]/u);
            expect(
              validateAnswer({
                answerKind: "meaning",
                answer,
                acceptedAnswers: m.accepted,
                blockedAnswers: m.blocked?.map((b) => b.text),
              }).accepted,
            ).toBe(true);
          }
          for (const texts of [w.meaningHint, w.meaningMnemonic, w.readingHint, w.readingMnemonic])
            expect(texts[locale].trim()).not.toBe("");
        }
        expect(w.meaningHint).not.toEqual(w.meaningMnemonic);
        expect(w.readingHint).not.toEqual(w.readingMnemonic);
      }
  });
  it.each([0, -1, 201, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER])(
    "rejects invalid declared word count %s",
    (wordCount) => {
      const changed = { ...block[0]!, wordCount };
      expect(validateMainCourseWordBatch(changed)).toContain(
        "Word batch size must be a safe integer from 1 to 200.",
      );
    },
  );
  it("requires the exact declared count and places each word at its earliest readable level", () => {
    expect(
      validateMainCourseWordBatch({ ...block[0]!, wordCount: block[0]!.words.length + 1 }),
    ).toContain("Word batch count does not match declared size.");
    const levels = new Map(
      kanji.flatMap((b) => b.kanji.map((k) => [k.character, k.levelNumber] as const)),
    );
    for (const b of block)
      for (const w of b.words)
        expect(b.levelNumber).toBe(
          Math.max(
            2,
            ...wordHanCharacters(w.expression + w.example.japaneseText).map(
              (c) => levels.get(c)! + 1,
            ),
          ),
        );
  });
  it("binds all new selected readings to exact primary source pairs, including two explicit contractions", () => {
    expect(CONTINUATION_READING_LINKS).toHaveLength(134);
    expect(validateContinuationReadings(kanji, words)).toEqual([]);
    expect(
      CONTINUATION_READING_LINKS.filter((l) => l.kanjiReading !== l.realizedReading).map((l) => [
        l.character,
        l.kanjiReading,
        l.realizedReading,
        l.expression,
      ]),
    ).toEqual([
      ["決", "けつ", "けっ", "決定"],
      ["骨", "こつ", "こっ", "骨折"],
    ]);
    const glyphs = new Set(
      words.flatMap((b) => b.words.flatMap((w) => wordHanCharacters(w.expression))),
    );
    expect(kanji.flatMap((b) => b.kanji).filter((k) => !glyphs.has(k.character))).toEqual([]);
  });
  it.each(["missing", "alternate-only", "wrong-id"])("rejects %s primary reinforcement", (mode) => {
    const changed = structuredClone(block);
    const b = changed.find((b) => b.words.some((w) => w.expression === "高校"))!;
    const index = b.words.findIndex((w) => w.expression === "高校");
    const w = b.words[index]!;
    if (mode === "missing") (b.words as unknown[]).splice(index, 1);
    else if (mode === "alternate-only")
      Object.assign(w, { reading: "たかこう", acceptedReadings: [w.reading] });
    else Object.assign(w, { jmdictEntryId: "jmdict:1" });
    expect(validateContinuationReadings(kanji, changed)).toContain(
      "Missing primary reinforcement: 高",
    );
  });
  it("cannot silently change a taught reading while building word manifests", () => {
    const changed = structuredClone(kanji);
    Object.assign(changed.flatMap((b) => b.kanji).find((k) => k.character === "骨")!.reading, {
      primary: "こっ",
    });
    expect(() => buildCourseContinuationWordBatches(changed, priorWords)).toThrow(
      "Taught reading mismatch: 骨",
    );
  });
  it.each([
    ["泳ぐ", "verb"],
    ["高い", "i-adjective"],
    ["静か", "na-adjective"],
    ["僕", "pronoun"],
    ["毎朝", "adverb"],
    ["高校", "noun"],
  ])("persists the authored %s grammatical category %s", (expression, kind) => {
    const word = block.flatMap((b) => b.words).find((w) => w.expression === expression)!;
    expect(word.partOfSpeech).toBe(kind);
    expect(authoredWordPartOfSpeech(word)).toBe(`${kind} (course-authored)`);
  });
  it("keeps unsupported grammatical metadata invalid", () => {
    const changed = structuredClone(block[0]!);
    Object.assign(changed.words[0]!, { partOfSpeech: "unreviewed" });
    expect(validateMainCourseWordBatch(changed)).toContain(
      `Invalid authored part of speech for ${changed.words[0]!.expression}.`,
    );
  });
  it("blocks all reviewed semantic near-misses before fuzzy matching", () => {
    let count = 0;
    for (const word of block.flatMap((b) => b.words))
      for (const locale of ["ru", "en"] as const) {
        const m = word.meanings[locale];
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
    expect(count).toBe(25);
    const k = batch.kanji.find((k) => k.character === "笑")!;
    expect(
      validateAnswer({
        answerKind: "meaning",
        answer: "сменяться",
        acceptedAnswers: k.meanings.ru.accepted,
        blockedAnswers: k.meanings.ru.blocked!.map((b) => b.text),
      }),
    ).toMatchObject({ accepted: false, result: "blocked" });
  });
  it("accepts 18 exact alternatives and one proven sense-note reading without changing primaries", () => {
    const items = block.flatMap((b) => b.words);
    expect(items.flatMap((w) => w.acceptedReadings ?? [])).toHaveLength(18);
    expect(items.flatMap((w) => w.sourceNoteReadings ?? [])).toHaveLength(1);
    for (const w of items)
      for (const answer of mainCourseWordAcceptedReadings(w))
        expect(
          validateAnswer({
            answerKind: "reading",
            answer,
            acceptedAnswers: mainCourseWordAcceptedReadings(w),
          }).accepted,
        ).toBe(true);
    const good = items.find((w) => w.expression === "良い")!;
    expect(good.reading).toBe("よい");
    expect(good.sourceNoteReadings![0]!.note).toBe("also いい (all senses)");
    expect(mainCourseWordAcceptedReadings(good)).toContain("いい");
    expect(items.find((w) => w.expression === "怒る")!.acceptedReadingEntryIds).toEqual({
      いかる: "jmdict:2859682",
    });
    for (const [expression, answer] of [
      ["他人", "ひと"],
      ["娘", "こ"],
      ["上手", "うわて"],
      ["死ぬ", "たひぬ"],
      ["高い", "たっけー"],
    ]) {
      const w = items.find((w) => w.expression === expression)!;
      expect(
        validateAnswer({
          answerKind: "reading",
          answer: answer!,
          acceptedAnswers: mainCourseWordAcceptedReadings(w),
        }).accepted,
      ).toBe(false);
    }
  });
  it.each([
    "unknown-key",
    "same-entry",
    "invalid-id",
    "wrong-note-entry",
    "invalid-note-hash",
    "unrelated-note",
  ])("rejects %s reading provenance metadata", (mode) => {
    const changed = structuredClone(block);
    const words = changed.flatMap((b) => b.words);
    const angry = words.find((w) => w.expression === "怒る")!;
    const good = words.find((w) => w.expression === "良い")!;
    if (mode === "unknown-key")
      Object.assign(angry, { acceptedReadingEntryIds: { いかれ: "jmdict:2859682" } });
    if (mode === "same-entry")
      Object.assign(angry, { acceptedReadingEntryIds: { いかる: angry.jmdictEntryId } });
    if (mode === "invalid-id")
      Object.assign(angry, { acceptedReadingEntryIds: { いかる: "jmdict:0" } });
    if (mode === "wrong-note-entry")
      Object.assign(good.sourceNoteReadings![0]!, { sourceRecordId: "jmdict:9999" });
    if (mode === "invalid-note-hash")
      Object.assign(good.sourceNoteReadings![0]!, { sourceDocumentSha256: "invalid" });
    if (mode === "unrelated-note")
      Object.assign(good.sourceNoteReadings![0]!, { note: "No reading mentioned" });
    expect(validateMainCourseWordBatches(changed).length).toBeGreaterThan(0);
  });
});
