import type { Prisma } from "@prisma/client";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  buildMainCourseWordBatches,
  type MainCourseWordBatch,
} from "../packages/db/src/main-course-word-content.ts";
import {
  reviewedSourceCandidates,
  selectReviewedSourceBatches,
} from "./import-missing-reviewed-word-sources.mts";

type Reader = Pick<Prisma.TransactionClient, "word">;
type Pair = { expression: string; reading: string };
const pairKey = ({ expression, reading }: Pair) => JSON.stringify([expression, reading]);
const MAX_QUERY_PAIRS = 256;

export async function auditReviewedWordInventory(
  db: Reader,
  batches: readonly MainCourseWordBatch[],
) {
  const candidates = reviewedSourceCandidates(batches);
  const select = {
    expression: true,
    reading: true,
    jmdictEntryId: true,
    importedRecord: {
      select: {
        recordType: true,
        sourceRecordId: true,
        importRun: { select: { status: true } },
      },
    },
  } as const satisfies Prisma.WordSelect;
  type Observed = Prisma.WordGetPayload<{ select: typeof select }>;
  const observed = new Map<string, Observed>();
  for (let offset = 0; offset < candidates.length; offset += MAX_QUERY_PAIRS) {
    const pairs = candidates.slice(offset, offset + MAX_QUERY_PAIRS);
    for (const row of await db.word.findMany({
      where: { OR: pairs.map(({ expression, reading }) => ({ expression, reading })) },
      select,
    })) {
      observed.set(pairKey(row), row);
    }
  }

  let offset = 0;
  const manifests = batches.map(({ id, words }) => {
    const total = words.reduce(
      (count, word) => count + 1 + (word.acceptedReadings?.length ?? 0),
      0,
    );
    const counts = { total, missing: 0, conflicting: 0, incomplete: 0, existingExact: 0 };
    for (const candidate of candidates.slice(offset, offset + total)) {
      const row = observed.get(pairKey(candidate));
      if (!row) counts.missing++;
      else if (row.jmdictEntryId !== candidate.jmdictEntryId) counts.conflicting++;
      else if (
        row.importedRecord?.recordType !== "JMDICT_ENTRY" ||
        row.importedRecord.sourceRecordId !== candidate.jmdictEntryId ||
        row.importedRecord.importRun.status !== "SUCCESS"
      )
        counts.incomplete++;
      else counts.existingExact++;
    }
    offset += total;
    return { id, words: words.length, ...counts };
  });
  return { status: "source-inventory-audited", existingRowsNotRevalidated: true, manifests };
}

async function main(args: readonly string[]) {
  const { values } = parseArgs({
    args: [...args],
    options: { batch: { type: "string", multiple: true } },
  });
  const batches = selectReviewedSourceBatches(buildMainCourseWordBatches(), values.batch ?? []);
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const { PrismaClient } = await import("@prisma/client");
  const db = new PrismaClient();
  try {
    console.log(JSON.stringify(await auditReviewedWordInventory(db, batches), null, 2));
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  void main(process.argv.slice(2)).catch(() => {
    console.error(
      "REVIEWED_SOURCE_INVENTORY_FAILED: check reviewed batch IDs and database access.",
    );
    process.exitCode = 1;
  });
}
