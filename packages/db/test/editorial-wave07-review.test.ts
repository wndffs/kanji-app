import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { WAVE07_REVIEW_DECISION } from "../src/editorial-wave07-review";
import { buildMainCourseContentBatch07 } from "../src/main-course-content-07";
import { buildMainCourseWordBatch07 } from "../src/main-course-word-content-07";
import { buildKanjiDraft07 } from "../src/editorial-draft-kanji-07";
import { buildWordDraft07 } from "../src/editorial-draft-words-07";
import { buildEditorialCoverage } from "../src/editorial-coverage";
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
describe("versioned independent AI wave07 review", () => {
  it("binds both immutable snapshots and the corrected proposal to the review decision", () => {
    expect(hash(buildMainCourseContentBatch07())).toBe(WAVE07_REVIEW_DECISION.kanjiSha256);
    expect(hash(buildMainCourseWordBatch07())).toBe(WAVE07_REVIEW_DECISION.wordsSha256);
    expect(hash({ kanji: buildKanjiDraft07(), words: buildWordDraft07() })).toBe(
      WAVE07_REVIEW_DECISION.proposalFingerprint,
    );
    expect(WAVE07_REVIEW_DECISION).toMatchObject({
      decision: "approved-ai-editorial",
      humanReviewed: false,
      publicationApproved: false,
      reviewedAt: "2026-10-29",
    });
  });
  it("counts the promoted registry once while retaining a nonpublishing proposal archive", () => {
    const coverage = buildEditorialCoverage();
    expect(coverage.validation.valid).toBe(true);
    expect(coverage.reviewedRegistry).toMatchObject({ kanji: 117, words: 180 });
    expect(coverage.pendingDrafts.proposedCards).toBe(0);
    expect(coverage.archivedDrafts?.proposedCards).toBe(69);
    expect(coverage.publicationApproved).toBe(false);
  });
});
