import { describe, expect, it, vi } from "vitest";
import { buildMainCourseContentBatches, validateMainCourseContentBatches } from "../src/main-course-content";
import { buildKanjiDraft07 } from "../src/editorial-draft-kanji-07";
import { buildWordDraft07 } from "../src/editorial-draft-words-07";
import { buildMainCourseWordBatches } from "../src/main-course-word-content";
import { inspectEditorialDraftEvidence } from "../src/editorial-draft-evidence";
import { buildEditorialDraftPreview } from "../src/editorial-draft-preview";
import { runEditorialDraftPreview } from "../prisma/preview-editorial-drafts";

describe("isolated editorial drafts", () => {
  it.each(["ru", "en", "ru-en"] as const)("previews %s without inventing approval or dropping prerequisites", (mode) => {
    const report = buildEditorialDraftPreview(mode);
    expect(report.validation).toEqual({ valid: true, issues: [] });
    expect(report.publicationApproved).toBe(false);
    expect(report.words[0]?.requiredKanji).toEqual(expect.arrayContaining(["学", "校", "山", "下"]));
    expect(Object.keys(report.words[0]!.meanings)).toEqual(mode === "ru-en" ? ["ru", "en"] : [mode]);
    expect(report.words.find((word) => word.japanese === "今日")?.reading).toBe("きょう");
  });
  it("rejects missing example prerequisites and invalid CLI flags", () => {
    const draft = buildWordDraft07();
    const first = draft.words[0]!;
    const report = buildEditorialDraftPreview("ru-en", buildKanjiDraft07(), { ...draft,
      words: [{ ...first, example: { ...first.example, japaneseText: "龍です。" } }, ...draft.words.slice(1)] });
    expect(report.validation.issues).toContain("Missing earlier kanji 龍 for 学校:がっこう");
    expect(() => runEditorialDraftPreview(["--apply"])).toThrow("--mode");
  });
  it("reports missing evidence without guessing source IDs or approving a draft", async () => {
    const db = { word: { findMany: vi.fn().mockResolvedValue([]) }, kanji: { findMany: vi.fn().mockResolvedValue([]) } };
    const report = await inspectEditorialDraftEvidence(db as never);
    expect(report.publicationApproved).toBe(false);
    expect(report.kanji).toHaveLength(10);
    expect(report.words).toHaveLength(20);
    expect(report.words.every((word) => word.observedEntryId === null && word.provenance === null)).toBe(true);
    expect(db.word.findMany).toHaveBeenCalledOnce();
    expect(db.kanji.findMany).toHaveBeenCalledOnce();
    expect(db.word.findMany.mock.calls[0]![0].where.OR).toContainEqual({ expression: "何人", reading: "なんにん" });
  });
  it("keeps twenty exact-pair vocabulary proposals with kana and bilingual examples", () => {
    const draft = buildWordDraft07();
    expect(draft.words).toHaveLength(20);
    expect(draft.reviewedAt).toBeNull();
    expect(draft.words.every((word) => word.jmdictEntryId === null)).toBe(true);
    expect(buildMainCourseWordBatches().some((batch) => batch.id === draft.id)).toBe(false);
    expect(draft.words.find((word) => word.expression === "学校")?.reading).toBe("がっこう");
    expect(draft.words.find((word) => word.expression === "今年")?.reading).toBe("ことし");
    expect(draft.words.every((word) => word.example.japaneseText && word.example.readingText && word.example.translationRu && word.example.translationEn)).toBe(true);
  });
  it("keeps ten bilingual kanji and nine components pending outside the curator", () => {
    const draft = buildKanjiDraft07();
    expect(draft.reviewedAt).toBeNull();
    expect(draft.kanji).toHaveLength(10);
    expect(draft.components).toHaveLength(9);
    expect(buildMainCourseContentBatches().some((batch) => batch.id === draft.id)).toBe(false);
    expect(validateMainCourseContentBatches([...buildMainCourseContentBatches(), draft])).toEqual([]);
    expect(draft.kanji.find((item) => item.character === "今")?.reading).toMatchObject({ primary: "こん", accepted: ["こん"] });
    expect(draft.kanji.every((item) => item.meaningMnemonic.ru && item.meaningMnemonic.en && item.readingMnemonic.ru && item.readingMnemonic.en)).toBe(true);
  });
});
