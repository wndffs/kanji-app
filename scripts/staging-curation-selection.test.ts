import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { selectStagingCuration } from "./staging-curation-selection.mjs";

const KANJI = "task-118-foundation-kanji-04";
const WORDS = "task-127-foundation-words-02";

describe("explicit staging curation selection", () => {
  it.each([
    [{}, { applyKanji: true, applyWords: true }],
    [{ WORD_BATCH: WORDS }, { applyKanji: false, applyWords: true }],
    [{ KANJI_BATCH: KANJI }, { applyKanji: true, applyWords: true }],
    [
      { KANJI_BATCH: KANJI, WORD_BATCH: WORDS },
      { applyKanji: true, applyWords: true },
    ],
    [
      { KANJI_BATCH: KANJI, SKIP_WORDS: "true" },
      { applyKanji: true, applyWords: false },
    ],
  ])("preserves defaults and supports an explicit kanji-only selection: %j", (env, expected) => {
    expect(selectStagingCuration(env)).toEqual({
      ...expected,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });
  it("requires an explicit source-supplement opt-in with vocabulary enabled", () => {
    expect(selectStagingCuration({ WORD_BATCH: WORDS, SUPPLEMENT_WORD_SOURCES: "true" })).toEqual({
      applyKanji: false,
      applyWords: true,
      supplementWordSources: true,
      sourceOnly: false,
    });
  });
  it("accepts explicit distinct word selections without also selecting kanji", () => {
    expect(selectStagingCuration({ WORD_BATCH: `${WORDS},task-127-foundation-words-03` })).toEqual({
      applyKanji: false,
      applyWords: true,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });

  it.each([
    { CURATION_MODE: "apply" },
    { CURATION_MODE: "apply", KANJI_BATCH: KANJI },
    { SUPPLEMENT_WORD_SOURCES: "true" },
    { SKIP_WORDS: "true" },
    { CURATION_MODE: "publish" },
    { CURATION_MODE: "apply\nsecret=value" },
    { KANJI_BATCH: KANJI, WORD_BATCH: WORDS, SKIP_WORDS: "true" },
    { KANJI_BATCH: KANJI, SKIP_WORDS: "yes" },
    { KANJI_BATCH: "invalid\napply_words=true" },
    { WORD_BATCH: "../secret" },
    { KANJI_BATCH: `batch-${"x".repeat(80)}` },
    { KANJI_BATCH: KANJI, SKIP_WORDS: "true", SUPPLEMENT_WORD_SOURCES: "true" },
    { SUPPLEMENT_WORD_SOURCES: "yes" },
    { WORD_BATCH: `${WORDS},${WORDS}` },
    { WORD_BATCH: `${WORDS},` },
    { WORD_BATCH: `${WORDS},../secret` },
    { CURATION_MODE: "apply_sources" },
    { CURATION_MODE: "plan_sources", KANJI_BATCH: KANJI, WORD_BATCH: WORDS },
    { CURATION_MODE: "apply_sources", WORD_BATCH: WORDS, SKIP_WORDS: "true" },
    { CURATION_MODE: "apply_sources", WORD_BATCH: WORDS, SUPPLEMENT_WORD_SOURCES: "true" },
    { CURATION_MODE: "apply_sources", WORD_BATCH: WORDS, SOURCE_PAIR_LIMIT: "101" },
    { CURATION_MODE: "plan_sources", WORD_BATCH: WORDS, SOURCE_PAIR_LIMIT: "0" },
    { CURATION_MODE: "plan_sources", WORD_BATCH: WORDS, SOURCE_PAIR_LIMIT: "5.2" },
    { CURATION_MODE: "audit_sources" },
    { CURATION_MODE: "audit_sources", KANJI_BATCH: KANJI, WORD_BATCH: WORDS },
    { CURATION_MODE: "audit_sources", WORD_BATCH: WORDS, SOURCE_PAIR_LIMIT: "20" },
    { CURATION_MODE: "audit_sources", WORD_BATCH: WORDS, SUPPLEMENT_WORD_SOURCES: "true" },
    { CURATION_MODE: "audit_sources", WORD_BATCH: WORDS, STAGE_WORD_PAIRS: "true" },
    { CURATION_MODE: "apply", WORD_BATCH: WORDS, SOURCE_PAIR_LIMIT: "50" },
    { CURATION_MODE: "receipts" },
    { CURATION_MODE: "receipts", KANJI_BATCH: KANJI, SKIP_WORDS: "true" },
    { CURATION_MODE: "receipts", WORD_BATCH: WORDS, SUPPLEMENT_WORD_SOURCES: "true" },
    { CURATION_MODE: "apply", WORD_BATCH: WORDS, STAGE_WORD_PAIRS: "3" },
    { CURATION_MODE: "plan", WORD_BATCH: WORDS, STAGE_WORD_PAIRS: "true" },
    { CURATION_MODE: "apply", KANJI_BATCH: KANJI, WORD_BATCH: WORDS, STAGE_WORD_PAIRS: "true" },
    {
      CURATION_MODE: "apply",
      WORD_BATCH: WORDS,
      SUPPLEMENT_WORD_SOURCES: "true",
      STAGE_WORD_PAIRS: "true",
    },
    { CURATION_MODE: "apply_sources", WORD_BATCH: WORDS, STAGE_WORD_PAIRS: "true" },
    { CURATION_MODE: "plan", KANJI_BATCH: KANJI, SKIP_WORDS: "true", STAGE_KANJI_PAIRS: "true" },
    { CURATION_MODE: "apply", KANJI_BATCH: KANJI, SKIP_WORDS: "true", STAGE_KANJI_PAIRS: "2" },
    { CURATION_MODE: "apply", KANJI_BATCH: KANJI, WORD_BATCH: WORDS, STAGE_KANJI_PAIRS: "true" },
    { CURATION_MODE: "apply", WORD_BATCH: WORDS, STAGE_KANJI_PAIRS: "true" },
    { WORD_BATCH: Array.from({ length: 41 }, (_, i) => `word-${i}`).join(",") },
  ])("fails ambiguous or unsafe input before database work: %j", (env) => {
    expect(() => selectStagingCuration(env)).toThrow("Invalid staging curation selection.");
  });
  it.each([
    [{ WORD_BATCH: WORDS }, { applyKanji: false, applyWords: true }],
    [
      { KANJI_BATCH: KANJI, SKIP_WORDS: "true" },
      { applyKanji: true, applyWords: false },
    ],
    [
      { KANJI_BATCH: KANJI, WORD_BATCH: WORDS },
      { applyKanji: true, applyWords: true },
    ],
  ])("only applies scopes explicitly selected for writes: %j", (env, expected) => {
    expect(selectStagingCuration({ ...env, CURATION_MODE: "apply" })).toEqual({
      ...expected,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });
  it.each([22, 40])("accepts a bounded %s-manifest level-aligned block", (count) => {
    expect(
      selectStagingCuration({
        WORD_BATCH: Array.from({ length: count }, (_, i) => `word-${i}`).join(","),
      }),
    ).toEqual({
      applyKanji: false,
      applyWords: true,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });
  it("allows paired staging only for an explicit word-only apply", () => {
    expect(
      selectStagingCuration({
        CURATION_MODE: "apply",
        WORD_BATCH: WORDS,
        STAGE_WORD_PAIRS: "true",
      }),
    ).toEqual({
      applyKanji: false,
      applyWords: true,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });
  it("allows paired kanji staging only with words and source writes disabled", () => {
    expect(
      selectStagingCuration({
        CURATION_MODE: "apply",
        KANJI_BATCH: KANJI,
        SKIP_WORDS: "true",
        STAGE_KANJI_PAIRS: "true",
      }),
    ).toEqual({
      applyKanji: true,
      applyWords: false,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });
  it.each(["plan_sources", "apply_sources"])("isolates %s from teaching writes", (mode) => {
    expect(
      selectStagingCuration({ CURATION_MODE: mode, WORD_BATCH: WORDS, SOURCE_PAIR_LIMIT: "50" }),
    ).toEqual({
      applyKanji: false,
      applyWords: false,
      supplementWordSources: true,
      sourceOnly: true,
    });
  });
  it("audits only selected source inventory without enabling writes or archives", () => {
    expect(selectStagingCuration({ CURATION_MODE: "audit_sources", WORD_BATCH: WORDS })).toEqual({
      applyKanji: false,
      applyWords: false,
      supplementWordSources: false,
      sourceOnly: true,
    });
  });
  it("reads receipts for explicit reviewed selections without enabling other steps", () => {
    expect(
      selectStagingCuration({ CURATION_MODE: "receipts", KANJI_BATCH: KANJI, WORD_BATCH: WORDS }),
    ).toEqual({
      applyKanji: false,
      applyWords: false,
      supplementWordSources: false,
      sourceOnly: false,
    });
  });
  it("defaults the workflow to read-only and scopes secrets away from installation", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/deploy-staging-curation.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("default: plan");
    expect(workflow).toContain("timeout-minutes: 180");
    expect(workflow.split("    steps:")[0]).not.toContain("secrets.STAGING_DATABASE_URL");
    expect(workflow).not.toContain("db:migrate");
    for (const name of [
      "Apply versioned main-course curation",
      "Apply reviewed vocabulary and original examples",
      "Apply missing reviewed word sources",
    ]) {
      const step = workflow.split(`- name: ${name}`)[1]!.split("\n      - name:")[0]!;
      expect(step).toContain("inputs.mode == 'apply'");
      expect(step).toContain("DATABASE_URL: ${{ secrets.STAGING_DATABASE_URL }}");
    }
    const readOnlyKanji = workflow
      .split("- name: Preflight selected kanji without mutations")[1]!
      .split("\n      - name:")[0]!;
    expect(readOnlyKanji).toContain("inputs.mode == 'plan'");
    expect(readOnlyKanji).toContain("npm run db:curate -- --preflight-only");
    expect(readOnlyKanji).not.toContain("--stage-pairs");
    const applyKanji = workflow
      .split("- name: Apply versioned main-course curation")[1]!
      .split("\n      - name:")[0]!;
    expect(applyKanji).toContain(
      "if [ \"$STAGE_KANJI_PAIRS\" = 'true' ]; then args+=(--stage-pairs); fi",
    );
    const readOnlyWords = workflow
      .split("- name: Preflight reviewed vocabulary without mutations")[1]!
      .split("\n      - name:")[0]!;
    expect(readOnlyWords).toContain("inputs.mode == 'plan'");
    expect(readOnlyWords).toContain("npm run db:curate:words -- --preflight-only");
    expect(readOnlyWords).not.toContain("--stage-pairs");
    const applyWords = workflow
      .split("- name: Apply reviewed vocabulary and original examples")[1]!
      .split("\n      - name:")[0]!;
    expect(applyWords).toContain(
      "if [ \"$STAGE_WORD_PAIRS\" = 'true' ]; then args+=(--stage-pairs); fi",
    );
    const sourceApply = workflow
      .split("- name: Apply missing reviewed word sources")[1]!
      .split("\n      - name:")[0]!;
    expect(sourceApply).toContain("inputs.mode == 'apply_sources'");
    expect(sourceApply).toContain('--max-pairs "$SOURCE_PAIR_LIMIT"');
    expect(workflow).toContain(
      "inputs.mode != 'receipts' && steps.selection.outputs.source_only != 'true'",
    );
    const receiptStep = workflow
      .split("- name: Read selected manifest receipts without mutations")[1]!
      .split("\n      - name:")[0]!;
    expect(receiptStep).toContain("inputs.mode == 'receipts'");
    expect(receiptStep).toContain("|| inputs.mode == 'apply'");
    expect(receiptStep).toContain("args+=(--expect unfinished)");
    expect(receiptStep).toContain('npm run content:receipts -- "${args[@]}"');
    const verifyComplete = workflow
      .split("- name: Verify complete receipts for the selected teaching writes")[1]!
      .split("\n      - name:")[0]!;
    expect(verifyComplete).toContain("inputs.mode == 'apply'");
    expect(verifyComplete).toContain("args=(--expect complete)");
    expect(verifyComplete).toContain('npm run content:receipts -- "${args[@]}"');
    const capture = workflow
      .split("- name: Capture private release preservation baseline")[1]!
      .split("\n      - name:")[0]!;
    expect(capture).toContain("inputs.mode == 'apply'");
    expect(capture).toContain("check-curation-preservation.ts capture");
    const compare = workflow
      .split("- name: Check release preservation and remove private fingerprint baseline")[1]!
      .split("\n      - name:")[0]!;
    expect(compare).toContain(
      "always() && inputs.mode == 'apply' && steps.preservation.outcome == 'success'",
    );
    expect(compare).toContain("check-curation-preservation.ts compare");
    const upload = workflow.split("- name: Upload corpus report")[1]!;
    expect(upload).not.toContain("preservation");
  });

  it("emits only fixed boolean outputs, not batch inputs or unrelated credentials", () => {
    const script = fileURLToPath(new URL("./staging-curation-selection.mjs", import.meta.url));
    const env = {
      ...process.env,
      KANJI_BATCH: KANJI,
      WORD_BATCH: "",
      SKIP_WORDS: "true",
      SUPPLEMENT_WORD_SOURCES: "false",
      SOURCE_PAIR_LIMIT: "100",
      STAGE_WORD_PAIRS: "false",
      STAGE_KANJI_PAIRS: "false",
      CURATION_MODE: "plan",
      DATABASE_URL: "synthetic-private-value",
    };
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 10000,
      env,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "apply_kanji=true\napply_words=false\nsupplement_word_sources=false\nsource_only=false\n",
    );
    expect(result.stderr).toBe("");
    const failure = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 10000,
      env: { ...env, KANJI_BATCH: "" },
    });
    expect(failure.status).toBe(1);
    expect(failure.stdout).toBe("");
    expect(failure.stderr).toBe("Invalid staging curation selection.\n");
  });
});
