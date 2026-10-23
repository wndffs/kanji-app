import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildEditorialDraftPreview } from "../src/editorial-draft-preview";

export function runEditorialDraftPreview(args: readonly string[]) {
  if (args.length !== 2 || args[0] !== "--mode" || !["ru", "en", "ru-en"].includes(args[1]!)) {
    throw new Error("Use --mode ru, --mode en or --mode ru-en. No database is used.");
  }
  return buildEditorialDraftPreview(args[1] as "ru" | "en" | "ru-en");
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const report = runEditorialDraftPreview(process.argv.slice(2));
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = report.validation.valid ? 0 : 1;
  } catch (error) { console.error(error instanceof Error ? error.message : "Draft preview failed."); process.exitCode = 1; }
}
