import { describe, expect, it } from "vitest";

import { createContentImportProgressTracker, type ContentImportProgress } from "../src/progress";
import { formatImportProgress } from "../src/cli/import-progress";

describe("content import progress", () => {
  it("reports start, throttled checkpoints, and exact completion", () => {
    const reports: ContentImportProgress[] = [];
    const tracker = createContentImportProgressTracker("JMdict", 250, (progress) => {
      reports.push(progress);
    });

    for (let index = 0; index < 250; index += 1) {
      tracker.advance();
    }

    expect(reports[0]).toEqual({ source: "JMdict", completed: 0, total: 250, percent: 0 });
    expect(reports[1]).toEqual({ source: "JMdict", completed: 3, total: 250, percent: 1.2 });
    expect(reports.at(-1)).toEqual({
      source: "JMdict",
      completed: 250,
      total: 250,
      percent: 100,
    });
    expect(reports.length).toBeLessThanOrEqual(102);
  });

  it("reports an empty import as complete and prevents over-counting", () => {
    const reports: ContentImportProgress[] = [];
    const empty = createContentImportProgressTracker("Tatoeba", 0, (progress) => {
      reports.push(progress);
    });

    expect(reports).toEqual([{ source: "Tatoeba", completed: 0, total: 0, percent: 100 }]);
    expect(() => empty.advance()).toThrow(/advanced beyond 0 items/u);
  });

  it("formats deterministic CLI output", () => {
    expect(
      formatImportProgress({ source: "KANJIDIC2", completed: 500, total: 10_000, percent: 5 }),
    ).toBe("[import:KANJIDIC2] 500/10000 (5.0%)");
  });
});
