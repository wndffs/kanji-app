import { describe, expect, it } from "vitest";
import { buildDistinctKanaChoices, findKana, listKana, kanaReadingAliases } from "../src";

describe("alias-safe kana contrasts", () => {
  it.each(["が","ぱ","ガ","パ","きゃ","シ","ン"])("retains %s and never offers overlapping accepted sounds", character => {
    const current=findKana(character)!;
    const choices=buildDistinctKanaChoices(listKana(current.script),current,4);
    expect(choices).toContain(current);
    const seen=new Set<string>();
    for(const choice of choices) for(const reading of kanaReadingAliases(choice.character,choice.romaji)) {
      expect(seen.has(reading)).toBe(false); seen.add(reading);
    }
  });
  it.each([["ぱ",["は","ば"]],["パ",["ハ","バ"]],["が",["か"]],["ガ",["カ"]],["シ",["ツ"]]])("prioritizes relevant contrast for %s", (character, contrasts) => {
    const target=findKana(character)!;
    const choices=buildDistinctKanaChoices(listKana(target.script),target,4).map(x=>x.character);
    expect(choices).toEqual(expect.arrayContaining(contrasts));
  });
  it("rejects invalid budgets and filters aliases rather than canonical spelling alone",()=>{
    const current={...findKana("じ")!,romaji:"zi"};
    expect(buildDistinctKanaChoices([current,findKana("ぢ")!,findKana("ず")!],current,4).map(x=>x.character)).toEqual(expect.arrayContaining(["じ","ず"]));
    expect(buildDistinctKanaChoices([current,findKana("ぢ")!],current,4)).toHaveLength(1);
    expect(()=>buildDistinctKanaChoices([current],current,0)).toThrow();
  });
});
