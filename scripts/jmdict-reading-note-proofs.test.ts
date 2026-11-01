import { createHash } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  readingNoteProofChecksum,
  readingNoteProofData,
  type JmdictReadingNote,
  type ReadingNoteWord,
} from "../packages/db/src/jmdict-reading-note-proof";
import { buildMainCourseWordBatch } from "../packages/db/src/main-course-word-content";
import { reviewedSourceCandidates } from "./import-missing-reviewed-word-sources.mts";
import {
  buildReadingNoteProofPlans,
  planOrApplyReadingNoteProofs,
  type ReadingNoteProofDatabase,
  type ReadingNoteProofPlan,
} from "./jmdict-reading-note-proofs.mts";
import { SOURCE_CONTRACTS, type LocalSource } from "./local-source-manifest.mts";

vi.mock("@prisma/client", () => {
  throw new Error("Reading-note proof tests must not connect to a database.");
});

const version = "2026-10-31";
const word: ReadingNoteWord = {
  expression: "良い",
  reading: "よい",
  jmdictEntryId: "jmdict:1605820",
};
const noteText = "also いい (all senses)";
const entry = `<entry><ent_seq>1605820</ent_seq><k_ele><keb>良い</keb></k_ele><r_ele><reb>よい</reb></r_ele><sense><s_inf>${noteText}</s_inf><gloss>good</gloss></sense></entry>`;
const directories: string[] = [];
afterEach(async () => {
  for (const directory of directories.splice(0))
    await rm(directory, { recursive: true, force: true });
});

async function fixture(xml = `<JMdict>${entry}</JMdict>`) {
  const directory = await mkdtemp(join(tmpdir(), "jmdict-reading-notes-"));
  directories.push(directory);
  const path = join(directory, "JMdict.xml");
  await writeFile(path, xml, "utf8");
  const source: LocalSource = {
    ...SOURCE_CONTRACTS.jmdict,
    id: "jmdict",
    path,
    archiveSha256: "a".repeat(64),
    contentSha256: createHash("sha256").update(xml, "utf8").digest("hex"),
    downloadedAt: `${version}T00:00:00Z`,
  };
  const note: JmdictReadingNote = {
    reading: "いい",
    sourceRecordId: word.jmdictEntryId,
    sourceVersion: version,
    sourceDocumentSha256: source.contentSha256,
    note: noteText,
  };
  const withNote = { ...word, sourceNoteReadings: [note] };
  return { source, note, withNote };
}

describe("bounded structured JMdict reading-note verification", () => {
  it("does not open or scan a source unless notes were requested", async () => {
    const { source } = await fixture();
    await expect(
      buildReadingNoteProofPlans({ ...source, path: "nonexistent.xml" }, [word], version),
    ).resolves.toEqual([]);
  });

  it("proves the exact sense note, not a nonexistent alternative spelling/reading pair", async () => {
    const { source, note, withNote } = await fixture();
    const plans = await buildReadingNoteProofPlans(source, [withNote], version);
    expect(plans).toEqual([
      {
        word: withNote,
        note,
        rawJson: readingNoteProofData(withNote, note),
        checksumSha256: readingNoteProofChecksum(withNote, note),
      },
    ]);
    expect(Object.keys(plans[0]!.rawJson)).toHaveLength(9);
    expect(plans[0]!.rawJson).toMatchObject({ proofKind: "JMDICT_SENSE_NOTE", schemaVersion: 1 });
    expect(plans[0]!.checksumSha256).not.toBe(source.contentSha256);
    expect(await buildReadingNoteProofPlans(source, [withNote], version)).toEqual(plans);
  });

  it("accepts only restrictions that apply to the primary expression and reading", async () => {
    const xml = entry
      .replace("</r_ele>", "<re_restr>良い</re_restr></r_ele>")
      .replace("<sense>", "<sense><stagk>良い</stagk><stagr>よい</stagr>");
    const { source, withNote } = await fixture(`<JMdict>${xml}</JMdict>`);
    await expect(buildReadingNoteProofPlans(source, [withNote], version)).resolves.toHaveLength(1);
  });

  it.each([
    ["wrong note", entry.replace(noteText, "usually いい")],
    ["exact note whitespace", entry.replace(noteText, ` ${noteText} `)],
    ["missing entry", entry.replace("1605820", "1605821")],
    ["wrong primary expression", entry.replace("<keb>良い</keb>", "<keb>善い</keb>")],
    ["wrong primary reading", entry.replace("<reb>よい</reb>", "<reb>いい</reb>")],
    ["reading restriction", entry.replace("</r_ele>", "<re_restr>善い</re_restr></r_ele>")],
    ["no-kanji restriction", entry.replace("</r_ele>", "<re_nokanji/></r_ele>")],
    ["sense spelling restriction", entry.replace("<sense>", "<sense><stagk>善い</stagk>")],
    ["sense reading restriction", entry.replace("<sense>", "<sense><stagr>いい</stagr>")],
    [
      "duplicate sequence in entry",
      entry.replace("</ent_seq>", "</ent_seq><ent_seq>1605820</ent_seq>"),
    ],
    ["duplicate entry", entry + entry],
  ])("refuses %s", async (_label, xml) => {
    const { source, withNote } = await fixture(`<JMdict>${xml}</JMdict>`);
    await expect(buildReadingNoteProofPlans(source, [withNote], version)).rejects.toThrow();
  });

  it("does not borrow an exact note from a different, inapplicable sense", async () => {
    const xml = entry
      .replace(`<s_inf>${noteText}</s_inf>`, "")
      .replace("</entry>", `<sense><stagr>いい</stagr><s_inf>${noteText}</s_inf></sense></entry>`);
    const { source, withNote } = await fixture(`<JMdict>${xml}</JMdict>`);
    await expect(buildReadingNoteProofPlans(source, [withNote], version)).rejects.toThrow(
      "applicable",
    );
  });

  it.each([
    { note: "also another reading" },
    { reading: "よい" },
    { sourceRecordId: "jmdict:999" },
    { sourceVersion: "2026-10-30" },
    { sourceDocumentSha256: "b".repeat(64) },
  ])("refuses invalid note metadata %j before source inspection", async (change) => {
    const { source, note } = await fixture();
    await expect(
      buildReadingNoteProofPlans(
        { ...source, path: "nonexistent.xml" },
        [{ ...word, sourceNoteReadings: [{ ...note, ...change }] }],
        version,
      ),
    ).rejects.toThrow("Invalid reading note");
  });

  it("rehashes the source while scanning and rejects source mutation", async () => {
    const { source, withNote } = await fixture();
    await writeFile(source.path, `<JMdict>${entry}\n</JMdict>`, "utf8");
    await expect(buildReadingNoteProofPlans(source, [withNote], version)).rejects.toThrow(
      "changed",
    );
  });

  it("refuses more than 100 notes before scanning", async () => {
    const { source, note } = await fixture();
    await expect(
      buildReadingNoteProofPlans(
        { ...source, path: "nonexistent.xml" },
        [{ ...word, sourceNoteReadings: Array.from({ length: 101 }, () => note) }],
        version,
      ),
    ).rejects.toThrow("100");
  });
});

type StoredRun = {
  id: string;
  dataSourceId: string;
  checksumSha256: string;
  sourceVersion: string;
  status: string;
  statsJson: unknown;
  records: { importRunId: string; recordType: string; sourceRecordId: string; rawJson: unknown }[];
};
function successfulRun(plan: ReadingNoteProofPlan): StoredRun {
  return {
    id: "fixture-run",
    dataSourceId: "fixture-source",
    checksumSha256: plan.checksumSha256,
    sourceVersion: plan.note.sourceVersion,
    status: "SUCCESS",
    statsJson: {
      purpose: "reading-note-evidence",
      parentContentSha256: plan.note.sourceDocumentSha256,
    },
    records: [
      {
        importRunId: "fixture-run",
        recordType: "JMDICT_ENTRY",
        sourceRecordId: plan.note.sourceRecordId,
        rawJson: plan.rawJson,
      },
    ],
  };
}
function mockDatabase(initial: StoredRun[] = []) {
  const source = {
    id: "fixture-source",
    name: "JMdict",
    licenseId: "fixture-license",
    homepageUrl: "https://www.edrdg.org/",
    downloadUrl: String(SOURCE_CONTRACTS.jmdict.url),
    attributionText: String(SOURCE_CONTRACTS.jmdict.attribution),
    license: {
      id: "fixture-license",
      name: "EDRDG JMdict license",
      scope: "OPEN_DATA",
      spdxLikeId: String(SOURCE_CONTRACTS.jmdict.license),
      requiresAttribution: true,
      url: String(SOURCE_CONTRACTS.jmdict.licenseUrl),
    },
  };
  const runs = new Map(initial.map((run) => [run.checksumSha256, run]));
  const writes = vi.fn();
  const forbiddenWrite = vi.fn(() => {
    throw new Error("Existing rows must never be rewritten.");
  });
  const create = vi.fn(
    async ({
      data,
    }: {
      data: {
        dataSourceId: string;
        checksumSha256: string;
        sourceVersion: string;
        status: string;
        statsJson: unknown;
        records: { create: StoredRun["records"][number] };
      };
    }) => {
      writes(data);
      const id = `new-run-${runs.size}`;
      runs.set(data.checksumSha256, {
        ...data,
        id,
        records: [{ ...data.records.create, importRunId: id }],
      });
      return { id };
    },
  );
  const client = {
    dataSource: {
      findUnique: vi.fn(async () => source),
      update: forbiddenWrite,
      upsert: forbiddenWrite,
    },
    license: { update: forbiddenWrite, upsert: forbiddenWrite },
    word: { create: forbiddenWrite, update: forbiddenWrite, upsert: forbiddenWrite },
    importedRecord: { update: forbiddenWrite, upsert: forbiddenWrite },
    importRun: {
      findUnique: vi.fn(
        async ({ where }: { where: { dataSourceId_checksumSha256: { checksumSha256: string } } }) =>
          runs.get(where.dataSourceId_checksumSha256.checksumSha256) ?? null,
      ),
      create,
      update: forbiddenWrite,
      upsert: forbiddenWrite,
    },
  };
  const transaction = vi.fn(async (execute: (tx: typeof client) => Promise<unknown>) => {
    const snapshot = new Map(runs);
    try {
      return await execute(client);
    } catch (error) {
      runs.clear();
      for (const [key, run] of snapshot) runs.set(key, run);
      throw error;
    }
  });
  return {
    db: { ...client, $transaction: transaction } as unknown as ReadingNoteProofDatabase,
    source,
    runs,
    writes,
    create,
    forbiddenWrite,
    transaction,
    client,
  };
}
async function onePlan() {
  const { source, withNote } = await fixture();
  return (await buildReadingNoteProofPlans(source, [withNote], version))[0]!;
}

describe("insert-only reading-note proof storage", () => {
  it("defaults to read-only planning with zero writes or transactions", async () => {
    const plan = await onePlan();
    const db = mockDatabase();
    expect(await planOrApplyReadingNoteProofs(db.db, [plan])).toEqual({
      plannedProofCount: 1,
      createdProofCount: 0,
      reusedProofCount: 0,
    });
    expect(db.writes).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.forbiddenWrite).not.toHaveBeenCalled();
  });

  it("creates only a new successful run and its nested record in a single transaction", async () => {
    const plan = await onePlan();
    const db = mockDatabase();
    expect(await planOrApplyReadingNoteProofs(db.db, [plan], { apply: true })).toEqual({
      plannedProofCount: 1,
      createdProofCount: 1,
      reusedProofCount: 0,
    });
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.create).toHaveBeenCalledTimes(1);
    expect(db.create).toHaveBeenCalledWith({
      data: {
        dataSourceId: "fixture-source",
        sourceVersion: version,
        sourceFileName: `JMdict-reading-note-${plan.note.sourceDocumentSha256}.json`,
        checksumSha256: plan.checksumSha256,
        status: "SUCCESS",
        finishedAt: expect.any(Date),
        statsJson: {
          purpose: "reading-note-evidence",
          parentContentSha256: plan.note.sourceDocumentSha256,
        },
        records: {
          create: {
            recordType: "JMDICT_ENTRY",
            sourceRecordId: word.jmdictEntryId,
            rawJson: readingNoteProofData(word, plan.note),
          },
        },
      },
    });
    expect(db.forbiddenWrite).not.toHaveBeenCalled();
    expect(db.source.name).toBe("JMdict");
  });

  it("reuses successful exact evidence without any writes, including on repeated apply", async () => {
    const plan = await onePlan();
    const db = mockDatabase([successfulRun(plan)]);
    expect(await planOrApplyReadingNoteProofs(db.db, [plan], { apply: true })).toEqual({
      plannedProofCount: 1,
      createdProofCount: 0,
      reusedProofCount: 1,
    });
    expect(db.writes).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.forbiddenWrite).not.toHaveBeenCalled();
    const fresh = mockDatabase();
    await planOrApplyReadingNoteProofs(fresh.db, [plan], { apply: true });
    await planOrApplyReadingNoteProofs(fresh.db, [plan], { apply: true });
    expect(fresh.writes).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      "pending run",
      (run: StoredRun) => {
        run.status = "PENDING";
      },
    ],
    [
      "failed run",
      (run: StoredRun) => {
        run.status = "FAILED";
      },
    ],
    [
      "wrong checksum",
      (run: StoredRun) => {
        run.checksumSha256 = "b".repeat(64);
      },
    ],
    [
      "wrong version",
      (run: StoredRun) => {
        run.sourceVersion = "2026-10-30";
      },
    ],
    [
      "wrong source",
      (run: StoredRun) => {
        run.dataSourceId = "other";
      },
    ],
    [
      "missing record",
      (run: StoredRun) => {
        run.records = [];
      },
    ],
    [
      "extra record",
      (run: StoredRun) => {
        run.records.push({ ...run.records[0]! });
      },
    ],
    [
      "wrong record parent",
      (run: StoredRun) => {
        run.records[0]!.importRunId = "other";
      },
    ],
    [
      "wrong record type",
      (run: StoredRun) => {
        run.records[0]!.recordType = "KANJIDIC2_ENTRY";
      },
    ],
    [
      "wrong record entry",
      (run: StoredRun) => {
        run.records[0]!.sourceRecordId = "jmdict:999";
      },
    ],
    [
      "extra body key",
      (run: StoredRun) => {
        run.records[0]!.rawJson = { ...(run.records[0]!.rawJson as object), extra: true };
      },
    ],
    [
      "wrong body",
      (run: StoredRun) => {
        run.records[0]!.rawJson = { ...(run.records[0]!.rawJson as object), note: "also いい" };
      },
    ],
    [
      "missing parent evidence",
      (run: StoredRun) => {
        run.statsJson = null;
      },
    ],
    [
      "wrong parent hash",
      (run: StoredRun) => {
        run.statsJson = { purpose: "reading-note-evidence", parentContentSha256: "b".repeat(64) };
      },
    ],
    [
      "wrong purpose",
      (run: StoredRun) => {
        run.statsJson = { purpose: "raw-import", parentContentSha256: "b".repeat(64) };
      },
    ],
  ])("refuses %s without overwriting, even in plan mode", async (_label, change) => {
    const plan = await onePlan();
    const run = successfulRun(plan);
    const db = mockDatabase();
    db.runs.set(plan.checksumSha256, run);
    change(run);
    const before = structuredClone(run);
    for (const apply of [false, true]) {
      await expect(planOrApplyReadingNoteProofs(db.db, [plan], { apply })).rejects.toThrow(
        "repair refused",
      );
    }
    expect(run).toEqual(before);
    expect(db.writes).not.toHaveBeenCalled();
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.forbiddenWrite).not.toHaveBeenCalled();
  });

  it.each([
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.name = "other";
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.licenseId = "other";
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.license.scope = "PROPRIETARY";
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.license.spdxLikeId = "other" as typeof source.license.spdxLikeId;
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.license.requiresAttribution = false;
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.license.name = " ";
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.attributionText = "";
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.license.url = "http://example.org/license" as typeof source.license.url;
    },
    (source: ReturnType<typeof mockDatabase>["source"]) => {
      source.downloadUrl = "invalid" as typeof source.downloadUrl;
    },
  ])("requires existing licensed JMdict metadata without repairing it (%#)", async (change) => {
    const plan = await onePlan();
    const db = mockDatabase();
    change(db.source);
    await expect(planOrApplyReadingNoteProofs(db.db, [plan], { apply: true })).rejects.toThrow(
      "licensed JMdict",
    );
    expect(db.writes).not.toHaveBeenCalled();
    expect(db.forbiddenWrite).not.toHaveBeenCalled();
  });

  it("revalidates inside the transaction and refuses a newly appeared pending run", async () => {
    const plan = await onePlan();
    const db = mockDatabase();
    db.transaction.mockImplementationOnce(async (execute) => {
      db.runs.set(plan.checksumSha256, { ...successfulRun(plan), status: "PENDING" });
      return execute(db.client);
    });
    await expect(planOrApplyReadingNoteProofs(db.db, [plan], { apply: true })).rejects.toThrow(
      "repair refused",
    );
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("reuses an exact proof appearing between preflight and transaction without writing", async () => {
    const plan = await onePlan();
    const db = mockDatabase();
    db.transaction.mockImplementationOnce(async (execute) => {
      db.runs.set(plan.checksumSha256, successfulRun(plan));
      return execute(db.client);
    });
    expect(await planOrApplyReadingNoteProofs(db.db, [plan], { apply: true })).toEqual({
      plannedProofCount: 1,
      createdProofCount: 0,
      reusedProofCount: 1,
    });
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("rolls back all new proofs if creating a later proof fails", async () => {
    const plan = await onePlan();
    const note = { ...plan.note, reading: "いいい", note: "also いいい (all senses)" };
    const second = {
      ...plan,
      word: { ...plan.word, sourceNoteReadings: [note] },
      note,
      rawJson: readingNoteProofData(plan.word, note),
      checksumSha256: readingNoteProofChecksum(plan.word, note),
    };
    const db = mockDatabase();
    const create = db.create.getMockImplementation()!;
    db.create
      .mockImplementationOnce(create)
      .mockRejectedValueOnce(new Error("fixture insert failure"));
    await expect(
      planOrApplyReadingNoteProofs(db.db, [plan, second], { apply: true }),
    ).rejects.toThrow("fixture insert failure");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(db.runs.size).toBe(0);
    expect(db.forbiddenWrite).not.toHaveBeenCalled();
  });

  it("validates all plans before writing any run", async () => {
    const plan = await onePlan();
    const otherNote = { ...plan.note, reading: "いいい", note: "also いいい (all senses)" };
    const other = {
      ...plan,
      word: { ...plan.word, sourceNoteReadings: [otherNote] },
      note: otherNote,
      rawJson: readingNoteProofData(plan.word, otherNote),
      checksumSha256: readingNoteProofChecksum(plan.word, otherNote),
    };
    const db = mockDatabase([{ ...successfulRun(other), status: "PENDING" }]);
    await expect(
      planOrApplyReadingNoteProofs(db.db, [plan, other], { apply: true }),
    ).rejects.toThrow("repair refused");
    expect(db.writes).not.toHaveBeenCalled();
  });

  it("rejects tampered, duplicate or oversized plans and leaves an empty set untouched", async () => {
    const plan = await onePlan();
    const db = mockDatabase();
    for (const plans of [
      [{ ...plan, checksumSha256: "b".repeat(64) }],
      [{ ...plan, rawJson: { ...plan.rawJson, note: "also いい" } }],
      [plan, plan],
      Array.from({ length: 101 }, () => plan),
    ])
      await expect(planOrApplyReadingNoteProofs(db.db, plans, { apply: true })).rejects.toThrow();
    expect(await planOrApplyReadingNoteProofs(db.db, [], { apply: true })).toEqual({
      plannedProofCount: 0,
      createdProofCount: 0,
      reusedProofCount: 0,
    });
    expect(db.client.dataSource.findUnique).not.toHaveBeenCalled();
    expect(db.writes).not.toHaveBeenCalled();
  });
});

describe("reviewed-source candidate separation", () => {
  it("uses exact accepted-reading entry IDs and never treats note evidence as a Word candidate", () => {
    const batch = buildMainCourseWordBatch();
    const primary = batch.words[0]!;
    const words = [
      {
        ...primary,
        acceptedReadings: ["さん"],
        acceptedReadingEntryIds: { さん: "jmdict:9999999" },
        sourceNoteReadings: [
          {
            reading: "やまあ",
            sourceRecordId: primary.jmdictEntryId,
            sourceVersion: version,
            sourceDocumentSha256: "a".repeat(64),
            note: "also やまあ (all senses)",
          },
        ],
      },
      ...batch.words.slice(1),
    ];
    const candidates = reviewedSourceCandidates([{ ...batch, words }]);
    expect(candidates).toContainEqual({
      expression: primary.expression,
      reading: "さん",
      jmdictEntryId: "jmdict:9999999",
    });
    expect(candidates.some((candidate) => candidate.reading === "やまあ")).toBe(false);
  });
});
