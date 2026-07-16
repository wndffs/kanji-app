import { Inject, Injectable } from "@nestjs/common";

import { type Prisma } from "@kanji-srs/db";

import { PrismaService } from "../database/prisma.service";
import { type CourseSelectionRecord, type EnrolledCourseRecord } from "./courses.types";

export abstract class CoursesRepository {
  abstract getSelection(userId: string): Promise<CourseSelectionRecord>;
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
