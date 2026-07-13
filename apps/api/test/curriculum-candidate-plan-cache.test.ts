import { describe, expect, it, vi } from "vitest";

import { CurriculumCandidatePlanCache } from "../src/admin/curriculum-candidate-plan-cache";
import { type CurriculumCandidatePlan } from "../src/admin/curriculum-candidate-plan";

describe("curriculum candidate plan cache", () => {
  it("deduplicates concurrent loads for the same database version", async () => {
    const cache = new CurriculumCandidatePlanCache(2, () => new Date("2026-07-13T12:00:00.000Z"));
    const loader = vi.fn(async () => emptyPlan());

    const [first, second] = await Promise.all([
      cache.getOrLoad("version-one", loader),
      cache.getOrLoad("version-one", loader),
    ]);

    expect(loader).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
    expect(first).toMatchObject({
      version: "version-one",
      generatedAt: "2026-07-13T12:00:00.000Z",
    });
  });

  it("retains only the two most recently used plan versions", async () => {
    const cache = new CurriculumCandidatePlanCache(2);
    const loader = vi.fn(async () => emptyPlan());

    await cache.getOrLoad("version-one", loader);
    await cache.getOrLoad("version-two", loader);
    expect(cache.getCached("version-one")).not.toBeNull();
    await cache.getOrLoad("version-three", loader);

    expect(cache.getCached("version-one")).not.toBeNull();
    expect(cache.getCached("version-two")).toBeNull();
    expect(cache.getCached("version-three")).not.toBeNull();
  });
});

function emptyPlan(): CurriculumCandidatePlan {
  return {
    summary: {
      policyVersion: "independent-frequency-prerequisites-v1",
      targetItems: { kanji: 2_300, word: 8_000 },
      existingItems: { kanji: 0, word: 0 },
      candidateSlots: { kanji: 2_300, word: 8_000 },
      candidatePool: { kanji: 0, word: 0 },
      poolTruncated: { kanji: false, word: false },
      selectedItems: { kanji: 0, word: 0 },
      unfilledSlots: { kanji: 2_300, word: 8_000 },
      excludedWordsMissingKanji: 0,
      bands: [],
    },
    candidates: { kanji: [], word: [] },
  };
}
