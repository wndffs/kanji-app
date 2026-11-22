import { describe, expect, it } from "vitest";

import {
  parseCurationReceiptSelection,
  summarizeCurationReceipts,
} from "../prisma/report-curation-receipts";
import { CURATION_SOURCE_NAMES } from "../src/curation-source-names";

const manifest = {
  id: "selected-kanji",
  kind: "kanji" as const,
  version: "1",
  sourceFile: "packages/db/src/content.ts",
  checksumSha256: "a".repeat(64),
};

const complete = {
  checksumSha256: manifest.checksumSha256,
  sourceVersion: manifest.version,
  sourceFileName: manifest.sourceFile,
  status: "SUCCESS" as const,
  finishedAt: new Date("2026-11-01T00:00:00Z"),
  dataSource: { name: CURATION_SOURCE_NAMES.kanji },
};

describe("read-only curation receipts", () => {
  it("reports only manifest identity and status for the matching reviewed checksum", () => {
    expect(summarizeCurationReceipts([manifest], [complete])).toEqual({
      counts: { COMPLETE: 1, MISSING: 0, INCONSISTENT: 0, PENDING: 0, FAILED: 0 },
      batches: [{ id: manifest.id, kind: "kanji", status: "COMPLETE" }],
    });
  });

  it("does not count a different version checksum or curation source as evidence", () => {
    expect(
      summarizeCurationReceipts(
        [manifest],
        [
          { ...complete, checksumSha256: "b".repeat(64) },
          { ...complete, dataSource: { name: CURATION_SOURCE_NAMES.word } },
        ],
      ).counts.MISSING,
    ).toBe(1);
  });

  it.each([
    { ...complete, finishedAt: null },
    { ...complete, sourceVersion: "2" },
    { ...complete, sourceFileName: "elsewhere.ts" },
  ])("rejects inconsistent successful metadata", (receipt) => {
    expect(summarizeCurationReceipts([manifest], [receipt]).counts.INCONSISTENT).toBe(1);
  });

  it.each(["PENDING", "FAILED"] as const)("distinguishes incomplete %s receipts", (status) => {
    expect(summarizeCurationReceipts([manifest], [{ ...complete, status }]).counts[status]).toBe(1);
  });

  it("requires bounded and explicit distinct selections before accessing the database", () => {
    expect(parseCurationReceiptSelection(["--kanji-batch", "foo", "--word-batch", "bar"])).toEqual({
      kanji: ["foo"],
      word: ["bar"],
    });
    expect(() => parseCurationReceiptSelection([])).toThrow();
    expect(() =>
      parseCurationReceiptSelection(["--word-batch", "same", "--word-batch", "same"]),
    ).toThrow();
    expect(() => parseCurationReceiptSelection(["--kanji-batch", "../other"])).toThrow();
    expect(() =>
      parseCurationReceiptSelection(["--kanji-batch", "one", "--kanji-batch", "two"]),
    ).toThrow();
    expect(() =>
      parseCurationReceiptSelection(
        Array.from({ length: 41 }, (_, index) => ["--word-batch", `word-${index}`]).flat(),
      ),
    ).toThrow();
  });
});
