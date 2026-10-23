import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { summarizeEditorialDraftEvidence } from "../src/editorial-draft-evidence";

describe("manual aggregate draft coverage", () => {
  it("whitelists numeric counts without dictionary rows, IDs, URLs or source details", () => {
    const report = summarizeEditorialDraftEvidence({
      kanji: [{ character: "PRIVATE", targetId: "PRIVATE", exactRawReadingObserved: true, firstStoredReadingMatches: false, strokeProvenance: { secret: "PRIVATE" } }],
      words: [{ expression: "PRIVATE", targetId: "PRIVATE", importedLocales: ["ru-RU", "en-US"], provenance: { secret: "PRIVATE" } }],
    } as never);
    expect(report).toEqual({ scope: "aggregate-draft-source-counts", publicationApproved: false,
      kanji: { candidates: 1, targetsFound: 1, exactRawReadings: 1, firstPriorityMatches: 0, strokeLinks: 1 },
      words: { candidates: 1, targetsFound: 1, sourceLinks: 1, bilingualImported: 1 } });
    expect(JSON.stringify(report)).not.toContain("PRIVATE");
  });
  it("runs only a manual read-only aggregate query and does not upload artifacts", () => {
    const workflow = readFileSync(resolve(__dirname, "../../../.github/workflows/editorial-draft-evidence.yml"), "utf8");
    const inspector = readFileSync(resolve(__dirname, "../prisma/report-editorial-draft-evidence.ts"), "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/\n\s+(push|pull_request|schedule):/u);
    expect(workflow).toContain("contents: read");
    expect(workflow).not.toMatch(/npm run db:(seed|migrate|curate|publish)/u);
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).toContain("report-editorial-draft-evidence.ts --summary-only");
    expect(inspector).toContain("SET TRANSACTION READ ONLY");
    expect(inspector).toContain("$disconnect");
  });
});
