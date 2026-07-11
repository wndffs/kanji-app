import { describe, expect, it } from "vitest";

import {
  buildKanjiVgFileName,
  buildKanjiVgSourceUrl,
  canTraceKana,
  isTraceStrokeAccepted,
} from "../src/lib/kana-tracing";

describe("kana tracing", () => {
  it("builds pinned KanjiVG URLs only for single kana characters", () => {
    expect(canTraceKana("あ")).toBe(true);
    expect(canTraceKana("ア")).toBe(true);
    expect(canTraceKana("きゃ")).toBe(false);
    expect(canTraceKana("一")).toBe(false);
    expect(buildKanjiVgFileName("あ")).toBe("03042.svg");
    expect(buildKanjiVgSourceUrl("ア")).toContain("r20250816/kanji/030a2.svg");
    expect(buildKanjiVgSourceUrl("おう")).toBeNull();
  });

  it("accepts a close forward trace and rejects reversed or distant strokes", () => {
    const guide = [
      { x: 10, y: 10 },
      { x: 30, y: 20 },
      { x: 50, y: 30 },
      { x: 70, y: 40 },
    ];
    const close = [
      { x: 11, y: 9 },
      { x: 29, y: 21 },
      { x: 51, y: 29 },
      { x: 69, y: 41 },
    ];

    expect(isTraceStrokeAccepted(close, guide)).toBe(true);
    expect(isTraceStrokeAccepted([...close].reverse(), guide)).toBe(false);
    expect(
      isTraceStrokeAccepted(
        close.map((point) => ({ x: point.x, y: point.y + 30 })),
        guide,
      ),
    ).toBe(false);
  });
});
