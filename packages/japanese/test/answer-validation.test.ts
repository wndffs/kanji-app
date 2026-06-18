import { describe, expect, it } from "vitest";

import {
  answerValidationPackageStatus,
  calculateStringDistance,
  isConservativeTypo,
  isMeaningAccepted,
  isReadingAccepted,
  katakanaToHiragana,
  normalizeEnglishMeaning,
  normalizeJapaneseReading,
  normalizeKana,
  normalizeMeaning,
  normalizeRussianMeaning,
  splitRussianMeaningList,
  validateAnswer,
} from "../src";

describe("answer validation package status", () => {
  it("marks answer validation behavior as implemented", () => {
    expect(answerValidationPackageStatus).toEqual({
      packageName: "@kanji-srs/japanese",
      implemented: true,
    });
  });
});

describe("Japanese reading normalization", () => {
  it("converts katakana to hiragana", () => {
    expect(katakanaToHiragana("アイウエオヴヶ")).toBe("あいうえおゔゖ");
    expect(normalizeKana(" カン ジ ")).toBe("かん じ");
  });

  it("normalizes whitespace for reading comparison", () => {
    expect(normalizeJapaneseReading("　カ ン\tジ\n")).toBe("かんじ");
    expect(
      isReadingAccepted({
        answer: "　カ ン\tジ\n",
        acceptedAnswers: ["かんじ"],
      }),
    ).toBe(true);
  });

  it("supports user private accepted readings", () => {
    const result = validateAnswer({
      answerKind: "reading",
      answer: "じっぷん",
      acceptedAnswers: ["じゅっぷん"],
      userAcceptedAnswers: ["じっぷん"],
    });

    expect(result).toMatchObject({
      accepted: true,
      result: "correct",
      matchSource: "user",
      reason: "user-exact-match",
    });
  });

  it("rejects blocked readings before accepted answers", () => {
    const result = validateAnswer({
      answerKind: "reading",
      answer: "にほん",
      acceptedAnswers: ["にほん"],
      blockedAnswers: ["ニホン"],
    });

    expect(result).toMatchObject({
      accepted: false,
      result: "blocked",
      matchedAnswer: "ニホン",
    });
  });
});

describe("Russian meaning normalization", () => {
  it("normalizes case, punctuation, and whitespace", () => {
    expect(normalizeRussianMeaning("  БОЛЬШОЙ!!\tдом  ")).toBe("большой дом");
  });

  it("normalizes е and ё", () => {
    expect(normalizeRussianMeaning("Ёлка")).toBe("елка");
    expect(isMeaningAccepted({ answer: "елка", acceptedAnswers: ["ёлка"] })).toBe(true);
  });

  it("splits comma and semicolon separated meaning lists", () => {
    expect(splitRussianMeaningList("дом, жилище; хата")).toEqual(["дом", "жилище", "хата"]);
    expect(isMeaningAccepted({ answer: "жилище", acceptedAnswers: ["дом, жилище"] })).toBe(true);
  });

  it("accepts global synonyms", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "жилище",
      acceptedAnswers: ["дом", "жилище"],
    });

    expect(result).toMatchObject({
      accepted: true,
      result: "correct",
      matchedAnswer: "жилище",
      matchSource: "global",
    });
  });

  it("accepts user private meanings", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "хата",
      acceptedAnswers: ["дом"],
      userAcceptedAnswers: ["хата"],
    });

    expect(result).toMatchObject({
      accepted: true,
      result: "correct",
      matchedAnswer: "хата",
      matchSource: "user",
      reason: "user-exact-match",
    });
  });

  it("rejects blocked meanings before exact or fuzzy acceptance", () => {
    const exactBlocked = validateAnswer({
      answerKind: "meaning",
      answer: "дом",
      acceptedAnswers: ["дом"],
      blockedAnswers: ["дом"],
    });
    const typoBlocked = validateAnswer({
      answerKind: "meaning",
      answer: "электричетво",
      acceptedAnswers: ["электричество"],
      blockedAnswers: ["электричетво"],
    });

    expect(exactBlocked).toMatchObject({
      accepted: false,
      result: "blocked",
      matchedAnswer: "дом",
    });
    expect(typoBlocked).toMatchObject({
      accepted: false,
      result: "blocked",
      matchedAnswer: "электричетво",
    });
  });
});

describe("English meaning normalization", () => {
  it("normalizes case, punctuation, and whitespace", () => {
    expect(normalizeEnglishMeaning("  Big... HOUSE!! ")).toBe("big house");
    expect(normalizeMeaning("SCHOOL", "en-US")).toBe("school");
  });

  it("accepts English user private meanings", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "single stroke",
      acceptedAnswers: ["one"],
      userAcceptedAnswers: ["single stroke"],
    });

    expect(result).toMatchObject({
      accepted: true,
      result: "correct",
      matchedAnswer: "single stroke",
      matchSource: "user",
      reason: "user-exact-match",
    });
  });

  it("rejects global blocked answers before exact private answers", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "line",
      acceptedAnswers: ["one"],
      userAcceptedAnswers: ["line"],
      blockedAnswers: ["line"],
    });

    expect(result).toMatchObject({
      accepted: false,
      result: "blocked",
      matchedAnswer: "line",
    });
  });
});

describe("conservative typo handling", () => {
  it("calculates string distance", () => {
    expect(calculateStringDistance("кот", "кит")).toBe(1);
    expect(calculateStringDistance("электричество", "электричетво")).toBe(1);
  });

  it("accepts conservative typos for long meanings", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "электричетво",
      acceptedAnswers: ["электричество"],
    });

    expect(result).toMatchObject({
      accepted: true,
      result: "typo",
      matchedAnswer: "электричество",
      distance: 1,
      reason: "conservative-typo",
    });
  });

  it("rejects typos for short or ambiguous meanings", () => {
    expect(isConservativeTypo("дым", "дом")).toBe(false);

    const result = validateAnswer({
      answerKind: "meaning",
      answer: "дым",
      acceptedAnswers: ["дом"],
    });

    expect(result).toMatchObject({
      accepted: false,
      result: "wrong",
      matchedAnswer: null,
    });
  });

  it("can disable typo tolerance", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "электричетво",
      acceptedAnswers: ["электричество"],
      typoTolerance: {
        enabled: false,
      },
    });

    expect(result.accepted).toBe(false);
    expect(result.result).toBe("wrong");
  });
});

describe("validateAnswer", () => {
  it("validates reading and meaning cards through one API", () => {
    const reading = validateAnswer({
      answerKind: "reading",
      answer: "ガク",
      acceptedAnswers: ["がく"],
    });
    const meaning = validateAnswer({
      answerKind: "meaning",
      answer: "учеба",
      acceptedAnswers: ["учёба"],
    });

    expect(reading).toMatchObject({
      answerKind: "reading",
      accepted: true,
      normalizedAnswer: "がく",
    });
    expect(meaning).toMatchObject({
      answerKind: "meaning",
      accepted: true,
      normalizedAnswer: "учеба",
    });
  });

  it("rejects wrong meanings", () => {
    const result = validateAnswer({
      answerKind: "meaning",
      answer: "река",
      acceptedAnswers: ["дом"],
    });

    expect(result).toMatchObject({
      accepted: false,
      result: "wrong",
      reason: "no-match",
    });
  });
});
