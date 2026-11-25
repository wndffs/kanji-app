import type { PrismaClient } from "@kanji-srs/db";
import type { AdminMainCoursePublicationReadinessResponse } from "@kanji-srs/shared";

import { PrismaAdminRepository } from "./admin.repository";

export async function checkMainCourseLaunch(db: PrismaClient) {
  const repository = new PrismaAdminRepository({ db });
  const audit = await db.$transaction(
    async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      return repository.getMainCoursePublicationReadiness(tx);
    },
    { isolationLevel: "RepeatableRead", maxWait: 10_000, timeout: 120_000 },
  );
  return summarizeMainCourseLaunch(audit);
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
