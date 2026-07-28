import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import { PrismaClient } from "@kanji-srs/db";

import {
  importJmDictXml,
  JMDICT_SELECTION_PROFILE_NAMES,
  type JmDictImportDatabase,
  readJmDictSelectionProfile,
} from "../jmdict";
import { createPrismaJmDictBatchWriter } from "../jmdict-prisma-batch";
import { readFlagValue, readImportMetadata } from "./import-options";
import { writeImportProgress } from "./import-progress";

const args = process.argv.slice(2);
const filePath = args.find((arg) => !arg.startsWith("--"));
const metadata = readImportMetadata(args);
const selectionProfile =
  readJmDictSelectionProfile(readFlagValue(args, "--selection-profile")) ??
  JMDICT_SELECTION_PROFILE_NAMES[0];

if (filePath === undefined) {
  console.error(
    "Usage: npm run import:jmdict --workspace @kanji-srs/content-importers -- <path> [--source-version <version>] [--source-downloaded-at <ISO-8601>] [--checksum-sha256 <hash>] [--selection-profile bilingual-course-candidates-v1]",
  );
  process.exitCode = 1;
} else {
  const prisma = new PrismaClient();

  try {
    const absolutePath = resolve(filePath);
    const xml = await readFile(absolutePath, "utf8");
    const result = await importJmDictXml(prisma as unknown as JmDictImportDatabase, xml, {
      sourceFileName: basename(absolutePath),
      batchWriter: createPrismaJmDictBatchWriter(prisma),
      onProgress: writeImportProgress,
      selectionProfile,
      ...metadata,
    });

    console.log(
      JSON.stringify(
        {
          importRunId: result.importRunId,
          checksumSha256: result.checksumSha256,
          selectionProfile: result.selectionProfile,
          sourceEntryCount: result.sourceEntryCount,
          sourceWordCount: result.sourceWordCount,
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
