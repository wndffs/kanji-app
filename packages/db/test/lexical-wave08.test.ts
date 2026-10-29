import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { WAVE08_REVIEW_DECISION } from "../src/lexical-wave08-review";
import { buildMainCourseContentBatches, validateMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseContentBatch08 } from "../src/main-course-content-08";
import { buildMainCourseWordBatches, wordHanCharacters } from "../src/main-course-word-content";
import { lexicalPairKey, rankLexicalCandidates, selectLexicalBackbone } from "../src/lexical-selection";
import { WAVE08_CANDIDATES } from "../src/lexical-wave08-candidates";
import { WAVE08_TEACHING } from "../src/lexical-wave08-teaching";
import { WAVE08_RU, WAVE08_EN } from "../src/lexical-wave08-answers";
import { validateCuratedMeaningBlocks } from "../src/curated-meaning-blocks";
import { validateAnswer } from "@kanji-srs/japanese";
import { buildMainCourseWordBatch08 } from "../src/main-course-word-content-08";
import { validateMainCourseWordBatch } from "../src/main-course-word-content";

const oldKanji = () => buildMainCourseContentBatches().filter(x=>x.id!=="task-118-course-kanji-08");
describe("bounded everyday wave08", () => {
  it("binds AI review to the full original teaching payload, not dictionary matching alone",()=>{
    const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
    expect(hash(buildMainCourseContentBatch08())).toBe(WAVE08_REVIEW_DECISION.kanjiSha256);
    expect(hash(buildMainCourseWordBatch08())).toBe(WAVE08_REVIEW_DECISION.wordsSha256);
    expect(WAVE08_REVIEW_DECISION.decision).toBe('approved-ai-editorial');
    expect(WAVE08_REVIEW_DECISION.humanReviewed).toBe(false);
    expect(WAVE08_REVIEW_DECISION.publicationApproved).toBe(false);
  });
  it("selects the declared 10/5/5 quota from thirty candidates without approving publication", () => {
    const levels=new Map([...oldKanji(),buildMainCourseContentBatch08()].flatMap(b=>b.kanji.map(k=>[k.character,k.levelNumber] as const)));
    const verified=WAVE08_CANDIDATES.map((candidate,index)=>({...candidate,sourceRecordId:`jmdict:${index+1}`,matches:1,bilingual:true,sourceRank:["午前","午後","今月","今後"].includes(candidate.expression)?500:1000}));
    const ranked=rankLexicalCandidates(verified,{existingPairs:new Set(),prerequisiteLevels:levels,wordLevel:12});
    const choice=selectLexicalBackbone(ranked.selected);
    expect(new Set(choice.selected.map(lexicalPairKey))).toEqual(new Set(WAVE08_TEACHING.map(lexicalPairKey)));
    expect(choice.deferred).toHaveLength(10);
    expect(choice.publicationApproved).toBe(false);
  });
  it("has complete original bilingual examples with only earlier registered kanji", () => {
    const batch=buildMainCourseWordBatch08();
    expect(validateMainCourseWordBatch(batch)).toEqual([]);
    const levels=new Map([...oldKanji(),buildMainCourseContentBatch08()].flatMap(b=>b.kanji.map(k=>[k.character,k.levelNumber] as const)));
    for(const word of batch.words) for(const character of wordHanCharacters(word.example.japaneseText)) {
      expect(levels.get(character)).toBeDefined();
      expect(levels.get(character)!).toBeLessThan(batch.levelNumber);
    }
  });
  it("aligns English scope with Russian and seals conservative block collisions", () => {
    for(const row of WAVE08_TEACHING) {
      const meaning=WAVE08_EN[row.expression]!;
      expect(meaning.primary).toBe(row.en);
      expect(validateCuratedMeaningBlocks({ru:WAVE08_RU[row.expression]!,en:meaning})).toEqual([]);
      for(const answer of meaning.accepted) expect(validateAnswer({answerKind:"meaning",answer,acceptedAnswers:meaning.accepted,blockedAnswers:meaning.blocked?.map(x=>x.text)}).accepted).toBe(true);
      for(const block of meaning.blocked??[]) expect(validateAnswer({answerKind:"meaning",answer:block.text,acceptedAnswers:[...meaning.accepted,block.text],blockedAnswers:[block.text]}).accepted).toBe(false);
    }
  });
  it("accepts selected Russian aspect equivalents but rejects semantic contrasts even with a private synonym", () => {
    for(const row of WAVE08_TEACHING) {
      const meaning=WAVE08_RU[row.expression]!;
      expect(meaning.primary).toBe(row.ru);
      for(const answer of meaning.accepted) expect(validateAnswer({answerKind:"meaning",answer,acceptedAnswers:meaning.accepted}).accepted).toBe(true);
      for(const block of meaning.blocked??[]) expect(validateAnswer({answerKind:"meaning",answer:block.text,acceptedAnswers:[...meaning.accepted,block.text],blockedAnswers:[block.text]}).accepted).toBe(false);
    }
  });
  it("reuses existing components for the single missing prerequisite without moving old slots", () => {
    const batch=buildMainCourseContentBatch08();
    expect(batch.components).toEqual([]);
    expect(batch.kanji.map(x=>[x.character,x.levelNumber])).toEqual([["前",11]]);
    expect(validateMainCourseContentBatches([...oldKanji(),batch])).toEqual([]);
  });
  it("keeps twenty exact pairs distinct from all earlier teaching words", () => {
    const previous = new Set(buildMainCourseWordBatches().filter(x=>x.id!=="task-127-course-words-08").flatMap(x=>x.words.map(lexicalPairKey)));
    expect(WAVE08_TEACHING).toHaveLength(20);
    expect(new Set(WAVE08_TEACHING.map(lexicalPairKey)).size).toBe(20);
    expect(WAVE08_TEACHING.every(x=>!previous.has(lexicalPairKey(x)))).toBe(true);
    expect(WAVE08_TEACHING.filter(x=>x.partOfSpeech==='verb')).toHaveLength(10);
    expect(WAVE08_TEACHING.filter(x=>x.partOfSpeech==='i-adjective')).toHaveLength(5);
  });
  it("has an earlier registered kanji for every word spelling", () => {
    const levels=new Map([...oldKanji(),buildMainCourseContentBatch08()].flatMap(b=>b.kanji.map(k=>[k.character,k.levelNumber] as const)));
    for(const word of WAVE08_TEACHING) for(const character of wordHanCharacters(word.expression)) {
      expect(levels.get(character)).toBeDefined();
      expect(levels.get(character)!).toBeLessThan(12);
    }
  });
});
