import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import {
  formatEditorialRegistryInventory,
  parseEditorialRegistryArgs,
  runEditorialRegistryInventory,
} from "../prisma/report-editorial-registry";
import { buildEditorialRegistryInventory } from "../src/editorial-registry-inventory";
import {
  buildMainCourseContentBatches,
  type MainCourseContentBatch,
} from "../src/main-course-content";
import {
  buildMainCourseWordBatches,
  mainCourseWordBatchChecksum,
  type MainCourseWordBatch,
} from "../src/main-course-word-content";

vi.mock("@prisma/client", () => {
  throw new Error("Source-only inventory must not load the database runtime.");
});

// Synthetic source-only data, not dictionary evidence or educational seed content.
function fixture() {
  const text = { ru: "fixture", en: "fixture" };
  const meanings = {
    ru: { primary: "one", accepted: ["one"] },
    en: { primary: "one", accepted: ["one"] },
  };
  const kanji: MainCourseContentBatch = {
    id: "fixture-kanji",
    version: "1",
    authoredAt: "2026-10-22",
    reviewedAt: "2026-10-22",
    reviewNotes: "Fixture review metadata only.",
    sourceFile: "fixture.ts",
    courseSlug: "japanese-ru-n2",
    componentLevelNumber: 1,
    components: [
      {
        key: "component-one",
        symbol: "\u4e00",
        displayName: text,
        shapeDescription: text,
        meaning: text,
        mnemonic: text,
      },
    ],
    kanji: [
      {
        character: "\u4e00",
        levelNumber: 2,
        sortOrder: 1,
        meanings,
        reading: { source: "\u30a4\u30c1", primary: "\u3044\u3061", accepted: ["\u3044\u3061"] },
        componentKeys: ["component-one"],
        meaningMnemonic: text,
        readingMnemonic: text,
        requireStrokeData: false,
      },
    ],
  };
  const words: MainCourseWordBatch = {
    id: "fixture-words",
    version: "1",
    authoredAt: "2026-10-22",
    reviewedAt: "2026-10-22",
    reviewNotes: "Fixture review metadata only.",
    sourceFile: "fixture.ts",
    courseSlug: "japanese-ru-n2",
    levelNumber: 3,
    words: Array.from({ length: 20 }, (_, i) => ({
      expression: "\u4e00",
      reading: "\u3042".repeat(i + 1),
      jmdictEntryId: `jmdict:${i + 1}`,
      sortOrder: i + 1,
      meanings,
      meaningMnemonic: text,
      readingMnemonic: text,
      meaningHint: text,
      readingHint: text,
      example: {
        japaneseText: "\u4e00",
        readingText: "\u3042".repeat(i + 1),
        translationRu: "Fixture.",
        translationEn: "Fixture.",
      },
    })),
  };
  return { kanjiBatches: [kanji], wordBatches: [words] };
}

describe("source-only editorial registry inventory", () => {
  it("counts exact distinct targets, slots and transitive earlier prerequisites without mutation", () => {
    const input = fixture();
    const before = JSON.stringify(input);
    const report = buildEditorialRegistryInventory(input);
    expect(JSON.stringify(input)).toBe(before);
    expect(report.validation).toEqual({ valid: true, issues: [] });
    expect(report.prepared.distinctTotals).toEqual({
      components: 1,
      kanji: 1,
      words: 20,
      items: 22,
    });
    expect(report.batches[0]!.levelSlots).toEqual([
      { kind: "COMPONENT", levelNumber: 1, sortOrders: [1] },
      { kind: "KANJI", levelNumber: 2, sortOrders: [1] },
    ]);
    expect(report.batches[1]!.prerequisiteClosure).toEqual({
      closed: true,
      requiredTargetCount: 2,
      externalBatchIds: ["fixture-kanji"],
      issues: [],
    });
    expect(report.batches[0]!.checksumSha256).toBe(
      createHash("sha256").update(JSON.stringify(input.kanjiBatches[0])).digest("hex"),
    );
    expect(report.batches[1]!.checksumSha256).toBe(
      mainCourseWordBatchChecksum(input.wordBatches[0]!),
    );
    expect(report.sourceSeals.every((seal) => seal.status === "incomplete")).toBe(true);
    expect(
      report.batches.every((batch) =>
        batch.sourceSeals.every((seal) => seal.status === "not-in-seal"),
      ),
    ).toBe(true);
  });

  it("is repeatable, order independent and hashes content changes, not just counts", () => {
    const input = fixture();
    const original = input.kanjiBatches[0]!;
    const extra: MainCourseContentBatch = {
      ...original,
      id: "fixture-extra",
      componentSortOrderStart: 2,
      components: [{ ...original.components[0]!, key: "component-two", symbol: "\u4e8c" }],
      kanji: [
        {
          ...original.kanji[0]!,
          character: "\u4e8c",
          sortOrder: 2,
          componentKeys: ["component-two"],
        },
      ],
    };
    input.kanjiBatches.push(extra);
    const first = buildEditorialRegistryInventory(input);
    expect(first.validation.valid).toBe(true);
    expect(buildEditorialRegistryInventory(input)).toEqual(first);
    expect(
      buildEditorialRegistryInventory({
        ...input,
        kanjiBatches: [...input.kanjiBatches].reverse(),
      }),
    ).toEqual(first);
    const changed = buildEditorialRegistryInventory({
      ...input,
      wordBatches: [{ ...input.wordBatches[0]!, reviewNotes: "Changed." }],
    });
    expect(changed.prepared.distinctTotals).toEqual(first.prepared.distinctTotals);
    expect(changed.manifestChecksumSha256).not.toBe(first.manifestChecksumSha256);
    expect(first.manifestChecksumSha256).toMatch(/^[a-f0-9]{64}$/u);
    const { manifestChecksumSha256, ...payload } = first;
    const canonical = JSON.stringify(payload, (_key, value: unknown) =>
      value !== null && typeof value === "object" && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : value,
    );
    expect(manifestChecksumSha256).toBe(createHash("sha256").update(canonical).digest("hex"));
    expect(
      buildEditorialRegistryInventory({
        ...input,
        kanjiBatches: [original, { ...extra, id: `${original.id}:kanji-validation` }],
      }).validation.valid,
    ).toBe(true);
  });

  it("keeps pending review separate from reviewed source metadata", () => {
    const input = fixture();
    input.wordBatches[0] = { ...input.wordBatches[0]!, reviewedAt: null };
    const report = buildEditorialRegistryInventory(input);
    expect(report.validation.valid).toBe(true);
    expect(report.batches[1]!.reviewStatus).toBe("pending-review");
    expect(report.prepared.reviewedDistinctTotals).toEqual({
      components: 1,
      kanji: 1,
      words: 0,
      items: 2,
    });
    expect(report.prepared.pendingReviewDistinctTotals).toEqual({
      components: 0,
      kanji: 0,
      words: 20,
      items: 20,
    });
  });

  it.each(["missing-component", "example-kanji", "same-level", "other-course"])(
    "rejects broken prerequisite closure: %s",
    (condition) => {
      const input = fixture();
      const kanji = input.kanjiBatches[0]!;
      const words = input.wordBatches[0]!;
      if (condition === "missing-component")
        input.kanjiBatches[0] = {
          ...kanji,
          kanji: [{ ...kanji.kanji[0]!, componentKeys: ["absent"] }],
        };
      if (condition === "example-kanji")
        input.wordBatches[0] = {
          ...words,
          words: words.words.map((word) => ({
            ...word,
            example: { ...word.example, japaneseText: `${word.expression}\u4e8c` },
          })),
        };
      if (condition === "same-level")
        input.wordBatches[0] = {
          ...words,
          levelNumber: 2,
          sortOrderStart: 21,
          words: words.words.map((word) => ({ ...word, sortOrder: word.sortOrder + 20 })),
        };
      if (condition === "other-course") input.kanjiBatches[0] = { ...kanji, courseSlug: "other" };
      const report = buildEditorialRegistryInventory(input);
      expect(report.validation.valid).toBe(false);
      expect(report.batches.some((batch) => !batch.prerequisiteClosure.closed)).toBe(true);
      expect(report.validation.issues.join("\n")).toMatch(
        /prerequisite.*(missing|earlier)|missing.*prerequisite/u,
      );
    },
  );

  it.each(["source-id", "word-identity", "cross-kind-slot", "component-symbol", "metadata"])(
    "reports invalid registry data: %s",
    (condition) => {
      const input = fixture();
      const kanji = input.kanjiBatches[0]!;
      const words = input.wordBatches[0]!;
      if (condition === "source-id") input.wordBatches[0] = { ...words, id: kanji.id };
      if (condition === "word-identity")
        input.wordBatches[0] = {
          ...words,
          words: words.words.map((word, i) =>
            i === 1 ? { ...words.words[0]!, sortOrder: 2 } : word,
          ),
        };
      if (condition === "cross-kind-slot") input.wordBatches[0] = { ...words, levelNumber: 1 };
      if (condition === "component-symbol")
        input.kanjiBatches[0] = {
          ...kanji,
          components: [...kanji.components, { ...kanji.components[0]!, key: "duplicate-symbol" }],
        };
      if (condition === "metadata") input.kanjiBatches[0] = { ...kanji, reviewedAt: "yesterday" };
      const report = buildEditorialRegistryInventory(input);
      expect(report.validation.valid).toBe(false);
      expect(report.validation.issues.length).toBeGreaterThan(0);
      if (condition === "source-id")
        expect(report.validation.issues).toContain(`Duplicate source batch ID ${kanji.id}.`);
      if (condition === "cross-kind-slot")
        expect(report.validation.issues.join("\n")).toContain("Duplicate registry placement");
      if (condition === "word-identity") expect(report.prepared.distinctTotals.words).toBe(19);
      expect(runEditorialRegistryInventory(["--json"], () => report).exitCode).toBe(1);
      expect(runEditorialRegistryInventory([], () => report).exitCode).toBe(1);
    },
  );

  it("fails empty registries and refuses a changed immutable source identity", () => {
    expect(
      buildEditorialRegistryInventory({ kanjiBatches: [], wordBatches: [] }).validation.valid,
    ).toBe(false);
    const input = fixture();
    input.kanjiBatches[0] = { ...input.kanjiBatches[0]!, id: "task-118-foundation-kanji-01" };
    const report = buildEditorialRegistryInventory(input);
    expect(report.validation.issues).toContain(
      "task-118-foundation-kanji-01: immutable V1/V2/V3 source seal mismatch.",
    );
    expect(report.sourceSeals.map((seal) => seal.status)).toEqual([
      "mismatch",
      "mismatch",
      "mismatch",
      "mismatch",
    ]);
  });

  it("compares growing prepared builders with fixed V1-V4 source seals", () => {
    const kanjiBatches = buildMainCourseContentBatches();
    const wordBatches = buildMainCourseWordBatches();
    const report = buildEditorialRegistryInventory({ kanjiBatches, wordBatches });
    expect(report.validation).toEqual({ valid: true, issues: [] });
    expect(report.sourceSeals.map((seal) => [seal.id, seal.status, seal.sources.length])).toEqual([
      ["v1", "complete", 3],
      ["v2", "complete", 7],
      ["v3", "complete", 10],
      ["v4", "complete", 12],
    ]);
    for (const seal of report.sourceSeals) {
      expect(seal.includedPreparedDistinctTotals).toEqual(seal.sealedDistinctTotals);
      expect(seal.preparedOutsideSealDistinctTotals.items).toBe(
        report.prepared.distinctTotals.items - seal.sealedDistinctTotals.items,
      );
    }
    expect(report.prepared.distinctTotals.kanji).toBe(
      new Set(kanjiBatches.flatMap((batch) => batch.kanji.map((item) => item.character))).size,
    );
    expect(report.prepared.distinctTotals.words).toBe(
      new Set(
        wordBatches.flatMap((batch) =>
          batch.words.map((word) => `${word.expression}:${word.reading}`),
        ),
      ).size,
    );
    expect(
      report.batches
        .find((batch) => batch.id === "task-118-course-kanji-06")!
        .sourceSeals.filter((seal) => seal.id !== "v4").every((seal) => seal.status === "not-in-seal"),
    ).toBe(true);
  });
});

describe("editorial inventory CLI", () => {
  it("defaults to human-readable stdout and emits a single parseable JSON document on request", () => {
    const report = buildEditorialRegistryInventory(fixture());
    expect(parseEditorialRegistryArgs([])).toEqual({ json: false });
    expect(parseEditorialRegistryArgs(["--json"])).toEqual({ json: true });
    const human = runEditorialRegistryInventory([], () => report);
    expect(human).toEqual({ stdout: `${formatEditorialRegistryInventory(report)}\n`, exitCode: 0 });
    expect(human.stdout).toContain("SOURCE ONLY");
    expect(human.stdout).toContain("not live, applied or published counts");
    expect(human.stdout).toContain("L1 COMPONENT [1]");
    expect(human.stdout).toContain("Prerequisite closure: closed");
    const json = runEditorialRegistryInventory(["--json"], () => report);
    expect(json.exitCode).toBe(0);
    expect(JSON.parse(json.stdout)).toEqual(report);
  });

  it.each([
    ["--output", "file.json"],
    ["--apply"],
    ["--publish"],
    ["--json", "--json"],
    ["unexpected"],
  ])("rejects unsupported arguments before building: %j", (...args) => {
    const build = vi.fn(() => buildEditorialRegistryInventory(fixture()));
    expect(() => runEditorialRegistryInventory(args, build)).toThrow("Usage:");
    expect(build).not.toHaveBeenCalled();
  });
});
