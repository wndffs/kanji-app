import { describe, expect, it } from "vitest";

import { selectJapaneseVoice } from "../src/lib/japanese-speech";

describe("Japanese speech", () => {
  it("prefers a default Japanese voice with the ja-JP locale", () => {
    const voices = [
      { lang: "en-US", default: true, name: "English" },
      { lang: "ja", default: true, name: "Japanese generic" },
      { lang: "ja_JP", default: true, name: "Japanese Japan" },
    ];

    expect(selectJapaneseVoice(voices)).toEqual(voices[2]);
    expect(selectJapaneseVoice([{ lang: "en-US" }])).toBeNull();
  });
});
