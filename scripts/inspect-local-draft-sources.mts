import { open, realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { inspectLocalDraft } from "./local-draft-evidence.mts";
import { isWithin } from "./local-source-manifest.mts";
import { createReviewWorksheet } from "./local-review-worksheet.mts";

export async function writeExternalEvidence(path: string, value: unknown): Promise<void> {
  if (!isAbsolute(path)) throw new Error("An absolute external report path is required.");
  const parent = await realpath(dirname(path));
  const root = await realpath(resolve(import.meta.dirname, ".."));
  if (isWithin(root, parent)) throw new Error("Reports must stay outside the repository.");
  const file = await open(resolve(parent, basename(path)), "wx", 0o600);
  try { await file.writeFile(`${JSON.stringify(value, null, 2)}\n`); } finally { await file.close(); }
}
export function parseLocalEvidenceArguments(args: readonly string[]) {
  const values = new Map<string, string | true>();
  for (let index = 0; index < args.length; index++) {
    const flag = args[index]!;
    if (values.has(flag)) throw new Error("Duplicate option.");
    if (flag === "--require-complete" || flag === "--help") { values.set(flag, true); continue; }
    if (!["--snapshot-dir", "--report", "--worksheet"].includes(flag) || !args[index + 1] || args[index + 1]!.startsWith("--")) throw new Error("Invalid local evidence option.");
    values.set(flag, args[++index]!);
  }
  if (values.has("--help")) return { help: true as const };
  const directory = values.get("--snapshot-dir");
  const report = values.get("--report");
  const worksheet = values.get("--worksheet");
  if (worksheet !== undefined && (typeof worksheet !== "string" || !isAbsolute(worksheet))) throw new Error("An absolute worksheet path is required.");
  if (typeof directory !== "string" || !isAbsolute(directory) || (report !== undefined && (typeof report !== "string" || !isAbsolute(report)))) throw new Error("Absolute snapshot/report paths are required.");
  return { help: false as const, directory, report, worksheet, requireComplete: values.has("--require-complete") };
}
export async function runLocalEvidenceCli(args: readonly string[], output: (value: string) => void = console.log): Promise<number> {
  const options = parseLocalEvidenceArguments(args);
  if (options.help) { output("content:drafts:local --snapshot-dir ABSOLUTE_DIRECTORY [--report ABSOLUTE_EXTERNAL_FILE] [--worksheet ABSOLUTE_EXTERNAL_FILE] [--require-complete]"); return 0; }
  const result = await inspectLocalDraft(options.directory);
  if (options.report) await writeExternalEvidence(options.report, result);
  if (options.worksheet) await writeExternalEvidence(options.worksheet, createReviewWorksheet(result));
  output(JSON.stringify(result.summary));
  return options.requireComplete && !result.summary.sourceMatchesComplete ? 2 : 0;
}
if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  runLocalEvidenceCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }).catch(() => {
    console.error("LOCAL_SOURCE_EVIDENCE_FAILED: check local paths, pinned source manifest, XML and checksums. No publication performed.");
    process.exitCode = 1;
  });
}
