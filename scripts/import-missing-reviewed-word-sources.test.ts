import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { buildMainCourseWordBatch } from "../packages/db/src/main-course-word-content";
import { parseJmDictXml } from "../packages/content-importers/src/jmdict";
import { SOURCE_CONTRACTS } from "./local-source-manifest.mts";
import {
  buildReviewedSourceSupplement,
  planReviewedSourceWindow,
  parseSourceSupplementArgs,
  requireAbsentSupplementPairs,
  reviewedSourceCandidates,
  selectReviewedSourceBatches,
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
    expect(planReviewedSourceWindow([candidate], [observed])).toEqual({
      selected: [],
      totalMissingPairs: 0,
    });
    expect(planReviewedSourceWindow([candidate], [])).toEqual({
      selected: [candidate],
      totalMissingPairs: 1,
    });
    expect(() =>
      planReviewedSourceWindow([candidate], [{ ...observed, jmdictEntryId: null }]),
    ).toThrow("conflicting source");
  });
  it("retains explicit alternate-entry IDs and does not invent exact rows for sense notes", () => {
    const batch = buildMainCourseWordBatch();
    const first = batch.words[0]!;
    const changed = {
      ...batch,
      words: [
        {
          ...first,
          acceptedReadings: ["さん"],
          acceptedReadingEntryIds: { さん: "jmdict:9999" },
          sourceNoteReadings: [
            {
              reading: "やまやま",
              sourceRecordId: first.jmdictEntryId,
              sourceVersion: "2026-10-31",
              sourceDocumentSha256: "a".repeat(64),
              note: "also やまやま (all senses)",
            },
          ],
        },
        ...batch.words.slice(1),
      ],
    };
    const result = reviewedSourceCandidates([changed]);
    expect(result).toContainEqual({
      expression: first.expression,
      reading: "さん",
      jmdictEntryId: "jmdict:9999",
    });
    expect(result.some((r) => r.reading === "やまやま")).toBe(false);
  });
  it("always refuses to overwrite an existing requested pair", () => {
    expect(() => requireAbsentSupplementPairs([])).not.toThrow();
    for (const row of [
      { id: "fixture-published", jmdictEntryId: null, status: "PUBLISHED" },
      { id: "fixture-other-source", jmdictEntryId: "jmdict:999", status: "DRAFT" },
      { id: "fixture-same-source", jmdictEntryId: candidate.jmdictEntryId },
    ])
      expect(() => requireAbsentSupplementPairs([row])).toThrow("insert-only");
  });
  it("stops on matching rows left without successful provenance by an earlier import", () => {
    for (const status of [null, "PENDING", "FAILED"])
      expect(() =>
        planReviewedSourceWindow([candidate], [{ ...observed, importStatus: status }], 1),
      ).toThrow("incomplete import provenance");
    expect(
      planReviewedSourceWindow([candidate], [{ ...observed, importStatus: "SUCCESS" }], 1),
    ).toMatchObject({ selected: [], totalMissingPairs: 0 });
  });
  it("refuses source identity conflicts and oversized backfills rather than silently importing everything", () => {
    expect(() =>
      planReviewedSourceWindow([candidate], [{ ...observed, jmdictEntryId: "jmdict:1" }]),
    ).toThrow("conflicting source");
    expect(() =>
      planReviewedSourceWindow(
        Array.from({ length: 101 }, (_, i) => ({ ...candidate, expression: `fixture-${i}` })),
        [],
      ),
    ).toThrow("100 pairs");
  });
  it("reconciles missing exact pairs across bounded source-only windows and checks conflicts outside the next window", () => {
    const candidates = Array.from({ length: 134 }, (_, index) => ({
      ...candidate,
      expression: `fixture-${index}`,
    }));
    const first = planReviewedSourceWindow(candidates, [], 100);
    expect(first).toEqual({ selected: candidates.slice(0, 100), totalMissingPairs: 134 });
    const second = planReviewedSourceWindow(candidates, [...first.selected].reverse(), 100);
    expect(second).toEqual({ selected: candidates.slice(100), totalMissingPairs: 34 });
    expect(planReviewedSourceWindow(candidates, [...first.selected, ...second.selected])).toEqual({
      selected: [],
      totalMissingPairs: 0,
    });
    expect(() => planReviewedSourceWindow(candidates, [], 0)).toThrow("1-100");
    expect(() => planReviewedSourceWindow(candidates, [], 101)).toThrow("1-100");
    expect(() =>
      planReviewedSourceWindow(candidates, [{ ...candidates[133]!, jmdictEntryId: null }], 1),
    ).toThrow("conflicting source");
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
    expect(derived.exactPairs).toEqual([
      { expression: "ありがとう", reading: "ありがとう", sourceRecordId: "jmdict:1000002" },
    ]);
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
    const args = ["--snapshot-dir", path, "--batch", "reviewed-01"];
    expect(parseSourceSupplementArgs(args)).toEqual({
      directory: path,
      apply: false,
      batchIds: ["reviewed-01"],
    });
    expect(parseSourceSupplementArgs([...args, "--batch", "reviewed-02", "--apply"])).toEqual({
      directory: path,
      apply: true,
      batchIds: ["reviewed-01", "reviewed-02"],
    });
    expect(parseSourceSupplementArgs([...args, "--max-pairs", "60"])).toEqual({
      directory: path,
      apply: false,
      batchIds: ["reviewed-01"],
      maxPairs: 60,
    });
    for (const invalidArgs of [
      [],
      ["--apply"],
      ["--snapshot-dir", path],
      ["--snapshot-dir", "relative"],
      ["--snapshot-dir", path, "--batch", "reviewed-01", "--all"],
      ["--snapshot-dir", path, "--batch", "reviewed-01", "--apply", "--apply"],
      ["--snapshot-dir", path, "--batch", "reviewed-01", "--batch", "reviewed-01"],
      ["--snapshot-dir", path, "--batch", "reviewed-01,reviewed-02"],
      [...args, "--max-pairs", "0"],
      [...args, "--max-pairs", "101"],
      [...args, "--max-pairs", "2.5"],
      [...args, "--max-pairs", "1", "--max-pairs", "2"],
      [
        "--snapshot-dir",
        path,
        ...Array.from({ length: 41 }, (_, i) => ["--batch", `reviewed-${i}`]).flat(),
      ],
    ])
      expect(() => parseSourceSupplementArgs(invalidArgs)).toThrow("Usage");
  });

  it("derives evidence only for selected reviewed batches in stable registry order", () => {
    const reviewed = buildMainCourseWordBatch();
    const other = {
      ...reviewed,
      id: "other-reviewed",
      wordCount: 1,
      sortOrderStart: reviewed.words[1]!.sortOrder,
      words: reviewed.words.slice(1, 2),
    };
    const pending = { ...reviewed, id: "pending", reviewedAt: null };
    const registered = [reviewed, pending, other];
    expect(selectReviewedSourceBatches(registered, [other.id, reviewed.id])).toEqual([
      reviewed,
      other,
    ]);
    const selected = selectReviewedSourceBatches(registered, [other.id]);
    expect(reviewedSourceCandidates(selected)).toHaveLength(1);
    expect(reviewedSourceCandidates(selected)).not.toContainEqual(candidate);
    expect(() => selectReviewedSourceBatches(registered, [pending.id])).toThrow("reviewed");
    expect(() => selectReviewedSourceBatches(registered, ["unknown"])).toThrow("existing");
    expect(() => selectReviewedSourceBatches(registered, [])).toThrow("1-40");
  });
});
