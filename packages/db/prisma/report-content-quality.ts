import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import { collectContentQualityReport } from "../src/content-quality-report";

const args = process.argv.slice(2);
const prisma = new PrismaClient();
try {
  const outputIndex = args.indexOf("--output");
  if (
    outputIndex >= 0 &&
    (args[outputIndex + 1] === undefined || args[outputIndex + 1].startsWith("--"))
  )
    throw new Error("--output requires a file path.");
  const report = await prisma.$transaction((db) => collectContentQualityReport(db), {
    isolationLevel: "RepeatableRead",
    maxWait: 10000,
    timeout: 120000,
  });
  const json = `${JSON.stringify(report, null, 2)}\n`;
  if (outputIndex >= 0) {
    const path = resolve(args[outputIndex + 1]);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, json, "utf8");
  }
  console.log(json.trimEnd());
  if (report.blockerCount > 0 && !args.includes("--report-only")) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
