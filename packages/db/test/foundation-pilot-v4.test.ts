import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it, vi } from "vitest";

import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
import {
  buildFoundationPilotManifest,
  buildFoundationPilotManifestV2,
  buildFoundationPilotManifestV3,
  buildFoundationPilotManifestV4,
  foundationPilotRecordId,
  FOUNDATION_PILOT_RECORD_ID,
  FOUNDATION_PILOT_V2_RECORD_ID,
  FOUNDATION_PILOT_V3_RECORD_ID,
  FOUNDATION_PILOT_V4_RECORD_ID,
  FOUNDATION_PILOT_V4_SLUG,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseWordBatches, wordHanCharacters } from "../src/main-course-word-content";

function checksum(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : entry,
  );
  return createHash("sha256").update(canonical).digest("hex");
}

describe("sealed finite pilot v4 preparation", () => {
  it("keeps all earlier canonical manifests, counts and publication identities unchanged", () => {
    for (const [build, hash, items, cards, levels] of [
      [
        buildFoundationPilotManifest,
        "f2febe7e3a1e5a11800530c7992819ab2c3a06f5c33ae3dd0f5218de68c68b86",
        100,
        160,
        5,
      ],
      [
        buildFoundationPilotManifestV2,
        "4d2f3aab0b2b160774ab5a2ca19a675f28423c48561218abca4c8737c47d53e1",
        174,
        295,
        5,
      ],
      [
        buildFoundationPilotManifestV3,
        "a7261a33902acba75a8058ba043b4f6ab786978315783e23cb9479cd040617d1",
        244,
        425,
        6,
      ],
    ] as const) {
      const manifest = build();
      expect(checksum(manifest)).toBe(hash);
      expect(manifest.counts).toMatchObject({ items, cards });
      expect(manifest.levels).toHaveLength(levels);
    }
    expect(
      new Set([
        FOUNDATION_PILOT_RECORD_ID,
        FOUNDATION_PILOT_V2_RECORD_ID,
        FOUNDATION_PILOT_V3_RECORD_ID,
        FOUNDATION_PILOT_V4_RECORD_ID,
      ]).size,
    ).toBe(4);
    expect(FOUNDATION_PILOT_V4_RECORD_ID).toBe("a88880b1-27a3-474d-af1f-0e9ef261d6f7");
    expect(FOUNDATION_PILOT_V4_RECORD_ID).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u,
    );
  });

  it("seals exactly twelve reviewed sources, 300 items, 521 cards and 120 examples", () => {
    const manifest = buildFoundationPilotManifestV4();
    expect(manifest.slug).toBe(FOUNDATION_PILOT_V4_SLUG);
    expect(manifest.version).toBe("4");
    expect(checksum(manifest)).toBe(
      "7353baf893c3bde9fb7279529bcf69d66d7e0b9ef81396a8fb96169c686e70fc",
    );
    expect(foundationPilotRecordId(manifest)).toBe(FOUNDATION_PILOT_V4_RECORD_ID);
    expect(manifest.counts).toEqual({
      components: 79,
      kanji: 101,
      words: 120,
      items: 300,
      cards: 521,
    });
    expect(manifest.sources.map((source) => source.id)).toEqual([
      ...["01", "02", "03", "04", "05"].map((suffix) => `task-118-foundation-kanji-${suffix}`),
      "task-118-course-kanji-06",
      ...["01", "02", "03", "04"].map((suffix) => `task-127-foundation-words-${suffix}`),
      "task-127-course-words-05",
      "task-127-course-words-06",
    ]);
    expect(manifest.sources[5]!.checksumSha256).toBe(
      "74482be25706778fafe6e18b5ffc144718a3bf7a4181a5aacc8323516b223833",
    );
    expect(manifest.sources[11]!.checksumSha256).toBe(
      "8a9e0cef7dc10ec355125ffb7bb989d96cd531d0f85767280b735b6ad9790858",
    );
    expect(
      manifest.sources.every((source) => source.version === "1" && source.reviewedAt !== null),
    ).toBe(true);
    const previousSources = buildFoundationPilotManifestV3().sources;
    expect(
      manifest.sources.filter((source) => previousSources.some((old) => old.id === source.id)),
    ).toEqual(previousSources);
    expect(manifest.targets).toHaveLength(300);
    expect(new Set(manifest.targets.map((target) => target.key)).size).toBe(300);
    expect(
      manifest.targets.reduce((sum, target) => sum + (target.kind === "COMPONENT" ? 1 : 2), 0),
    ).toBe(521);
    expect(
      manifest.sources
        .flatMap((source) => source.records)
        .filter((record) => record.wordKey !== undefined),
    ).toHaveLength(120);
    expect(manifest.titleRu).toContain("79 компонентов, 101 кандзи и 120 слов");
    expect(manifest.descriptionRu).toContain("7 уровней");
  });

  it("keeps exact registry order/slots and prerequisite/example closure across all seven populated levels", () => {
    const manifest = buildFoundationPilotManifestV4();
    const kanji = buildMainCourseContentBatches().filter((batch) =>
      manifest.sources.some((source) => source.id === batch.id),
    );
    const words = buildMainCourseWordBatches().filter((batch) =>
      manifest.sources.some((source) => source.id === batch.id),
    );
    const placements = [
      ...kanji.flatMap((batch) => [
        ...batch.components.map((item, index) => [
          item.key,
          batch.componentLevelNumber,
          (batch.componentSortOrderStart ?? 1) + index,
        ]),
        ...batch.kanji.map((item) => [`kanji:${item.character}`, item.levelNumber, item.sortOrder]),
      ]),
      ...words.flatMap((batch) =>
        batch.words.map((item) => [
          `word:${item.expression}:${item.reading}`,
          batch.levelNumber,
          item.sortOrder,
        ]),
      ),
    ];
    expect(
      manifest.targets.map((target) => [target.key, target.levelNumber, target.sortOrder]),
    ).toEqual(placements);
    expect(
      new Set(manifest.targets.map((target) => `${target.levelNumber}:${target.sortOrder}`)).size,
    ).toBe(300);
    expect(
      manifest.levels.map(
        (level) =>
          manifest.targets.filter((target) => target.levelNumber === level.levelNumber).length,
      ),
    ).toEqual([63, 22, 18, 41, 80, 56, 20]);
    const byKey = new Map(manifest.targets.map((target) => [target.key, target]));
    for (const target of manifest.targets)
      for (const key of target.prerequisiteKeys)
        expect(byKey.get(key)!.levelNumber).toBeLessThan(target.levelNumber);
    for (const batch of words)
      for (const word of batch.words)
        for (const character of wordHanCharacters(word.expression + word.example.japaneseText))
          expect(byKey.get(`kanji:${character}`)!.levelNumber).toBeLessThan(batch.levelNumber);
  });

  it("uses WORD core policies for L5/L6 without dropping L6 components required by L7 kanji", () => {
    const manifest = buildFoundationPilotManifestV4();
    expect(manifest.levels.map((level) => level.passPolicyJson)).toEqual(
      ["COMPONENT", "KANJI", "KANJI", "KANJI", "WORD", "WORD", "KANJI"].map((itemKind) => ({
        version: 1,
        itemKind,
        passStageIndex: 5,
        requiredPercentage: 90,
      })),
    );
    const levelSix = manifest.targets.filter((target) => target.levelNumber === 6);
    expect(levelSix.filter((target) => target.kind === "WORD")).toHaveLength(40);
    const components = levelSix.filter((target) => target.kind === "COMPONENT");
    expect(components.map((target) => target.sortOrder)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 41),
    );
    const lateKanji = manifest.targets.filter((target) => target.levelNumber === 7);
    expect(lateKanji).toHaveLength(20);
    expect(lateKanji.every((target) => target.kind === "KANJI" && target.requiredStage === 1)).toBe(
      true,
    );
    for (const component of components)
      expect(lateKanji.some((target) => target.prerequisiteKeys.includes(component.key))).toBe(
        true,
      );
    expect(
      manifest.targets
        .filter((target) => target.kind === "WORD")
        .every((target) => target.requiredStage === 2),
    ).toBe(true);
    expect(manifest.levels[5]!.descriptionRu).toContain("не означает освоения всех элементов");
    expect(manifest.levels[6]!.descriptionRu).toBe("Кандзи пилотного курса.");
  });

  it("refuses source expansion, missing batches and reordered batches", () => {
    const manifest = buildFoundationPilotManifestV4();
    const kanji = buildMainCourseContentBatches().filter((batch) =>
      manifest.sources.some((source) => source.id === batch.id),
    );
    const words = buildMainCourseWordBatches().filter((batch) =>
      manifest.sources.some((source) => source.id === batch.id),
    );
    expect(() => buildFoundationPilotManifestV4(kanji.slice(0, -1), words)).toThrow();
    expect(() => buildFoundationPilotManifestV4(kanji, words.slice(0, -1))).toThrow();
    expect(() =>
      buildFoundationPilotManifestV4(
        [...kanji, { ...kanji.at(-1)!, id: "future", components: [], kanji: [] }],
        words,
      ),
    ).toThrow("exactly the twelve");
    expect(() =>
      buildFoundationPilotManifestV4(kanji, [...words, { ...words.at(-1)!, id: "future" }]),
    ).toThrow("exactly the twelve");
    expect(() => buildFoundationPilotManifestV4(kanji, [...words].reverse())).toThrow(
      "exactly the twelve",
    );
  });

  it.each([
    "counts",
    "cards",
    "target",
    "slot",
    "target-order",
    "answer",
    "prerequisite",
    "stage",
    "source-id",
    "source-hash",
    "source-content",
    "source-file",
    "source-order",
    "review-date",
    "missing-review",
    "L5-policy",
    "L6-policy",
    "L7-policy",
    "version",
    "slug",
    "extra-field",
  ])("rejects v4 %s tampering before any database access", async (condition) => {
    const manifest = structuredClone(buildFoundationPilotManifestV4());
    if (condition === "counts") manifest.counts.items++;
    if (condition === "cards") manifest.counts.cards++;
    if (condition === "target") manifest.targets[0]!.key = "foreign";
    if (condition === "slot") manifest.targets[0]!.sortOrder++;
    if (condition === "target-order") manifest.targets.reverse();
    if (condition === "answer") manifest.targets.at(-1)!.answers = [];
    if (condition === "prerequisite")
      manifest.targets.find((target) => target.levelNumber === 7)!.prerequisiteKeys = [];
    if (condition === "stage")
      manifest.targets.find((target) => target.levelNumber === 7)!.requiredStage = 0;
    if (condition === "source-id") manifest.sources[5]!.id = "task-118-foundation-kanji-06";
    if (condition === "source-hash") manifest.sources[5]!.checksumSha256 = "0".repeat(64);
    if (condition === "source-content") manifest.sources[5]!.records[0]!.content = { forged: true };
    if (condition === "source-file") manifest.sources.at(-1)!.sourceFile = "foreign";
    if (condition === "source-order") manifest.sources.reverse();
    if (condition === "review-date") manifest.sources.at(-1)!.reviewedAt = "2026-10-23";
    if (condition === "missing-review") manifest.sources[5]!.reviewedAt = null;
    if (condition === "L5-policy")
      Object.assign(manifest.levels[4]!.passPolicyJson, { itemKind: "KANJI" });
    if (condition === "L6-policy")
      Object.assign(manifest.levels[5]!.passPolicyJson, { itemKind: "COMPONENT" });
    if (condition === "L7-policy")
      Object.assign(manifest.levels[6]!.passPolicyJson, { itemKind: "WORD" });
    if (condition === "version") Object.assign(manifest, { version: "5" });
    if (condition === "slug") Object.assign(manifest, { slug: "unrecognized" });
    if (condition === "extra-field") Object.assign(manifest, { enrollAllUsers: true });
    const access = vi.fn(() => {
      throw new Error("Unexpected database access");
    });
    const db = new Proxy({}, { get: access }) as never;
    await expect(planFoundationPilot(db, { manifest })).rejects.toThrow(
      "sealed independently reviewed",
    );
    await expect(publishFoundationPilot(db, { manifest })).rejects.toThrow(
      "sealed independently reviewed",
    );
    expect(access).not.toHaveBeenCalled();
  });

  it("selects v4 explicitly, keeps default v1/read-only mode, and validates without a database URL", () => {
    expect(parseFoundationPilotArgs([])).toEqual({ mode: "plan" });
    expect(parseFoundationPilotArgs(["--pilot", "v4"])).toEqual({ mode: "plan", pilot: "v4" });
    expect(parseFoundationPilotArgs(["--pilot", "v4", "--publish"])).toEqual({
      mode: "publish",
      pilot: "v4",
    });
    for (const args of [
      ["--pilot"],
      ["--pilot", "v6"],
      ["--pilot", "v4", "--pilot", "v4"],
      ["--pilot", "v4", "--pilot", "v1"],
    ])
      expect(() => parseFoundationPilotArgs(args)).toThrow("--pilot once");
    const root = fileURLToPath(new URL("../../../", import.meta.url));
    const output = execFileSync(
      process.execPath,
      [
        "--import",
        "tsx",
        "packages/db/prisma/publish-foundation-pilot.ts",
        "--pilot",
        "v4",
        "--validate-only",
      ],
      { cwd: root, encoding: "utf8", env: { ...process.env, DATABASE_URL: "" } },
    );
    const result = JSON.parse(output);
    expect(result).toMatchObject({
      status: "valid-finite-manifest",
      slug: FOUNDATION_PILOT_V4_SLUG,
      levels: 7,
      counts: { components: 79, kanji: 101, words: 120, items: 300, cards: 521 },
      manifestRecordId: FOUNDATION_PILOT_V4_RECORD_ID,
    });
    expect(result.sources).toHaveLength(12);
    const workflow = readFileSync(
      new URL("../../../.github/workflows/publish-foundation-pilot.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("default: v1");
    expect(workflow).toContain("          - v4");
    expect(workflow.match(/v1\|v2\|v3\|v4\|v5\) ;;/gu)).toHaveLength(2);
    expect(workflow).not.toContain("--enroll-user-id");
  });
});
