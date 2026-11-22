import type { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";
import { buildMainCourseWordBatch } from "../packages/db/src/main-course-word-content";
import { auditReviewedWordInventory } from "./audit-reviewed-word-inventory.mts";

const batch = buildMainCourseWordBatch();

describe("reviewed word source inventory", () => {
  it("reports only scoped counts for absent, conflicting, incomplete and exact rows", async () => {
    const [first, second, third] = batch.words;
    const findMany = vi.fn().mockResolvedValue([
      {
        expression: first!.expression,
        reading: first!.reading,
        jmdictEntryId: first!.jmdictEntryId,
        importedRecord: {
          recordType: "JMDICT_ENTRY",
          sourceRecordId: first!.jmdictEntryId,
          importRun: { status: "SUCCESS" },
        },
      },
      {
        expression: second!.expression,
        reading: second!.reading,
        jmdictEntryId: "jmdict:999999",
        importedRecord: null,
      },
      {
        expression: third!.expression,
        reading: third!.reading,
        jmdictEntryId: third!.jmdictEntryId,
        importedRecord: null,
      },
    ]);
    const word = { findMany } as unknown as Prisma.TransactionClient["word"];
    const report = await auditReviewedWordInventory({ word }, [batch]);
    expect(findMany).toHaveBeenCalledOnce();
    expect(findMany.mock.calls[0]?.[0].where.OR).toContainEqual({
      expression: first!.expression,
      reading: first!.reading,
    });
    expect(report).toEqual({
      status: "source-inventory-audited",
      existingRowsNotRevalidated: true,
      manifests: [
        {
          id: batch.id,
          words: batch.words.length,
          total: batch.words.length,
          missing: batch.words.length - 3,
          conflicting: 1,
          incomplete: 1,
          existingExact: 1,
        },
      ],
    });
  });

  it("counts explicit alternate readings and rejects unreviewed manifests before querying", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const word = { findMany } as unknown as Prisma.TransactionClient["word"];
    await expect(
      auditReviewedWordInventory({ word }, [{ ...batch, reviewedAt: null }]),
    ).rejects.toThrow("reviewed");
    expect(findMany).not.toHaveBeenCalled();
    const [first, ...rest] = batch.words;
    const report = await auditReviewedWordInventory({ word }, [
      { ...batch, words: [{ ...first!, acceptedReadings: ["さん"] }, ...rest] },
    ]);
    expect(report.manifests[0]).toMatchObject({
      total: batch.words.length + 1,
      missing: batch.words.length + 1,
    });
  });
});
