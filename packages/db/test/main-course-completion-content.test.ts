import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { normalizeJapaneseReading, validateAnswer } from "@kanji-srs/japanese";
import {
  buildMainCourseContentBatches,
  validateMainCourseContentBatches,
} from "../src/main-course-content";
import { buildMainCourseWordBatches } from "../src/main-course-word-content";
import { buildEditorialRegistryInventory } from "../src/editorial-registry-inventory";
import { runEditorialRegistryInventory } from "../prisma/report-editorial-registry";
import {
  buildMainCourseCompletionContent,
  COMPLETION_KANJI_TEACHING,
} from "../src/main-course-completion-content";

import {
  completionReadingMemory,
  COMPLETION_READING_MEMORY_CHARACTERS,
} from "../src/completion-reading-memory";
import { buildCompletionWordBatches } from "../src/completion-word-content";
import { validateMainCourseWordBatches, wordHanCharacters } from "../src/main-course-word-content";

const base = buildMainCourseContentBatches().filter(
  (batch) => batch.id !== "full-course-kanji-completion-01",
);
const makeContent = () =>
  buildMainCourseCompletionContent(base.flatMap((batch) => batch.components));

describe("single full-course completion content block", () => {
  it("counts the reviewed registry once, including the legacy inventory flag, never as live totals", () => {
    const result = runEditorialRegistryInventory(["--json", "--include-completion-draft"]);
    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report.validation.valid).toBe(true);
    expect(report.prepared.distinctTotals.kanji).toBe(262);
    expect(report.prepared.reviewedDistinctTotals.kanji).toBe(262);
    expect(report.prepared.pendingReviewDistinctTotals.kanji).toBe(0);
    expect(report.prepared.distinctTotals.words).toBe(260);
    expect(report.prepared.reviewedDistinctTotals.words).toBe(260);
    expect(result.stdout).toBe(runEditorialRegistryInventory(["--json"]).stdout);
    expect(report.sourceSeals.every((seal: { status: string }) => seal.status === "complete")).toBe(
      true,
    );
    expect(report.countSemantics).toContain("not");
  });
  it("adds a reviewed independent block without changing old course content", () => {
    const before = createHash("sha256").update(JSON.stringify(base)).digest("hex");
    const draft = makeContent();
    expect(draft.kanji).toHaveLength(145);
    expect(draft.components).toHaveLength(38);
    expect(new Set(draft.kanji.map((item) => item.character)).size).toBe(145);
    const prior = new Set(base.flatMap((batch) => batch.kanji.map((item) => item.character)));
    expect(draft.kanji.every((item) => !prior.has(item.character))).toBe(true);
    expect(new Set(COMPLETION_KANJI_TEACHING.map((row) => `${row[7]}:${row[8]}`)).size).toBe(133);
    expect(createHash("sha256").update(JSON.stringify(base)).digest("hex")).toBe(before);
    expect(base.some((batch) => batch.id === draft.id)).toBe(false);
    expect(draft.reviewedAt).toBe("2026-10-31");
    expect(draft.reviewNotes).toContain("AI");
    expect(buildMainCourseContentBatches().filter((batch) => batch.id === draft.id)).toHaveLength(
      1,
    );
  });
  it("reuses the real registry validator and earlier component constraints", () => {
    const draft = makeContent();
    expect(validateMainCourseContentBatches([...base, draft])).toEqual([]);
    expect(
      buildEditorialRegistryInventory({
        kanjiBatches: [...base, draft],
        wordBatches: buildMainCourseWordBatches(),
      }),
    ).toBeDefined();
    const all = [...base, draft];
    const levels = new Map(
      all.flatMap((batch) =>
        batch.components.map((item) => [item.key, batch.componentLevelNumber] as const),
      ),
    );
    for (const item of draft.kanji) {
      expect(item.requireStrokeData).toBe(true);
      expect(
        item.componentKeys.every((key) => levels.has(key) && levels.get(key)! < item.levelNumber),
      ).toBe(true);
      expect(item.reading.primary).toBe(normalizeJapaneseReading(item.reading.source));
      expect(item.reading.accepted).toEqual([item.reading.primary]);
      expect(item.meanings.ru.accepted[0]).toBe(item.meanings.ru.primary);
      expect(item.meanings.en.accepted[0]).toBe(item.meanings.en.primary);
      expect(item.meaningMnemonic.ru).toContain("не этимология");
      expect(item.meaningMnemonic.en).toContain("not etymology");
    }
  });
  it("retains complete kana word readings and deliberate different reading types", () => {
    const byCharacter = new Map(makeContent().kanji.map((item) => [item.character, item]));
    expect(byCharacter.get("坂")?.reading).toMatchObject({
      source: "さか",
      sourceType: "ja_kun",
      primary: "さか",
    });
    expect(byCharacter.get("写")?.readingMnemonic.ru).toContain("写真（しゃしん）");
    expect(byCharacter.get("筆")?.readingMnemonic.en).toContain("筆記 (ひっき)");
    for (const row of COMPLETION_KANJI_TEACHING) {
      expect(row[7]).toContain(row[0]);
      expect(row[8]).toMatch(/^[\p{Script=Hiragana}ー]+$/u);
      expect(normalizeJapaneseReading(row[1])).toMatch(/^[\p{Script=Hiragana}ー]+$/u);
    }
    expect(() => buildMainCourseCompletionContent([])).toThrow("Missing component");
  });
  it.each([
    ["意", "en", "invention"],
    ["映", "ru", "проектировать"],
    ["化", "ru", "измерение"],
    ["化", "en", "transportation"],
    ["写", "en", "phonograph"],
    ["台", "ru", "подстава"],
    ["転", "ru", "перемешаться"],
    ["終", "ru", "закачивать"],
    ["教", "ru", "учиться"],
    ["教", "en", "learn"],
    ["開", "ru", "отрывать"],
    ["業", "ru", "процессия"],
    ["写", "ru", "купировать"],
    ["住", "ru", "прожигать"],
    ["送", "ru", "отравлять"],
    ["代", "ru", "покорение"],
    ["着", "ru", "пребывать"],
    ["別", "ru", "разлучать"],
  ] as const)(
    "rejects semantically different %s %s near-answer %s",
    (character, locale, answer) => {
      const meanings = makeContent().kanji.find((item) => item.character === character)!.meanings[
        locale
      ];
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer,
          acceptedAnswers: meanings.accepted,
          blockedAnswers: meanings.blocked?.map((item) => item.text),
        }),
      ).toMatchObject({ accepted: false, result: "blocked" });
      for (const accepted of meanings.accepted)
        expect(
          validateAnswer({
            answerKind: "meaning",
            answer: accepted,
            acceptedAnswers: meanings.accepted,
            blockedAnswers: meanings.blocked?.map((item) => item.text),
          }).accepted,
        ).toBe(true);
    },
  );
  it("keeps corrected component identities and concrete sound-change guidance", () => {
    const draft = makeContent();
    const symbols = new Map(
      [...base.flatMap((batch) => batch.components), ...draft.components].map((item) => [
        item.key,
        item.symbol,
      ]),
    );
    const get = (character: string) => draft.kanji.find((item) => item.character === character)!;
    for (const character of ["助", "組"]) {
      const shapes = get(character).componentKeys.map((key) => symbols.get(key));
      expect(shapes).toContain("且");
      expect(shapes).not.toContain("目");
    }
    expect(get("事").componentKeys.map((key) => symbols.get(key))).not.toContain("聿");
    expect(get("歩").componentKeys.map((key) => symbols.get(key))).not.toContain("小");
    expect(get("筆").readingMnemonic.ru).toContain("ひつ + き");
    expect(get("切").readingMnemonic.ru).toContain("切断（せつだん）");
    expect(get("教").meanings.ru.primary).toBe("обучать");
  });
  it("connects every individual reading memory exactly once and fails unknown keys", () => {
    const content = makeContent();
    expect(COMPLETION_READING_MEMORY_CHARACTERS).toHaveLength(145);
    expect(new Set(COMPLETION_READING_MEMORY_CHARACTERS).size).toBe(145);
    expect([...COMPLETION_READING_MEMORY_CHARACTERS].sort()).toEqual(
      content.kanji.map((item) => item.character).sort(),
    );
    expect(() => completionReadingMemory("不存在")).toThrow();
    for (const item of content.kanji) {
      const memory = completionReadingMemory(item.character);
      for (const locale of ["ru", "en"] as const) {
        expect(memory[locale]).toContain(item.reading.primary);
        expect(item.readingMnemonic[locale]).toContain(memory[locale]);
        expect(memory[locale]).not.toMatch(/коротк\S* ん|short (?:nasal )?ん/u);
      }
    }
    expect(completionReadingMemory("注").ru).toContain("конечное う удлиняет");
    expect(
      content.kanji.find((item) => item.character === "写")?.meanings.ru.accepted,
    ).not.toContain("снимать");
  });
  it("provides eighty reviewed word cards with closed earlier kanji dependencies", () => {
    const kanji = [...base, makeContent()];
    const words = buildCompletionWordBatches(kanji);
    const priorWords = buildMainCourseWordBatches().filter(
      (batch) => !batch.id.startsWith("full-course-vocabulary-completion-"),
    );
    expect(words).toHaveLength(4);
    expect(
      words.every((batch) => batch.words.length === 20 && batch.reviewedAt === "2026-10-31"),
    ).toBe(true);
    expect(words.flatMap((batch) => batch.words)).toHaveLength(80);
    expect(validateMainCourseWordBatches([...priorWords, ...words])).toEqual([]);
    expect(buildCompletionWordBatches(kanji)).toEqual(words);
    expect(() => buildCompletionWordBatches(base)).toThrow("needs prepared kanji");
    const levels = new Map(
      kanji.flatMap((batch) =>
        batch.kanji.map((item) => [item.character, item.levelNumber] as const),
      ),
    );
    for (const batch of words) {
      for (const item of batch.words) {
        for (const character of wordHanCharacters(item.expression + item.example.japaneseText))
          expect(levels.get(character)!).toBeLessThan(batch.levelNumber);
        expect(item.meaningMnemonic).not.toEqual(item.meaningHint);
        for (const locale of ["ru", "en"] as const) {
          const meanings = item.meanings[locale];
          expect(meanings.accepted[0]).toBe(meanings.primary);
          for (const text of [
            item.meaningMnemonic,
            item.meaningHint,
            item.readingMnemonic,
            item.readingHint,
          ])
            expect(text[locale].trim()).not.toBe("");
          for (const answer of meanings.accepted)
            expect(
              validateAnswer({
                answerKind: "meaning",
                answer,
                acceptedAnswers: meanings.accepted,
                blockedAnswers: meanings.blocked?.map((answer) => answer.text),
              }).accepted,
            ).toBe(true);
        }
      }
    }
    const inventory = buildEditorialRegistryInventory({
      kanjiBatches: kanji,
      wordBatches: [...priorWords, ...words],
    });
    expect(inventory.validation).toEqual({ valid: true, issues: [] });
    expect(inventory.batches.every((batch) => batch.prerequisiteClosure.closed)).toBe(true);
  });
  it.each([
    ["会話", "en", "conservation"],
    ["会話", "en", "conversion"],
    ["写真", "en", "phonograph"],
    ["説明", "en", "classification"],
    ["急行", "ru", "старый поезд"],
    ["今回", "ru", "в тот раз"],
    ["中古", "ru", "поддержанный"],
    ["中古", "ru", "поддержанный товар"],
    ["中古", "ru", "поддержанные вещи"],
  ] as const)(
    "rejects %s %s false-positive %s before typo tolerance",
    (expression, locale, answer) => {
      const item = buildCompletionWordBatches([...base, makeContent()])
        .flatMap((batch) => batch.words)
        .find((item) => item.expression === expression)!;
      const meanings = item.meanings[locale];
      expect(
        validateAnswer({
          answerKind: "meaning",
          answer,
          acceptedAnswers: meanings.accepted,
          blockedAnswers: meanings.blocked?.map((answer) => answer.text),
        }),
      ).toMatchObject({ accepted: false, result: "blocked" });
    },
  );
  it("accepts only explicitly checked word-reading alternatives and keeps dictionary scope", () => {
    const words = buildCompletionWordBatches([...base, makeContent()]).flatMap(
      (batch) => batch.words,
    );
    for (const [expression, alternative] of [
      ["工場", "こうば"],
      ["中古", "ちゅうぶる"],
      ["船長", "ふなおさ"],
    ]) {
      const item = words.find((item) => item.expression === expression)!;
      expect(item.acceptedReadings).toEqual([alternative]);
      expect(
        validateAnswer({
          answerKind: "reading",
          answer: alternative!,
          acceptedAnswers: [item.reading, ...item.acceptedReadings!],
        }).accepted,
      ).toBe(true);
    }
    expect(words.find((item) => item.expression === "曜日")?.meanings.en.accepted).toEqual([
      "day of the week",
    ]);
    expect(words.find((item) => item.expression === "走行")?.meanings.en.accepted).not.toContain(
      "running",
    );
    expect(words.find((item) => item.expression === "放送")?.meanings.en.accepted).not.toContain(
      "transmission",
    );
  });
});
