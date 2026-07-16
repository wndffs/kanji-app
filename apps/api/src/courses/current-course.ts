import { type Prisma } from "@kanji-srs/db";

export const MAIN_COURSE_SLUG = "japanese-ru-n2";
export const STARTER_COURSE_SLUG = "starter-demo";

export type CurrentCourseCandidate = {
  readonly id: string;
  readonly slug: string;
  readonly startedAt: Date;
};

type CurrentCourseDatabase = Pick<Prisma.TransactionClient, "userEnrollment" | "userSettings">;

export function chooseCurrentCourseId(
  candidates: readonly CurrentCourseCandidate[],
  savedCurrentCourseId: string | null,
): string | null {
  if (savedCurrentCourseId !== null && candidates.some(({ id }) => id === savedCurrentCourseId)) {
    return savedCurrentCourseId;
  }

  return (
    candidates.find(({ slug }) => slug === MAIN_COURSE_SLUG)?.id ??
    candidates.find(({ slug }) => slug === STARTER_COURSE_SLUG)?.id ??
    candidates[0]?.id ??
    null
  );
}

export async function resolveCurrentCourseId(
  db: CurrentCourseDatabase,
  userId: string,
): Promise<string | null> {
  const [settings, enrollments] = await Promise.all([
    db.userSettings.findUnique({
      where: { userId },
      select: { currentCourseId: true },
    }),
    db.userEnrollment.findMany({
      where: {
        userId,
        status: "ACTIVE",
        course: { status: "PUBLISHED" },
      },
      select: {
        courseId: true,
        startedAt: true,
        course: { select: { slug: true } },
      },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }],
    }),
  ]);

  return chooseCurrentCourseId(
    enrollments.map((enrollment) => ({
      id: enrollment.courseId,
      slug: enrollment.course.slug,
      startedAt: enrollment.startedAt,
    })),
    settings?.currentCourseId ?? null,
  );
}
