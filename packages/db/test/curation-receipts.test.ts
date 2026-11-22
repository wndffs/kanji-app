import { describe, expect, it } from "vitest";

import {
  formatReceiptDatabaseError,
  parseCurationReceiptSelection,
  receiptGateFailure,
  resolveCurationReceiptManifests,
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
  it("recognizes the complete Broadening selection without opening a database connection", () => {
    const words = Array.from({ length: 21 }, (_, index) => [
      "--word-batch",
      `full-course-vocabulary-broadening-${String(index + 1).padStart(2, "0")}`,
    ]).flat();
    const manifests = resolveCurationReceiptManifests([
      "--kanji-batch",
      "full-course-kanji-broadening",
      ...words,
    ]);
    expect(manifests.map(({ kind }) => kind)).toEqual(["kanji", ...Array(21).fill("word")]);
  });

  it("reports Prisma error codes without connection details or arbitrary log input", () => {
    const message = "private connection data";
    expect(formatReceiptDatabaseError({ errorCode: "P1001", message })).toContain("(P1001)");
    expect(formatReceiptDatabaseError({ code: "P1017", message })).toContain("(P1017)");
    expect(formatReceiptDatabaseError({ code: message, message })).not.toContain(message);
    expect(formatReceiptDatabaseError(new Error(message))).not.toContain(message);
  });
  it("reports only manifest identity and status for the matching reviewed checksum", () => {
    expect(summarizeCurationReceipts([manifest], [complete])).toEqual({
      counts: { COMPLETE: 1, MISSING: 0, INCONSISTENT: 0, PENDING: 0, FAILED: 0 },
      batches: [{ id: manifest.id, kind: "kanji", status: "COMPLETE" }],
    });
  });

  it("prevents a whole apply selection when one exact receipt is already complete", () => {
    const pending = { ...manifest, id: "next", checksumSha256: "b".repeat(64) };
    const mixed = summarizeCurationReceipts([manifest, pending], [complete]);
    expect(receiptGateFailure(mixed)).toBeNull();
    expect(receiptGateFailure(mixed, "unfinished")).toMatch(/already complete/);
    expect(receiptGateFailure(mixed, "complete")).toMatch(/every manifest/);
    expect(
      receiptGateFailure(summarizeCurationReceipts([manifest], [complete]), "complete"),
    ).toBeNull();
  });

  it.each(["MISSING", "PENDING", "FAILED"] as const)(
    "permits %s before writing but not as post-write evidence",
    (status) => {
      const report = summarizeCurationReceipts(
        [manifest],
        status === "MISSING" ? [] : [{ ...complete, status }],
      );
      expect(receiptGateFailure(report, "unfinished")).toBeNull();
      expect(receiptGateFailure(report, "complete")).not.toBeNull();
    },
  );

  it("fails either expectation for inconsistent records", () => {
    const report = summarizeCurationReceipts([manifest], [{ ...complete, sourceVersion: "wrong" }]);
    for (const expectation of [undefined, "unfinished", "complete"] as const)
      expect(receiptGateFailure(report, expectation)).toMatch(/inconsistent/);
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
    expect(
      parseCurationReceiptSelection(["--expect", "complete", "--kanji-batch", "foo"]).expect,
    ).toBe("complete");
    expect(() =>
      parseCurationReceiptSelection(["--expect", "all", "--kanji-batch", "foo"]),
    ).toThrow();
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
