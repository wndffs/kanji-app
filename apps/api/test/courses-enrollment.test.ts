import "reflect-metadata";

import { describe, expect, it, vi } from "vitest";
import { Prisma } from "@kanji-srs/db";

import { CoursesController } from "../src/courses/courses.controller";
import { AuthGuard } from "../src/auth/auth.guard";
import { PrismaCoursesRepository, type CoursesRepository } from "../src/courses/courses.repository";
import { CoursesService } from "../src/courses/courses.service";

const OWNER = "00000000-0000-4000-8000-000000000001";
const COURSE = "00000000-0000-4000-8000-000000000002";

function serviceHarness() {
  const selection = {
    savedCurrentCourseId: "starter",
    courses: [
      {
        id: "starter",
        slug: "starter-demo",
        title: "Старт",
        description: null,
        targetLevel: null,
        band: "FOUNDATION",
        courseType: "DEMO",
        enrollmentStatus: "ACTIVE",
        startedAt: new Date(0),
      },
    ],
  };
  const repository = {
    getSelection: vi.fn().mockResolvedValue(selection),
    getAvailable: vi.fn().mockResolvedValue({ courses: [], nextCursor: null }),
    enroll: vi.fn().mockResolvedValue("enrolled"),
    setCurrentCourse: vi.fn(),
  };
  return { repository, service: new CoursesService(repository as CoursesRepository) };
}

describe("explicit published-course enrollment", () => {
  it("retains the existing auth guard and binds writes to the authenticated owner", async () => {
    expect(Reflect.getMetadata("__guards__", CoursesController)).toContain(AuthGuard);
    const h = serviceHarness();
    const result = await new CoursesController(h.service).enroll({ id: OWNER } as never, {
      courseId: COURSE,
      userId: "forged",
    });
    expect(h.repository.enroll).toHaveBeenCalledWith(OWNER, COURSE);
    expect(result.currentCourseId).toBe("starter");
    expect(h.repository.setCurrentCourse).not.toHaveBeenCalled();
  });

  it.each([
    null,
    {},
    { courseId: "draft" },
    { courseId: [] },
    { courseId: `${COURSE}?user=other` },
  ])("rejects invalid enrollment input before repository writes: %j", async (body) => {
    const h = serviceHarness();
    await expect(h.service.enroll(OWNER, body)).rejects.toMatchObject({ status: 400 });
    expect(h.repository.enroll).not.toHaveBeenCalled();
  });

  it.each(["", "not-a-uuid", [COURSE]])("rejects malformed catalog cursors: %j", async (cursor) => {
    const h = serviceHarness();
    await expect(h.service.availableCourses(OWNER, cursor)).rejects.toMatchObject({ status: 400 });
    expect(h.repository.getAvailable).not.toHaveBeenCalled();
  });

  it.each([
    ["not-found", 404],
    ["conflict", 409],
  ] as const)("reports %s without claiming enrollment", async (result, status) => {
    const h = serviceHarness();
    h.repository.enroll.mockResolvedValue(result);
    await expect(h.service.enroll(OWNER, { courseId: COURSE })).rejects.toMatchObject({ status });
    expect(h.repository.getSelection).not.toHaveBeenCalled();
  });

  it("returns only public catalog metadata and preserves the continuation", async () => {
    const h = serviceHarness();
    h.repository.getAvailable.mockResolvedValue({
      courses: [
        {
          id: COURSE,
          slug: "pilot",
          title: "Пилот",
          description: null,
          targetLevel: "FOUNDATION",
          band: "FOUNDATION",
          courseType: "STRUCTURED",
        },
      ],
      nextCursor: COURSE,
    });
    await expect(h.service.availableCourses(OWNER, COURSE)).resolves.toMatchObject({
      courses: [{ id: COURSE, band: "foundation", courseType: "structured" }],
      nextCursor: COURSE,
    });
    expect(h.repository.getAvailable).toHaveBeenCalledWith(OWNER, COURSE);
  });
});

function prismaHarness(published = true) {
  const query = vi
    .fn()
    .mockResolvedValueOnce([{ id: OWNER }])
    .mockResolvedValueOnce(published ? [{ id: COURSE }] : []);
  const upsert = vi.fn().mockResolvedValue({ id: "enrollment" });
  const forbidden = vi.fn();
  const tx = {
    $queryRaw: query,
    userEnrollment: { upsert },
    userSettings: { update: forbidden },
    userSrsState: { updateMany: forbidden },
    learningCard: { create: forbidden },
    reviewAnswer: { create: forbidden },
  };
  const transaction = vi.fn(
    async (callback: (db: typeof tx) => Promise<"enrolled" | "not-found">, _options?: unknown) =>
      callback(tx),
  );
  const repository = new PrismaCoursesRepository({ db: { $transaction: transaction } } as never);
  return { repository, query, upsert, forbidden, transaction };
}

describe("Prisma add-only enrollment", () => {
  it("locks owner/publication and upserts without resetting any existing status or progress", async () => {
    const h = prismaHarness();
    await expect(h.repository.enroll(OWNER, COURSE)).resolves.toBe("enrolled");
    expect(h.query.mock.calls[0]![0].values).toEqual([OWNER]);
    expect(h.query.mock.calls[0]![0].sql).toContain("FOR UPDATE");
    expect(h.query.mock.calls[1]![0].values).toEqual([COURSE]);
    expect(h.query.mock.calls[1]![0].sql).toContain("status='PUBLISHED'");
    expect(h.query.mock.calls[1]![0].sql).toContain("\"courseType\"='STRUCTURED' FOR SHARE");
    expect(h.upsert).toHaveBeenCalledWith({
      where: { userId_courseId: { userId: OWNER, courseId: COURSE } },
      update: {},
      create: { userId: OWNER, courseId: COURSE, status: "ACTIVE" },
    });
    expect(h.forbidden).not.toHaveBeenCalled();
    expect(h.transaction.mock.calls[0]![1]).toMatchObject({ isolationLevel: "Serializable" });
  });

  it("cannot enroll a missing, private or draft course", async () => {
    const h = prismaHarness(false);
    await expect(h.repository.enroll(OWNER, COURSE)).resolves.toBe("not-found");
    expect(h.upsert).not.toHaveBeenCalled();
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it.each(["P2034", "P2002"])("returns a recoverable conflict for %s", async (code) => {
    const h = prismaHarness();
    h.transaction.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("test conflict", { code, clientVersion: "test" }),
    );
    await expect(h.repository.enroll(OWNER, COURSE)).resolves.toBe("conflict");
    expect(h.forbidden).not.toHaveBeenCalled();
  });

  it("does not convert unrelated failures into successful enrollment", async () => {
    const h = prismaHarness();
    h.transaction.mockRejectedValue(new Error("failure"));
    await expect(h.repository.enroll(OWNER, COURSE)).rejects.toThrow("failure");
  });

  it("paginates only published structured courses not already joined by this owner", async () => {
    const rows = Array.from({ length: 21 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}`,
      slug: `pilot-${index}`,
      titleRu: "Пилот",
      descriptionRu: null,
      targetLevel: "FOUNDATION",
      band: "FOUNDATION",
      courseType: "STRUCTURED",
    }));
    const findMany = vi.fn().mockResolvedValue(rows);
    const repository = new PrismaCoursesRepository({ db: { course: { findMany } } } as never);
    const page = await repository.getAvailable(OWNER, COURSE);
    expect(page.courses).toHaveLength(20);
    expect(page.nextCursor).toBe(rows[19]!.id);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: "PUBLISHED",
          courseType: "STRUCTURED",
          enrollments: { none: { userId: OWNER } },
          id: { gt: COURSE },
        },
        take: 21,
        orderBy: { id: "asc" },
      }),
    );
    findMany.mockResolvedValue(rows.slice(0, 3));
    expect((await repository.getAvailable(OWNER)).nextCursor).toBeNull();
  });
});
