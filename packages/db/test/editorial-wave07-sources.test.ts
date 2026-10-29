import { describe, expect, it } from "vitest";
import { buildWordDraft07 } from "../src/editorial-draft-words-07";
import { buildMainCourseWordBatches, validateMainCourseWordBatch } from "../src/main-course-word-content";
import { resolveWave07WordSources, WAVE07_SOURCE_OBSERVATION, WAVE07_WORD_IDENTITIES } from "../src/editorial-wave07-sources";

describe("wave07 exact source resolution", () => {
  it("resolves only observed pairs without granting review or registering the draft", () => {
    const resolved = resolveWave07WordSources(buildWordDraft07());
    expect(validateMainCourseWordBatch(resolved)).toEqual([]);
    expect(resolved.reviewedAt).toBeNull();
    expect(buildMainCourseWordBatches().some((batch) => batch.id === resolved.id)).toBe(false);
    expect(resolved.words).toHaveLength(20);
    expect(resolved.words.find((word) => word.expression === "何人")).toMatchObject({
      reading: "なんにん", jmdictEntryId: "jmdict:1189100",
    });
    expect(WAVE07_SOURCE_OBSERVATION.publicationApproved).toBe(false);
    expect(WAVE07_WORD_IDENTITIES.every(([, , sequence]) => /^[1-9]\d*$/u.test(sequence))).toBe(true);
  });
  it("rejects changed, duplicate or omitted identities rather than guessing", () => {
    for (const change of ["reading", "duplicate", "missing"]) {
      const draft = structuredClone(buildWordDraft07());
      if (change === "reading") Object.assign(draft.words[0]!, { reading: "がくこう" });
      if (change === "duplicate") Object.assign(draft.words[0]!, draft.words[1]!);
      if (change === "missing") Object.assign(draft, { words: draft.words.slice(1) });
      expect(() => resolveWave07WordSources(draft)).toThrow();
    }
  });
});
