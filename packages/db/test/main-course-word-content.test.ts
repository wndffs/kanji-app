import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { buildMainCourseContentBatches } from "../src/main-course-content";
import {
  buildMainCourseWordBatch,
  mainCourseWordBatchChecksum,
  validateMainCourseWordBatch,
  wordHanCharacters,
} from "../src/main-course-word-content";

describe("first bounded main-course vocabulary manifest", () => {
  it("pins the independently reviewed manifest and exact twenty verified identities", () => {
    const batch = buildMainCourseWordBatch();
    expect(validateMainCourseWordBatch(batch)).toEqual([]);
    expect(batch).toMatchObject({
      id: "task-127-foundation-words-01",
      version: "1",
      reviewedAt: "2026-10-22",
      levelNumber: 5,
    });
    expect(batch.reviewNotes).toContain("Independently reviewed and corrected by the parent agent");
    expect(mainCourseWordBatchChecksum(batch)).toBe(
      "1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf",
    );
    expect(batch.words.map((word) => [word.expression, word.reading, word.jmdictEntryId])).toEqual([
      ["山", "やま", "jmdict:1302680"],
      ["川", "かわ", "jmdict:1390020"],
      ["水", "みず", "jmdict:1371260"],
      ["火", "ひ", "jmdict:1193610"],
      ["木", "き", "jmdict:1534520"],
      ["石", "いし", "jmdict:1382440"],
      ["土", "つち", "jmdict:1445270"],
      ["金", "かね", "jmdict:1242590"],
      ["女", "おんな", "jmdict:1344930"],
      ["男", "おとこ", "jmdict:1419990"],
      ["子", "こ", "jmdict:1307770"],
      ["田", "た", "jmdict:1442730"],
      ["上", "うえ", "jmdict:1352130"],
      ["下", "した", "jmdict:1184140"],
      ["右", "みぎ", "jmdict:1171010"],
      ["左", "ひだり", "jmdict:1290800"],
      ["円", "えん", "jmdict:1175570"],
      ["力", "ちから", "jmdict:1554820"],
      ["人", "ひと", "jmdict:1580640"],
      ["月", "つき", "jmdict:1255430"],
    ]);
    expect(batch.words.map((word) => word.sortOrder)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 1),
    );
  });

  it("keeps bilingual teaching and original kana-readable examples within registered earlier kanji", () => {
    const registered = new Set(
      buildMainCourseContentBatches().flatMap((batch) =>
        batch.kanji.map((kanji) => kanji.character),
      ),
    );
    for (const word of buildMainCourseWordBatch().words) {
      expect(word.example.japaneseText).toContain(word.expression);
      expect(word.example.readingText).toContain(word.reading);
      expect(Object.values(word.example).every((text) => text.trim() !== "")).toBe(true);
      expect(
        wordHanCharacters(word.expression + word.example.japaneseText).every((character) =>
          registered.has(character),
        ),
      ).toBe(true);
      expect(word.meanings.ru.accepted[0]).toBe(word.meanings.ru.primary);
      expect(word.meanings.en.accepted[0]).toBe(word.meanings.en.primary);
      for (const text of [
        word.meaningMnemonic,
        word.readingMnemonic,
        word.meaningHint,
        word.readingHint,
      ])
        expect(text.ru.trim() !== "" && text.en.trim() !== "").toBe(true);
    }
    expect(
      buildMainCourseWordBatch().words.find((word) => word.expression === "金")?.meanings.en
        .accepted,
    ).toEqual(["money"]);
    expect(
      buildMainCourseWordBatch().words.find((word) => word.expression === "月")?.meanings.en
        .accepted,
    ).toEqual(["moon"]);
  });

  it("does not mutate existing kanji batches and hashes repeated builds identically", () => {
    const hash = () =>
      createHash("sha256").update(JSON.stringify(buildMainCourseContentBatches())).digest("hex");
    const before = hash();
    const batch = buildMainCourseWordBatch();
    validateMainCourseWordBatch(batch);
    expect(hash()).toBe(before);
    expect(mainCourseWordBatchChecksum(buildMainCourseWordBatch())).toBe(
      mainCourseWordBatchChecksum(batch),
    );
    expect(mainCourseWordBatchChecksum({ ...batch, reviewedAt: "2026-10-23" })).not.toBe(
      mainCourseWordBatchChecksum(batch),
    );
  });

  it.each(["reading", "placement", "bilingual", "example", "count", "meanings"])(
    "rejects invalid %s content before source reads",
    (condition) => {
      const batch = structuredClone(buildMainCourseWordBatch());
      const first = batch.words[0]!;
      const word =
        condition === "reading"
          ? { ...first, reading: "サン" }
          : condition === "placement"
            ? { ...first, sortOrder: 2 }
            : condition === "bilingual"
              ? { ...first, readingHint: { ru: "", en: "" } }
              : condition === "example"
                ? { ...first, example: { ...first.example, translationRu: "" } }
                : condition === "meanings"
                  ? {
                      ...first,
                      meanings: {
                        ...first.meanings,
                        en: { primary: "mountain", accepted: ["mountain", "MOUNTAIN"] },
                      },
                    }
                  : first;
      const invalid = {
        ...batch,
        words: condition === "count" ? batch.words.slice(1) : [word, ...batch.words.slice(1)],
      };
      expect(validateMainCourseWordBatch(invalid).length).toBeGreaterThan(0);
    },
  );

  it("dry-validates the guarded CLI with no database URL", () => {
    const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
    const stdout = execFileSync(
      process.execPath,
      [
        join(root, "node_modules/tsx/dist/cli.mjs"),
        join(root, "packages/db/prisma/curate-main-course-words.ts"),
        "--validate-only",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    expect(JSON.parse(stdout)).toMatchObject({
      status: "valid-manifest",
      reviewedAt: "2026-10-22",
      words: 20,
      cards: 40,
      examples: 20,
      checksumSha256: mainCourseWordBatchChecksum(buildMainCourseWordBatch()),
    });
  });

  it.each([["--prefligt-only"], ["--validate-only", "--preflight-only"]])(
    "rejects unsafe or ambiguous CLI flags before database construction: %s",
    (...args) => {
      const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
      const result = spawnSync(
        process.execPath,
        [
          join(root, "node_modules/tsx/dist/cli.mjs"),
          join(root, "packages/db/prisma/curate-main-course-words.ts"),
          ...args,
        ],
        { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
      );
      expect(result.status).toBe(1);
      expect(result.stderr).toContain("Use no arguments to apply");
      expect(result.stderr).not.toContain("DATABASE_URL is required");
    },
  );
});
