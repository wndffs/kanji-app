import { describe, expect, it, vi } from "vitest";

import { chooseCurrentCourseId } from "../src/courses/current-course";
import { CoursesRepository, PrismaCoursesRepository } from "../src/courses/courses.repository";
import { CoursesService } from "../src/courses/courses.service";
import { type CourseSelectionRecord } from "../src/courses/courses.types";

const STARTED_AT = new Date("2026-07-16T08:00:00.000Z");

describe("current course selection", () => {
  const candidates = [
    { id: "starter", slug: "starter-demo", startedAt: STARTED_AT },
    { id: "main", slug: "japanese-ru-n2", startedAt: STARTED_AT },
  ];

  it("keeps a valid saved selection ahead of default priorities", () => {
    expect(chooseCurrentCourseId(candidates, "starter")).toBe("starter");
  });

  it("prefers the main course and falls back to starter when no selection is saved", () => {
    expect(chooseCurrentCourseId(candidates, null)).toBe("main");
    expect(chooseCurrentCourseId(candidates.slice(0, 1), null)).toBe("starter");
    expect(chooseCurrentCourseId([], null)).toBeNull();
  });
});

describe("CoursesService", () => {
  it("lists published enrollments and marks only the resolved active course as current", async () => {
    const repository = new InMemoryCoursesRepository({
      savedCurrentCourseId: "paused-course",
      courses: [
        createCourse({ id: "paused-course", enrollmentStatus: "PAUSED" }),
        createCourse({ id: "main", slug: "japanese-ru-n2" }),
        createCourse({ id: "starter", slug: "starter-demo" }),
      ],
    });
    const service = new CoursesService(repository);

    await expect(service.listCourses("user-1")).resolves.toMatchObject({
      currentCourseId: "main",
      courses: [
        { id: "paused-course", enrollmentStatus: "paused", isCurrent: false },
        { id: "main", enrollmentStatus: "active", isCurrent: true },
        { id: "starter", enrollmentStatus: "active", isCurrent: false },
      ],
    });
  });

  it("selects an available course and returns the refreshed selection", async () => {
    const repository = new InMemoryCoursesRepository({
      savedCurrentCourseId: "main",
      courses: [
        createCourse({ id: "main", slug: "japanese-ru-n2" }),
        createCourse({ id: "starter", slug: "starter-demo" }),
      ],
    });
    const service = new CoursesService(repository);

    await expect(service.selectCurrentCourse("user-1", { courseId: " starter " })).resolves.toEqual(
      expect.objectContaining({ currentCourseId: "starter" }),
    );
    expect(repository.selectedCourseIds).toEqual(["starter"]);
  });

  it("rejects a course without an active published enrollment", async () => {
    const repository = new InMemoryCoursesRepository({ savedCurrentCourseId: null, courses: [] });
    const service = new CoursesService(repository);

    await expect(service.selectCurrentCourse("user-1", { courseId: "missing" })).rejects.toThrow(
      "Active published course enrollment not found.",
    );
  });

  it("rejects changing course while a lesson session is active", async () => {
    const repository = new InMemoryCoursesRepository({
      savedCurrentCourseId: "main",
      courses: [
        createCourse({ id: "main", slug: "japanese-ru-n2" }),
        createCourse({ id: "starter", slug: "starter-demo" }),
      ],
    });
    repository.hasActiveLesson = true;
    const service = new CoursesService(repository);

    await expect(service.selectCurrentCourse("user-1", { courseId: "starter" })).rejects.toThrow(
      "Finish or abandon the active lesson before changing course.",
    );
  });
});

describe("PrismaCoursesRepository", () => {
  it("updates currentCourseId only after validating an active published enrollment", async () => {
    const findFirst = vi.fn().mockResolvedValue({ id: "enrollment-1" });
    const findActiveLesson = vi.fn().mockResolvedValue(null);
    const update = vi.fn().mockResolvedValue({});
    const transactionDatabase = {
      userEnrollment: { findFirst },
      reviewSession: { findFirst: findActiveLesson },
      userSettings: { update },
    };
    const transaction = vi.fn(
      async (
        callback: (
          database: typeof transactionDatabase,
        ) => Promise<"updated" | "not-found" | "active-lesson">,
      ) => callback(transactionDatabase),
    );
    const repository = new PrismaCoursesRepository({
      db: { $transaction: transaction },
    } as never);

    await expect(repository.setCurrentCourse("user-1", "course-1")).resolves.toBe("updated");
    expect(findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        courseId: "course-1",
        status: "ACTIVE",
        course: { status: "PUBLISHED" },
      },
      select: { id: true },
    });
    expect(update).toHaveBeenCalledWith({
      where: { userId: "user-1" },
      data: { currentCourseId: "course-1" },
    });
    expect(findActiveLesson).toHaveBeenCalledWith({
      where: { userId: "user-1", mode: "LESSON_QUIZ", finishedAt: null },
      select: { id: true },
    });
    expect(transaction).toHaveBeenCalledTimes(1);
  });
});

class InMemoryCoursesRepository extends CoursesRepository {
  readonly selectedCourseIds: string[] = [];
  hasActiveLesson = false;

  constructor(private selection: CourseSelectionRecord) {
    super();
  }

  async getSelection(_userId: string): Promise<CourseSelectionRecord> {
    return this.selection;
  }

  async setCurrentCourse(
    _userId: string,
    courseId: string,
  ): Promise<"updated" | "not-found" | "active-lesson"> {
    const course = this.selection.courses.find(({ id }) => id === courseId);

    if (course?.enrollmentStatus !== "ACTIVE") {
      return "not-found";
    }

    if (this.hasActiveLesson) {
      return "active-lesson";
    }

    this.selectedCourseIds.push(courseId);
    this.selection = { ...this.selection, savedCurrentCourseId: courseId };
    return "updated";
  }
}

function createCourse(
  overrides: Partial<CourseSelectionRecord["courses"][number]> = {},
): CourseSelectionRecord["courses"][number] {
  return {
    id: "course-1",
    slug: "course-1",
    title: "Курс",
    description: null,
    targetLevel: "N2",
    band: "N2",
    courseType: "STRUCTURED",
    enrollmentStatus: "ACTIVE",
    startedAt: STARTED_AT,
    ...overrides,
  };
}
