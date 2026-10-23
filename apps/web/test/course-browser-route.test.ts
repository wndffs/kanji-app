import { describe, expect, it } from "vitest";
import { courseBrowserHref, parseCourseBrowserRoute } from "../src/lib/course-browser-route";
describe("course browser URLs", () => {
  it("round trips the complete view without including arbitrary URL destinations", () => {
    const route = { level: 4, page: 2, itemType: "word", studyState: "learning" } as const;
    const href = courseBrowserHref("course", route);
    expect(href).toBe("/courses/course?level=4&page=2&itemType=word&studyState=learning");
    expect(parseCourseBrowserRoute(new URL(href, "https://example.test").searchParams)).toEqual(route);
  });
  it("bounds malformed or excessive values", () => {
    expect(parseCourseBrowserRoute(new URLSearchParams("level=61&page=10001&itemType=wrong&studyState=wrong"))).toEqual({ level: null, page: 1, itemType: "all", studyState: "all" });
  });
});
