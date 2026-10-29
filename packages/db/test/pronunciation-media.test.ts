import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRONUNCIATION_RECORDINGS } from "@kanji-srs/shared";
import { verifyPronunciationWav } from "../src/pronunciation-media";
describe("original pinned production recording",()=>{
  it("matches exact bytes, SHA-256 and parsed PCM duration",()=>{
    const entry=PRONUNCIATION_RECORDINGS[0];
    const bytes=readFileSync(new URL(`../../../apps/web/public${entry.publicPath}`,import.meta.url));
    expect(()=>verifyPronunciationWav(bytes,entry)).not.toThrow();
    expect(()=>verifyPronunciationWav(bytes.subarray(0,-1),entry)).toThrow();
  });
});
