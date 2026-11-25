import "reflect-metadata";

import { PrismaClient } from "@kanji-srs/db";

import { checkMainCourseLaunch } from "./main-course-launch-check";

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");

  const db = new PrismaClient({ datasourceUrl: databaseUrl });
  try {
    const summary = await checkMainCourseLaunch(db);
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    if (!summary.readyToPublish) process.exitCode = 1;
  } finally {
    await db.$disconnect();
  }
}

void main().catch((error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  const reason = typeof code === "string" && /^P\d{4}$/.test(code) ? ` (${code})` : "";
  const message = process.env.DATABASE_URL
    ? `The main-course launch check could not complete${reason}.`
    : "DATABASE_URL is required.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
