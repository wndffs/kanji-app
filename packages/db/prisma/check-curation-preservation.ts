import { readFile, rm, writeFile } from "node:fs/promises";
import { isAbsolute, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Prisma, PrismaClient } from "@prisma/client";
import { withNeonConnectionDefaults } from "../src/connection-defaults";

const ROW_LIMIT = 200_000;
const BASELINE_FILE = "curation-preservation-private.json";
const privateTables = [
  "User",
  "UserSettings",
  "UserEnrollment",
  "UserSrsState",
  "ReviewSession",
  "ReviewAnswer",
  "UserItemOverride",
  "UserMnemonic",
  "UserCourseLevelCompletion",
  "UserUnlockEvent",
  "UserKanaProgress",
  "KanaPracticeSession",
  "KanaAttempt",
  "Deck",
  "DeckItem",
] as const;
const curriculumGroups = ["Course", "CourseLevel", "PublishedCoursePlacement"] as const;
const groups = [...privateTables, ...curriculumGroups] as const;
type Group = (typeof groups)[number];
type Fingerprint = { readonly group: Group; readonly rows: number; readonly hash: string };
type AuditMode = "capture" | "compare";

export function selectPreservationMode(args: readonly string[]): AuditMode {
  const [mode] = args;
  if (args.length !== 1 || (mode !== "capture" && mode !== "compare"))
    throw new Error("Select preservation capture or compare.");
  return mode;
}

export function parsePreservationSnapshot(value: unknown): readonly Fingerprint[] {
  if (!Array.isArray(value) || value.length !== groups.length)
    throw new Error("Invalid preservation snapshot.");
  const ids = new Set<Group>();
  for (const row of value) {
    if (
      row === null ||
      typeof row !== "object" ||
      !groups.includes(row.group) ||
      ids.has(row.group) ||
      !Number.isSafeInteger(row.rows) ||
      row.rows < 0 ||
      row.rows > ROW_LIMIT + 1 ||
      typeof row.hash !== "string" ||
      !/^[0-9a-f]{32}$/u.test(row.hash)
    )
      throw new Error("Invalid preservation snapshot.");
    ids.add(row.group);
  }
  return value as Fingerprint[];
}

export function summarizePreservation(
  before: readonly Fingerprint[],
  after: readonly Fingerprint[],
) {
  const fingerprintAfter = new Map(after.map((row) => [row.group, row]));
  const learnerData = { unchanged: 0, changed: 0, beyondLimit: 0 };
  const curriculum = { unchanged: 0, changed: 0, beyondLimit: 0 };
  for (const baseline of before) {
    const current = fingerprintAfter.get(baseline.group);
    if (!current) throw new Error("Invalid preservation snapshot.");
    const tally = curriculumGroups.some((group) => group === baseline.group)
      ? curriculum
      : learnerData;
    if (baseline.rows > ROW_LIMIT || current.rows > ROW_LIMIT) tally.beyondLimit++;
    else if (baseline.rows === current.rows && baseline.hash === current.hash) tally.unchanged++;
    else tally.changed++;
  }
  return { learnerData, curriculum };
}

export async function capturePreservationSnapshot(db: Pick<PrismaClient, "$queryRaw">) {
  const queries = groups.map((group) => {
    // Table names come exclusively from fixed internal groups, never from workflow inputs.
    const source =
      group === "PublishedCoursePlacement"
        ? Prisma.sql`"CourseLevelItem" r JOIN "CourseLevel" l ON l.id = r."courseLevelId" JOIN "Course" c ON c.id = l."courseId" WHERE c.status = 'PUBLISHED'`
        : Prisma.sql`${Prisma.raw(`"${group}"`)} r`;
    const data =
      group === "User"
        ? Prisma.sql`to_jsonb(r) - 'passwordHash' - 'email'`
        : Prisma.sql`to_jsonb(r)`;
    return Prisma.sql`
      SELECT ${group}::text AS "group", count(*)::int AS rows,
        md5(COALESCE(string_agg(digest, '' ORDER BY id), '')) AS hash
      FROM (SELECT r.id, md5((${data})::text) AS digest
        FROM ${source} ORDER BY r.id LIMIT ${ROW_LIMIT + 1}) fingerprinted
    `;
  });
  // One statement gives every group the same snapshot. Neither row data nor hashes go to stdout.
  return parsePreservationSnapshot(await db.$queryRaw(Prisma.join(queries, " UNION ALL ")));
}

async function main(args: readonly string[]) {
  const mode = selectPreservationMode(args);
  const directory = process.env.RUNNER_TEMP;
  const url = process.env.DATABASE_URL;
  if (!directory || !isAbsolute(directory) || !url)
    throw new Error("Preservation audit requires CI paths and a database.");
  const baselinePath = join(directory, BASELINE_FILE);
  const db = new PrismaClient({ datasourceUrl: withNeonConnectionDefaults(url) });
  try {
    if (mode === "capture") {
      const baseline = await capturePreservationSnapshot(db);
      await writeFile(baselinePath, JSON.stringify(baseline), { flag: "wx", mode: 0o600 });
      console.log(
        JSON.stringify({ status: "preservation-baseline-captured", groups: baseline.length }),
      );
      return;
    }
    const before = parsePreservationSnapshot(JSON.parse(await readFile(baselinePath, "utf8")));
    const report = summarizePreservation(before, await capturePreservationSnapshot(db));
    console.log(JSON.stringify({ status: "preservation-compared", ...report }, null, 2));
    if (report.curriculum.changed > 0 || report.curriculum.beyondLimit > 0) process.exitCode = 1;
    if (report.learnerData.changed > 0 || report.learnerData.beyondLimit > 0)
      console.warn(
        "Learner-data preservation is not established for every group; concurrent learner activity can change it.",
      );
  } finally {
    if (mode === "compare") await rm(baselinePath, { force: true });
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).catch(() => {
    console.error("Curation preservation audit could not complete. No details were exported.");
    process.exitCode = 1;
  });
}
