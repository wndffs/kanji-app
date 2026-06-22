import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  calculateSha256,
  importKanjiVgXml,
  type KanjiVgImportDatabase,
  parseKanjiVgXml,
} from "../src";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "..", "..", "data", "fixtures", "kanjivg-small.svg");
const fixtureXml = readFileSync(fixturePath, "utf8");

describe("KanjiVG importer", () => {
  it("parses stroke paths from the tiny fixture", () => {
    const parsed = parseKanjiVgXml(fixtureXml);

    expect(parsed.characters).toHaveLength(1);
    expect(parsed.characters[0]).toMatchObject({
      sourceRecordId: "kanjivg:04e00",
      character: "一",
      codepoint: "04e00",
      viewBox: "0 0 109 109",
      strokeCount: 1,
      strokes: [
        {
          id: "kvg:04e00-s1",
          order: 1,
          path: "M18,54 C34,52 72,52 91,54",
          type: "㇐",
        },
      ],
    });
  });

  it("writes DB records idempotently for the same source IDs", async () => {
    const db = new InMemoryKanjiVgDb();

    await importKanjiVgXml(db, fixtureXml, { sourceFileName: "kanjivg-small.svg" });
    await importKanjiVgXml(db, fixtureXml, { sourceFileName: "kanjivg-small.svg" });

    expect(db.importRuns.size).toBe(1);
    expect(db.importedRecords.size).toBe(1);
    expect(db.kanjiRows.size).toBe(1);
    expect(db.strokeGraphicRows.size).toBe(1);
    expect([...db.strokeGraphicRows.values()][0]).toMatchObject({
      sourceRecordId: "kanjivg:04e00",
      viewBox: "0 0 109 109",
      strokesJson: [
        {
          id: "kvg:04e00-s1",
          order: 1,
          path: "M18,54 C34,52 72,52 91,54",
          type: "㇐",
        },
      ],
    });
  });

  it("records import run checksum and success status", async () => {
    const db = new InMemoryKanjiVgDb();
    const checksum = calculateSha256(fixtureXml);

    const result = await importKanjiVgXml(db, fixtureXml, {
      sourceFileName: "kanjivg-small.svg",
      checksumSha256: checksum,
    });

    expect(result).toMatchObject({
      checksumSha256: checksum,
      status: "SUCCESS",
      characterCount: 1,
      importedRecordCount: 1,
    });
    expect([...db.importRuns.values()][0]).toMatchObject({
      checksumSha256: checksum,
      status: "SUCCESS",
      statsJson: { characters: 1 },
    });
  });
});

class InMemoryKanjiVgDb implements KanjiVgImportDatabase {
  readonly licenses = new Map<string, Record<string, unknown>>();
  readonly dataSources = new Map<string, Record<string, unknown>>();
  readonly importRuns = new Map<string, Record<string, unknown>>();
  readonly importedRecords = new Map<string, Record<string, unknown>>();
  readonly kanjiRows = new Map<string, Record<string, unknown>>();
  readonly strokeGraphicRows = new Map<string, Record<string, unknown>>();
  private nextId = 1;

  readonly license = {
    upsert: async (args: Parameters<KanjiVgImportDatabase["license"]["upsert"]>[0]) => {
      return this.upsert(this.licenses, args.where.name, args.update, args.create);
    },
  };

  readonly dataSource = {
    upsert: async (args: Parameters<KanjiVgImportDatabase["dataSource"]["upsert"]>[0]) => {
      return this.upsert(this.dataSources, args.where.name, args.update, args.create);
    },
  };

  readonly importRun = {
    upsert: async (args: Parameters<KanjiVgImportDatabase["importRun"]["upsert"]>[0]) => {
      const key = [
        args.where.dataSourceId_checksumSha256.dataSourceId,
        args.where.dataSourceId_checksumSha256.checksumSha256,
      ].join(":");

      return this.upsert(this.importRuns, key, args.update, args.create);
    },
  };

  readonly importedRecord = {
    upsert: async (args: Parameters<KanjiVgImportDatabase["importedRecord"]["upsert"]>[0]) => {
      const key = [
        args.where.importRunId_recordType_sourceRecordId.importRunId,
        args.where.importRunId_recordType_sourceRecordId.recordType,
        args.where.importRunId_recordType_sourceRecordId.sourceRecordId,
      ].join(":");

      await this.upsert(this.importedRecords, key, args.update, args.create);
    },
  };

  readonly kanji = {
    upsert: async (args: Parameters<KanjiVgImportDatabase["kanji"]["upsert"]>[0]) => {
      return this.upsert(this.kanjiRows, args.where.character, args.update, args.create);
    },
  };

  readonly kanjiStrokeGraphic = {
    upsert: async (args: Parameters<KanjiVgImportDatabase["kanjiStrokeGraphic"]["upsert"]>[0]) => {
      await this.upsert(
        this.strokeGraphicRows,
        args.where.sourceRecordId,
        args.update,
        args.create,
      );
    },
  };

  private upsert(
    rows: Map<string, Record<string, unknown>>,
    key: string,
    update: Record<string, unknown>,
    create: Record<string, unknown>,
  ): { readonly id: string } {
    const existing = rows.get(key);

    if (existing !== undefined) {
      const updated = { ...existing, ...update };
      rows.set(key, updated);
      return { id: String(updated.id) };
    }

    const row = { id: `row-${this.nextId++}`, ...create };
    rows.set(key, row);

    return { id: String(row.id) };
  }
}
