import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { PrismaClient } from "@kanji-srs/db";

import { importTatoebaFiles, type TatoebaImportDatabase } from "../tatoeba";
import { writeImportProgress } from "./import-progress";

const args = process.argv.slice(2);
const filePaths = readPositionalArgs(args);
const sourceVersion = readFlagValue(args, "--source-version");
const maxTextLength = readNumberFlagValue(args, "--max-text-length");

if (filePaths.length < 2) {
  console.error(
    "Usage: npm run import:tatoeba --workspace @kanji-srs/content-importers -- <sentences.tsv> <links.tsv> [--source-version <version>] [--max-text-length <n>]",
  );
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();

  try {
    const [sentencesPath, linksPath] = filePaths.map((filePath) => resolve(filePath));
    const [sentencesTsv, linksTsv] = await Promise.all([
      readFile(sentencesPath, "utf8"),
      readFile(linksPath, "utf8"),
    ]);
    const result = await importTatoebaFiles(
      prisma as unknown as TatoebaImportDatabase,
      sentencesTsv,
      linksTsv,
      {
        sourceFileName: `${basename(sentencesPath)}+${basename(linksPath)}`,
        sourceVersion,
        maxTextLength,
        onProgress: writeImportProgress,
      },
    );

    console.log(
      JSON.stringify(
        {
          importRunId: result.importRunId,
          checksumSha256: result.checksumSha256,
          sentenceCount: result.sentenceCount,
          rejectedCount: result.rejectedCount,
          status: result.status,
        },
        null,
        2,
      ),
    );
  } finally {
    await prisma.$disconnect();
  }
}

function readFlagValue(args: readonly string[], flag: string): string | null {
  const index = args.indexOf(flag);

  if (index === -1) {
    return null;
  }

  const value = args[index + 1];

  return value === undefined || value.startsWith("--") ? null : value;
}

function readPositionalArgs(args: readonly string[]): readonly string[] {
  const values: string[] = [];

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];

    if (value === "--source-version" || value === "--max-text-length") {
      index += 1;
      continue;
    }

    if (value !== undefined && !value.startsWith("--")) {
      values.push(value);
    }
  }

  return values;
}

function readNumberFlagValue(args: readonly string[], flag: string): number | undefined {
  const raw = readFlagValue(args, flag);

  if (raw === null) {
    return undefined;
  }

  const parsed = Number(raw);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${flag} must be a positive integer.`);
  }

  return parsed;
}
