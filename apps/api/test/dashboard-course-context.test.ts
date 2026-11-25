import { expect, it, vi } from "vitest";
import { PrismaDashboardRepository } from "../src/dashboard/dashboard.repository";

it("resolves the course once per dashboard request without sharing owners or retaining stale selection", async () => {
  const settings = vi.fn(async ({ where }: { where: { userId: string } }) => ({
    currentCourseId: `course-${where.userId}`,
  }));
  const enrollments = vi.fn(async (query: { where: { userId: string; courseId?: string } }) =>
    query.where.courseId === undefined
      ? [
          {
            courseId: `course-${query.where.userId}`,
            startedAt: new Date(),
            course: { slug: "fixture" },
          },
        ]
      : [],
  );
  const progress = vi.fn(async (_query: unknown) => null);
  const unlocks = vi.fn(async (_query: unknown) => null);
  const repository = new PrismaDashboardRepository({
    db: {
      userSettings: { findUnique: settings },
      userEnrollment: { findMany: enrollments, findFirst: progress },
      userUnlockEvent: { findFirst: unlocks },
    },
  } as never);
  for (const owner of ["a", "b", "a"]) {
    expect(await repository.loadCourseData(owner)).toEqual({
      lessonItems: [],
      currentCourse: null,
      unlockEvents: [],
    });
  }
  expect(settings).toHaveBeenCalledTimes(3);
  expect(enrollments).toHaveBeenCalledTimes(3);
  expect(
    progress.mock.calls.map(
      (call) => (call[0] as unknown as { where: { courseId: string } }).where.courseId,
    ),
  ).toEqual(["course-a", "course-b", "course-a"]);
});

it("does not hydrate an absent or inactive course", async () => {
  const findUnique = vi.fn().mockResolvedValue({ currentCourseId: "stale" });
  const findFirst = vi.fn();
  const repository = new PrismaDashboardRepository({
    db: {
      userSettings: { findUnique },
      userEnrollment: { findMany: vi.fn().mockResolvedValue([]), findFirst },
    },
  } as never);
  expect(await repository.loadCourseData("a")).toEqual({
    lessonItems: [],
    currentCourse: null,
    unlockEvents: [],
  });
  expect(await repository.listLatestUnlockEvents("a", null)).toEqual([]);
  expect(findUnique).toHaveBeenCalledTimes(1);
  expect(findFirst).not.toHaveBeenCalled();
});
