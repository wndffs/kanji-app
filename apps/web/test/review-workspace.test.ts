import { describe, expect, it } from "vitest";
import { type ReviewQueueItem } from "@kanji-srs/shared";
import {
  DEFAULT_REVIEW_BROWSER,
  filterReviewPreview,
  formatReviewDueAt,
  mergeReviewBrowser,
  parseReviewBrowser,
  pendingReviewCorrections,
  reviewBrowserHref,
  reviewFeedbackTone,
  reviewTimezone,
  summarizeReviewQueue,
} from "../src/lib/review-workspace";

function row(
  id: string,
  prompt: "meaning" | "reading" | "listening",
  itemId = "one",
): ReviewQueueItem {
  return {
    card: {
      id,
      learningItemId: itemId,
      itemType: "kanji",
      cardType: "review",
      promptType: prompt,
      answerType: prompt === "meaning" ? "meaning" : "reading",
      prompt: { japanese: "一", reading: "いち" },
      sortOrder: 1,
    },
    item: {
      id: itemId,
      itemType: "kanji",
      slug: itemId,
      japanese: "一",
      reading: "いち",
      level: 1,
      jlptLevel: "N5",
    },
    dueAt: "2026-06-22T08:00:00Z",
    srs: {
      stageIndex: 1,
      stageName: "Apprentice 1",
      availableAt: "2026-06-22T08:00:00Z",
      burnedAt: null,
      wrongCount: 0,
      correctStreak: 0,
    },
  };
}

describe("review workspace", () => {
  it("separates distinct cards, materials and audio prompts without mutating snapshots", () => {
    const meaning = row("meaning", "meaning");
    const reading = row("reading", "reading");
    const audio = row("audio", "listening", "two");
    const queue = [meaning, reading, audio, meaning];
    const before = structuredClone(queue);
    expect(summarizeReviewQueue(queue)).toEqual({
      cards: 3,
      materials: 2,
      meaning: 1,
      reading: 1,
      listening: 1,
    });
    expect(pendingReviewCorrections(queue, ["meaning", "outside"])).toBe(2);
    expect(summarizeReviewQueue([]).materials).toBe(0);
    expect(queue).toEqual(before);
  });
  it("bounds unknown filters/pages and keeps partial navigation intent", () => {
    expect(
      parseReviewBrowser(new URLSearchParams("kind=unknown&prompt=all-other&level=61&page=-3")),
    ).toEqual(DEFAULT_REVIEW_BROWSER);
    expect(parseReviewBrowser(new URLSearchParams("page=10001&level=0"))).toEqual(
      DEFAULT_REVIEW_BROWSER,
    );
    const first = mergeReviewBrowser({ ...DEFAULT_REVIEW_BROWSER, page: 3 }, { kind: "kanji" });
    const next = mergeReviewBrowser(first, { prompt: "reading", level: 1 });
    expect(next).toEqual({ kind: "kanji", prompt: "reading", level: 1, page: 1 });
    const href = reviewBrowserHref(mergeReviewBrowser(next, { page: 2 }));
    expect(href).toBe("/reviews?kind=kanji&prompt=reading&level=1&page=2");
    expect(parseReviewBrowser(new URL(href, "https://app.test").searchParams)).toEqual({
      ...next,
      page: 2,
    });
  });
  it("filters only the inspection list without modifying the session queue", () => {
    const queue = [row("a", "meaning"), row("b", "reading"), row("c", "listening")];
    expect(
      filterReviewPreview(queue, { ...DEFAULT_REVIEW_BROWSER, prompt: "listening" }).map(
        (item) => item.card.id,
      ),
    ).toEqual(["c"]);
    expect(filterReviewPreview(queue, { ...DEFAULT_REVIEW_BROWSER, kind: "word" })).toEqual([]);
    expect(filterReviewPreview(queue, { ...DEFAULT_REVIEW_BROWSER, level: 2 })).toEqual([]);
    expect(queue).toHaveLength(3);
  });
  it("formats the actual due instant in selected zones and safely handles bad values", () => {
    expect(formatReviewDueAt("2026-06-22T08:00:00Z", "Europe/Moscow")).toContain(
      "11:00 (Europe/Moscow)",
    );
    expect(formatReviewDueAt("2026-06-22T08:00:00Z", "Asia/Tokyo")).toContain("17:00 (Asia/Tokyo)");
    expect(formatReviewDueAt("2026-06-22T08:00:00Z", "bad/zone")).toContain("08:00 (UTC)");
    expect(reviewTimezone("bad/zone")).toBe("UTC");
    expect(formatReviewDueAt(null, "UTC")).toBe("Дата недоступна");
    expect(formatReviewDueAt("invalid", "UTC")).toBe("Дата недоступна");
  });
  it.each([
    [{ result: "correct", accepted: true }, "success"],
    [{ result: "typo", accepted: true }, "success"],
    [{ result: "wrong", accepted: false }, "wrong"],
    [{ result: "reveal", accepted: false }, "neutral"],
    [{ result: "manual-ignore", accepted: true }, "neutral"],
    [{ result: "wrong", accepted: false, retry: true }, "neutral"],
  ] as const)("distinguishes server feedback presentation: %o", (feedback, expected) => {
    expect(reviewFeedbackTone(feedback)).toBe(expected);
  });
});
