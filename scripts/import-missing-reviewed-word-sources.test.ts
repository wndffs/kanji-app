import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildMainCourseWordBatch } from "../packages/db/src/main-course-word-content";
import { parseJmDictXml } from "../packages/content-importers/src/jmdict";
import { SOURCE_CONTRACTS } from "./local-source-manifest.mts";
import {
  buildReviewedSourceSupplement,
  missingReviewedSources,
  parseSourceSupplementArgs,
  requireAbsentSupplementAliases,
  reviewedSourceCandidates,
} from "./import-missing-reviewed-word-sources.mts";

vi.mock("@prisma/client", () => {
  throw new Error("Pure supplement checks must not connect to a database.");
});

const candidate = { expression: "山", reading: "やま", jmdictEntryId: "jmdict:1302680" };
const observed = { ...candidate };

describe("bounded missing-source supplements for reviewed words", () => {
  it("includes explicit accepted alternatives and refuses pending teaching manifests", () => {
    const batch = buildMainCourseWordBatch();
    const words = batch.words.map((word, index) =>
      index ? word : { ...word, acceptedReadings: ["さん"] },
    );
    expect(reviewedSourceCandidates([{ ...batch, words }])).toContainEqual({
      ...candidate,
      reading: "さん",
    });
    expect(() => reviewedSourceCandidates([{ ...batch, reviewedAt: null }])).toThrow("reviewed");
  });
  it("only requests absent pairs; existing source validation remains the curator's job", () => {
    expect(missingReviewedSources([candidate], [observed])).toEqual([]);
    expect(missingReviewedSources([candidate], [])).toEqual([candidate]);
    expect(() =>
      missingReviewedSources([candidate], [{ ...observed, jmdictEntryId: null }]),
    ).toThrow("conflicting source");
  });
  it("refuses every existing alias, including published null-ID and unpublished conflicting-ID rows", () => {
    expect(() => requireAbsentSupplementAliases([])).not.toThrow();
    for (const row of [
      { id: "fixture-published", jmdictEntryId: null, status: "PUBLISHED" },
      { id: "fixture-other-source", jmdictEntryId: "jmdict:999", status: "DRAFT" },
      { id: "fixture-same-source", jmdictEntryId: candidate.jmdictEntryId },
    ])
      expect(() => requireAbsentSupplementAliases([row])).toThrow("insert-only");
  });
  it("refuses source identity conflicts and oversized backfills rather than silently importing everything", () => {
    expect(() =>
      missingReviewedSources([candidate], [{ ...observed, jmdictEntryId: "jmdict:1" }]),
    ).toThrow("conflicting source");
    expect(() =>
      missingReviewedSources(
        Array.from({ length: 101 }, (_, i) => ({ ...candidate, expression: `fixture-${i}` })),
        [],
      ),
    ).toThrow("100 pairs");
  });
  it("derives only requested exact bilingual fixture records, with a distinct reproducible checksum", async () => {
    const path = resolve("data/fixtures/jmdict-small.xml");
    const xml = await readFile(path, "utf8");
    const source = {
      id: "jmdict" as const,
      path,
      ...SOURCE_CONTRACTS.jmdict,
      contentSha256: createHash("sha256").update(xml).digest("hex"),
      archiveSha256: "a".repeat(64),
      downloadedAt: "2026-10-29T00:00:00Z",
    };
    const wanted = [
      { expression: "ありがとう", reading: "ありがとう", jmdictEntryId: "jmdict:1000002" },
    ];
    const derived = await buildReviewedSourceSupplement(source, wanted);
    expect(derived.entryCount).toBe(1);
    expect(parseJmDictXml(derived.xml).entries.map((entry) => entry.sourceRecordId)).toEqual([
      "jmdict:1000002",
    ]);
    expect(derived.touchedPairs).toEqual([{ expression: "ありがとう", reading: "ありがとう" }]);
    expect(derived.checksumSha256).not.toBe(source.contentSha256);
    expect(await buildReviewedSourceSupplement(source, wanted)).toEqual(derived);
    await expect(
      buildReviewedSourceSupplement(source, [{ ...wanted[0]!, jmdictEntryId: "jmdict:999" }]),
    ).rejects.toThrow("exact");
    await expect(buildReviewedSourceSupplement(source, [candidate])).rejects.toThrow("exact");
    await expect(buildReviewedSourceSupplement(source, [])).rejects.toThrow("1-100");
    await expect(
      buildReviewedSourceSupplement(source, [
        { expression: "一日", reading: "いちにち", jmdictEntryId: "jmdict:1000001" },
      ]),
    ).rejects.toThrow("bilingual");
  });
  it("defaults to read-only planning and accepts only explicit bounded CLI arguments", () => {
    const path = resolve(".");
    expect(parseSourceSupplementArgs(["--snapshot-dir", path])).toEqual({
      directory: path,
      apply: false,
    });
    expect(parseSourceSupplementArgs(["--snapshot-dir", path, "--apply"]).apply).toBe(true);
    for (const args of [
      [],
      ["--apply"],
      ["--snapshot-dir", "relative"],
      ["--snapshot-dir", path, "--all"],
      ["--snapshot-dir", path, "--apply", "--apply"],
    ])
      expect(() => parseSourceSupplementArgs(args)).toThrow("Usage");
  });
});
