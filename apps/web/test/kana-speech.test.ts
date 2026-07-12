import { describe, expect, it } from "vitest";

import { buildKanaSpeechText } from "../src/lib/kana-speech";

describe("kana speech", () => {
  it("adds audible context to leading sokuon targets", () => {
    expect(buildKanaSpeechText({ character: "っか", variant: "sokuon" })).toBe("かっか");
    expect(buildKanaSpeechText({ character: "ッサ", variant: "sokuon" })).toBe("サッサ");
    expect(buildKanaSpeechText({ character: "きゃ", variant: "yoon" })).toBe("きゃ");
  });
});
