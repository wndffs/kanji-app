import { describe, expect, it } from "vitest";

import {
  primaryTaughtReadingCards,
  resolvePrimaryTaughtReading,
  type PrimaryTaughtReadingCard,
} from "../src/taught-reading";

const reading = (text: string): PrimaryTaughtReadingCard => ({
  answerType: "READING",
  promptType: "READING",
  answers: [{ text, locale: "ja-JP", answerKind: "READING", isPrimary: true }],
});

describe("primary taught reading", () => {
  it("uses the global taught primary rather than reordering dictionary evidence", () => {
    const evidence = ["ベイ", "マイ", "こめ"];
    const cards = [reading("こめ")];
    const before = structuredClone(cards);
    expect(resolvePrimaryTaughtReading(cards, evidence[0]!)).toBe("こめ");
    expect(cards).toEqual(before);
    expect(evidence).toEqual(["ベイ", "マイ", "こめ"]);
  });

  it.each([
    undefined,
    [],
    [{ ...reading("べい"), answers: [] }],
    [reading("  ")],
    [{ ...reading("こめ"), answerType: "MEANING" }],
    [{ ...reading("こめ"), promptType: "LISTENING" }],
    [
      {
        ...reading("こめ"),
        answers: [{ text: "rice", locale: "en-US", answerKind: "READING", isPrimary: true }],
      },
    ],
    [
      {
        ...reading("こめ"),
        answers: [{ text: "米", locale: "ja-JP", answerKind: "MEANING", isPrimary: true }],
      },
    ],
    [
      {
        ...reading("こめ"),
        answers: [{ text: "べい", locale: "ja-JP", answerKind: "READING", isPrimary: false }],
      },
    ],
  ])("falls back when there is no eligible taught primary (%#)", (cards) => {
    expect(resolvePrimaryTaughtReading(cards, "ベイ")).toBe("ベイ");
    expect(resolvePrimaryTaughtReading(cards, null)).toBeNull();
  });

  it("ignores private overrides and listening answers instead of changing the taught reading", () => {
    const cards = [
      { ...reading("ひ"), promptType: "LISTENING" },
      { ...reading("こめ"), userOverrides: [{ text: "private" }] },
    ];
    expect(resolvePrimaryTaughtReading(cards, "ベイ")).toBe("こめ");
  });

  it("selects only global Japanese primary reading answers without extra item queries", () => {
    expect(primaryTaughtReadingCards).toEqual({
      where: { answerType: "READING", promptType: { not: "LISTENING" } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        answerType: true,
        promptType: true,
        answers: {
          where: { answerKind: "READING", locale: "ja-JP", isPrimary: true },
          orderBy: { text: "asc" },
          select: { text: true, locale: true, answerKind: true, isPrimary: true },
        },
      },
    });
  });
});
