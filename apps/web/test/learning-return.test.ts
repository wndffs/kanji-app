import { describe, expect, it } from "vitest";
import {
  canonicalCourseReturn,
  lessonEntryHref,
  lessonReturnHref,
} from "../src/lib/learning-return";
import { DEFAULT_LESSON_BROWSER, lessonBrowserHref } from "../src/lib/lesson-browser";

const path = "/courses/00000000-0000-4000-8000-000000000010";
describe("bounded learning return", () => {
  it("retains whitelisted catalogue context through local lesson filters", () => {
    const target = `${path}?level=2&page=3&kind=kanji&q=one`;
    const safe = canonicalCourseReturn(target)!;
    expect(safe).toContain("level=2");
    expect(safe).toContain("page=3");
    const entry = new URL(lessonEntryHref(safe), "https://app.test");
    expect(lessonReturnHref(entry.searchParams)).toBe(safe);
    const filtered = new URL(
      lessonBrowserHref(null, { ...DEFAULT_LESSON_BROWSER, q: "one", page: 2 }, safe),
      "https://app.test",
    );
    expect(lessonReturnHref(filtered.searchParams)).toBe(safe);
    expect(filtered.searchParams.get("q")).toBe("one");
  });
  it("rejects external, malformed, ambiguous and arbitrary return destinations", () => {
    for (const value of [
      "https://evil.test",
      "//evil.test",
      "/dashboard",
      `${path}#secret`,
      `${path}/items`,
      "/courses/../admin",
      `${path}?q=${"x".repeat(1100)}`,
    ]) {
      expect(canonicalCourseReturn(value)).toBeNull();
      expect(lessonEntryHref(value)).toBe("/lessons");
    }
    expect(lessonReturnHref(new URLSearchParams(`returnTo=${path}&returnTo=${path}`))).toBeNull();
    expect(canonicalCourseReturn(`${path}?token=private&answer=one`)).toBe(path);
  });
});
