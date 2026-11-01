import type { Prisma } from "@prisma/client";
import {
  authoredWordPartOfSpeech,
  mainCourseWordReadingEntryId,
  type MainCourseWordContent,
} from "./main-course-word-content";
import { readingNoteProofData, readingNoteProofChecksum } from "./jmdict-reading-note-proof";
type Reader = Pick<Prisma.TransactionClient, "word" | "importedRecord">;
const WORD_SOURCE_SELECT = {
  id: true,
  expression: true,
  reading: true,
  jmdictEntryId: true,
  jmdictImportedRecordId: true,
  senses: { select: { locale: true, meaning: true, partOfSpeech: true, sourceKind: true } },
  importedRecord: {
    select: {
      id: true,
      recordType: true,
      sourceRecordId: true,
      rawJson: true,
      importRun: {
        select: {
          id: true,
          dataSourceId: true,
          status: true,
          sourceVersion: true,
          checksumSha256: true,
          dataSource: {
            select: {
              id: true,
              name: true,
              licenseId: true,
              homepageUrl: true,
              attributionText: true,
              license: {
                select: {
                  id: true,
                  name: true,
                  scope: true,
                  spdxLikeId: true,
                  url: true,
                  requiresAttribution: true,
                },
              },
            },
          },
        },
      },
    },
  },
} as const satisfies Prisma.WordSelect;

export async function requireWordSource(db: Pick<Reader, "word">, content: MainCourseWordContent) {
  const word = await db.word.findUnique({
    where: { expression_reading: { expression: content.expression, reading: content.reading } },
    select: WORD_SOURCE_SELECT,
  });
  const record = word?.importedRecord;
  const run = record?.importRun;
  const source = run?.dataSource;
  if (
    word === null ||
    word.expression !== content.expression ||
    word.reading !== content.reading ||
    word.jmdictEntryId !== content.jmdictEntryId ||
    record?.id !== word.jmdictImportedRecordId ||
    record?.recordType !== "JMDICT_ENTRY" ||
    record.sourceRecordId !== content.jmdictEntryId ||
    run?.status !== "SUCCESS" ||
    !run.sourceVersion?.trim() ||
    run.sourceVersion.trim().toLowerCase() === "unknown" ||
    !/^[a-f0-9]{64}$/iu.test(run.checksumSha256) ||
    source?.name !== "JMdict" ||
    source.id !== run.dataSourceId ||
    source.license.id !== source.licenseId ||
    source.license.scope !== "OPEN_DATA" ||
    source.license.spdxLikeId !== "LicenseRef-JMdict-Multilingual" ||
    !source.license.name.trim() ||
    !source.license.requiresAttribution ||
    !isHttpsSourceUrl(source.license.url) ||
    !isHttpsSourceUrl(source.homepageUrl) ||
    !source.attributionText?.trim()
  )
    throw new Error(
      `Word ${content.expression}/${content.reading} lacks exact successful licensed JMdict provenance.`,
    );
  const raw = record.rawJson;
  if (!isObject(raw) || raw.sequence !== content.jmdictEntryId.slice("jmdict:".length))
    throw new Error(
      `Word ${content.expression}/${content.reading} has invalid JMdict sequence evidence.`,
    );

  // The bounded importer deliberately stores only provenance, not duplicate glosses.
  // Its exact pair and retained senses live on Word/WordSense under this import ID.
  const compact =
    Object.keys(raw).length === 3 &&
    Number.isSafeInteger(raw.importedWordCount) &&
    Number(raw.importedWordCount) > 0 &&
    Array.isArray(raw.retainedLocales) &&
    raw.retainedLocales.length === 2 &&
    raw.retainedLocales.includes("ru-RU") &&
    raw.retainedLocales.includes("en-US");
  const full =
    Array.isArray(raw.kanjiElements) &&
    raw.kanjiElements.some((entry) => isObject(entry) && entry.expression === content.expression) &&
    Array.isArray(raw.readingElements) &&
    raw.readingElements.some(
      (entry) =>
        isObject(entry) &&
        entry.reading === content.reading &&
        Array.isArray(entry.restrictions) &&
        (entry.restrictions.length === 0 || entry.restrictions.includes(content.expression)),
    ) &&
    Array.isArray(raw.senses);
  if (!compact && !full)
    throw new Error(
      `Word ${content.expression}/${content.reading} is not supported by its raw JMdict entry.`,
    );
  for (const locale of ["ru-RU", "en-US"] as const) {
    const hasRawGloss =
      compact ||
      (Array.isArray(raw.senses) &&
        raw.senses.some(
          (sense) =>
            isObject(sense) &&
            Array.isArray(sense.glosses) &&
            sense.glosses.some(
              (gloss) =>
                isObject(gloss) &&
                gloss.locale === locale &&
                typeof gloss.text === "string" &&
                gloss.text.trim() !== "",
            ),
        ));
    if (
      !hasRawGloss ||
      !word.senses.some(
        (sense) =>
          sense.sourceKind === "IMPORTED" && sense.locale === locale && sense.meaning.trim() !== "",
      )
    )
      throw new Error(
        `Word ${content.expression}/${content.reading} lacks imported ${locale} evidence.`,
      );
    const meanings = locale === "ru-RU" ? content.meanings.ru : content.meanings.en;
    if (
      word.senses.some(
        (sense) =>
          sense.locale === locale &&
          sense.partOfSpeech === authoredWordPartOfSpeech(content) &&
          meanings.accepted.includes(sense.meaning) &&
          sense.sourceKind !== "PROJECT_AUTHORED",
      )
    )
      throw new Error(`Authored sense collision for ${content.expression}/${locale}.`);
  }
  return word;
}

export function wordEvidence(word: Awaited<ReturnType<typeof requireWordSource>>) {
  const record = word.importedRecord!;
  return {
    importedRecordId: record.id,
    sourceRecordId: record.sourceRecordId,
    importRunId: record.importRun.id,
    sourceVersion: record.importRun.sourceVersion,
    checksumSha256: record.importRun.checksumSha256,
    licenseId: record.importRun.dataSource.licenseId,
  };
}

export async function requireAlternativeReadingSources(
  db: Pick<Reader, "word" | "importedRecord">,
  content: MainCourseWordContent,
  primaryEvidence: ReturnType<typeof wordEvidence>,
) {
  const alternatives = [];
  for (const reading of content.acceptedReadings ?? []) {
    const entryId = mainCourseWordReadingEntryId(content, reading);
    const word = await requireWordSource(db, { ...content, reading, jmdictEntryId: entryId });
    const sourceEvidence = wordEvidence(word);
    if (
      entryId === content.jmdictEntryId
        ? JSON.stringify(sourceEvidence) !== JSON.stringify(primaryEvidence)
        : sourceEvidence.licenseId !== primaryEvidence.licenseId
    )
      throw new Error(
        `Alternative reading ${content.expression}/${reading} must share the primary successful JMdict source evidence.`,
      );
    alternatives.push({ reading, wordId: word.id, sourceEvidence });
  }
  for (const note of content.sourceNoteReadings ?? []) {
    const checksum = readingNoteProofChecksum(content, note);
    const proof = await db.importedRecord.findFirst({
      where: {
        recordType: "JMDICT_ENTRY",
        sourceRecordId: note.sourceRecordId,
        importRun: { checksumSha256: checksum, dataSource: { name: "JMdict" } },
      },
      select: WORD_SOURCE_SELECT.importedRecord.select,
    });
    const run = proof?.importRun;
    const expected = readingNoteProofData(content, note);
    const actual = proof?.rawJson;
    if (
      !proof ||
      run?.status !== "SUCCESS" ||
      run.sourceVersion !== note.sourceVersion ||
      run.checksumSha256 !== checksum ||
      run.dataSourceId !== run.dataSource.id ||
      run.dataSource.name !== "JMdict" ||
      run.dataSource.licenseId !== primaryEvidence.licenseId ||
      run.dataSource.license.id !== run.dataSource.licenseId ||
      run.dataSource.license.scope !== "OPEN_DATA" ||
      run.dataSource.license.spdxLikeId !== "LicenseRef-JMdict-Multilingual" ||
      !run.dataSource.license.requiresAttribution ||
      !run.dataSource.license.name.trim() ||
      !isHttpsSourceUrl(run.dataSource.license.url) ||
      !isHttpsSourceUrl(run.dataSource.homepageUrl) ||
      !run.dataSource.attributionText.trim() ||
      actual === undefined ||
      !isObject(actual) ||
      Object.keys(actual).length !== Object.keys(expected).length ||
      Object.entries(expected).some(([key, value]) => actual[key] !== value)
    )
      throw new Error(
        `Missing verified JMdict sense-note proof for ${content.expression}/${note.reading}.`,
      );
    alternatives.push({
      reading: note.reading,
      sourceEvidence: primaryEvidence,
      noteEvidence: {
        importedRecordId: proof.id,
        importRunId: run.id,
        checksumSha256: checksum,
        ...expected,
      },
    });
  }
  return alternatives;
}

function isObject(value: Prisma.JsonValue): value is Prisma.JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isHttpsSourceUrl(value: string | null): boolean {
  if (value === null || /\s/u.test(value)) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" && url.hostname !== "" && url.username === "" && url.password === ""
    );
  } catch {
    return false;
  }
}
