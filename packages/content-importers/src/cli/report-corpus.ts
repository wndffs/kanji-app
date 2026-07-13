import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { PrismaClient } from "@kanji-srs/db";

import {
  collectCorpusStats,
  type CorpusStatsDatabase,
  validateCorpusMinimums,
} from "../corpus-stats";
import { readFlagValue } from "./import-options";

const args = process.argv.slice(2);
const outputPath = readFlagValue(args, "--output");
const requireFull = args.includes("--require-full");
const prisma = new PrismaClient();

try {
  const stats = await collectCorpusStats(prisma as unknown as CorpusStatsDatabase);
  const serialized = `${JSON.stringify(stats, null, 2)}\n`;

  if (outputPath !== null) {
    const absoluteOutputPath = resolve(outputPath);
    await mkdir(dirname(absoluteOutputPath), { recursive: true });
    await writeFile(absoluteOutputPath, serialized, "utf8");
  }

  console.log(serialized.trimEnd());

  if (requireFull) {
    const issues = validateCorpusMinimums(stats);

    if (issues.length > 0) {
      throw new Error(`Full corpus verification failed:\n- ${issues.join("\n- ")}`);
    }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
