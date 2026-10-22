import { describe, expect, it } from "vitest";
import { CONTENT_QUALITY_ISSUE_CODES, type ContentQualityIssueCode } from "@kanji-srs/shared";
import {
  normalizeQualityAnswer,
  validateQualityItem,
  type QualityItem,
} from "../src/content-quality";

function validItem(): QualityItem {
  return {
    id: "kanji-sun",
    kind: "KANJI",
    targetType: "KANJI",
    band: "FOUNDATION",
    targetExists: true,
    source: {
      sourceRecordId: "sun",
      checksumSha256: "a".repeat(64),
      status: "SUCCESS",
      sourceVersion: "2026-10-21",
      sourceUrl: "https://example.org/dictionary",
      licenseName: "CC-BY-SA-4.0",
      attributionText: "Dictionary authors",
    },
    sourceReadings: ["ニチ"],
    requiresImportedSource: true,
    hasStrokes: true,
    hasPartOfSpeech: false,
    hasExample: false,
    cards: [
      {
        id: "meaning",
        promptType: "MEANING",
        answerType: "MEANING",
        locale: "ru-RU",
        answers: [
          {
            text: "солнце",
            normalizedText: "солнце",
            locale: "ru-RU",
            isPrimary: true,
            sourceKind: "PROJECT_AUTHORED",
          },
          {
            text: "sun",
            normalizedText: "sun",
            locale: "en-US",
            isPrimary: true,
            sourceKind: "PROJECT_AUTHORED",
          },
        ],
        blockedAnswers: [],
      },
      {
        id: "reading",
        promptType: "READING",
        answerType: "READING",
        locale: "ru-RU",
        answers: [
          {
            text: "にち",
            normalizedText: "にち",
            locale: "ru-RU",
            isPrimary: true,
            sourceKind: "PROJECT_AUTHORED",
          },
        ],
        blockedAnswers: [],
      },
    ],
    mnemonics: [
      {
        locale: "ru-RU",
        body: "Светлый круг солнца внутри рамки.",
        sourceKind: "PROJECT_AUTHORED",
      },
      { locale: "en-US", body: "A bright sun inside a frame.", sourceKind: "PROJECT_AUTHORED" },
    ],
    placements: [{ levelNumber: 2, sortOrder: 1, band: "FOUNDATION" }],
    hasPrerequisiteCycle: false,
    requiredPrerequisiteTargetIds: ["component-frame"],
    dependencies: [
      {
        id: "frame",
        targetId: "component-frame",
        kind: "COMPONENT",
        status: "PUBLISHED",
        requiredStage: 5,
        placements: [{ levelNumber: 1, sortOrder: 1, band: "FOUNDATION" }],
      },
    ],
  };
}

const invalid: Record<ContentQualityIssueCode, (item: QualityItem) => QualityItem> = {
  "missing-target": (i) => ({ ...i, targetExists: false }),
  "missing-card": (i) => ({ ...i, cards: [] }),
  "empty-answer": (i) => ({ ...i, cards: [{ ...i.cards[0], answers: [] }] }),
  "invalid-normalization": (i) => ({
    ...i,
    cards: [
      { ...i.cards[0], answers: i.cards[0].answers.map((a) => ({ ...a, normalizedText: "bad" })) },
    ],
  }),
  "duplicate-answer": (i) => ({
    ...i,
    cards: [{ ...i.cards[0], answers: [...i.cards[0].answers, i.cards[0].answers[0]] }],
  }),
  "primary-answer-count": (i) => ({
    ...i,
    cards: [
      { ...i.cards[0], answers: i.cards[0].answers.map((a) => ({ ...a, isPrimary: false })) },
    ],
  }),
  "unsupported-locale": (i) => ({
    ...i,
    mnemonics: [...i.mnemonics, { locale: "de-DE", body: "Sonne", sourceKind: "PROJECT_AUTHORED" }],
  }),
  "blocked-answer-collision": (i) => ({
    ...i,
    cards: [{ ...i.cards[0], blockedAnswers: [{ text: "СОЛНЦЕ!", normalizedText: "солнце" }] }],
  }),
  "unsupported-reading": (i) => ({ ...i, sourceReadings: ["ゲツ"] }),
  "missing-source": (i) => ({ ...i, source: null }),
  "invalid-source": (i) => ({ ...i, source: { ...i.source!, checksumSha256: "unknown" } }),
  "unreviewed-content": (i) => ({
    ...i,
    cards: [
      { ...i.cards[0], answers: i.cards[0].answers.map((a) => ({ ...a, sourceKind: "IMPORTED" })) },
    ],
  }),
  "missing-mnemonic": (i) => ({ ...i, mnemonics: [] }),
  "placeholder-content": (i) => ({
    ...i,
    mnemonics: i.mnemonics.map((m) => ({ ...m, body: "TODO: write later" })),
  }),
  "missing-strokes": (i) => ({ ...i, hasStrokes: false }),
  "missing-prerequisite": (i) => ({ ...i, dependencies: [] }),
  "invalid-prerequisite": (i) => ({
    ...i,
    dependencies: i.dependencies.map((d) => ({ ...d, status: "DRAFT" })),
  }),
  "prerequisite-cycle": (i) => ({ ...i, hasPrerequisiteCycle: true }),
  "invalid-placement": (i) => ({
    ...i,
    placements: [{ levelNumber: 44, sortOrder: 1, band: "N2" }],
  }),
  "missing-word-evidence": (i) => ({
    ...i,
    kind: "WORD",
    targetType: "WORD",
    hasPartOfSpeech: false,
  }),
  "invalid-media": (i) => ({
    ...i,
    cards: [{ ...i.cards[1], promptType: "LISTENING", audioValid: false }],
  }),
  "missing-example": (i) => ({ ...i, kind: "WORD", targetType: "WORD", hasPartOfSpeech: true }),
};

describe("shared course-content quality rules", () => {
  it("blocks a bad published word example even alongside a valid example", () => {
    const issues = validateQualityItem({
      ...validItem(),
      kind: "WORD",
      targetType: "WORD",
      hasExample: true,
      exampleEvidence: { hasExample: true, invalidExampleCount: 1, fingerprint: "mixed" },
    });
    expect(issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-source",
        severity: "blocker",
        message: expect.stringContaining("пример"),
      }),
    );
    expect(issues.some((issue) => issue.code === "missing-example")).toBe(false);
  });
  it("rejects prerequisites with a stage absent from the configured SRS system", () => {
    expect(validateQualityItem({ ...validItem(), validStageIndices: [1, 2, 3] })).toContainEqual(
      expect.objectContaining({ code: "invalid-prerequisite" }),
    );
  });
  it("accepts an attributed bilingual prerequisite-safe item", () =>
    expect(validateQualityItem(validItem())).toEqual([]));
  it.each(CONTENT_QUALITY_ISSUE_CODES)("detects %s in a broken fixture", (code) => {
    expect(validateQualityItem(invalid[code](validItem()))).toContainEqual(
      expect.objectContaining({
        code,
        learningItemId: "kanji-sun",
        remediation: expect.any(String),
      }),
    );
  });
  it("uses the existing normalization and the actual 60-level blueprint", () => {
    expect(normalizeQualityAnswer(" ЁЛКА! ", "MEANING", "ru-RU")).toBe("елка");
    expect(normalizeQualityAnswer(" ニチ ", "READING", "en-US")).toBe("にち");
    expect(
      validateQualityItem({
        ...validItem(),
        band: "N4",
        placements: [{ levelNumber: 27, sortOrder: 1, band: "N4" }],
      }).filter((i) => i.code === "invalid-placement"),
    ).toEqual([]);
  });
});
