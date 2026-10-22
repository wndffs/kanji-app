import { describe, expect, it } from "vitest";

import { formatKanjiJlptLevel } from "../src/jlpt";

describe("source-aware kanji JLPT labels", () => {
  it.each([1, 2, 3, 4])("does not turn old level %i into a modern N label", (level) => {
    expect(formatKanjiJlptLevel(null, level)).toBe(`до 2010: ${level}`);
  });
  it.each([1, 2, 3, 4, 5])("preserves independently supplied modern N%i", (level) => {
    expect(formatKanjiJlptLevel(level, 4)).toBe(`N${level}`);
  });
  it.each([undefined, null, 0, 5, -1, 2.5, NaN, Infinity])("rejects invalid legacy %s", (level) => {
    expect(formatKanjiJlptLevel(null, level)).toBeNull();
  });
  it.each([0, 6, -1, 1.5, NaN])("does not invent a label from invalid modern %s", (level) => {
    expect(formatKanjiJlptLevel(level)).toBeNull();
  });
});
