import { describe, expect, it, vi } from "vitest";
import type { Prisma } from "@prisma/client";
import {
  collectContentQualityReport,
  getContentQualityPage,
  type ContentQualityDatabase,
} from "../src/content-quality-report";

function databaseFixture(count: number) {
  const rows = Array.from({ length: count }, (_, index) => ({
    id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, "0")}`,
    targetId: `component-${index}`,
    kind: "COMPONENT",
    targetType: "COMPONENT",
    curriculumBand: "FOUNDATION",
    cards: [],
    mnemonics: [],
    dependencies: [],
    prerequisiteFor: [],
    courseLevelItems: [
      { sortOrder: index + 1, courseLevel: { levelNumber: 1, band: "FOUNDATION" } },
    ],
  }));
  const findMany = vi.fn(async (args: { take: number; where: { id?: { gt: string } } }) =>
    rows
      .filter((row) => args.where.id === undefined || row.id > args.where.id.gt)
      .slice(0, args.take),
  );
  const db = {
    learningItem: { findMany },
    component: {
      findMany: vi.fn(async (args: { where: { id: { in: string[] } } }) =>
        args.where.id.in.map((id) => ({
          id,
          meaningRu: "солнце",
          meaningEn: "sun",
          sourceKind: "PROJECT_AUTHORED",
        })),
      ),
    },
    kanji: { findMany: vi.fn().mockResolvedValue([]) },
    word: { findMany: vi.fn().mockResolvedValue([]) },
    sentence: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
    srsSystem: {
      findMany: vi.fn().mockResolvedValue([{ slug: "default-mvp", stages: [{ stageIndex: 1 }] }]),
    },
  } as unknown as ContentQualityDatabase;
  return { db, rows, findMany };
}

describe("bounded content-quality reporting", () => {
  it("uses direct word-example aggregates without loading sentence LearningItems or unbounded reverse dependencies", async () => {
    const { db, rows, findMany } = databaseFixture(1);
    Object.assign(rows[0], {
      kind: "WORD",
      targetType: "WORD",
      targetId: "00000000-0000-4000-8000-000000009999",
    });
    vi.mocked(db.word.findMany).mockResolvedValue([
      {
        id: rows[0].targetId,
        expression: "ほん",
        reading: "ほん",
        importedRecord: null,
        senses: [
          {
            locale: "ru-RU",
            sourceKind: "PROJECT_AUTHORED",
            meaning: "книга",
            partOfSpeech: "noun",
          },
        ],
      },
    ] as never);
    let evidence = { hasExample: true, invalidExampleCount: 1, fingerprint: "mixed" };
    Object.assign(db, {
      $queryRaw: vi.fn(async (query: Prisma.Sql) =>
        query.sql.includes("bool_or") ? [{ itemId: rows[0].id, ...evidence }] : [],
      ),
    });
    const mixed = await getContentQualityPage(db, { code: "invalid-source", limit: 1 });
    expect(mixed.issues).toContainEqual(
      expect.objectContaining({
        code: "invalid-source",
        severity: "blocker",
        message: expect.stringContaining("пример"),
      }),
    );
    expect(findMany.mock.calls[0]?.[0]).not.toHaveProperty("include.prerequisiteFor");
    expect(db.sentence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: [] } } }),
    );
    evidence = { hasExample: false, invalidExampleCount: 0, fingerprint: "empty" };
    expect((await getContentQualityPage(db, { code: "missing-example" })).issues).toHaveLength(1);
    evidence = { hasExample: true, invalidExampleCount: 0, fingerprint: "valid-v1" };
    const first = await collectContentQualityReport(db);
    evidence = { ...evidence, fingerprint: "valid-v2" };
    expect((await collectContentQualityReport(db)).contentVersion).not.toBe(first.contentVersion);
  });
  it("scans consecutive keyset pages and bounds the retained issue sample", async () => {
    const { db, findMany } = databaseFixture(201);
    const report = await collectContentQualityReport(db, { maxIssues: 2 });
    expect(report.scannedItems).toBe(201);
    expect(report.blockerCount).toBe(603);
    expect(report.issues).toHaveLength(2);
    expect(report.issuesTruncated).toBe(true);
    expect(findMany).toHaveBeenCalledTimes(3);
    expect(findMany.mock.calls.map(([args]) => args.take)).toEqual([100, 100, 100]);
    expect(findMany.mock.calls[1]?.[0].where.id?.gt).toBe("00000000-0000-0000-0000-000000000100");
  });
  it("keeps the content checksum independent of generation time and retained issue count", async () => {
    const { db, rows } = databaseFixture(2);
    const first = await collectContentQualityReport(db, { maxIssues: 0 });
    const repeated = await collectContentQualityReport(db, { maxIssues: 20 });
    expect(first.contentVersion).toBe(repeated.contentVersion);
    rows[0].curriculumBand = "N5";
    expect((await collectContentQualityReport(db)).contentVersion).not.toBe(first.contentVersion);
  });
  it("filters issue codes after a bounded item page and preserves continuation", async () => {
    const { db } = databaseFixture(3);
    const page = await getContentQualityPage(db, { code: "missing-card", limit: 2 });
    expect(page.issues).toHaveLength(2);
    expect(page.nextCursor).toBe("00000000-0000-0000-0000-000000000002");
    expect(
      (
        await getContentQualityPage(db, {
          code: "missing-card",
          limit: 2,
          cursor: page.nextCursor!,
        })
      ).issues,
    ).toHaveLength(1);
  });
  it("rejects oversized pages before reading the database", async () => {
    const { db, findMany } = databaseFixture(1);
    await expect(getContentQualityPage(db, { limit: 101 })).rejects.toThrow("between 1 and 100");
    expect(findMany).not.toHaveBeenCalled();
  });
});
