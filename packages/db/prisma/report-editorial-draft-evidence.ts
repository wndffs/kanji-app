import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { withNeonConnectionDefaults } from "../src/connection-defaults";
import { inspectEditorialDraftEvidence } from "../src/editorial-draft-evidence";

export async function runEditorialDraftEvidence(args: readonly string[]) {
  if (args.length !== 0)
    throw new Error("Draft evidence accepts no flags; it never applies content.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for read-only draft evidence.");
  const db = new PrismaClient({ datasources: { db: { url: withNeonConnectionDefaults(url) } } });
  try {
    return await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`SET TRANSACTION READ ONLY`;
        return inspectEditorialDraftEvidence(tx);
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
  } finally {
    await db.$disconnect();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  runEditorialDraftEvidence(process.argv.slice(2)).then(
    (report) => console.log(JSON.stringify(report, null, 2)),
    () => {
      console.error(
        "Draft evidence failed. Check database connectivity and committed schema; no content was applied.",
      );
      process.exitCode = 1;
    },
  );
}
