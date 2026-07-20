import { describe, expect, it } from "vitest";

import { resolveStudyAudioPreferences } from "../src/lib/use-study-audio-preferences";

describe("study audio preferences", () => {
  it("normalizes missing and stale stored settings", () => {
    expect(resolveStudyAudioPreferences(undefined)).toEqual({
      speechVoiceUri: null,
      speechRate: 0.8,
      speechAutoplay: false,
      soundFeedback: false,
    });
    expect(
      resolveStudyAudioPreferences({
        speechVoiceUri: " voice-ja ",
        speechRate: 1.2,
        speechAutoplay: true,
        soundFeedback: true,
      }),
    ).toEqual({
      speechVoiceUri: "voice-ja",
      speechRate: 1.2,
      speechAutoplay: true,
      soundFeedback: true,
    });
  });
});
