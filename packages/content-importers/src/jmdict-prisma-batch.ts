import { Prisma, type PrismaClient } from "@kanji-srs/db";

import { type JmDictBatchWriter, type JmDictEntryDto, type JmDictWordSenseDto } from "./jmdict";

const SENSE_WRITE_BATCH_SIZE = 1_000;
const TRANSACTION_MAX_WAIT_MS = 30_000;
const TRANSACTION_TIMEOUT_MS = 120_000;

type ImportedRecordIdentity = {
  readonly id: string;
  readonly sourceRecordId: string;
};

export type JmDictWordBatchCandidate = {
  readonly expression: string;
  readonly reading: string;
  readonly commonnessRank: number | null;
  readonly jmdictEntryId: string;
  readonly importedRecordId: string;
  readonly senses: readonly JmDictWordSenseDto[];
};

export function createPrismaJmDictBatchWriter(prisma: PrismaClient): JmDictBatchWriter {
  return {
    async writeBatch({ importRunId, entries }): Promise<void> {
      await prisma.$transaction(
        async (transaction) => {
          await transaction.importedRecord.createMany({
            data: entries.map((entry) => ({
              importRunId,
              recordType: "JMDICT_ENTRY",
              sourceRecordId: entry.sourceRecordId,
              rawJson: entry.raw as Prisma.InputJsonValue,
            })),
            skipDuplicates: true,
          });

          const importedRecords = await transaction.importedRecord.findMany({
            where: {
              importRunId,
              recordType: "JMDICT_ENTRY",
              sourceRecordId: { in: entries.map((entry) => entry.sourceRecordId) },
            },
            select: {
              id: true,
              sourceRecordId: true,
            },
          });
          const words = buildJmDictWordBatchCandidates(entries, importedRecords);

          if (words.length === 0) {
            return;
          }

          await transaction.word.createMany({
            data: words.map((word) => ({
              expression: word.expression,
              reading: word.reading,
              commonnessRank: word.commonnessRank,
              jmdictEntryId: word.jmdictEntryId,
              jmdictImportedRecordId: word.importedRecordId,
            })),
            skipDuplicates: true,
          });
          await transaction.$executeRaw(buildWordProvenanceUpdate(words));

          const wordRows = await transaction.word.findMany({
            where: {
              OR: words.map((word) => ({
                expression: word.expression,
                reading: word.reading,
              })),
            },
            select: {
              id: true,
              expression: true,
              reading: true,
            },
          });
          const wordIds = new Map(
            wordRows.map((word) => [wordIdentityKey(word.expression, word.reading), word.id]),
          );
          const senses = words.flatMap((word) => {
            const wordId = wordIds.get(wordIdentityKey(word.expression, word.reading));

            if (wordId === undefined) {
              throw new Error(
                `JMdict batch did not resolve word ${word.expression}/${word.reading}.`,
              );
            }

            return word.senses.map((sense) => ({
              wordId,
              locale: sense.locale,
              meaning: sense.meaning,
              partOfSpeech: sense.partOfSpeech,
              sourceKind: sense.sourceKind,
            }));
          });

          for (let index = 0; index < senses.length; index += SENSE_WRITE_BATCH_SIZE) {
            await transaction.wordSense.createMany({
              data: senses.slice(index, index + SENSE_WRITE_BATCH_SIZE),
              skipDuplicates: true,
            });
          }
        },
        {
          maxWait: TRANSACTION_MAX_WAIT_MS,
          timeout: TRANSACTION_TIMEOUT_MS,
        },
      );
    },
  };
}

export function buildJmDictWordBatchCandidates(
  entries: readonly JmDictEntryDto[],
  importedRecords: readonly ImportedRecordIdentity[],
): readonly JmDictWordBatchCandidate[] {
  const importedRecordIds = new Map(
    importedRecords.map((record) => [record.sourceRecordId, record.id]),
  );
  const candidates = new Map<
    string,
    Omit<JmDictWordBatchCandidate, "senses"> & {
      readonly sensesByIdentity: Map<string, JmDictWordSenseDto>;
    }
  >();

  for (const entry of entries) {
    const importedRecordId = importedRecordIds.get(entry.sourceRecordId);

    if (importedRecordId === undefined) {
      throw new Error(
        `JMdict imported record ${entry.sourceRecordId} is missing after batch insert.`,
      );
    }

    for (const word of entry.words) {
      const key = wordIdentityKey(word.expression, word.reading);
      const existing = candidates.get(key);
      const sensesByIdentity = existing?.sensesByIdentity ?? new Map<string, JmDictWordSenseDto>();

      for (const sense of word.senses) {
        sensesByIdentity.set(senseIdentityKey(sense), sense);
      }

      candidates.set(key, {
        expression: word.expression,
        reading: word.reading,
        commonnessRank: word.commonnessRank,
        jmdictEntryId: entry.sourceRecordId,
        importedRecordId,
        sensesByIdentity,
      });
    }
  }

  return [...candidates.values()].map(({ sensesByIdentity, ...candidate }) => ({
    ...candidate,
    senses: [...sensesByIdentity.values()],
  }));
}

function buildWordProvenanceUpdate(words: readonly JmDictWordBatchCandidate[]): Prisma.Sql {
  const values = Prisma.join(
    words.map(
      (word) =>
        Prisma.sql`(
          ${word.expression},
          ${word.reading},
          CAST(${word.commonnessRank} AS INTEGER),
          ${word.jmdictEntryId},
          CAST(${word.importedRecordId} AS UUID)
        )`,
    ),
  );

  return Prisma.sql`
    UPDATE "Word" AS target
    SET
      "commonnessRank" = source."commonnessRank",
      "jmdictEntryId" = source."jmdictEntryId",
      "jmdictImportedRecordId" = source."jmdictImportedRecordId",
      "updatedAt" = CURRENT_TIMESTAMP
    FROM (
      VALUES ${values}
    ) AS source(
      "expression",
      "reading",
      "commonnessRank",
      "jmdictEntryId",
      "jmdictImportedRecordId"
    )
    WHERE
      target."expression" = source."expression"
      AND target."reading" = source."reading"
  `;
}

function wordIdentityKey(expression: string, reading: string): string {
  return JSON.stringify([expression, reading]);
}

function senseIdentityKey(sense: JmDictWordSenseDto): string {
  return JSON.stringify([sense.locale, sense.meaning, sense.partOfSpeech]);
}
