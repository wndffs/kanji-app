import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { type CourseOutlineDto } from "@kanji-srs/shared";
import { apiRequest, getCourseOutline, getLessonQueue } from "../src/lib/api-client";
import {
  courseOutlineGeneration,
  invalidateCourseOutline,
  readCourseOutline,
  storeCourseOutline,
} from "../src/lib/course-outline-snapshot";

const outline: CourseOutlineDto = { id: "course", title: "Course", description: null, levels: [] };
beforeEach(invalidateCourseOutline);
afterEach(() => vi.unstubAllGlobals());
it("keeps one confirmed owner/course outline for at most 30 seconds", () => {
  storeCourseOutline("owner", "course", outline, courseOutlineGeneration(), 1000);
  expect(readCourseOutline("owner", "course", 31000)).toBe(outline);
  expect(readCourseOutline("other", "course", 2000)).toBeNull();
  expect(readCourseOutline("owner", "other", 2000)).toBeNull();
  expect(readCourseOutline("owner", "course", 31001)).toBeNull();
  storeCourseOutline("owner", "course", outline, courseOutlineGeneration(), 1000);
  expect(readCourseOutline("owner", "course", 999)).toBeNull();
});
it("rejects late pre-invalidation responses and never caches queue state", async () => {
  const generation = courseOutlineGeneration();
  invalidateCourseOutline();
  storeCourseOutline("owner", "course", outline, generation);
  expect(readCourseOutline("owner", "course")).toBeNull();
  const fetchMock = vi.fn(async () => Response.json(outline));
  vi.stubGlobal("fetch", fetchMock);
  await getCourseOutline("owner", "course");
  await getCourseOutline("owner", "course");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await getCourseOutline("owner", "course", undefined, true);
  await getLessonQueue("owner");
  await getLessonQueue("owner");
  expect(fetchMock).toHaveBeenCalledTimes(4);
  await apiRequest("/users/settings", { method: "PATCH", body: {}, token: "owner" });
  await getCourseOutline("owner", "course");
  expect(fetchMock).toHaveBeenCalledTimes(6);
});
it("does not store failed or cancelled reads", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({}, { status: 503 }))
    .mockResolvedValue(Response.json(outline));
  vi.stubGlobal("fetch", fetchMock);
  await expect(getCourseOutline("owner", "course")).rejects.toThrow();
  const controller = new AbortController();
  controller.abort();
  await expect(getCourseOutline("owner", "course", controller.signal)).rejects.toHaveProperty(
    "name",
    "AbortError",
  );
  expect(readCourseOutline("owner", "course")).toBeNull();
  await getCourseOutline("owner", "course");
  expect(fetchMock).toHaveBeenCalledTimes(2);
});
