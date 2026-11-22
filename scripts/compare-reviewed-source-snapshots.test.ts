import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  compareReviewedSourceObservations,
  reviewedLexicalFingerprint,
} from "./compare-reviewed-source-snapshots.mts";

const word = { expression: "仮", reading: "かり", jmdictEntryId: "jmdict:1" };
const senses = [
  { locale: "en-US", meaning: "temporary", partOfSpeech: "noun", sourceKind: "IMPORTED" },
  { locale: "ru-RU", meaning: "временный", partOfSpeech: "noun", sourceKind: "IMPORTED" },
] as const;
const observation = {
  ...word,
  matches: 1,
  sourceRecordId: word.jmdictEntryId,
  sequence: "1",
  bilingual: true,
  status: "matched",
  lexical: { commonnessRank: 1, senses },
};

describe("reviewed JMdict snapshot comparison", () => {
  it("does not expose glosses and ignores sense order and ranking changes", () => {
    const next = {
      ...observation,
      lexical: { commonnessRank: 2, senses: [senses[1], senses[0], senses[0]] },
    };
    const first = reviewedLexicalFingerprint([word], [observation]);
    expect(first.lexicalSha256).toMatch(/^[a-f0-9]{64}$/u);
    expect(reviewedLexicalFingerprint([word], [next])).toEqual(first);
    expect(compareReviewedSourceObservations([word], [observation], [next]).pairs).toMatchObject({
      unchanged: 1,
      changedRank: 1,
    });
    expect(JSON.stringify(first)).not.toContain(senses[0].meaning);
  });

  it("reports changed sense scope and refuses missing, mismatched, or monolingual pairs", () => {
    const next = {
      ...observation,
      lexical: { commonnessRank: 1, senses: [{ ...senses[0], meaning: "different" }, senses[1]] },
    };
    expect(
      compareReviewedSourceObservations([word], [observation], [next]).pairs.changedGlosses,
    ).toBe(1);
    expect(reviewedLexicalFingerprint([word], [next]).lexicalSha256).not.toBe(
      reviewedLexicalFingerprint([word], [observation]).lexicalSha256,
    );
    for (const item of [
      { ...observation, sourceRecordId: "jmdict:2" },
      { ...observation, reading: "か" },
      { ...observation, bilingual: false },
      { ...observation, status: "ambiguous" },
    ])
      expect(reviewedLexicalFingerprint([word], [item])).toEqual({
        pairs: 1,
        missingOrChangedIdentity: 1,
        lexicalSha256: null,
      });
    expect(() => reviewedLexicalFingerprint([word], [])).toThrow("incomplete");
  });

  it("does not permit the evidence workflow to use database secrets or upload source assets", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/audit-reviewed-source-refresh.yml", import.meta.url),
      "utf8",
    );
    for (const forbidden of ["DATABASE_URL", "secrets.", "upload-artifact", "--apply"])
      expect(workflow).not.toContain(forbidden);
    expect(workflow).toContain("$RUNNER_TEMP/reviewed-source-refresh");
  });
});
