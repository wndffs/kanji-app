import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

import {
  buildEditorialRegistryInventory,
  type EditorialRegistryInventory,
} from "../src/editorial-registry-inventory";
import { buildMainCourseContentBatches } from "../src/main-course-content";
import { buildMainCourseCompletionDraft } from "../src/main-course-completion-content";
import type { EditorialRegistryInventoryOptions } from "../src/editorial-registry-inventory";

export function parseEditorialRegistryArgs(args: readonly string[]) {
  if (
    new Set(args).size !== args.length ||
    args.some((arg) => !["--json", "--include-completion-draft"].includes(arg))
  )
    throw new Error(
      "Usage: report-editorial-registry [--json] [--include-completion-draft]. No database or output file options.",
    );
  return {
    json: args.includes("--json"),
    ...(args.includes("--include-completion-draft")
      ? { includeCompletionDraft: true as const }
      : {}),
  };
}

export function formatEditorialRegistryInventory(report: EditorialRegistryInventory): string {
  const totals = (value: EditorialRegistryInventory["prepared"]["distinctTotals"]) =>
    `${value.components} components, ${value.kanji} kanji, ${value.words} words (${value.items} targets)`;
  const lines = [
    "Editorial registry inventory (SOURCE ONLY)",
    report.countSemantics,
    `Manifest: ${report.manifestVersion}`,
    `SHA-256: ${report.manifestChecksumSha256}`,
    `Validation: ${report.validation.valid ? "valid" : "INVALID"}`,
    `Prepared distinct: ${totals(report.prepared.distinctTotals)}`,
    `Reviewed source metadata: ${totals(report.prepared.reviewedDistinctTotals)}`,
    `Pending review: ${totals(report.prepared.pendingReviewDistinctTotals)}`,
    "",
  ];
  for (const batch of report.batches) {
    lines.push(
      `${batch.kind} ${batch.id} v${batch.version}: ${batch.reviewStatus} (${batch.reviewedAt ?? "no review date"})`,
      `  Source: ${batch.sourceFile}; course: ${batch.courseSlug}`,
      `  SHA-256: ${batch.checksumSha256}`,
      `  Prepared distinct: ${totals(batch.counts)}`,
      `  Slots: ${batch.levelSlots.map((slot) => `L${slot.levelNumber} ${slot.kind} [${slot.sortOrders.join(",")}]`).join("; ") || "none"}`,
      `  Prerequisite closure: ${batch.prerequisiteClosure.closed ? "closed" : "INVALID"}; ${batch.prerequisiteClosure.requiredTargetCount} required targets; external batches: ${batch.prerequisiteClosure.externalBatchIds.join(", ") || "none"}`,
      `  Source seals: ${batch.sourceSeals.map((seal) => `${seal.id}=${seal.status}`).join(", ")}`,
    );
  }
  lines.push("", "Finite source seals (not publication evidence):");
  for (const seal of report.sourceSeals) {
    lines.push(
      `${seal.id}: ${seal.status}; sealed distinct: ${totals(seal.sealedDistinctTotals)}`,
      `  Included prepared: ${totals(seal.includedPreparedDistinctTotals)}; prepared outside seal: ${totals(seal.preparedOutsideSealDistinctTotals)}`,
      `  Sources: ${seal.sources.map((source) => `${source.id}=${source.status}`).join(", ")}`,
    );
  }
  if (report.validation.issues.length > 0)
    lines.push("", "Validation issues:", ...report.validation.issues.map((issue) => `- ${issue}`));
  return lines.join("\n");
}

export function runEditorialRegistryInventory(
  args: readonly string[],
  build: (
    options?: EditorialRegistryInventoryOptions,
  ) => EditorialRegistryInventory = buildEditorialRegistryInventory,
): { stdout: string; exitCode: number } {
  const { json, includeCompletionDraft } = parseEditorialRegistryArgs(args);
  const base = includeCompletionDraft ? buildMainCourseContentBatches() : null;
  const report =
    base === null
      ? build()
      : build({
          kanjiBatches: [
            ...base,
            buildMainCourseCompletionDraft(base.flatMap((batch) => batch.components)),
          ],
        });
  return {
    stdout: `${json ? JSON.stringify(report, null, 2) : formatEditorialRegistryInventory(report)}\n`,
    exitCode: report.validation.valid ? 0 : 1,
  };
}

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  try {
    const result = runEditorialRegistryInventory(process.argv.slice(2));
    process.stdout.write(result.stdout);
    process.exitCode = result.exitCode;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
