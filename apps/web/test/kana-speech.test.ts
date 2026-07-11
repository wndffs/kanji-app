import { describe, expect, it } from "vitest";

import { buildKanaSpeechText, selectJapaneseVoice } from "../src/lib/kana-speech";

describe("kana speech", () => {
  it("prefers a default Japanese voice with the ja-JP locale", () => {
    const voices = [
      { lang: "en-US", default: true, name: "English" },
      { lang: "ja", default: true, name: "Japanese generic" },
      { lang: "ja_JP", default: true, name: "Japanese Japan" },
    ];

    expect(selectJapaneseVoice(voices)).toEqual(voices[2]);
    expect(selectJapaneseVoice([{ lang: "en-US" }])).toBeNull();
  });

  it("adds audible context to leading sokuon targets", () => {
    expect(buildKanaSpeechText({ character: "っか", variant: "sokuon" })).toBe("かっか");
    expect(buildKanaSpeechText({ character: "ッサ", variant: "sokuon" })).toBe("サッサ");
    expect(buildKanaSpeechText({ character: "きゃ", variant: "yoon" })).toBe("きゃ");
  });
});
