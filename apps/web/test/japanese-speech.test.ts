import { describe, expect, it } from "vitest";

import {
  getJapaneseVoices,
  normalizeSpeechRate,
  selectJapaneseVoice,
} from "../src/lib/japanese-speech";

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

  it("uses a preferred Japanese voice URI and ignores non-Japanese voices", () => {
    const voices = [
      { lang: "en-US", name: "English", voiceURI: "voice-en" },
      { lang: "ja-JP", name: "Japanese A", voiceURI: "voice-ja-a", default: true },
      { lang: "ja-JP", name: "Japanese B", voiceURI: "voice-ja-b" },
    ];

    expect(selectJapaneseVoice(voices, "voice-ja-b")).toEqual(voices[2]);
    expect(selectJapaneseVoice(voices, "voice-en")).toEqual(voices[1]);
    expect(getJapaneseVoices(voices)).toEqual([voices[1], voices[2]]);
  });

  it("keeps speech rate inside the supported study range", () => {
    expect(normalizeSpeechRate(1.2)).toBe(1.2);
    expect(normalizeSpeechRate(0.4)).toBe(0.8);
    expect(normalizeSpeechRate(Number.NaN)).toBe(0.8);
  });
});
