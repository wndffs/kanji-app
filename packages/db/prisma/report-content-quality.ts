import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  collectContentQualityReport,
  contentQualityReportTimeoutMs,
} from "../src/content-quality-report";
import { buildMainCourseBlueprint } from "../src/main-course";

const args = process.argv.slice(2);
const prisma = new PrismaClient();
try {
  const outputIndex = args.indexOf("--output");
  if (
    outputIndex >= 0 &&
    (args[outputIndex + 1] === undefined || args[outputIndex + 1].startsWith("--"))
  )
    throw new Error("--output requires a file path.");
  const courseSlug = buildMainCourseBlueprint().course.slug;
  // This count determines only the deadline; report contents are still read
  // exclusively inside the consistent transaction below.
  const publishedItemCount = await prisma.learningItem.count({
    where: {
      status: "PUBLISHED",
      courseLevelItems: { some: { courseLevel: { course: { slug: courseSlug } } } },
    },
  });
  const report = await prisma.$transaction(
    (db) => collectContentQualityReport(db, { courseSlug }),
    {
      isolationLevel: "RepeatableRead",
      maxWait: 10000,
      timeout: contentQualityReportTimeoutMs(publishedItemCount),
    },
  );
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
