import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { PrismaClient } from "@kanji-srs/db";

import { importJmDictXml, type JmDictImportDatabase } from "../jmdict";

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith("--"));
const sourceVersion = readFlagValue(args, "--source-version");

if (filePath === undefined) {
  console.error(
    "Usage: npm run import:jmdict --workspace @kanji-srs/content-importers -- <path> [--source-version <version>]",
  );
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();

  try {
    const absolutePath = resolve(filePath);
    const xml = await readFile(absolutePath, "utf8");
    const result = await importJmDictXml(prisma as unknown as JmDictImportDatabase, xml, {
      sourceFileName: basename(absolutePath),
      sourceVersion,
    });

    console.log(
      JSON.stringify(
        {
          importRunId: result.importRunId,
          checksumSha256: result.checksumSha256,
          entryCount: result.entryCount,
          wordCount: result.wordCount,
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
