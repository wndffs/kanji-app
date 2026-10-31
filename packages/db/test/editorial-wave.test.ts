import { describe, expect, it } from "vitest";
import { nextEditorialWave } from "../src/editorial-wave";
import { auditWaveLocale } from "../src/editorial-wave-language";
import { auditWaveReadings } from "../src/editorial-wave-readings";
import { auditWavePlacement } from "../src/editorial-wave-placement";
import { buildEditorialWaveReport } from "../src/editorial-wave-report";

describe("nonpublishing foundation wave", () => {
  it("reports aggregate-only exact volume without changing reviewed coverage or approval", () => {
    const result = buildEditorialWaveReport();
    expect(result).toMatchObject({
      structurallyValid: true,
      readyToPublish: false,
      publicationApproved: false,
      counts: { components: 9, kanji: 10, words: 20, examples: 20, proposedCards: 69 },
      reviewedRegistry: { kanji: 262, words: 260 },
      remainingReviewedContent: { kanji: 2038, words: 7740 },
      checks: {
        placement: {
          unresolvedWordSourceIds: 20,
          outsideCuratorRegistry: true,
          sourceEvidenceVerified: false,
          independentlyReviewed: false,
        },
      },
    });
    expect(JSON.stringify(result)).not.toContain("学校");
    expect(JSON.stringify(result)).not.toContain("jmdictEntryId");
  });
  it.each(["ru", "en"] as const)(
    "rejects missing %s text and accepted answers without primary",
    (locale) => {
      const wave = structuredClone(nextEditorialWave());
      const first = wave.words.words[0]!;
      Object.assign(first.meanings[locale], { primary: "", accepted: [] });
      const result = auditWaveLocale(locale, wave);
      expect(result.valid).toBe(false);
      expect(result.missingFields).toBeGreaterThan(0);
      expect(result.invalidAcceptedSets).toBe(1);
      expect(auditWaveLocale(locale === "ru" ? "en" : "ru", wave).valid).toBe(true);
    },
  );
  it.each(["ru", "en"] as const)(
    "rejects age-erasing meanings and duplicate normalized answers (%s)",
    (locale) => {
      const wave = structuredClone(nextEditorialWave());
      const brother = wave.kanji.kanji.find((item) => item.character === "兄")!;
      Object.assign(brother.meanings[locale], {
        primary: locale === "ru" ? "брат" : "brother",
        accepted: locale === "ru" ? ["брат", "БРАТ"] : ["brother", "BROTHER"],
      });
      expect(auditWaveLocale(locale, wave)).toMatchObject({
        valid: false,
        invalidAcceptedSets: 1,
        semanticContrasts: 1,
      });
    },
  );
  it("rejects swapped locale primary text", () => {
    const wave = structuredClone(nextEditorialWave());
    Object.assign(wave.kanji.kanji[0]!.meanings.en, { primary: "школа", accepted: ["школа"] });
    expect(auditWaveLocale("en", wave).wrongScript).toBe(1);
  });
  it.each(["コウ", "kou", " ", "こう "])("rejects noncanonical primary reading %s", (reading) => {
    const wave = structuredClone(nextEditorialWave());
    Object.assign(wave.kanji.kanji[0]!.reading, { primary: reading });
    expect(auditWaveReadings(wave).valid).toBe(false);
  });
  it("rejects inferred or duplicate reading alternatives and mismatched source spelling", () => {
    const wave = structuredClone(nextEditorialWave());
    Object.assign(wave.kanji.kanji[0]!.reading, { source: "ガク", accepted: ["こう", "こう"] });
    expect(auditWaveReadings(wave)).toMatchObject({
      valid: false,
      invalidAlternatives: 1,
      sourceReadingMismatch: 1,
    });
  });
  it("rejects backward prerequisites, unknown kanji and colliding slots", () => {
    const wave = structuredClone(nextEditorialWave());
    Object.assign(wave.kanji.kanji[0]!, { levelNumber: 8, sortOrder: 1 });
    Object.assign(wave.words.words[0]!, {
      expression: "鬱",
      sortOrder: wave.words.words[1]!.sortOrder,
    });
    expect(auditWavePlacement(wave).valid).toBe(false);
    expect(auditWavePlacement(wave).placementIssueCount).toBeGreaterThan(0);
  });
  it("is deterministic and cannot silently bless self-assigned review metadata", () => {
    const wave = structuredClone(nextEditorialWave());
    Object.assign(wave.kanji, { reviewedAt: "2026-10-28" });
    expect(buildEditorialWaveReport(wave)).toEqual(buildEditorialWaveReport(wave));
    expect(buildEditorialWaveReport(wave).readyToPublish).toBe(false);
    expect(buildEditorialWaveReport(wave).checks.placement.independentlyReviewed).toBe(false);
  });
});
