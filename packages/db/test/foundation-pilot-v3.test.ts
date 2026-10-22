import { createHash } from "node:crypto";

import { describe, expect, it, vi } from "vitest";

import { parseFoundationPilotArgs } from "../prisma/publish-foundation-pilot";
import {
  buildFoundationPilotManifest,
  buildFoundationPilotManifestV2,
  buildFoundationPilotManifestV3,
  foundationPilotRecordId,
  FOUNDATION_PILOT_RECORD_ID,
  FOUNDATION_PILOT_V2_RECORD_ID,
  FOUNDATION_PILOT_V3_RECORD_ID,
  FOUNDATION_PILOT_V3_SLUG,
  planFoundationPilot,
  publishFoundationPilot,
} from "../src/foundation-pilot";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseWordBatches } from "../src/main-course-word-content";

function checksum(value: unknown): string {
  const canonical = JSON.stringify(value, (_key, entry: unknown) =>
    entry !== null && typeof entry === "object" && !Array.isArray(entry)
      ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
      : entry,
  );
  return createHash("sha256").update(canonical).digest("hex");
}

describe("finite pilot v3 preparation", () => {
  it("preserves the complete canonical v1 and v2 payloads and separate publication identities", () => {
    expect(checksum(buildFoundationPilotManifest())).toBe(
      "f2febe7e3a1e5a11800530c7992819ab2c3a06f5c33ae3dd0f5218de68c68b86",
    );
    expect(checksum(buildFoundationPilotManifestV2())).toBe(
      "4d2f3aab0b2b160774ab5a2ca19a675f28423c48561218abca4c8737c47d53e1",
    );
    expect(
      new Set([
        FOUNDATION_PILOT_RECORD_ID,
        FOUNDATION_PILOT_V2_RECORD_ID,
        FOUNDATION_PILOT_V3_RECORD_ID,
      ]).size,
    ).toBe(3);
    expect(FOUNDATION_PILOT_V3_RECORD_ID).toMatch(
      /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/u,
    );
  });

  it("selects exactly ten sources and 244 existing targets with two WORD levels", () => {
    const manifest = buildFoundationPilotManifestV3();
    expect(manifest.slug).toBe(FOUNDATION_PILOT_V3_SLUG);
    expect(manifest.version).toBe("3");
    expect(checksum(manifest)).toBe(
      "a7261a33902acba75a8058ba043b4f6ab786978315783e23cb9479cd040617d1",
    );
    expect(foundationPilotRecordId(manifest)).toBe(FOUNDATION_PILOT_V3_RECORD_ID);
    expect(manifest.counts).toEqual({
      components: 63,
      kanji: 81,
      words: 100,
      items: 244,
      cards: 425,
    });
    expect(manifest.sources.map((source) => source.id)).toEqual([
      ...["01", "02", "03", "04", "05"].map((suffix) => `task-118-foundation-kanji-${suffix}`),
      ...["01", "02", "03", "04"].map((suffix) => `task-127-foundation-words-${suffix}`),
      "task-127-course-words-05",
    ]);
    expect(manifest.sources.slice(-2).map((source) => source.checksumSha256)).toEqual([
      "81496c6ffcb91d0d7fa046b8f075b4b1aff6e2ccec7f69d48c48708bb043b5b6",
      "e1fd34111d46183f4376934d9d55429c191524e7d319ec367b8bdb2c4d972f36",
    ]);
    expect(manifest.sources[4]!.checksumSha256).toBe(
      "95a4b69a331f200caa5044717cde9d628c3d3ad1d79600000c142a55967a3c1b",
    );
    expect(manifest.levels.map((level) => level.passPolicyJson.itemKind)).toEqual([
      "COMPONENT",
      "KANJI",
      "KANJI",
      "KANJI",
      "WORD",
      "WORD",
    ]);
    expect(manifest.titleRu).toContain("63 компонента, 81 кандзи и 100 слов");
    expect(manifest.descriptionRu).toContain("6 уровней");
    expect(manifest.descriptionRu).toContain("не полный курс до N2");
    expect(manifest.targets).toHaveLength(244);
    const byKey = new Map(manifest.targets.map((target) => [target.key, target]));
    expect(byKey.size).toBe(244);
    expect(
      new Set(manifest.targets.map((target) => `${target.levelNumber}:${target.sortOrder}`)).size,
    ).toBe(244);
    for (const target of manifest.targets) {
      expect(target.levelNumber).toBeLessThanOrEqual(target.kind === "WORD" ? 6 : 4);
      if (target.kind === "WORD") expect(target.levelNumber).toBeGreaterThanOrEqual(5);
      for (const prerequisite of target.prerequisiteKeys)
        expect(byKey.get(prerequisite)!.levelNumber).toBeLessThan(target.levelNumber);
    }
    expect(
      manifest.targets.reduce((count, target) => count + (target.kind === "COMPONENT" ? 1 : 2), 0),
    ).toBe(425);
  });

  it("does not silently expand old pilots or accept extra v3 sources", () => {
    expect(buildFoundationPilotManifestV2().sources).toHaveLength(7);
    expect(buildFoundationPilotManifest().sources).toHaveLength(3);
    const kanji = buildMainCourseContentBatches().filter((batch) =>
      /^task-118-foundation-kanji-0[1-5]$/u.test(batch.id),
    );
    const words = buildMainCourseWordBatches().filter(
      (batch) =>
        /^task-127-foundation-words-0[1-4]$/u.test(batch.id) ||
        batch.id === "task-127-course-words-05",
    );
    expect(() => buildFoundationPilotManifestV3(kanji, words.slice(0, -1))).toThrow();
    expect(() => buildFoundationPilotManifestV3(kanji, [...words, words[0]!])).toThrow();
  });

  it.each(["count", "source", "answer", "policy", "order"])(
    "rejects tampered v3 %s before reads, transactions or enrollment writes",
    async (condition) => {
      const manifest = structuredClone(buildFoundationPilotManifestV3());
      if (condition === "count") manifest.counts.items++;
      if (condition === "source") manifest.sources.at(-1)!.checksumSha256 = "0".repeat(64);
      if (condition === "answer") manifest.targets[0]!.answers = [];
      if (condition === "policy")
        Object.assign(manifest.levels[5]!.passPolicyJson, { itemKind: "KANJI" });
      if (condition === "order") manifest.targets.reverse();
      const access = vi.fn(() => {
        throw new Error("Unexpected database access");
      });
      const db = { course: { findUnique: access }, $transaction: access } as never;
      await expect(planFoundationPilot(db, { manifest })).rejects.toThrow(
        "sealed independently reviewed",
      );
      await expect(publishFoundationPilot(db, { manifest })).rejects.toThrow(
        "sealed independently reviewed",
      );
      expect(access).not.toHaveBeenCalled();
    },
  );

  it("requires explicit v3 selection without changing defaults or adding implicit enrollment", () => {
    expect(parseFoundationPilotArgs([])).toEqual({ mode: "plan" });
    expect(parseFoundationPilotArgs(["--pilot", "v3", "--publish"])).toEqual({
      mode: "publish",
      pilot: "v3",
    });
    for (const args of [
      ["--pilot", "v4"],
      ["--pilot", "v3", "--pilot", "v3"],
    ])
      expect(() => parseFoundationPilotArgs(args)).toThrow("--pilot once");
  });
});
