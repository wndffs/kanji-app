import { describe, expect, it } from "vitest";
import { findPronunciationRecording, PRONUNCIATION_RECORDINGS, recordingOrigin } from "../src/pronunciation-recordings";
describe("separate verified human pronunciation registry", () => {
  it("binds exact spelling/reading, not merely a kanji or source title", () => {
    expect(findPronunciationRecording("食べる", "たべる")).not.toBeNull();
    expect(findPronunciationRecording("食", "しょく")).toBeNull();
    expect(findPronunciationRecording("食べる", "たべます")).toBeNull();
    const entry=PRONUNCIATION_RECORDINGS[0];
    expect(entry.checksumSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(entry.attribution).toContain("unmodified");
    expect(entry.licenseUrl).toBe("https://creativecommons.org/licenses/by/4.0/");
  });
  it("does not infer a human voice from a speaker name or unknown metadata", () => {
    expect(recordingOrigin({speaker:"A"})).toBe("unknown");
    expect(recordingOrigin({origin:"synthetic"})).toBe("synthetic");
    expect(recordingOrigin({origin:"human-recording"})).toBe("human-recording");
  });
});
