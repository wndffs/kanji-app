import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  calculateSha256,
  importKanjiDic2Xml,
  type KanjiDic2ImportDatabase,
  parseKanjiDic2Xml,
} from "../src";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "..", "..", "data", "fixtures", "kanjidic2-small.xml");
const fixtureXml = readFileSync(fixturePath, "utf8");

describe("KANJIDIC2 importer", () => {
  it("parses kanji metadata from the tiny fixture", () => {
    const parsed = parseKanjiDic2Xml(fixtureXml);

    expect(parsed.header).toEqual({
      fileVersion: "4",
      databaseVersion: "fixture-2026-06-22",
      dateOfCreation: "2026-06-22",
    });
    expect(parsed.characters).toHaveLength(3);
    expect(parsed.characters[0]).toMatchObject({
      sourceRecordId: "kanjidic2:65e5",
      character: "日",
      codepoint: "65e5",
      strokeCount: 4,
      grade: 1,
      jlptLevel: 4,
      frequencyRank: 1,
      readings: [
        { reading: "ニチ", readingType: "ONYOMI", sourceType: "ja_on", priority: 1 },
        { reading: "ジツ", readingType: "ONYOMI", sourceType: "ja_on", priority: 2 },
        { reading: "ひ", readingType: "KUNYOMI", sourceType: "ja_kun", priority: 3 },
      ],
      meanings: [
        { locale: "en-US", text: "day", isPrimary: true },
        { locale: "en-US", text: "sun", isPrimary: false },
      ],
    });
    expect(parsed.characters[2]).toMatchObject({
      character: "火",
      jlptLevel: null,
      frequencyRank: 574,
    });
    expect(parsed.characters[0]?.raw).toMatchObject({
      readings: [
        { reading: "ニチ", sourceType: "ja_on" },
        { reading: "ジツ", sourceType: "ja_on" },
        { reading: "ひ", sourceType: "ja_kun" },
      ],
      meanings: [
        { text: "day", sourceLanguage: "en" },
        { text: "sun", sourceLanguage: "en" },
      ],
    });
    expect(JSON.stringify(parsed.characters[0]?.raw)).not.toContain("ri4");
    expect(JSON.stringify(parsed.characters[0]?.raw)).not.toContain("jour");
  });

  it("writes DB records idempotently for the same source IDs", async () => {
    const db = new InMemoryKanjiDic2Db();

    await importKanjiDic2Xml(db, fixtureXml, { sourceFileName: "kanjidic2-small.xml" });
    await importKanjiDic2Xml(db, fixtureXml, { sourceFileName: "kanjidic2-small.xml" });

    expect(db.importRuns.size).toBe(1);
    expect(db.importedRecords.size).toBe(3);
    expect(db.kanjiRows.size).toBe(3);
    expect(db.readingRows.size).toBe(8);
    expect(db.meaningRows.size).toBe(5);
    expect(JSON.stringify([...db.importedRecords.values()])).not.toContain("ri4");
    expect(JSON.stringify([...db.importedRecords.values()])).not.toContain("jour");
    expect([...db.kanjiRows.values()].map((row) => row.kanjidicSourceId)).toEqual([
      "kanjidic2:65e5",
      "kanjidic2:6708",
      "kanjidic2:706b",
    ]);
    expect(
      [...db.kanjiRows.values()].every((row) => row.kanjidicImportedRecordId !== undefined),
    ).toBe(true);
  });

  it("records import run checksum and success status", async () => {
    const db = new InMemoryKanjiDic2Db();
    const checksum = calculateSha256(fixtureXml);
    const sourceDownloadedAt = new Date("2026-07-11T09:30:00.000Z");

    const result = await importKanjiDic2Xml(db, fixtureXml, {
      sourceFileName: "kanjidic2-small.xml",
      checksumSha256: checksum,
      sourceDownloadedAt,
    });

    expect(result).toMatchObject({
      checksumSha256: checksum,
      status: "SUCCESS",
      characterCount: 3,
      importedRecordCount: 3,
    });
    expect([...db.importRuns.values()][0]).toMatchObject({
      checksumSha256: checksum,
      sourceDownloadedAt,
      status: "SUCCESS",
      statsJson: { characters: 3 },
    });
    expect([...db.licenses.values()][0]).toMatchObject({
      spdxLikeId: "CC-BY-SA-4.0",
      url: "https://www.edrdg.org/edrdg/licence.html",
      requiresAttribution: true,
      requiresShareAlike: true,
    });
  });
});

class InMemoryKanjiDic2Db implements KanjiDic2ImportDatabase {
  readonly licenses = new Map<string, Record<string, unknown>>();
  readonly dataSources = new Map<string, Record<string, unknown>>();
  readonly importRuns = new Map<string, Record<string, unknown>>();
  readonly importedRecords = new Map<string, Record<string, unknown>>();
  readonly kanjiRows = new Map<string, Record<string, unknown>>();
  readonly readingRows = new Map<string, Record<string, unknown>>();
  readonly meaningRows = new Map<string, Record<string, unknown>>();
  private nextId = 1;

  readonly license = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["license"]["upsert"]>[0]) => {
      return this.upsert(this.licenses, args.where.name, args.update, args.create);
    },
  };

  readonly dataSource = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["dataSource"]["upsert"]>[0]) => {
      return this.upsert(this.dataSources, args.where.name, args.update, args.create);
    },
  };

  readonly importRun = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["importRun"]["upsert"]>[0]) => {
      const key = [
        args.where.dataSourceId_checksumSha256.dataSourceId,
        args.where.dataSourceId_checksumSha256.checksumSha256,
      ].join(":");

      return this.upsert(this.importRuns, key, args.update, args.create);
    },
    update: async (args: Parameters<KanjiDic2ImportDatabase["importRun"]["update"]>[0]) => {
      this.updateById(this.importRuns, args.where.id, args.data);
    },
  };

  readonly importedRecord = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["importedRecord"]["upsert"]>[0]) => {
      const key = [
        args.where.importRunId_recordType_sourceRecordId.importRunId,
        args.where.importRunId_recordType_sourceRecordId.recordType,
        args.where.importRunId_recordType_sourceRecordId.sourceRecordId,
      ].join(":");

      return this.upsert(this.importedRecords, key, args.update, args.create);
    },
  };

  readonly kanji = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["kanji"]["upsert"]>[0]) => {
      return this.upsert(this.kanjiRows, args.where.character, args.update, args.create);
    },
  };

  readonly kanjiReading = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["kanjiReading"]["upsert"]>[0]) => {
      const key = [
        args.where.kanjiId_reading_readingType.kanjiId,
        args.where.kanjiId_reading_readingType.reading,
        args.where.kanjiId_reading_readingType.readingType,
      ].join(":");

      await this.upsert(this.readingRows, key, args.update, args.create);
    },
  };

  readonly kanjiMeaning = {
    upsert: async (args: Parameters<KanjiDic2ImportDatabase["kanjiMeaning"]["upsert"]>[0]) => {
      const key = [
        args.where.kanjiId_locale_meaning_sourceKind.kanjiId,
        args.where.kanjiId_locale_meaning_sourceKind.locale,
        args.where.kanjiId_locale_meaning_sourceKind.meaning,
        args.where.kanjiId_locale_meaning_sourceKind.sourceKind,
      ].join(":");

      await this.upsert(this.meaningRows, key, args.update, args.create);
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

  private updateById(
    rows: Map<string, Record<string, unknown>>,
    id: string,
    data: Record<string, unknown>,
  ): void {
    const row = [...rows.values()].find((candidate) => candidate.id === id);

    if (row === undefined) {
      throw new Error(`Missing row ${id}.`);
    }

    Object.assign(row, data);
  }
}
