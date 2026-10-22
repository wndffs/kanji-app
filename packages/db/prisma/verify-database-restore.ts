import { appendFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

import { PrismaClient } from "@prisma/client";

import {
  DatabaseRestoreError,
  readRestoreEnvironment,
  restoreFailureReport,
  runDatabaseRestore,
  validateRestoreTempRoot,
} from "../src/database-restore";

async function main(): Promise<void> {
  let reportPath: string | undefined;
  let source: PrismaClient | undefined;
  let target: PrismaClient | undefined;
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once("SIGTERM", abort);
  process.once("SIGINT", abort);
  let report:
    | Awaited<ReturnType<typeof runDatabaseRestore>>
    | ReturnType<typeof restoreFailureReport>;
  try {
    if (process.argv.length !== 2) throw new DatabaseRestoreError("INVALID_CONFIGURATION");
    const { config, tempRoot, workspace } = readRestoreEnvironment(process.env);
    const root = await validateRestoreTempRoot(tempRoot, workspace);
    reportPath = join(root, "database-restore-report.json");
    source = new PrismaClient({
      datasourceUrl: config.source.url,
      log: [],
      errorFormat: "minimal",
    });
    target = new PrismaClient({
      datasourceUrl: config.target.url,
      log: [],
      errorFormat: "minimal",
    });
    report = await runDatabaseRestore({
      source,
      target,
      sourceUrl: config.source.url,
      targetUrl: config.target.url,
      containerId: config.containerId,
      tempRoot,
      workspace,
      signal: controller.signal,
    });
  } catch (error) {
    report = restoreFailureReport(error);
    process.exitCode = 1;
  } finally {
    const disconnected = await Promise.allSettled([source?.$disconnect(), target?.$disconnect()]);
    if (disconnected.some((result) => result.status === "rejected")) {
      report = restoreFailureReport(undefined);
      process.exitCode = 1;
    }
    process.removeListener("SIGTERM", abort);
    process.removeListener("SIGINT", abort);
  }
  const json = `${JSON.stringify(report!, null, 2)}\n`;
  if (reportPath !== undefined) {
    try {
      await writeFile(reportPath, json, { flag: "wx", mode: 0o600 });
      if (process.env.GITHUB_OUTPUT !== undefined)
        await appendFile(process.env.GITHUB_OUTPUT, "report_ready=true\n", "utf8");
    } catch {
      console.log(JSON.stringify(restoreFailureReport(undefined)));
      process.exitCode = 1;
      return;
    }
  }
  console.log(json.trimEnd());
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  void main().catch(() => {
    console.log(JSON.stringify(restoreFailureReport(undefined)));
    process.exitCode = 1;
  });
}
