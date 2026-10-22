import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
    expect(selectStagingCuration(env)).toEqual(expected);
  });

  it.each([
    { SKIP_WORDS: "true" },
    { KANJI_BATCH: KANJI, WORD_BATCH: WORDS, SKIP_WORDS: "true" },
    { KANJI_BATCH: KANJI, SKIP_WORDS: "yes" },
    { KANJI_BATCH: "invalid\napply_words=true" },
    { WORD_BATCH: "../secret" },
    { KANJI_BATCH: `batch-${"x".repeat(80)}` },
  ])("fails ambiguous or unsafe input before database work: %j", (env) => {
    expect(() => selectStagingCuration(env)).toThrow("Invalid staging curation selection.");
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
        DATABASE_URL: "synthetic-private-value",
      },
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toBe("apply_kanji=true\napply_words=false\n");
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
