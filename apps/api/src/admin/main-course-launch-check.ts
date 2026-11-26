import type { PrismaClient } from "@kanji-srs/db";
import type { AdminMainCoursePublicationReadinessResponse } from "@kanji-srs/shared";

import { PrismaAdminRepository } from "./admin.repository";
import { getMainCourseAuditTimeoutMs } from "./main-course-publication-readiness";

export async function checkMainCourseLaunch(db: PrismaClient) {
  const repository = new PrismaAdminRepository({ db });
  return summarizeMainCourseLaunch(await readMainCourseAudit(db, repository));
}

export async function publishCheckedMainCourse(db: PrismaClient) {
  const repository = new PrismaAdminRepository({ db });
  return publishFromMainCourseAudit(await readMainCourseAudit(db, repository), repository);
}

export async function publishFromMainCourseAudit(
  audit: AdminMainCoursePublicationReadinessResponse | null,
  repository: Pick<PrismaAdminRepository, "publishMainCourse">,
) {
  if (audit === null || !audit.readyToPublish || audit.course.status === "published") {
    return { ...summarizeMainCourseLaunch(audit), statusChanged: false };
  }
  const result = await repository.publishMainCourse(audit.readinessVersion);
  if (result?.readiness.course.status !== "published" || !result.readiness.readyToPublish) {
    throw new Error("Main course was not published.");
  }
  return { ...summarizeMainCourseLaunch(result.readiness), statusChanged: result.statusChanged };
}

async function readMainCourseAudit(db: PrismaClient, repository: PrismaAdminRepository) {
  const timeout = await getMainCourseAuditTimeoutMs(db);
  return db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return repository.getMainCoursePublicationReadiness(tx);
    },
    { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout },
  );
}

export function summarizeMainCourseLaunch(
  audit: AdminMainCoursePublicationReadinessResponse | null,
) {
  if (audit === null) return { readyToPublish: false, courseStatus: "missing" as const };

  return {
    policyVersion: audit.policyVersion,
    courseStatus: audit.course.status,
    readyToPublish: audit.readyToPublish,
    passedChecks: audit.summary.passedChecks,
    blockedChecks: audit.summary.blockedChecks,
    checks: audit.checks.map(({ code, passed, current, required }) => ({
      code,
      passed,
      current,
      required,
    })),
  };
}
