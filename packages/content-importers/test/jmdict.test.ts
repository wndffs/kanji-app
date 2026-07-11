import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  calculateSha256,
  importJmDictXml,
  type JmDictImportDatabase,
  parseJmDictXml,
} from "../src";

const currentDir = dirname(fileURLToPath(import.meta.url));
const fixturePath = join(currentDir, "..", "..", "..", "data", "fixtures", "jmdict-small.xml");
const fixtureXml = readFileSync(fixturePath, "utf8");

describe("JMdict importer", () => {
  it("parses one-kanji words, kana-only words, multiple senses, and multiple readings", () => {
    const parsed = parseJmDictXml(fixtureXml);

    expect(parsed.entries).toHaveLength(3);
    expect(parsed.entries[0]).toMatchObject({
      sourceRecordId: "jmdict:1000001",
      sequence: "1000001",
      kanjiElements: [{ expression: "一日", priorities: ["news1"] }],
      readingElements: [
        { reading: "いちにち", priorities: ["ichi1"], restrictions: [] },
        { reading: "ついたち", priorities: ["spec1"], restrictions: [] },
      ],
      senses: [
        {
          partOfSpeech: ["noun"],
          glosses: [
            { locale: "en-US", text: "one day", sourceLanguage: "eng" },
            { locale: "en-US", text: "first day of the month", sourceLanguage: "eng" },
          ],
        },
        {
          partOfSpeech: ["adverb"],
          glosses: [{ locale: "en-US", text: "all day", sourceLanguage: "eng" }],
        },
      ],
    });
    expect(parsed.entries[0].words).toEqual([
      expect.objectContaining({ expression: "一日", reading: "いちにち", commonnessRank: 1_000 }),
      expect.objectContaining({ expression: "一日", reading: "ついたち", commonnessRank: 1_000 }),
    ]);
    expect(parsed.entries[1].words).toEqual([
      expect.objectContaining({
        expression: "ありがとう",
        reading: "ありがとう",
        commonnessRank: 10_000,
        senses: [
          expect.objectContaining({ locale: "en-US", meaning: "thank you" }),
          expect.objectContaining({ locale: "ru-RU", meaning: "спасибо" }),
        ],
      }),
    ]);
    expect(parsed.entries[1].senses[0]?.glosses).toEqual([
      { locale: "en-US", text: "thank you", sourceLanguage: "eng" },
      { locale: "ru-RU", text: "спасибо", sourceLanguage: "rus" },
    ]);
    expect(parsed.glossCount).toBe(8);
    expect(parsed.unsupportedGlossCount).toBe(1);
    expect(JSON.stringify(parsed.entries[1].raw)).not.toContain("danke");
    expect(parsed.entries[2].words).toEqual([
      expect.objectContaining({ expression: "見る", reading: "みる" }),
      expect.objectContaining({ expression: "観る", reading: "みる" }),
    ]);
  });

  it("writes DB records idempotently", async () => {
    const db = new InMemoryJmDictDb();

    await importJmDictXml(db, fixtureXml, { sourceFileName: "jmdict-small.xml" });
    await importJmDictXml(db, fixtureXml, { sourceFileName: "jmdict-small.xml" });

    expect(db.importRuns.size).toBe(1);
    expect(db.importedRecords.size).toBe(3);
    expect(db.wordRows.size).toBe(5);
    expect(db.senseRows.size).toBe(12);
    expect([...db.senseRows.values()]).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ meaning: "danke" })]),
    );
    expect(JSON.stringify([...db.importedRecords.values()])).not.toContain("danke");
    expect([...db.wordRows.values()].map((row) => row.jmdictEntryId).sort()).toEqual([
      "jmdict:1000001",
      "jmdict:1000001",
      "jmdict:1000002",
      "jmdict:1000003",
      "jmdict:1000003",
    ]);
    expect([...db.wordRows.values()].every((row) => row.jmdictImportedRecordId !== undefined)).toBe(
      true,
    );
  });

  it("records import run checksum and success status", async () => {
    const db = new InMemoryJmDictDb();
    const checksum = calculateSha256(fixtureXml);
    const sourceDownloadedAt = new Date("2026-07-11T09:30:00.000Z");

    const result = await importJmDictXml(db, fixtureXml, {
      sourceFileName: "jmdict-small.xml",
      checksumSha256: checksum,
      sourceDownloadedAt,
    });

    expect(result).toMatchObject({
      checksumSha256: checksum,
      status: "SUCCESS",
      entryCount: 3,
      wordCount: 5,
      glossCount: 8,
      importedGlossCount: 7,
      unsupportedGlossCount: 1,
      importedRecordCount: 3,
    });
    expect([...db.importRuns.values()][0]).toMatchObject({
      checksumSha256: checksum,
      sourceDownloadedAt,
      status: "SUCCESS",
      statsJson: {
        entries: 3,
        words: 5,
        glosses: { total: 8, imported: 7, unsupported: 1 },
      },
    });
    expect([...db.licenses.values()][0]).toMatchObject({
      spdxLikeId: "LicenseRef-JMdict-Multilingual",
      url: "https://www.edrdg.org/edrdg/licence.html",
      requiresAttribution: true,
      requiresShareAlike: true,
    });
  });
});

class InMemoryJmDictDb implements JmDictImportDatabase {
  readonly licenses = new Map<string, Record<string, unknown>>();
  readonly dataSources = new Map<string, Record<string, unknown>>();
  readonly importRuns = new Map<string, Record<string, unknown>>();
  readonly importedRecords = new Map<string, Record<string, unknown>>();
  readonly wordRows = new Map<string, Record<string, unknown>>();
  readonly senseRows = new Map<string, Record<string, unknown>>();
  private nextId = 1;

  readonly license = {
    upsert: async (args: Parameters<JmDictImportDatabase["license"]["upsert"]>[0]) => {
      return this.upsert(this.licenses, args.where.name, args.update, args.create);
    },
  };

  readonly dataSource = {
    upsert: async (args: Parameters<JmDictImportDatabase["dataSource"]["upsert"]>[0]) => {
      return this.upsert(this.dataSources, args.where.name, args.update, args.create);
    },
  };

  readonly importRun = {
    upsert: async (args: Parameters<JmDictImportDatabase["importRun"]["upsert"]>[0]) => {
      const key = [
        args.where.dataSourceId_checksumSha256.dataSourceId,
        args.where.dataSourceId_checksumSha256.checksumSha256,
      ].join(":");

      return this.upsert(this.importRuns, key, args.update, args.create);
    },
    update: async (args: Parameters<JmDictImportDatabase["importRun"]["update"]>[0]) => {
      this.updateById(this.importRuns, args.where.id, args.data);
    },
  };

  readonly importedRecord = {
    upsert: async (args: Parameters<JmDictImportDatabase["importedRecord"]["upsert"]>[0]) => {
      const key = [
        args.where.importRunId_recordType_sourceRecordId.importRunId,
        args.where.importRunId_recordType_sourceRecordId.recordType,
        args.where.importRunId_recordType_sourceRecordId.sourceRecordId,
      ].join(":");

      return this.upsert(this.importedRecords, key, args.update, args.create);
    },
  };

  readonly word = {
    upsert: async (args: Parameters<JmDictImportDatabase["word"]["upsert"]>[0]) => {
      const key = [
        args.where.expression_reading.expression,
        args.where.expression_reading.reading,
      ].join(":");

      return this.upsert(this.wordRows, key, args.update, args.create);
    },
  };

  readonly wordSense = {
    upsert: async (args: Parameters<JmDictImportDatabase["wordSense"]["upsert"]>[0]) => {
      const key = [
        args.where.wordId_locale_meaning_partOfSpeech.wordId,
        args.where.wordId_locale_meaning_partOfSpeech.locale,
        args.where.wordId_locale_meaning_partOfSpeech.meaning,
        args.where.wordId_locale_meaning_partOfSpeech.partOfSpeech,
      ].join(":");

      await this.upsert(this.senseRows, key, args.update, args.create);
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
