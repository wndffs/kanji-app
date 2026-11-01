import type { Prisma, PrismaClient } from "@prisma/client";
import {
  readingNoteProofChecksum,
  readingNoteProofData,
  validReadingNote,
  type JmdictReadingNote,
  type ReadingNoteWord,
} from "../packages/db/src/jmdict-reading-note-proof.ts";
import type { LocalSource } from "./local-source-manifest.mts";
import { children, scanSourceXml, textOf, type SourceNode } from "./local-source-xml.mts";

export type ReadingNoteProofPlan = {
  readonly word: ReadingNoteWord;
  readonly note: JmdictReadingNote;
  readonly rawJson: ReturnType<typeof readingNoteProofData>;
  readonly checksumSha256: string;
};
export type ReadingNoteProofDatabase = Pick<
  PrismaClient,
  "dataSource" | "importRun" | "$transaction"
>;
type Reader = Pick<Prisma.TransactionClient, "dataSource" | "importRun">;
const PURPOSE = "reading-note-evidence";
const MAX_PROOFS = 100;

function permitsPrimaryPair(entry: SourceNode, word: ReadingNoteWord): boolean {
  const spellings = children(entry, "k_ele").flatMap((element) => textOf(element, "keb"));
  return children(entry, "r_ele").some((element) => {
    const readings = textOf(element, "reb");
    if (readings.length !== 1 || readings[0] !== word.reading) return false;
    const restrictions = textOf(element, "re_restr");
    if (restrictions.length && !restrictions.includes(word.expression)) return false;
    if (!spellings.length || children(element, "re_nokanji").length)
      return word.expression === word.reading;
    return spellings.includes(word.expression);
  });
}

function hasApplicableNote(entry: SourceNode, word: ReadingNoteWord, note: JmdictReadingNote) {
  return children(entry, "sense").some((sense) => {
    const spellings = textOf(sense, "stagk");
    const readings = textOf(sense, "stagr");
    return (
      (!spellings.length || spellings.includes(word.expression)) &&
      (!readings.length || readings.includes(word.reading)) &&
      children(sense, "s_inf").some((info) => !info.children.length && info.text === note.note)
    );
  });
}

export async function buildReadingNoteProofPlans(
  source: LocalSource,
  words: readonly ReadingNoteWord[],
  snapshotVersion: string,
): Promise<readonly ReadingNoteProofPlan[]> {
  const plans: ReadingNoteProofPlan[] = [];
  for (const word of words) {
    for (const note of word.sourceNoteReadings ?? []) {
      if (plans.length >= MAX_PROOFS) throw new Error("Reading-note proof limit is 100 notes.");
      if (
        source.id !== "jmdict" ||
        !validReadingNote(word, note) ||
        note.sourceVersion !== snapshotVersion ||
        note.sourceDocumentSha256 !== source.contentSha256
      )
        throw new Error("Invalid reading note or pinned source hash/version mismatch.");
      plans.push({
        word,
        note,
        rawJson: readingNoteProofData(word, note),
        checksumSha256: readingNoteProofChecksum(word, note),
      });
    }
  }
  if (!plans.length) return [];
  const bySequence = new Map<string, ReadingNoteProofPlan[]>();
  for (const plan of plans) {
    const sequence = plan.rawJson.sequence;
    bySequence.set(sequence, [...(bySequence.get(sequence) ?? []), plan]);
  }
  const seen = new Set<string>();
  // Scan the complete document: stopping at the first match could hide a duplicate entry.
  await scanSourceXml(source, "JMdict", "entry", (entry) => {
    const sequences = textOf(entry, "ent_seq");
    if (!sequences.some((sequence) => bySequence.has(sequence))) return;
    if (sequences.length !== 1) throw new Error("Reading-note entry needs exactly one sequence.");
    const sequence = sequences[0]!;
    if (seen.has(sequence)) throw new Error("Duplicate reading-note source entry.");
    seen.add(sequence);
    for (const { word, note } of bySequence.get(sequence)!) {
      if (!permitsPrimaryPair(entry, word))
        throw new Error("Reading-note primary expression/reading binding or restriction mismatch.");
      if (!hasApplicableNote(entry, word, note))
        throw new Error("Exact reading note missing from an applicable source sense.");
    }
  });
  if (seen.size !== bySequence.size) throw new Error("Reading-note source entry is missing.");
  return plans;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function exactBody(actual: unknown, expected: ReadingNoteProofPlan["rawJson"]): boolean {
  return (
    isObject(actual) &&
    Object.keys(actual).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => actual[key] === value)
  );
}
function httpsUrl(value: string | null): boolean {
  try {
    return value !== null && new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}
async function requireLicensedSource(db: Reader) {
  const source = await db.dataSource.findUnique({
    where: { name: "JMdict" },
    include: { license: true },
  });
  if (
    !source ||
    source.name !== "JMdict" ||
    source.licenseId !== source.license.id ||
    source.license.scope !== "OPEN_DATA" ||
    source.license.spdxLikeId !== "LicenseRef-JMdict-Multilingual" ||
    !source.license.name.trim() ||
    !source.license.requiresAttribution ||
    !source.attributionText.trim() ||
    !httpsUrl(source.license.url) ||
    !httpsUrl(source.homepageUrl) ||
    !httpsUrl(source.downloadUrl)
  )
    throw new Error(
      "Existing licensed JMdict DataSource required; automatic metadata repair refused.",
    );
  return source;
}

async function absentPlans(
  db: Reader,
  dataSourceId: string,
  plans: readonly ReadingNoteProofPlan[],
) {
  const absent: ReadingNoteProofPlan[] = [];
  for (const plan of plans) {
    const run = await db.importRun.findUnique({
      where: { dataSourceId_checksumSha256: { dataSourceId, checksumSha256: plan.checksumSha256 } },
      include: { records: { take: 2 } },
    });
    if (!run) {
      absent.push(plan);
      continue;
    }
    const record = run.records[0];
    if (
      run.status !== "SUCCESS" ||
      run.dataSourceId !== dataSourceId ||
      run.checksumSha256 !== plan.checksumSha256 ||
      run.sourceVersion !== plan.note.sourceVersion ||
      !isObject(run.statsJson) ||
      run.statsJson.purpose !== PURPOSE ||
      run.statsJson.parentContentSha256 !== plan.note.sourceDocumentSha256 ||
      run.records.length !== 1 ||
      record?.importRunId !== run.id ||
      record.recordType !== "JMDICT_ENTRY" ||
      record.sourceRecordId !== plan.note.sourceRecordId ||
      !exactBody(record.rawJson, plan.rawJson)
    )
      throw new Error(
        "Reading-note checksum collision or incomplete proof; automatic repair refused.",
      );
  }
  return absent;
}

export async function planOrApplyReadingNoteProofs(
  db: ReadingNoteProofDatabase,
  plans: readonly ReadingNoteProofPlan[],
  options: { readonly apply: boolean } = { apply: false },
) {
  if (plans.length > MAX_PROOFS) throw new Error("Reading-note proof limit is 100 notes.");
  const checksums = new Set<string>();
  for (const plan of plans) {
    if (
      !validReadingNote(plan.word, plan.note) ||
      !exactBody(plan.rawJson, readingNoteProofData(plan.word, plan.note)) ||
      plan.checksumSha256 !== readingNoteProofChecksum(plan.word, plan.note) ||
      checksums.has(plan.checksumSha256)
    )
      throw new Error("Invalid or duplicate reading-note proof plan.");
    checksums.add(plan.checksumSha256);
  }
  if (!plans.length) return { plannedProofCount: 0, createdProofCount: 0, reusedProofCount: 0 };
  const source = await requireLicensedSource(db);
  const absent = await absentPlans(db, source.id, plans);
  let createdProofCount = 0;
  if (options.apply && absent.length) {
    createdProofCount = await db.$transaction(async (tx) => {
      const currentSource = await requireLicensedSource(tx);
      if (currentSource.id !== source.id) throw new Error("JMdict source changed; import refused.");
      const currentAbsent = await absentPlans(tx, source.id, plans);
      for (const plan of currentAbsent) {
        await tx.importRun.create({
          data: {
            dataSourceId: source.id,
            sourceVersion: plan.note.sourceVersion,
            sourceFileName: `JMdict-reading-note-${plan.note.sourceDocumentSha256}.json`,
            checksumSha256: plan.checksumSha256,
            status: "SUCCESS",
            finishedAt: new Date(),
            statsJson: { purpose: PURPOSE, parentContentSha256: plan.note.sourceDocumentSha256 },
            records: {
              create: {
                recordType: "JMDICT_ENTRY",
                sourceRecordId: plan.note.sourceRecordId,
                rawJson: plan.rawJson,
              },
            },
          },
        });
      }
      return currentAbsent.length;
    });
  }
  return {
    plannedProofCount: plans.length,
    createdProofCount,
    reusedProofCount: options.apply
      ? plans.length - createdProofCount
      : plans.length - absent.length,
  };
}
