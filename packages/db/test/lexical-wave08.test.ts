import { describe, expect, it } from "vitest";
import { buildMainCourseContentBatches, validateMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseContentBatch08 } from "../src/main-course-content-08";
import { buildMainCourseWordBatches, wordHanCharacters } from "../src/main-course-word-content";
import { lexicalPairKey } from "../src/lexical-selection";
import { WAVE08_TEACHING } from "../src/lexical-wave08-teaching";

const oldKanji = () => buildMainCourseContentBatches().filter(x=>x.id!=="task-118-course-kanji-08");
describe("bounded everyday wave08", () => {
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
