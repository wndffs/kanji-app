import type { Prisma } from "@prisma/client";
import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import { afterEach, describe, expect, it, vi } from "vitest";

import { validateQualityItem } from "../src/content-quality";
import {
  collectContentQualityReport,
  loadContentQualityItems,
  type ContentQualityDatabase,
} from "../src/content-quality-report";
import * as wordContent from "../src/main-course-word-content";
import { readingNoteProofChecksum, readingNoteProofData } from "../src/jmdict-reading-note-proof";

afterEach(() => vi.restoreAllMocks());

const EXPLICIT_BATCHES = wordContent
  .buildMainCourseWordBatches()
  .filter((batch) =>
    batch.words.some((word) => word.acceptedReadingEntryIds || word.sourceNoteReadings),
  );

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Pair = readonly [expression: string, primary: string, aliases: readonly string[]];
const PAIRS: readonly Pair[] = [
  ["日本", "にほん", ["にっぽん"]],
  ["一人", "ひとり", ["いちにん"]],
  ["二人", "ふたり", ["ににん"]],
  ["水田", "すいでん", ["みずた"]],
  ["左右", "さゆう", ["そう"]],
];

describe("bounded canonical JMdict sibling-reading evidence", () => {
  it("preserves legacy primary-only and sibling report hashes", async () => {
    const primary = await collectContentQualityReport(fixture([["日本", "にほん", []]]).db);
    const siblings = await collectContentQualityReport(fixture(PAIRS).db);
    expect([primary.contentVersion, siblings.contentVersion]).toEqual([
      "46e50b552f2eb4d09d1e0b1a0a03c1e7bb5325ee8fd490930da817f2e6265da0",
      "5000234268e7e44c11bb22d9320284ab78a07f7e7639ae8a20bff243e940834e",
    ]);
  });

  it("verifies the five alternate pairs only on their exact entry, record and successful source chain", async () => {
    const h = fixture(PAIRS);
    const items = await loadContentQualityItems(h.db);
    expect(items.map((item) => item.sourceReadings)).toEqual(
      PAIRS.map(([, primary, aliases]) => [primary, ...aliases]),
    );
    for (const item of items)
      expect(
        validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
      ).toEqual([]);
    expect(h.findWords).toHaveBeenCalledTimes(2);
    expect(h.findWords.mock.calls[1]?.[0]).toMatchObject({
      take: 1001,
      where: {
        OR: h.words.map((word, index) => ({
          expression: word.expression,
          reading: { in: PAIRS[index]![2] },
          jmdictEntryId: word.jmdictEntryId,
          jmdictImportedRecordId: word.jmdictImportedRecordId,
          importedRecord: {
            is: {
              recordType: "JMDICT_ENTRY",
              sourceRecordId: word.jmdictEntryId,
              importRunId: word.importedRecord.importRunId,
              importRun: {
                is: {
                  id: word.importedRecord.importRun.id,
                  status: "SUCCESS",
                  dataSourceId: word.importedRecord.importRun.dataSourceId,
                  sourceVersion: word.importedRecord.importRun.sourceVersion,
                  checksumSha256: word.importedRecord.importRun.checksumSha256,
                },
              },
            },
          },
        })),
      },
    });
  });

  it("keeps primary-only snapshots and query counts unchanged even when siblings exist", async () => {
    const h = fixture([["日本", "にほん", []]]);
    const before = await collectContentQualityReport(h.db);
    expect(h.findWords).toHaveBeenCalledTimes(1);
    h.aliases.push({ ...structuredClone(h.words[0]!), id: id(9000), reading: "にっぽん" });
    h.findWords.mockClear();
    expect((await collectContentQualityReport(h.db)).contentVersion).toBe(before.contentVersion);
    expect(h.findWords).toHaveBeenCalledTimes(1);
    expect((await loadContentQualityItems(h.db))[0]!.sourceReadings).toEqual(["にほん"]);
    expect(h.findWords.mock.calls.every(([args]) => args?.where?.OR === undefined)).toBe(true);
  });

  it("normalizes a requested katakana answer but never broadens to an unrequested sibling", async () => {
    const h = fixture();
    const answer = h.items[0]!.cards[0]!.answers[1]!;
    answer.text = "ニッポン";
    h.aliases.push({ ...structuredClone(h.aliases[0]!), id: id(9000), reading: "にほんご" });
    const item = (await loadContentQualityItems(h.db))[0]!;
    expect(item.sourceReadings).toEqual(["にほん", "にっぽん"]);
    expect(
      validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
    ).toEqual([]);
  });

  it.each([
    "expression",
    "entry",
    "record-link",
    "record-id",
    "record-type",
    "source-record-id",
    "run-link",
    "run-id",
    "run-status",
    "data-source",
    "version",
    "checksum",
    "unrequested",
  ])("does not accept a returned sibling with mismatched %s evidence", async (condition) => {
    const h = fixture();
    const sibling = h.aliases[0]!;
    const record = sibling.importedRecord;
    const run = record.importRun;
    if (condition === "expression") sibling.expression = "日本語";
    if (condition === "entry") sibling.jmdictEntryId = "jmdict:other";
    if (condition === "record-link") sibling.jmdictImportedRecordId = id(9991);
    if (condition === "record-id") record.id = id(9991);
    if (condition === "record-type") record.recordType = "PROJECT_AUTHORED";
    if (condition === "source-record-id") record.sourceRecordId = "jmdict:other";
    if (condition === "run-link") record.importRunId = id(9992);
    if (condition === "run-id") run.id = id(9992);
    if (condition === "run-status") run.status = "FAILED";
    if (condition === "data-source") run.dataSourceId = id(9993);
    if (condition === "version") run.sourceVersion = "another-edition";
    if (condition === "checksum") run.checksumSha256 = "e".repeat(64);
    if (condition === "unrequested") sibling.reading = "にほんご";
    const item = (await loadContentQualityItems(h.db))[0]!;
    expect(item.sourceReadings).toEqual(["にほん"]);
    expect(
      validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
    ).toHaveLength(1);
  });

  it.each(["record", "record-type", "source", "status", "license"])(
    "never queries sibling evidence for an original word with invalid %s provenance",
    async (condition) => {
      const h = fixture();
      const word = h.words[0]!;
      if (condition === "record") word.jmdictImportedRecordId = id(9991);
      if (condition === "record-type") word.importedRecord.recordType = "PROJECT_AUTHORED";
      if (condition === "source") word.importedRecord.importRun.dataSource.name = "Other source";
      if (condition === "status") word.importedRecord.importRun.status = "PENDING";
      if (condition === "license")
        word.importedRecord.importRun.dataSource.license.scope = "USER_PRIVATE";
      const item = (await loadContentQualityItems(h.db))[0]!;
      expect(item.sourceReadings).toEqual(["にほん"]);
      expect(h.findWords).toHaveBeenCalledTimes(1);
      expect(
        validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
      ).toHaveLength(1);
    },
  );

  it("does not query for invalid kana, primary-equivalent readings, meaning or blocked answers", async () => {
    const h = fixture([["日本", "にほん", ["", "abc", "にっぽん!", "ー", "に\u200bっぽん"]]]);
    const card = h.items[0]!.cards[0]!;
    card.answers.push({
      text: "ニホン",
      normalizedText: "にほん",
      locale: "ru-RU",
      sourceKind: "PROJECT_AUTHORED",
      isPrimary: false,
    });
    expect((await loadContentQualityItems(h.db))[0]!.sourceReadings).toEqual(["にほん"]);
    expect(h.findWords).toHaveBeenCalledTimes(1);
    card.answerType = "MEANING";
    card.answers[0]!.text = "にっぽん";
    card.blockedAnswers.push({ text: "にっぽん", normalizedText: "にっぽん" });
    h.findWords.mockClear();
    expect((await loadContentQualityItems(h.db))[0]!.sourceReadings).toEqual(["にほん"]);
    expect(h.findWords).toHaveBeenCalledTimes(1);
  });

  it("leaves all aliases unsupported when an item requests more than ten", async () => {
    const aliases = Array.from(
      { length: 11 },
      (_, index) => `あ${String.fromCodePoint(0x3041 + index)}`,
    );
    const h = fixture([["語", "ご", aliases]]);
    const item = (await loadContentQualityItems(h.db))[0]!;
    expect(item.sourceReadings).toEqual(["ご"]);
    expect(h.findWords).toHaveBeenCalledTimes(1);
    expect(
      validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
    ).toHaveLength(11);
  });

  it("bounds one request to 100 words and 1000 requested/returned aliases", async () => {
    const readings = Array.from(
      { length: 10 },
      (_, index) => `あ${String.fromCodePoint(0x3041 + index)}`,
    );
    const pairs: Pair[] = Array.from({ length: 100 }, (_, index) => [`語${index}`, "ご", readings]);
    const h = fixture(pairs);
    const items = await loadContentQualityItems(h.db, { limit: 100 });
    expect(items).toHaveLength(100);
    expect(items.every((item) => item.sourceReadings.length === 11)).toBe(true);
    expect(h.findWords).toHaveBeenCalledTimes(2);
    const query = h.findWords.mock.calls[1]![0]!;
    expect(query.take).toBe(1001);
    expect(query.where?.OR).toHaveLength(100);
  });

  it("fails closed if a bounded evidence query returns the 1001st row", async () => {
    const h = fixture();
    const sibling = h.aliases[0]!;
    h.aliases.splice(
      0,
      h.aliases.length,
      ...Array.from({ length: 1001 }, () => structuredClone(sibling)),
    );
    await expect(loadContentQualityItems(h.db)).rejects.toThrow("1000-row bound");
    expect(h.findWords.mock.calls[1]?.[0]?.take).toBe(1001);
  });
});

describe("reviewed explicit JMdict reading proofs", () => {
  it.each(["怒る", "良い"])(
    "accepts the registered %s alternative after strict revalidation",
    async (expression) => {
      const h = strictFixture(expression);
      const item = (await loadContentQualityItems(h.db))[0]!;
      expect(item.sourceReadings).toEqual([h.content.reading, h.requested]);
      expect(
        validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
      ).toEqual([]);
      expect(h.findPrimary).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { expression_reading: { expression, reading: h.content.reading } },
        }),
      );
      if (expression === "怒る") {
        expect(h.findPrimary).toHaveBeenCalledTimes(2);
        expect(h.findPrimary.mock.calls[1]?.[0]?.where).toEqual({
          expression_reading: { expression, reading: "いかる" },
        });
        expect(h.findProof).not.toHaveBeenCalled();
      } else {
        expect(h.findPrimary).toHaveBeenCalledTimes(1);
        expect(h.findProof).toHaveBeenCalledTimes(1);
        expect(h.findProof.mock.calls[0]?.[0]?.where).toMatchObject({
          sourceRecordId: "jmdict:1605820",
          importRun: { checksumSha256: h.proof.importRun.checksumSha256 },
        });
      }
    },
  );

  it.each(["怒る", "良い"])(
    "does not load unrequested %s proofs or change primary-only hashes",
    async (expression) => {
      const h = strictFixture(expression);
      h.items[0]!.cards[0]!.answers.splice(1);
      const before = await collectContentQualityReport(h.db);
      h.findWords.mockClear();
      h.findProof.mockRejectedValue(new Error("Unrequested proof must not be read"));
      h.findPrimary.mockRejectedValue(new Error("Unrequested primary must not be read"));
      expect((await collectContentQualityReport(h.db)).contentVersion).toBe(before.contentVersion);
      expect(h.findWords).toHaveBeenCalledTimes(1);
      expect(h.findPrimary).not.toHaveBeenCalled();
      expect(h.findProof).not.toHaveBeenCalled();
    },
  );

  it.each(["怒る", "良い"])("keeps arbitrary added %s readings unsupported", async (expression) => {
    const h = strictFixture(expression);
    h.items[0]!.cards[0]!.answers.push({
      text: "あいう",
      normalizedText: "あいう",
      locale: "ru-RU",
      sourceKind: "PROJECT_AUTHORED",
      isPrimary: false,
    });
    const item = (await loadContentQualityItems(h.db))[0]!;
    expect(item.sourceReadings).toEqual([h.content.reading, h.requested]);
    expect(
      validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
    ).toHaveLength(1);
    expect(h.findPrimary).toHaveBeenCalledTimes(expression === "怒る" ? 2 : 1);
    expect(h.findProof).toHaveBeenCalledTimes(expression === "良い" ? 1 : 0);
  });

  it.each(["absent", "unreviewed", "course", "expression", "reading", "entry", "not-explicit"])(
    "does not use a manifest with %s registration",
    async (condition) => {
      const h = strictFixture("怒る");
      if (condition === "absent") h.registry.mockReturnValue([]);
      if (condition === "unreviewed") Object.assign(h.batch, { reviewedAt: null });
      if (condition === "course") Object.assign(h.batch, { courseSlug: "different-course" });
      if (condition === "expression") Object.assign(h.content, { expression: "別語" });
      if (condition === "reading") Object.assign(h.content, { reading: "おこり" });
      if (condition === "entry") Object.assign(h.content, { jmdictEntryId: "jmdict:9999" });
      if (condition === "not-explicit")
        Object.assign(h.content, { acceptedReadingEntryIds: undefined });
      const item = (await loadContentQualityItems(h.db))[0]!;
      expect(item.sourceReadings).toEqual([h.words[0]!.reading]);
      expect(
        validateQualityItem(item).filter((issue) => issue.code === "unsupported-reading"),
      ).toHaveLength(1);
      expect(h.findPrimary).not.toHaveBeenCalled();
      expect(h.findProof).not.toHaveBeenCalled();
    },
  );

  it.each([
    "missing",
    "expression",
    "reading",
    "entry",
    "record",
    "sequence",
    "status",
    "version",
    "checksum",
    "license",
  ])("rejects %s cross-entry evidence", async (condition) => {
    const h = strictFixture("怒る");
    const alternative = h.aliases[0]!;
    const record = alternative.importedRecord;
    const run = record.importRun;
    if (condition === "missing") h.aliases.splice(0);
    if (condition === "expression") alternative.expression = "別語";
    if (condition === "reading") alternative.reading = "いかり";
    if (condition === "entry") alternative.jmdictEntryId = "jmdict:9999";
    if (condition === "record") alternative.jmdictImportedRecordId = id(9999);
    if (condition === "sequence") Object.assign(record, { rawJson: { sequence: "9999" } });
    if (condition === "status") run.status = "FAILED";
    if (condition === "version") run.sourceVersion = "unknown";
    if (condition === "checksum") run.checksumSha256 = "bad-hash";
    if (condition === "license") run.dataSource.licenseId = id(9999);
    await expect(loadContentQualityItems(h.db)).rejects.toThrow();
  });

  it.each([
    "missing",
    "raw",
    "extra-raw-field",
    "expression",
    "primary-reading",
    "reading",
    "document-hash",
    "note",
    "status",
    "version",
    "checksum",
    "license",
    "license-scope",
  ])("rejects %s source-note proof", async (condition) => {
    const h = strictFixture("良い");
    const proof = h.proof;
    const run = proof.importRun;
    if (condition === "missing") h.findProof.mockResolvedValue(null);
    if (condition === "raw") proof.rawJson = {};
    if (condition === "extra-raw-field") Object.assign(proof.rawJson, { unreviewed: true });
    if (condition === "expression") Object.assign(proof.rawJson, { expression: "好い" });
    if (condition === "primary-reading") Object.assign(proof.rawJson, { primaryReading: "いい" });
    if (condition === "reading") Object.assign(proof.rawJson, { reading: "よい" });
    if (condition === "document-hash")
      Object.assign(proof.rawJson, { sourceDocumentSha256: "a".repeat(64) });
    if (condition === "note") Object.assign(proof.rawJson, { note: "unreviewed note" });
    if (condition === "status") run.status = "PENDING";
    if (condition === "version") run.sourceVersion = "different-edition";
    if (condition === "checksum") run.checksumSha256 = "a".repeat(64);
    if (condition === "license") run.dataSource.licenseId = id(9999);
    if (condition === "license-scope") run.dataSource.license.scope = "USER_PRIVATE";
    await expect(loadContentQualityItems(h.db)).rejects.toThrow(
      "Missing verified JMdict sense-note proof",
    );
  });

  it.each(["missing", "raw", "id", "record", "run", "version", "checksum", "license"])(
    "rejects a %s primary returned by the proof lookup",
    async (condition) => {
      const h = strictFixture("良い");
      const primary = structuredClone(h.words[0]!);
      const run = primary.importedRecord.importRun;
      if (condition === "missing") h.findPrimary.mockResolvedValueOnce(null);
      else {
        if (condition === "raw") Object.assign(primary.importedRecord, { rawJson: {} });
        if (condition === "id") primary.id = id(9999);
        if (condition === "record") {
          primary.jmdictImportedRecordId = id(9999);
          primary.importedRecord.id = id(9999);
        }
        if (condition === "run") run.id = id(9999);
        if (condition === "version") run.sourceVersion = "another-valid-version";
        if (condition === "checksum") run.checksumSha256 = "a".repeat(64);
        if (condition === "license") {
          run.dataSource.licenseId = id(9999);
          run.dataSource.license.id = id(9999);
        }
        h.findPrimary.mockResolvedValueOnce(primary);
      }
      await expect(loadContentQualityItems(h.db)).rejects.toThrow();
      expect(h.findProof).not.toHaveBeenCalled();
    },
  );

  it.each(["primary", "alternative", "note"])(
    "surfaces %s database errors unchanged",
    async (lookup) => {
      const h = strictFixture(lookup === "alternative" ? "怒る" : "良い");
      const error = new Error("database unavailable");
      if (lookup === "primary") h.findPrimary.mockRejectedValueOnce(error);
      if (lookup === "alternative")
        h.findPrimary.mockResolvedValueOnce(h.words[0]!).mockRejectedValueOnce(error);
      if (lookup === "note") h.findProof.mockRejectedValueOnce(error);
      await expect(loadContentQualityItems(h.db)).rejects.toBe(error);
    },
  );
});

function strictFixture(expression: string) {
  const original = EXPLICIT_BATCHES.find((batch) =>
    batch.words.some((word) => word.expression === expression),
  )!;
  const batch = { ...structuredClone(original), reviewedAt: "2026-11-01" };
  const content = batch.words.find((word) => word.expression === expression)!;
  const requested = content.acceptedReadings?.[0] ?? content.sourceNoteReadings![0]!.reading;
  const h = fixture([[expression, content.reading, [requested]]]);
  const primary = h.words[0]!;
  primary.jmdictEntryId = content.jmdictEntryId;
  primary.importedRecord.sourceRecordId = content.jmdictEntryId;
  primary.senses.push(
    ...["ru-RU", "en-US"].map((locale) => ({
      locale,
      meaning: "synthetic imported gloss",
      partOfSpeech: "dictionary-fixture",
      sourceKind: "IMPORTED",
    })),
  );
  const raw = (entryId: string) => ({
    sequence: entryId.slice(7),
    importedWordCount: 1,
    retainedLocales: ["ru-RU", "en-US"],
  });
  Object.assign(primary.importedRecord, { rawJson: raw(content.jmdictEntryId) });
  const alternativeEntry = content.acceptedReadingEntryIds?.[requested];
  if (alternativeEntry) {
    const alternative = h.aliases[0]!;
    alternative.jmdictEntryId = alternativeEntry;
    alternative.jmdictImportedRecordId = id(2100);
    alternative.senses = structuredClone(primary.senses);
    Object.assign(alternative.importedRecord, {
      id: id(2100),
      sourceRecordId: alternativeEntry,
      importRunId: id(3100),
      rawJson: raw(alternativeEntry),
    });
    Object.assign(alternative.importedRecord.importRun, {
      id: id(3100),
      sourceVersion: "another-successful-edition",
      checksumSha256: "e".repeat(64),
    });
  } else h.aliases.splice(0);
  const note = content.sourceNoteReadings?.[0];
  const proof = {
    ...structuredClone(primary.importedRecord),
    id: id(2200),
    rawJson: note ? readingNoteProofData(content, note) : {},
  };
  if (note)
    Object.assign(proof.importRun, {
      id: id(3200),
      sourceVersion: note.sourceVersion,
      checksumSha256: readingNoteProofChecksum(content, note),
    });
  const findPrimary = vi.fn(async (args?: Prisma.WordFindUniqueArgs) => {
    const pair = args?.where.expression_reading;
    return (
      [primary, ...h.aliases].find(
        (word) => word.expression === pair?.expression && word.reading === pair.reading,
      ) ?? null
    );
  });
  const findProof = vi.fn(
    async (_args?: Prisma.ImportedRecordFindFirstArgs) => proof as typeof proof | null,
  );
  Object.assign(h.db.word, { findUnique: findPrimary });
  Object.assign(h.db, { importedRecord: { findFirst: findProof } });
  const registry = vi.spyOn(wordContent, "buildMainCourseWordBatches").mockReturnValue([batch]);
  return { ...h, batch, content, requested, proof, findPrimary, findProof, registry };
}

function fixture(pairs: readonly Pair[] = [PAIRS[0]!]) {
  const words = pairs.map(([expression, reading], index) => ({
    id: id(1000 + index),
    expression,
    reading,
    jmdictEntryId: `jmdict:${1000000 + index}`,
    jmdictImportedRecordId: id(2000 + index),
    importedRecord: {
      id: id(2000 + index),
      recordType: "JMDICT_ENTRY",
      sourceRecordId: `jmdict:${1000000 + index}`,
      importRunId: id(3000),
      importRun: {
        id: id(3000),
        dataSourceId: id(4000),
        status: "SUCCESS",
        sourceVersion: "fixture-edition",
        checksumSha256: "f".repeat(64),
        dataSource: {
          id: id(4000),
          name: "JMdict",
          licenseId: id(5000),
          homepageUrl: "https://example.test/jmdict",
          attributionText: "Synthetic JMdict provenance fixture, no imported glosses.",
          license: {
            id: id(5000),
            name: "Synthetic multilingual dictionary license",
            scope: "OPEN_DATA",
            spdxLikeId: "LicenseRef-JMdict-Multilingual",
            requiresAttribution: true,
            url: "https://example.test/license",
          },
        },
      },
    },
    senses: [
      {
        locale: "ru-RU",
        meaning: "учебное слово",
        partOfSpeech: "noun",
        sourceKind: "PROJECT_AUTHORED",
      },
    ],
  }));
  const aliases = pairs.flatMap(([, , readings], index) =>
    readings.map((reading, offset) => ({
      ...structuredClone(words[index]!),
      id: id(10000 + index * 10 + offset),
      reading,
    })),
  );
  const items = words.map((word, index) => ({
    id: id(1 + index),
    kind: "WORD",
    targetType: "WORD",
    targetId: word.id,
    curriculumBand: "FOUNDATION",
    cards: [
      {
        id: id(6000 + index),
        promptType: "READING",
        answerType: "READING",
        locale: "ru-RU",
        audioAsset: null,
        answers: [word.reading, ...pairs[index]![2]].map((text, offset) => ({
          text,
          normalizedText: normalizeJapaneseReading(text),
          locale: "ru-RU",
          sourceKind: "PROJECT_AUTHORED",
          isPrimary: offset === 0,
        })),
        blockedAnswers: [] as { text: string; normalizedText: string }[],
      },
    ],
    mnemonics: [],
    dependencies: [],
    courseLevelItems: [
      { sortOrder: index + 1, courseLevel: { levelNumber: 5, band: "FOUNDATION" } },
    ],
  }));
  const findWords = vi.fn(async (args?: Prisma.WordFindManyArgs) =>
    args?.take === 1001 ? aliases.slice(0, args.take) : words,
  );
  const db = {
    learningItem: { findMany: vi.fn(async ({ take }: { take: number }) => items.slice(0, take)) },
    word: { findMany: findWords },
    kanji: { findMany: vi.fn().mockResolvedValue([]) },
    component: { findMany: vi.fn().mockResolvedValue([]) },
    sentence: { findMany: vi.fn().mockResolvedValue([]) },
    srsSystem: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn().mockResolvedValue([]),
  } as unknown as ContentQualityDatabase;
  return { db, words, aliases, items, findWords };
}
