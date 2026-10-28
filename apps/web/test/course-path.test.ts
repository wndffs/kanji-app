import { describe, expect, it } from "vitest";
import { relatedCourseItemHref } from "../src/lib/course-browser-route";
describe("related study course context", () => {
  it("keeps only validated browsing context across related items", () => {
    const params = new URLSearchParams({
      courseId: "00000000-0000-4000-8000-000000000010",
      level: "2",
      page: "3",
      q: "one",
      token: "private",
      view: "personal",
    });
    const url = new URL(relatedCourseItemHref("related item", params), "https://example.test");
    expect(url.pathname).toBe("/items/related%20item");
    expect(url.searchParams.get("courseId")).toBe(params.get("courseId"));
    expect(url.searchParams.get("page")).toBe("3");
    expect(url.searchParams.get("q")).toBe("one");
    expect(url.searchParams.has("token")).toBe(false);
    expect(url.searchParams.has("view")).toBe(false);
  });
  it.each(["", "https://bad.test", "../../bad"])("drops invalid context %s", (courseId) => {
    expect(relatedCourseItemHref("word", new URLSearchParams({ courseId, q: "private" }))).toBe(
      "/items/word",
    );
  });
});
