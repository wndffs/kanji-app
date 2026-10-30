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
  buildMainCourseCompletionDraft,
  COMPLETION_KANJI_TEACHING,
} from "../src/main-course-completion-content";

const base = buildMainCourseContentBatches();
const makeDraft = () => buildMainCourseCompletionDraft(base.flatMap((batch) => batch.components));

describe("single full-course completion content block", () => {
  it("exposes the draft through the existing inventory without inflating reviewed or published counts", () => {
    const result = runEditorialRegistryInventory(["--json", "--include-completion-draft"]);
    const report = JSON.parse(result.stdout);
    expect(result.exitCode).toBe(0);
    expect(report.validation.valid).toBe(true);
    expect(report.prepared.distinctTotals.kanji).toBe(262);
    expect(report.prepared.reviewedDistinctTotals.kanji).toBe(117);
    expect(report.prepared.pendingReviewDistinctTotals.kanji).toBe(145);
    expect(report.prepared.distinctTotals.words).toBe(180);
    expect(report.countSemantics).toContain("not");
  });
  it("adds a substantial independent block without changing or registering old course content", () => {
    const before = createHash("sha256").update(JSON.stringify(base)).digest("hex");
    const draft = makeDraft();
    expect(draft.kanji).toHaveLength(145);
    expect(draft.components).toHaveLength(38);
    expect(new Set(draft.kanji.map((item) => item.character)).size).toBe(145);
    const prior = new Set(base.flatMap((batch) => batch.kanji.map((item) => item.character)));
    expect(draft.kanji.every((item) => !prior.has(item.character))).toBe(true);
    expect(new Set(COMPLETION_KANJI_TEACHING.map((row) => `${row[7]}:${row[8]}`)).size).toBe(133);
    expect(createHash("sha256").update(JSON.stringify(base)).digest("hex")).toBe(before);
    expect(base.some((batch) => batch.id === draft.id)).toBe(false);
    expect(draft.reviewedAt).toBeNull();
    expect(draft.reviewNotes).toContain("Pending");
  });
  it("reuses the real registry validator and earlier component constraints", () => {
    const draft = makeDraft();
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
    const byCharacter = new Map(makeDraft().kanji.map((item) => [item.character, item]));
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
    expect(() => buildMainCourseCompletionDraft([])).toThrow("Missing component");
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
  ] as const)(
    "rejects semantically different %s %s near-answer %s",
    (character, locale, answer) => {
      const meanings = makeDraft().kanji.find((item) => item.character === character)!.meanings[
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
    const draft = makeDraft();
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
});
