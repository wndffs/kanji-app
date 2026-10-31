import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "@kanji-srs/db";
import { createPrismaJmDictBatchWriter } from "../src/jmdict-prisma-batch";
import { parseJmDictXml } from "../src/jmdict";

const entry = parseJmDictXml(
  readFileSync(new URL("../../../data/fixtures/jmdict-small.xml", import.meta.url), "utf8"),
).entries[1]!;

function database(concurrentInsert = false) {
  const transaction = {
    importedRecord: {
      createMany: vi.fn(async () => ({ count: 1 })),
      findMany: vi.fn(async () => [{ id: "fixture-record", sourceRecordId: entry.sourceRecordId }]),
    },
    word: {
      createMany: vi.fn(async () => {
        if (concurrentInsert) throw new Error("unique Word(expression, reading) conflict");
        return { count: 1 };
      }),
      findMany: vi.fn(async () => [
        { id: "fixture-word", expression: "ありがとう", reading: "ありがとう" },
      ]),
    },
    wordSense: { createMany: vi.fn(async () => ({ count: 2 })) },
    $executeRaw: vi.fn(async () => 1),
  };
  const prisma = {
    $transaction: vi.fn(async (operation: (tx: typeof transaction) => Promise<void>) =>
      operation(transaction),
    ),
  };
  return { transaction, prisma };
}

describe("JMdict insert-only supplements", () => {
  it("writes provenance on insertion without rebinding any preexisting word", async () => {
    const { prisma, transaction } = database();
    await createPrismaJmDictBatchWriter(prisma as unknown as PrismaClient, {
      insertOnly: true,
    }).writeBatch({ importRunId: "fixture-run", entries: [entry] });
    expect(transaction.word.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skipDuplicates: false,
        data: [
          expect.objectContaining({
            jmdictEntryId: entry.sourceRecordId,
            jmdictImportedRecordId: "fixture-record",
          }),
        ],
      }),
    );
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(transaction.wordSense.createMany).toHaveBeenCalled();
  });
  it("propagates a concurrent insertion conflict through the transaction without updating provenance or senses", async () => {
    const { prisma, transaction } = database(true);
    await expect(
      createPrismaJmDictBatchWriter(prisma as unknown as PrismaClient, {
        insertOnly: true,
      }).writeBatch({ importRunId: "fixture-run", entries: [entry] }),
    ).rejects.toThrow("unique Word");
    expect(transaction.word.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: false }),
    );
    expect(transaction.$executeRaw).not.toHaveBeenCalled();
    expect(transaction.wordSense.createMany).not.toHaveBeenCalled();
  });
  it("preserves the existing default importer behavior", async () => {
    const { prisma, transaction } = database();
    await createPrismaJmDictBatchWriter(prisma as unknown as PrismaClient).writeBatch({
      importRunId: "fixture-run",
      entries: [entry],
    });
    expect(transaction.word.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(transaction.$executeRaw).toHaveBeenCalledOnce();
  });
});
