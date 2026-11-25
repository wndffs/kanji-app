import { describe, expect, it, vi } from "vitest";

import type { PrismaClient } from "@kanji-srs/db";

import {
  checkMainCourseLaunch,
  summarizeMainCourseLaunch,
} from "../src/admin/main-course-launch-check";

describe("server main-course launch check", () => {
  it("runs the same publication audit in a read-only repeatable snapshot", async () => {
    const tx = {
      $executeRaw: vi.fn().mockResolvedValue(0),
      course: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const db = {
      $transaction: vi.fn((run: (client: typeof tx) => Promise<unknown>) => run(tx)),
      course: { findUnique: vi.fn() },
      learningItem: { count: vi.fn().mockResolvedValue(10_544) },
    };

    await expect(checkMainCourseLaunch(db as unknown as PrismaClient)).resolves.toEqual({
      courseStatus: "missing",
      readyToPublish: false,
    });
    expect(tx.$executeRaw.mock.calls[0]?.[0]?.[0]).toBe("SET TRANSACTION READ ONLY");
    expect(tx.$executeRaw).toHaveBeenCalledBefore(tx.course.findUnique);
    expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "RepeatableRead",
      maxWait: 10_000,
      timeout: 1_060_000,
    });
    expect(db.learningItem.count).toHaveBeenCalledWith({
      where: {
        status: "PUBLISHED",
        courseLevelItems: { some: { courseLevel: { course: { slug: "japanese-ru-n2" } } } },
      },
    });
    expect(db.course.findUnique).not.toHaveBeenCalled();
  });

  it("drops record identity, check messages and confirmation hashes from output", () => {
    expect(
      summarizeMainCourseLaunch({
        policyVersion: "main-course-publication-readiness-v2",
        readyToPublish: false,
        allocationPlanVersion: "internal allocation hash",
        readinessVersion: "internal readiness hash",
        generatedAt: "2026-11-25T00:00:00Z",
        course: { id: "internal course id", slug: "course-slug", status: "draft", title: "Course" },
        summary: { passedChecks: 0, blockedChecks: 1 },
        checks: [
          {
            code: "word-target",
            title: "Word target",
            message: "Internal evidence",
            passed: false,
            current: 7999,
            required: 8000,
          },
        ],
      }),
    ).toEqual({
      policyVersion: "main-course-publication-readiness-v2",
      courseStatus: "draft",
      readyToPublish: false,
      passedChecks: 0,
      blockedChecks: 1,
      checks: [{ code: "word-target", passed: false, current: 7999, required: 8000 }],
    });
  });
});
