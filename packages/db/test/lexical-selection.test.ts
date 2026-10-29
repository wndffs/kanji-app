import { describe, expect, it } from "vitest";
import { lexicalPairKey, rankLexicalCandidates, type LexicalCandidate } from "../src/lexical-selection";
import { WAVE08_CANDIDATES } from "../src/lexical-wave08-candidates";

const candidate = (change: Partial<LexicalCandidate> = {}): LexicalCandidate => ({
  expression: "読む", reading: "よむ", kind: "verb", usefulness: 3,
  sourceRecordId: "jmdict:1", matches: 1, bilingual: true, sourceRank: 1000, ...change,
});
const options = { existingPairs: new Set<string>(), prerequisiteLevels: new Map([["読", 7]]), wordLevel: 12 };
describe("independent lexical selection", () => {
  it("keeps exact spelling/reading identities separate", () => {
    expect(lexicalPairKey({expression:"何時",reading:"なんじ"})).not.toBe(lexicalPairKey({expression:"何時",reading:"いつ"}));
    expect(new Set(WAVE08_CANDIDATES.map(lexicalPairKey)).size).toBe(30);
  });
  it("ranks deterministically by usefulness then observed source hint", () => {
    const rows = [candidate({reading:"よみ",sourceRank:null}), candidate({sourceRank:500}), candidate({reading:"よめ",usefulness:2})];
    const result = rankLexicalCandidates(rows,options);
    expect(result.selected.map(x=>x.reading)).toEqual(["よむ","よみ","よめ"]);
    expect(rankLexicalCandidates([...rows].reverse(),options).selected).toEqual(result.selected);
    expect(result.publicationApproved).toBe(false);
  });
  it.each([
    [{matches:2},"missing-or-ambiguous-source"], [{bilingual:false},"missing-bilingual-source"],
    [{expression:"来る"},"missing-earlier-kanji"], [{sourceRank:-1},"invalid-metadata"],
    [{reading:"ヨム"},"invalid-metadata"],
  ] as const)("rejects unsupported candidate %j", (change,reason) => {
    expect(rankLexicalCandidates([candidate(change)],options).rejected[0]!.reason).toBe(reason);
  });
  it("rejects both duplicates and already registered exact pairs", () => {
    expect(rankLexicalCandidates([candidate(),candidate()],options).selected).toEqual([]);
    expect(rankLexicalCandidates([candidate()],{...options,existingPairs:new Set([lexicalPairKey(candidate())])}).rejected[0]!.reason).toBe("already-registered");
    expect(rankLexicalCandidates([candidate()],{...options,wordLevel:7}).rejected[0]!.reason).toBe("missing-earlier-kanji");
  });
});
