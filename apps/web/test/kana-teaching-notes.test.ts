import { describe, expect, it } from "vitest";
import { listKana } from "@kanji-srs/japanese";
import { getKanaTeachingNote } from "../src/lib/kana-teaching-notes";

describe("original kana teaching notes", () => {
  it("covers every supported element in both learning languages", () => {
    for (const script of ["hiragana", "katakana"] as const) {
      for (const item of listKana(script)) {
        expect(getKanaTeachingNote(item).ru.length).toBeGreaterThan(20);
        expect(getKanaTeachingNote(item).en.length).toBeGreaterThan(20);
      }
    }
  });
  it("distinguishes hiragana spelling from the katakana length mark", () => {
    expect(getKanaTeachingNote({ script: "hiragana", variant: "long-vowel" }).en).toContain("えい");
    expect(getKanaTeachingNote({ script: "katakana", variant: "long-vowel" }).en).toContain("ー");
    expect(getKanaTeachingNote({ script: "katakana", variant: "long-vowel" }).en).not.toContain("えい");
  });
});
