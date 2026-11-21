import { describe, expect, it } from "vitest";
import { matchesAuthoredExampleReading } from "../src/curated-example-reading";

describe("authored example kana alignment", () => {
  it("anchors a whole-word reading and retains okurigana, particles and punctuation", () => {
    expect(
      matchesAuthoredExampleReading(
        "温泉",
        "おんせん",
        "旅行で温泉に入った。",
        "りょこうでおんせんにはいった。",
      ),
    ).toBe(true);
    expect(
      matchesAuthoredExampleReading(
        "温泉",
        "おんせん",
        "旅行で温泉に入った。",
        "りょこうでおんせんにはいた。",
      ),
    ).toBe(false);
    expect(
      matchesAuthoredExampleReading(
        "温泉",
        "おんせん",
        "旅行で温泉に入った。",
        "りょこうでおんせんをはいった。",
      ),
    ).toBe(false);
  });

  it("does not accept the target kana in an unrelated part of the sentence", () => {
    expect(
      matchesAuthoredExampleReading("線", "せん", "前で線を見た。", "せんであとをみた。"),
    ).toBe(false);
    expect(matchesAuthoredExampleReading("線", "せん", "線と線。", "せんとせん。")).toBe(true);
  });

  it("normalizes katakana and spacing without treating punctuation as unknown kana", () => {
    expect(
      matchesAuthoredExampleReading(
        "注文",
        "ちゅうもん",
        "ケーキを注文した。",
        "けーきを ちゅうもんした。",
      ),
    ).toBe(true);
    expect(
      matchesAuthoredExampleReading(
        "注文",
        "ちゅうもん",
        "ケーキを注文した。",
        "けーきをちゅうもんした！",
      ),
    ).toBe(false);
    expect(
      matchesAuthoredExampleReading("注文", "ちゅうもん", "本を注文した。", "をちゅうもんした。"),
    ).toBe(false);
  });
});
