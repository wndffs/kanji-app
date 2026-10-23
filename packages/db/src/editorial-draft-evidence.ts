import { type Prisma } from "@prisma/client";
import { normalizeJapaneseReading } from "@kanji-srs/japanese";
import { buildKanjiDraft07 } from "./editorial-draft-kanji-07";
import { buildWordDraft07 } from "./editorial-draft-words-07";

const provenanceSelect = {
  id: true, recordType: true, sourceRecordId: true,
  importRun: { select: {
    id: true, status: true, sourceVersion: true, checksumSha256: true,
    dataSource: { select: {
      name: true, homepageUrl: true, attributionText: true,
      license: { select: { name: true, scope: true, url: true, spdxLikeId: true, requiresAttribution: true, requiresShareAlike: true } },
    } },
  } },
} satisfies Prisma.ImportedRecordSelect;

export async function inspectEditorialDraftEvidence(db: Pick<Prisma.TransactionClient, "word" | "kanji">) {
  const kanjiDraft = buildKanjiDraft07();
  const wordDraft = buildWordDraft07();
  const kanjiRows = await db.kanji.findMany({
    where: { character: { in: kanjiDraft.kanji.map((item) => item.character) } },
    select: { id: true, character: true, readings: { orderBy: [{ priority: "asc" }, { reading: "asc" }] },
      importedRecord: { select: { ...provenanceSelect, rawJson: true } },
      strokeGraphic: { select: { id: true, importedRecord: { select: provenanceSelect } } },
    },
  });
  const wordRows = await db.word.findMany({
    where: { OR: wordDraft.words.map(({ expression, reading }) => ({ expression, reading })) },
    select: { id: true, expression: true, reading: true, jmdictEntryId: true,
      importedRecord: { select: provenanceSelect },
      senses: { where: { sourceKind: "IMPORTED" }, select: { locale: true } },
    },
  });
  return {
    scope: "read-only-draft-source-observations", publicationApproved: false,
    caveat: "Observed links are not successful curator preflight, independent review or publication approval. No source IDs are written back.",
    kanji: kanjiDraft.kanji.map((draft) => {
      const row = kanjiRows.find((row) => row.character === draft.character);
      const record = row?.importedRecord;
      const raw = record?.rawJson;
      const readings = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw?.readings : undefined;
      const exactRawReadingObserved = Array.isArray(readings) && readings.some((reading) =>
        reading !== null && typeof reading === "object" && !Array.isArray(reading) &&
        reading.reading === draft.reading.source && reading.sourceType === draft.reading.sourceType);
      const { rawJson: _raw, ...provenance } = record ?? {};
      return {
        character: draft.character, proposedReading: draft.reading.primary, targetId: row?.id ?? null,
        exactRawReadingObserved,
        firstStoredReadingMatches: row?.readings[0] !== undefined && normalizeJapaneseReading(row.readings[0].reading) === draft.reading.primary,
        provenance: record ? provenance : null,
        strokeProvenance: row?.strokeGraphic?.importedRecord ?? null,
      };
    }),
    words: wordDraft.words.map((draft) => {
      const row = wordRows.find((row) => row.expression === draft.expression && row.reading === draft.reading);
      return {
        expression: draft.expression, reading: draft.reading, targetId: row?.id ?? null,
        observedEntryId: row?.jmdictEntryId ?? null,
        importedLocales: [...new Set(row?.senses.map((sense) => sense.locale) ?? [])].sort(),
        provenance: row?.importedRecord ?? null,
      };
    }),
  };
}
