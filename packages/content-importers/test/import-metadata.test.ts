import { describe, expect, it } from "vitest";

import { readImportMetadata } from "../src/cli/import-options";
import { calculateSha256, executeTrackedImport, forEachConcurrent, verifySha256 } from "../src";

describe("import source metadata", () => {
  it("verifies a pinned source checksum", () => {
    const content = "source snapshot";
    const checksum = calculateSha256(content);

    expect(verifySha256(content, checksum.toUpperCase())).toBe(checksum);
    expect(() => verifySha256(content, "0".repeat(64))).toThrow(/SHA-256 mismatch/u);
    expect(() => verifySha256(content, "not-a-checksum")).toThrow(/64 hexadecimal/u);
  });

  it("parses workflow metadata flags", () => {
    expect(
      readImportMetadata([
        "--source-version",
        "2026-07-11",
        "--source-downloaded-at",
        "2026-07-11T09:30:00.000Z",
        "--checksum-sha256",
        "a".repeat(64),
      ]),
    ).toEqual({
      sourceVersion: "2026-07-11",
      sourceDownloadedAt: new Date("2026-07-11T09:30:00.000Z"),
      checksumSha256: "a".repeat(64),
    });
  });

  it("rejects an invalid downloaded timestamp", () => {
    expect(() => readImportMetadata(["--source-downloaded-at", "not-a-date"])).toThrow(/ISO-8601/u);
  });
});

describe("bounded import concurrency", () => {
  it("processes every row without exceeding the limit", async () => {
    let active = 0;
    let maximumActive = 0;
    const processed: number[] = [];

    await forEachConcurrent([1, 2, 3, 4, 5, 6], 3, async (value) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      processed.push(value);
      active -= 1;
    });

    expect(processed.sort((left, right) => left - right)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(maximumActive).toBe(3);
  });

  it("rejects an invalid concurrency", async () => {
    await expect(forEachConcurrent([1], 0, async () => undefined)).rejects.toThrow(
      /positive integer/u,
    );
  });

  it("stops scheduling new rows after a worker fails", async () => {
    const processed: number[] = [];

    await expect(
      forEachConcurrent([1, 2, 3, 4, 5, 6], 2, async (value) => {
        processed.push(value);
        await Promise.resolve();

        if (value === 2) {
          throw new Error("row failed");
        }
      }),
    ).rejects.toThrow("row failed");
    expect(processed.length).toBeLessThan(6);
  });
});

describe("tracked import lifecycle", () => {
  it("records failed writes before rethrowing", async () => {
    const updates: Record<string, unknown>[] = [];
    const importRun = {
      update: async ({ data }: { readonly data: Record<string, unknown> }) => {
        updates.push(data);
      },
    };

    await expect(
      executeTrackedImport(importRun, "run-1", { rows: 1 }, async () => {
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");
    expect(updates).toEqual([
      expect.objectContaining({ status: "FAILED", errorText: "write failed" }),
    ]);
  });
});
