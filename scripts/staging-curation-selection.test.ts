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
    expect(selectStagingCuration(env)).toEqual({ ...expected, supplementWordSources: false });
  });
  it("requires an explicit source-supplement opt-in with vocabulary enabled", () => {
    expect(selectStagingCuration({ WORD_BATCH: WORDS, SUPPLEMENT_WORD_SOURCES: "true" })).toEqual({
      applyKanji: false,
      applyWords: true,
      supplementWordSources: true,
    });
  });
  it("accepts explicit distinct word selections without also selecting kanji", () => {
    expect(selectStagingCuration({ WORD_BATCH: `${WORDS},task-127-foundation-words-03` })).toEqual({
      applyKanji: false,
      applyWords: true,
      supplementWordSources: false,
    });
  });

  it.each([
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
    { WORD_BATCH: Array.from({ length: 21 }, (_, i) => `word-${i}`).join(",") },
  ])("fails ambiguous or unsafe input before database work: %j", (env) => {
    expect(() => selectStagingCuration(env)).toThrow("Invalid staging curation selection.");
  });
  it("defaults the workflow to read-only and scopes secrets away from installation", () => {
    const workflow = readFileSync(
      new URL("../.github/workflows/deploy-staging-curation.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("default: plan");
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
    expect(workflow).toContain("npm run db:curate -- --preflight-only");
  });

  it("emits only fixed boolean outputs, not batch inputs or unrelated credentials", () => {
    const script = fileURLToPath(new URL("./staging-curation-selection.mjs", import.meta.url));
    const result = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 10000,
      env: {
        ...process.env,
        KANJI_BATCH: KANJI,
        WORD_BATCH: "",
        SKIP_WORDS: "true",
        SUPPLEMENT_WORD_SOURCES: "false",
        DATABASE_URL: "synthetic-private-value",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe(
      "apply_kanji=true\napply_words=false\nsupplement_word_sources=false\n",
    );
    expect(result.stderr).toBe("");
    const failure = spawnSync(process.execPath, [script], {
      encoding: "utf8",
      timeout: 10000,
      env: { ...process.env, KANJI_BATCH: "", WORD_BATCH: "", SKIP_WORDS: "true" },
    });
    expect(failure.status).toBe(1);
    expect(failure.stdout).toBe("");
    expect(failure.stderr).toBe("Invalid staging curation selection.\n");
  });
});
