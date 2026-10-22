import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";
import {
  EXAMPLE_SENTENCE_SELECT,
  isEligibleExampleSentence,
  loadItemExampleSentences,
  loadWordExampleQuality,
  toExampleSentenceDto,
  writeWordExample,
  type ExampleSentenceRecord,
} from "../src/word-examples";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const item = (n = 1) => ({ id: id(n), targetId: id(1000 + n), targetType: "WORD" });

function authored(): ExampleSentenceRecord {
  return {
    id: id(9000),
    japaneseText: "本を読みます。",
    readingText: "ほんをよみます。",
    translationRu: "Читаю книгу.",
    translationEn: "I read a book.",
    difficulty: 1,
    sourceId: null,
    importedRecordId: null,
    dataSourceId: id(8000),
    licenseId: id(7000),
    importedRecord: null,
    license: { id: id(7000), name: "Project-authored", scope: "PROJECT_AUTHORED" },
    dataSource: {
      id: id(8000),
      name: "Project examples",
      licenseId: id(7000),
      homepageUrl: "https://example.test/project",
      downloadUrl: null,
      attributionText: "Independent project authors.",
    },
  };
}

function imported(): ExampleSentenceRecord {
  const sentence = authored();
  return {
    ...sentence,
    sourceId: "123",
    importedRecordId: id(6000),
    license: { ...sentence.license, name: "CC-BY-2.0", scope: "OPEN_DATA" },
    importedRecord: {
      id: id(6000),
      sourceRecordId: "123",
      recordType: "TATOEBA_SENTENCE",
      importRun: {
        dataSourceId: sentence.dataSourceId!,
        status: "SUCCESS",
        sourceVersion: "2026-10-22",
        checksumSha256: "a".repeat(64),
      },
    },
  };
}

describe("word example licensing and identity", () => {
  it("uses a UUID identity, exact word/sentence uniqueness, foreign keys and a per-word publication/order index", () => {
    const model = Prisma.dmmf.datamodel.models.find((model) => model.name === "WordExample")!;
    expect(model.fields.find((field) => field.name === "id")).toMatchObject({
      type: "String",
      isId: true,
      default: { name: "uuid" },
    });
    expect(model.uniqueFields).toContainEqual(["wordId", "sentenceId"]);
    expect(model.fields.find((field) => field.name === "word")?.relationFromFields).toEqual([
      "wordId",
    ]);
    expect(model.fields.find((field) => field.name === "sentence")?.relationFromFields).toEqual([
      "sentenceId",
    ]);
    const sql = readFileSync(
      new URL(
        "../prisma/migrations/20261022120000_add_word_examples/migration.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "WordExample"');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS "WordExample_wordId_sentenceId_key"');
    expect(sql).toContain('("wordId", "status", "sortOrder", "id")');
    expect(sql).not.toMatch(/(?:^|\n)\s*(?:DROP|DELETE|UPDATE|INSERT)\b/u);
    expect(sql).not.toMatch(/\b(?:LearningCard|UserSrsState|Dependency)\b/u);
  });

  it("labels independently authored examples explicitly and preserves the existing bilingual DTO", () => {
    expect(toExampleSentenceDto(authored())).toMatchObject({
      japaneseText: "本を読みます。",
      translationRu: "Читаю книгу.",
      translationEn: "I read a book.",
      attribution: {
        sourceName: "Project examples (авторский пример проекта)",
        licenseName: "Project-authored",
        attributionText: "Independent project authors.",
        sourceUrl: "https://example.test/project",
      },
    });
    const sentence = imported();
    const before = structuredClone(sentence);
    expect(toExampleSentenceDto(sentence)?.attribution?.sourceName).toBe("Project examples");
    expect(sentence).toEqual(before);
  });

  const invalidAuthored: readonly [string, (s: ExampleSentenceRecord) => void][] = [
    ["missing Japanese", (s) => Object.assign(s, { japaneseText: "\t\n " })],
    ["missing RU", (s) => Object.assign(s, { translationRu: " " })],
    ["missing EN", (s) => Object.assign(s, { translationEn: null })],
    ["missing license", (s) => Object.assign(s.license, { name: "" })],
    ["private license", (s) => Object.assign(s.license, { scope: "USER_PRIVATE" })],
    ["open license without an import", (s) => Object.assign(s.license, { scope: "OPEN_DATA" })],
    ["missing source", (s) => Object.assign(s, { dataSource: null })],
    ["missing attribution", (s) => Object.assign(s.dataSource!, { attributionText: "\t\n" })],
    ["missing source name", (s) => Object.assign(s.dataSource!, { name: "" })],
    [
      "insecure source URL",
      (s) => Object.assign(s.dataSource!, { homepageUrl: "http://example.test/source" }),
    ],
    [
      "credential-bearing source URL",
      (s) =>
        Object.assign(s.dataSource!, { homepageUrl: "https://user:password@example.test/source" }),
    ],
    ["missing source URL", (s) => Object.assign(s.dataSource!, { homepageUrl: null })],
    [
      "newline in source URL",
      (s) => Object.assign(s.dataSource!, { homepageUrl: "https://example.test\n" }),
    ],
    ["conflicting license", (s) => Object.assign(s.dataSource!, { licenseId: id(44) })],
  ];
  it.each(invalidAuthored)("rejects %s", (_name, change) => {
    const sentence = authored();
    change(sentence);
    expect(isEligibleExampleSentence(sentence)).toBe(false);
    expect(toExampleSentenceDto(sentence)).toBeNull();
  });

  const invalidImported: readonly [string, (s: ExampleSentenceRecord) => void][] = [
    ["failed import", (s) => Object.assign(s.importedRecord!.importRun, { status: "FAILED" })],
    ["missing version", (s) => Object.assign(s.importedRecord!.importRun, { sourceVersion: "" })],
    [
      "invalid checksum",
      (s) => Object.assign(s.importedRecord!.importRun, { checksumSha256: "unknown" }),
    ],
    ["missing imported record", (s) => Object.assign(s, { importedRecord: null })],
    [
      "unrelated imported record type",
      (s) => Object.assign(s.importedRecord!, { recordType: "JMDICT_ENTRY" }),
    ],
    ["mismatched source identity", (s) => Object.assign(s, { sourceId: "other" })],
    [
      "mismatched import data source",
      (s) => Object.assign(s.importedRecord!.importRun, { dataSourceId: id(44) }),
    ],
    ["falsely authored open data", (s) => Object.assign(s.license, { scope: "PROJECT_AUTHORED" })],
  ];
  it.each(invalidImported)("rejects imported provenance with %s", (_name, change) => {
    const sentence = imported();
    change(sentence);
    expect(isEligibleExampleSentence(sentence)).toBe(false);
  });

  it("allows a traceable HTTPS download URL when the homepage is absent", () => {
    const sentence = authored();
    Object.assign(sentence.dataSource!, {
      homepageUrl: null,
      downloadUrl: "https://example.test/source.json",
    });
    expect(toExampleSentenceDto(sentence)?.attribution?.sourceUrl).toBe(
      "https://example.test/source.json",
    );
  });

  it("idempotently writes only a direct link, preserves its identity and keeps homograph readings separate by wordId", async () => {
    const links = new Map<string, object>();
    const upsert = vi.fn(async ({ where, create, update }) => {
      const key = JSON.stringify(where.wordId_sentenceId);
      const existing = links.get(key);
      const row = existing ? { ...existing, ...update } : { id: id(links.size + 5000), ...create };
      links.set(key, row);
      return row;
    });
    const findUnique = vi.fn().mockResolvedValue(authored());
    const db = { wordExample: { upsert }, sentence: { findUnique } } as never;
    const input = {
      wordId: id(1),
      sentenceId: authored().id,
      status: "PUBLISHED" as const,
      sortOrder: 2,
    };
    const first = await writeWordExample(db, input);
    expect(await writeWordExample(db, input)).toEqual(first);
    expect(links.size).toBe(1);
    await writeWordExample(db, { ...input, wordId: id(2) });
    expect(links.size).toBe(2);
    expect(upsert.mock.calls[0]![0].create).not.toHaveProperty("learningItem");
    findUnique.mockResolvedValue({ ...authored(), translationEn: "" });
    await expect(writeWordExample(db, input)).rejects.toThrow("Cannot publish");
    expect(upsert).toHaveBeenCalledTimes(3);
    await writeWordExample(db, { ...input, status: "DRAFT" });
    expect(upsert).toHaveBeenCalledTimes(4);
    await expect(writeWordExample(db, { ...input, sortOrder: -1 })).rejects.toThrow("non-negative");
  });
});

describe("bounded example queries", () => {
  it("applies per-item limits inside both indexed lateral branches, batches 100 identities and hydrates only bounded selected IDs", async () => {
    const items = Array.from({ length: 201 }, (_, index) => item(index + 1));
    const sentences = Array.from({ length: 5 }, (_, index) => ({
      ...authored(),
      id: id(9000 + index),
    }));
    const $queryRaw = vi.fn(async (query: Prisma.Sql) =>
      items
        .filter((item) => query.values.includes(item.id))
        .flatMap((item) =>
          sentences.map((sentence) => ({ itemId: item.id, sentenceId: sentence.id })),
        ),
    );
    const findMany = vi.fn().mockResolvedValue(sentences);
    const db = { $queryRaw, sentence: { findMany } } as never;
    const results = await loadItemExampleSentences(db, items, 5);
    expect(results.size).toBe(201);
    expect([...results.values()].every((examples) => examples.length === 5)).toBe(true);
    expect($queryRaw).toHaveBeenCalledTimes(3);
    for (const [query] of $queryRaw.mock.calls) {
      expect(items.filter((item) => query.values.includes(item.id)).length).toBeLessThanOrEqual(
        100,
      );
      expect(query.sql).toContain("CROSS JOIN LATERAL");
      expect(query.sql.match(/LIMIT \?/gu)).toHaveLength(3);
      expect(query.sql).toContain("e.status = 'PUBLISHED'");
      expect(query.sql).toContain('explicit_link."wordId" = root."targetId"');
      expect(query.sql).toContain("si.status = 'PUBLISHED'");
      expect(query.sql).not.toMatch(/\b(?:INSERT|UPDATE|DELETE|LearningCard|UserSrsState)\b/u);
    }
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: sentences.map((s) => s.id) } },
      select: EXAMPLE_SENTENCE_SELECT,
    });
  });

  it("revalidates hydrated provenance to fail closed if it changes after SQL selection", async () => {
    const sentence = authored();
    const db = {
      $queryRaw: vi.fn().mockResolvedValue([{ itemId: item().id, sentenceId: sentence.id }]),
      sentence: { findMany: vi.fn().mockResolvedValue([{ ...sentence, translationEn: " " }]) },
    } as never;
    expect((await loadItemExampleSentences(db, [item()], 3)).get(item().id)).toBeUndefined();
  });

  it("scans all published links for quality without the display cap and returns only per-word aggregates", async () => {
    const $queryRaw = vi
      .fn()
      .mockResolvedValue([
        { itemId: item().id, hasExample: true, invalidExampleCount: 1, fingerprint: "hash" },
      ]);
    const db = { $queryRaw } as never;
    expect((await loadWordExampleQuality(db, [item()])).get(item().id)).toMatchObject({
      hasExample: true,
      invalidExampleCount: 1,
    });
    const query = $queryRaw.mock.calls[0]![0] as Prisma.Sql;
    expect(query.sql).toContain("bool_or(q.eligible)");
    expect(query.sql).toContain("FILTER (WHERE NOT q.eligible)");
    expect(query.sql).not.toContain("LIMIT");
  });

  it("does not query empty batches and rejects unsupported display limits", async () => {
    const $queryRaw = vi.fn();
    const db = { $queryRaw } as never;
    expect(await loadItemExampleSentences(db, [], 3)).toEqual(new Map());
    expect(await loadWordExampleQuality(db, [])).toEqual(new Map());
    expect($queryRaw).not.toHaveBeenCalled();
    await expect(loadItemExampleSentences(db, [item()], 101 as 3)).rejects.toThrow("3 or 5");
  });
});
