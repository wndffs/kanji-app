import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { validateAnswer } from "@kanji-srs/japanese";
import { buildMainCourseContentBatches, validateMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseContentBatch09 } from "../src/main-course-content-09";
import { buildMainCourseWordBatch09 } from "../src/main-course-word-content-09";
import { buildMainCourseWordBatches, validateMainCourseWordBatch, wordHanCharacters } from "../src/main-course-word-content";
import { WAVE09_CANDIDATES } from "../src/lexical-wave09-candidates";
import { WAVE09_TEACHING } from "../src/lexical-wave09-teaching";
import { WAVE09_REVIEW_DECISION } from "../src/lexical-wave09-review";
import { lexicalPairKey, rankLexicalCandidates } from "../src/lexical-selection";
import { validateCuratedMeaningBlocks } from "../src/curated-meaning-blocks";

const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
describe("reviewed everyday wave09", () => {
  it("seals exact candidates and complete AI-reviewed teaching without implying human/publication approval", () => {
    expect(hash(WAVE09_CANDIDATES)).toBe(WAVE09_REVIEW_DECISION.candidateFingerprint);
    expect(hash(buildMainCourseContentBatch09())).toBe(WAVE09_REVIEW_DECISION.kanjiSha256);
    expect(hash(buildMainCourseWordBatch09())).toBe(WAVE09_REVIEW_DECISION.wordsSha256);
    expect(WAVE09_REVIEW_DECISION).toMatchObject({ decision: "approved-ai-editorial", humanReviewed: false, publicationApproved: false });
  });
  it("adds twenty exact pairs only after all earlier prerequisites", () => {
    const kanji = buildMainCourseContentBatches();
    const words = buildMainCourseWordBatches();
    expect(validateMainCourseContentBatches(kanji)).toEqual([]);
    const previous = new Set(words.filter(b => b.id !== "task-127-course-words-09").flatMap(b => b.words.map(lexicalPairKey)));
    const levels = new Map(kanji.flatMap(b => b.kanji.map(k => [k.character, k.levelNumber] as const)));
    const ranked = rankLexicalCandidates(WAVE09_CANDIDATES.map((candidate, index) => ({ ...candidate, sourceRecordId: WAVE09_TEACHING[index]!.jmdictEntryId, matches: 1, bilingual: true, sourceRank: 1000 })), { existingPairs: previous, prerequisiteLevels: levels, wordLevel: 15 });
    expect(ranked.rejected).toEqual([]);
    expect(new Set(ranked.selected.map(lexicalPairKey))).toEqual(new Set(WAVE09_TEACHING.map(lexicalPairKey)));
    expect(ranked.publicationApproved).toBe(false);
    expect(WAVE09_TEACHING.filter(x=>x.partOfSpeech === "verb")).toHaveLength(8);
    expect(WAVE09_TEACHING.filter(x=>x.partOfSpeech === "i-adjective")).toHaveLength(3);
    expect(WAVE09_TEACHING.filter(x=>x.partOfSpeech === "noun")).toHaveLength(9);
    expect(validateMainCourseWordBatch(buildMainCourseWordBatch09())).toEqual([]);
    for (const word of buildMainCourseWordBatch09().words)
      for (const char of wordHanCharacters(word.expression + word.example.japaneseText)) {
        expect(levels.get(char)).toBeDefined();
        expect(levels.get(char)!).toBeLessThan(15);
      }
  });
  it.each(buildMainCourseWordBatch09().words)("accepts taught answers and rejects semantic blocks for $expression", word => {
    expect(validateCuratedMeaningBlocks(word.meanings)).toEqual([]);
    for (const [locale, meaning] of Object.entries(word.meanings)) {
      for (const answer of meaning.accepted)
        expect(validateAnswer({ answerKind: "meaning", answer, locale: locale === "ru" ? "ru-RU" : "en-US", acceptedAnswers: meaning.accepted }).accepted).toBe(true);
      for (const block of meaning.blocked ?? [])
        expect(validateAnswer({ answerKind: "meaning", answer: block.text, acceptedAnswers: [...meaning.accepted, block.text], blockedAnswers: [block.text] }).accepted).toBe(false);
    }
    expect(validateAnswer({ answerKind: "reading", answer: word.reading, acceptedAnswers: [word.reading] }).accepted).toBe(true);
  });
  it.each([["作", "作る", "сознавать"], ["帰", "帰る", "возвращать"]])("prevents fuzzy semantic collisions for %s and %s", (character, expression, answer) => {
    const targets = [buildMainCourseContentBatch09().kanji.find(k=>k.character===character)!, buildMainCourseWordBatch09().words.find(w=>w.expression===expression)!];
    for (const target of targets) {
      const meaning = target.meanings.ru;
      expect(validateAnswer({ answerKind: "meaning", answer, acceptedAnswers: [...meaning.accepted, answer], blockedAnswers: meaning.blocked?.map(b=>b.text) }).accepted).toBe(false);
    }
  });
  it.each([["帰る", "возвращать домой"], ["今月", "в том месяце"]])("rejects near but different senses for %s", (expression, answer) => {
    const meaning = buildMainCourseWordBatch09().words.find(w=>w.expression===expression)!.meanings.ru;
    expect(validateAnswer({answerKind:"meaning", answer, acceptedAnswers: [...meaning.accepted, answer], blockedAnswers: meaning.blocked?.map(x=>x.text)}).accepted).toBe(false);
  });
  it.each([["休む", "делать перерыв"], ["作る", "готовить"], ["分かる", "становиться понятным"]])("accepts the promised Russian scope for %s", (expression, answer) => {
    const meaning = buildMainCourseWordBatch09().words.find(w=>w.expression===expression)!.meanings.ru;
    expect(validateAnswer({answerKind:"meaning", answer, acceptedAnswers: meaning.accepted}).accepted).toBe(true);
  });
});
