import { Inject, Injectable } from "@nestjs/common";

import { Prisma } from "@kanji-srs/db";

import { PrismaService } from "../database/prisma.service";
import {
  type AvailableCoursesRecord,
  type CourseSelectionRecord,
  type EnrolledCourseRecord,
} from "./courses.types";

export abstract class CoursesRepository {
  abstract getSelection(userId: string): Promise<CourseSelectionRecord>;
  abstract getAvailable(userId: string, cursor?: string): Promise<AvailableCoursesRecord>;
  abstract enroll(userId: string, courseId: string): Promise<"enrolled" | "not-found" | "conflict">;
  abstract setCurrentCourse(
    userId: string,
    courseId: string,
  ): Promise<"updated" | "not-found" | "active-lesson">;
}

type EnrollmentRow = {
  readonly status: string;
  readonly startedAt: Date;
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly titleRu: string;
    readonly descriptionRu: string | null;
    readonly targetLevel: string | null;
    readonly band: string;
    readonly courseType: string;
  };
};

@Injectable()
export class PrismaCoursesRepository extends CoursesRepository {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {
    super();
  }

  async getAvailable(userId: string, cursor?: string): Promise<AvailableCoursesRecord> {
    const rows = await this.prisma.db.course.findMany({
      where: {
        status: "PUBLISHED",
        courseType: "STRUCTURED",
        enrollments: { none: { userId } },
        ...(cursor === undefined ? {} : { id: { gt: cursor } }),
      },
      orderBy: { id: "asc" },
      take: 21,
      select: {
        id: true,
        slug: true,
        titleRu: true,
        descriptionRu: true,
        targetLevel: true,
        band: true,
        courseType: true,
      },
    });
    const page = rows.slice(0, 20);
    return {
      courses: page.map((row) => ({
        id: row.id,
        slug: row.slug,
        title: row.titleRu,
        description: row.descriptionRu,
        targetLevel: row.targetLevel,
        band: row.band,
        courseType: row.courseType,
      })),
      nextCursor: rows.length > 20 ? page.at(-1)!.id : null,
    };
  }

  async enroll(userId: string, courseId: string): Promise<"enrolled" | "not-found" | "conflict"> {
    try {
      return await this.prisma.db.$transaction(
        async (db) => {
          const users = await db.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM "User" WHERE id=${userId}::uuid FOR UPDATE`,
          );
          if (users.length !== 1) return "not-found";
          const courses = await db.$queryRaw<{ id: string }[]>(
            Prisma.sql`SELECT id FROM "Course" WHERE id=${courseId}::uuid AND status='PUBLISHED' AND "courseType"='STRUCTURED' FOR SHARE`,
          );
          if (courses.length !== 1) return "not-found";
          await db.userEnrollment.upsert({
            where: { userId_courseId: { userId, courseId } },
            update: {},
            create: { userId, courseId, status: "ACTIVE" },
          });
          return "enrolled";
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          maxWait: 5_000,
          timeout: 10_000,
        },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P2034", "P2002"].includes(error.code)
      )
        return "conflict";
      throw error;
    }
  }

  async getSelection(userId: string): Promise<CourseSelectionRecord> {
    const [settings, enrollments] = await Promise.all([
      this.prisma.db.userSettings.findUnique({
        where: { userId },
        select: { currentCourseId: true },
      }),
      this.prisma.db.userEnrollment.findMany({
        where: {
          userId,
          course: { status: "PUBLISHED" },
        },
        select: {
          status: true,
          startedAt: true,
          course: {
            select: {
              id: true,
              slug: true,
              titleRu: true,
              descriptionRu: true,
              targetLevel: true,
              band: true,
              courseType: true,
            },
          },
        },
        orderBy: [{ startedAt: "asc" }, { id: "asc" }],
      }),
    ]);

    return {
      savedCurrentCourseId: settings?.currentCourseId ?? null,
      courses: (enrollments as readonly EnrollmentRow[]).map(toRecord),
    };
  }

  async setCurrentCourse(
    userId: string,
    courseId: string,
  ): Promise<"updated" | "not-found" | "active-lesson"> {
    return this.prisma.db.$transaction(async (db: Prisma.TransactionClient) => {
      const enrollment = await db.userEnrollment.findFirst({
        where: {
          userId,
          courseId,
          status: "ACTIVE",
          course: { status: "PUBLISHED" },
        },
        select: { id: true },
      });

      if (enrollment === null) {
        return "not-found";
      }

      const activeLesson = await db.reviewSession.findFirst({
        where: {
          userId,
          mode: "LESSON_QUIZ",
          finishedAt: null,
        },
        select: { id: true },
      });

      if (activeLesson !== null) {
        return "active-lesson";
      }

      await db.userSettings.update({
        where: { userId },
        data: { currentCourseId: courseId },
      });

      return "updated";
    });
  }
}

function toRecord(enrollment: EnrollmentRow): EnrolledCourseRecord {
  return {
    id: enrollment.course.id,
    slug: enrollment.course.slug,
    title: enrollment.course.titleRu,
    description: enrollment.course.descriptionRu,
    targetLevel: enrollment.course.targetLevel,
    band: enrollment.course.band,
    courseType: enrollment.course.courseType,
    enrollmentStatus: enrollment.status,
    startedAt: enrollment.startedAt,
  };
}
