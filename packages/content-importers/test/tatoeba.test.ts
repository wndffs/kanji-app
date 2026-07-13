import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import {
  calculateSha256,
  importTatoebaFiles,
  parseTatoebaFiles,
  type TatoebaImportDatabase,
} from "../src";

const currentDir = dirname(fileURLToPath(import.meta.url));
const sentencesPath = join(
  currentDir,
  "..",
  "..",
  "..",
  "data",
  "fixtures",
  "tatoeba-sentences-small.tsv",
);
const linksPath = join(currentDir, "..", "..", "..", "data", "fixtures", "tatoeba-links-small.tsv");
const sentencesTsv = readFileSync(sentencesPath, "utf8");
const linksTsv = readFileSync(linksPath, "utf8");

describe("Tatoeba importer", () => {
  it("parses Japanese sentences and Russian/English links from tiny fixtures", () => {
    const parsed = parseTatoebaFiles(sentencesTsv, linksTsv, { maxTextLength: 16 });

    expect(parsed.rows).toHaveLength(10);
    expect(parsed.links).toHaveLength(7);
    expect(parsed.sentences).toHaveLength(2);
    expect(parsed.sentences[0]).toMatchObject({
      sourceRecordId: "tatoeba:1001",
      sentenceId: "1001",
      japaneseText: "私は水を飲みます。",
      translationRu: "Я пью воду.",
      translationEn: "I drink water.",
      translations: [
        { sentenceId: "1002", language: "rus", text: "Я пью воду." },
        { sentenceId: "1003", language: "eng", text: "I drink water." },
      ],
      links: [
        { fromId: "1001", toId: "1002" },
        { fromId: "1001", toId: "1003" },
      ],
    });
    expect(parsed.sentences[1]).toMatchObject({
      sourceRecordId: "tatoeba:1004",
      japaneseText: "学校へ行きます。",
      translationRu: "Я иду в школу.",
      translationEn: "I go to school.",
      links: [
        { fromId: "1004", toId: "1005" },
        { fromId: "1006", toId: "1004" },
      ],
    });
  });

  it("filters empty, too-long, and untranslated Japanese rows", () => {
    const parsed = parseTatoebaFiles(sentencesTsv, linksTsv, { maxTextLength: 16 });

    expect(parsed.rejected).toEqual([
      { sentenceId: "1007", reason: "too-long" },
      { sentenceId: "1008", reason: "empty" },
      { sentenceId: "1009", reason: "missing-translation" },
    ]);
    expect(parsed.sentences.map((sentence) => sentence.sentenceId)).toEqual(["1001", "1004"]);
  });

  it("writes sentence records with source attribution idempotently", async () => {
    const db = new InMemoryTatoebaDb();
    const checksum = calculateSha256(`${sentencesTsv}\n${linksTsv}`);

    const first = await importTatoebaFiles(db, sentencesTsv, linksTsv, {
      sourceFileName: "tatoeba-sentences-small.tsv+tatoeba-links-small.tsv",
      checksumSha256: checksum,
      maxTextLength: 16,
    });
    const second = await importTatoebaFiles(db, sentencesTsv, linksTsv, {
      sourceFileName: "tatoeba-sentences-small.tsv+tatoeba-links-small.tsv",
      checksumSha256: checksum,
      maxTextLength: 16,
    });

    expect(first).toMatchObject({
      checksumSha256: checksum,
      status: "SUCCESS",
      sentenceCount: 2,
      importedRecordCount: 2,
      rejectedCount: 3,
    });
    expect(second.importRunId).toBe(first.importRunId);
    expect(db.importRuns.size).toBe(1);
    expect(db.importedRecords.size).toBe(2);
    expect(db.importedRecordUpsertCount).toBe(2);
    expect(db.sentenceRows.size).toBe(2);
    expect([...db.dataSources.values()][0]).toMatchObject({
      name: "Tatoeba",
      attributionText: "Example sentence data is derived from Tatoeba.",
    });
    expect([...db.licenses.values()][0]).toMatchObject({
      name: "Tatoeba sentence license",
      requiresAttribution: true,
    });
    expect([...db.sentenceRows.values()][0]).toMatchObject({
      japaneseText: "私は水を飲みます。",
      translationRu: "Я пью воду.",
      translationEn: "I drink water.",
      sourceId: "tatoeba:1001",
    });
    expect([...db.importedRecords.values()][0]).toMatchObject({
      recordType: "TATOEBA_SENTENCE",
      sourceRecordId: "tatoeba:1001",
      rawJson: {
        sentenceId: "1001",
        links: [
          { fromId: "1001", toId: "1002" },
          { fromId: "1001", toId: "1003" },
        ],
      },
    });
  });

  it("marks a failed write and retries it with the same checksum", async () => {
    const db = new InMemoryTatoebaDb();
    const checksum = calculateSha256(`${sentencesTsv}\n${linksTsv}`);
    const options = {
      sourceFileName: "tatoeba-sentences-small.tsv+tatoeba-links-small.tsv",
      checksumSha256: checksum,
      maxTextLength: 16,
    } as const;

    db.failNextSentenceWrite = true;

    await expect(importTatoebaFiles(db, sentencesTsv, linksTsv, options)).rejects.toThrow(
      "Simulated sentence write failure.",
    );
    expect([...db.importRuns.values()][0]).toMatchObject({
      status: "FAILED",
      errorText: "Simulated sentence write failure.",
    });

    const result = await importTatoebaFiles(db, sentencesTsv, linksTsv, options);

    expect(result.status).toBe("SUCCESS");
    expect([...db.importRuns.values()][0]).toMatchObject({ status: "SUCCESS", errorText: null });
    expect(db.sentenceRows.size).toBe(2);
  });

  it("retains sentence/link provenance without importing audio metadata", async () => {
    const db = new InMemoryTatoebaDb();

    await importTatoebaFiles(db, sentencesTsv, linksTsv, {
      sourceFileName: "tatoeba-sentences-small.tsv+tatoeba-links-small.tsv",
      maxTextLength: 16,
    });

    expect([...db.licenses.values()][0]).toMatchObject({
      requiresAttribution: true,
      notes: expect.stringContaining("does not import audio"),
    });
    expect([...db.dataSources.values()][0]).toMatchObject({
      notes: expect.stringContaining("Audio is intentionally excluded"),
    });

    for (const record of db.importedRecords.values()) {
      expect(record.rawJson).toEqual(
        expect.objectContaining({
          sentenceId: expect.any(String),
          links: expect.any(Array),
        }),
      );
      expect(JSON.stringify(record.rawJson).toLowerCase()).not.toContain("audio");
    }
  });
});

class InMemoryTatoebaDb implements TatoebaImportDatabase {
  readonly licenses = new Map<string, Record<string, unknown>>();
  readonly dataSources = new Map<string, Record<string, unknown>>();
  readonly importRuns = new Map<string, Record<string, unknown>>();
  readonly importedRecords = new Map<string, Record<string, unknown>>();
  readonly sentenceRows = new Map<string, Record<string, unknown>>();
  importedRecordUpsertCount = 0;
  failNextSentenceWrite = false;
  private nextId = 1;

  readonly license = {
    upsert: async (args: Parameters<TatoebaImportDatabase["license"]["upsert"]>[0]) => {
      return this.upsert(this.licenses, args.where.name, args.update, args.create);
    },
  };

  readonly dataSource = {
    upsert: async (args: Parameters<TatoebaImportDatabase["dataSource"]["upsert"]>[0]) => {
      return this.upsert(this.dataSources, args.where.name, args.update, args.create);
    },
  };

  readonly importRun = {
    findUnique: async (args: Parameters<TatoebaImportDatabase["importRun"]["findUnique"]>[0]) => {
      const key = [
        args.where.dataSourceId_checksumSha256.dataSourceId,
        args.where.dataSourceId_checksumSha256.checksumSha256,
      ].join(":");
      const row = this.importRuns.get(key);

      return row === undefined
        ? null
        : {
            id: String(row.id),
            status: row.status as "PENDING" | "SUCCESS" | "FAILED",
          };
    },
    upsert: async (args: Parameters<TatoebaImportDatabase["importRun"]["upsert"]>[0]) => {
      const key = [
        args.where.dataSourceId_checksumSha256.dataSourceId,
        args.where.dataSourceId_checksumSha256.checksumSha256,
      ].join(":");

      return this.upsert(this.importRuns, key, args.update, args.create);
    },
    update: async (args: Parameters<TatoebaImportDatabase["importRun"]["update"]>[0]) => {
      this.updateById(this.importRuns, args.where.id, args.data);
    },
  };

  readonly importedRecord = {
    upsert: async (args: Parameters<TatoebaImportDatabase["importedRecord"]["upsert"]>[0]) => {
      this.importedRecordUpsertCount += 1;
      const key = [
        args.where.importRunId_recordType_sourceRecordId.importRunId,
        args.where.importRunId_recordType_sourceRecordId.recordType,
        args.where.importRunId_recordType_sourceRecordId.sourceRecordId,
      ].join(":");

      await this.upsert(this.importedRecords, key, args.update, args.create);
    },
  };

  readonly sentence = {
    upsert: async (args: Parameters<TatoebaImportDatabase["sentence"]["upsert"]>[0]) => {
      if (this.failNextSentenceWrite) {
        this.failNextSentenceWrite = false;
        throw new Error("Simulated sentence write failure.");
      }

      const key = [
        args.where.dataSourceId_sourceId.dataSourceId,
        args.where.dataSourceId_sourceId.sourceId,
      ].join(":");

      await this.upsert(this.sentenceRows, key, args.update, args.create);
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
