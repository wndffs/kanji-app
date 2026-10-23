import { describe, expect, it } from "vitest";
import {
  adjacentCourseLevels,
  courseBrowserHref,
  courseItemHref,
  courseReturnHref,
  parseCourseBrowserRoute,
} from "../src/lib/course-browser-route";
describe("course browser URLs", () => {
  it("links back to only a validated internal course view", () => {
    const courseId = "00000000-0000-4000-8000-000000000010";
    const href = courseItemHref("item", courseId, {
      level: 2,
      page: 3,
      itemType: "kanji",
      studyState: "all",
    });
    expect(
      courseReturnHref(Object.fromEntries(new URL(href, "https://example.test").searchParams)),
    ).toBe(`/courses/${courseId}?level=2&page=3&itemType=kanji`);
    expect(courseReturnHref({ courseId: "https://evil.example/" })).toBeNull();
    expect(courseReturnHref({ courseId: [courseId, courseId] })).toBeNull();
  });
  it("navigates actual adjacent levels without inventing missing numbers", () => {
    expect(adjacentCourseLevels([5, 1, 3, 3], 3)).toEqual({ previous: 1, next: 5 });
    expect(adjacentCourseLevels([1, 3], 1)).toEqual({ previous: null, next: 3 });
    expect(adjacentCourseLevels([], 1)).toEqual({ previous: null, next: null });
  });
  it("round trips the complete view without including arbitrary URL destinations", () => {
    const route = { level: 4, page: 2, itemType: "word", studyState: "learning" } as const;
    const href = courseBrowserHref("course", route);
    expect(href).toBe("/courses/course?level=4&page=2&itemType=word&studyState=learning");
    expect(parseCourseBrowserRoute(new URL(href, "https://example.test").searchParams)).toEqual(
      route,
    );
  });
  it("bounds malformed or excessive values", () => {
    expect(
      parseCourseBrowserRoute(
        new URLSearchParams("level=61&page=10001&itemType=wrong&studyState=wrong"),
      ),
    ).toEqual({ level: null, page: 1, itemType: "all", studyState: "all" });
  });
});
