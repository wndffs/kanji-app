import { describe, expect, it } from "vitest";
import { buildMainCourseContentBatches, validateMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseContentBatch08 } from "../src/main-course-content-08";
import { buildMainCourseWordBatches, wordHanCharacters } from "../src/main-course-word-content";
import { lexicalPairKey } from "../src/lexical-selection";
import { WAVE08_TEACHING } from "../src/lexical-wave08-teaching";
import { WAVE08_RU, WAVE08_EN } from "../src/lexical-wave08-answers";
import { validateCuratedMeaningBlocks } from "../src/curated-meaning-blocks";
import { validateAnswer } from "@kanji-srs/japanese";

const oldKanji = () => buildMainCourseContentBatches().filter(x=>x.id!=="task-118-course-kanji-08");
describe("bounded everyday wave08", () => {
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
