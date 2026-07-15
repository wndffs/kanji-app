import { describe, expect, it, vi } from "vitest";

import {
  type AdminApplyCourseAllocationResponse,
  type AdminCurationItemDto,
  type AdminCourseAllocationPreviewResponse,
  type AdminCoursePlacementListResponse,
  type AdminCurriculumScaleReadinessDto,
  type AdminImportRunSummaryDto,
  type AdminImportedCandidateDto,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateRejectionDto,
  type AdminImportedCandidateRejectionListItemDto,
  type AdminMainCourseEnrollmentRolloutPreviewResponse,
  type AdminMainCoursePublicationReadinessResponse,
  type AdminPublishMainCourseResponse,
  type AdminPrerequisiteCandidateListResponse,
} from "@kanji-srs/shared";
import { buildMainCourseBlueprint } from "@kanji-srs/db";

import {
  AdminRepository,
  CourseAllocationBlockedError,
  CourseAllocationPlanChangedError,
  CoursePlacementItemNotPublishedError,
  MainCoursePublicationBlockedError,
  MainCourseReadinessChangedError,
  PrismaAdminRepository,
} from "../src/admin/admin.repository";
import { AdminService } from "../src/admin/admin.service";
import {
  buildCurriculumCandidatePlan,
  type CurriculumCandidatePlan,
} from "../src/admin/curriculum-candidate-plan";
import {
  applyQualityIssues,
  buildCurriculumCompletenessReport,
} from "../src/admin/curriculum-quality";
import {
  type AdminCandidatePlanEnqueueItemInput,
  type AdminCandidatePlanEnqueueResult,
  type AdminImportedCandidateTargetInput,
  type AdminReviewQueuePageResult,
  type NormalizedAdminApproveImportedTranslationInput,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminPromoteCandidateInput,
  type NormalizedAdminRejectImportedCandidateInput,
  type NormalizedAdminReviewQueueFilters,
} from "../src/admin/admin.types";
import { type OverridesRepository } from "../src/overrides/overrides.repository";
import { OverridesService } from "../src/overrides/overrides.service";
import {
  type CardAnswerValidationRecord,
  type UpsertAcceptedAnswerInput,
  type UpsertPrivateMnemonicInput,
  type UserAcceptedAnswerRecord,
  type UserMnemonicRecord,
} from "../src/overrides/overrides.types";

describe("AdminService", () => {
  it("lets an admin edit accepted answers used by validation", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);
    const overridesService = new OverridesService(repository);

    await expect(
      adminService.updateCardAnswers("card-meaning", {
        acceptedAnswers: [
          {
            locale: "en-US",
            text: "single line",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
        blockedAnswers: [],
      }),
    ).resolves.toMatchObject({
      cards: [
        {
          id: "card-meaning",
          acceptedAnswers: [{ text: "single line", normalizedText: "single line" }],
        },
      ],
    });

    await expect(
      overridesService.validateAnswerForUser({
        userId: "learner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "single line",
      }),
    ).resolves.toMatchObject({
      accepted: true,
      result: "correct",
      matchedAnswer: "single line",
    });
    await expect(
      overridesService.validateAnswerForUser({
        userId: "learner",
        cardId: "card-meaning",
        answerKind: "meaning",
        answer: "one",
      }),
    ).resolves.toMatchObject({
      accepted: false,
      result: "wrong",
    });
  });

  it("lists only items waiting for content review", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    const response = await adminService.listReviewItems();

    expect(response.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "item-kanji-one",
          status: "needs-review",
        }),
        expect.objectContaining({
          id: "item-word-empty",
          status: "needs-review",
        }),
      ]),
    );
    expect(response.items.every((item) => item.status === "needs-review")).toBe(true);
    expect(response.pagination).toEqual({ limit: 20, nextCursor: null });
  });

  it("filters admin review queue by band and missing data", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.listReviewItems({
        band: "n5",
        missingAcceptedAnswers: "true",
        missingMnemonics: "true",
        status: "needs-review",
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          id: "item-word-empty",
          band: "n5",
          qualityIssues: expect.arrayContaining([
            expect.objectContaining({ code: "missing-accepted-answer" }),
            expect.objectContaining({ code: "missing-ru-mnemonic" }),
          ]),
        }),
      ],
      pagination: { limit: 20, nextCursor: null },
    });
  });

  it("lists inferred prerequisites and replaces only the selected links", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(adminService.getPrerequisiteCandidates("item-kanji-one")).resolves.toEqual({
      itemId: "item-kanji-one",
      candidates: [
        {
          prerequisiteItemId: "item-component-one",
          prerequisiteTitle: "Компонент 一",
          prerequisiteItemType: "component",
          prerequisiteStatus: "published",
          selected: true,
          requiredStage: 1,
          suggestionReason: "component",
        },
        {
          prerequisiteItemId: "item-component-line",
          prerequisiteTitle: "Компонент линия",
          prerequisiteItemType: "component",
          prerequisiteStatus: "published",
          selected: false,
          requiredStage: null,
          suggestionReason: "component",
        },
      ],
    });

    await expect(
      adminService.updatePrerequisites("item-kanji-one", {
        prerequisites: [{ prerequisiteItemId: "item-component-line", requiredStage: 2 }],
      }),
    ).resolves.toMatchObject({
      dependencies: [
        {
          prerequisiteItemId: "item-component-line",
          prerequisiteTitle: "Компонент линия",
          prerequisiteStatus: "published",
          dependencyType: "prerequisite",
          requiredStage: 2,
        },
      ],
    });
  });

  it("places only published items at one level per course", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.updateCoursePlacements("item-kanji-one", {
        courseLevelIds: ["course-level-1"],
      }),
    ).rejects.toThrow("Publish the learning item before placing it in a course");

    await repository.updateItemCuration("item-kanji-one", { status: "published" });

    await expect(
      adminService.updateCoursePlacements("item-kanji-one", {
        courseLevelIds: ["course-level-2"],
      }),
    ).resolves.toMatchObject({
      itemId: "item-kanji-one",
      levels: [
        { courseLevelId: "course-level-1", selected: false, sortOrder: null },
        { courseLevelId: "course-level-2", selected: true, sortOrder: 3 },
      ],
    });

    await expect(
      adminService.updateCoursePlacements("item-kanji-one", {
        courseLevelIds: ["course-level-1", "course-level-2"],
      }),
    ).rejects.toThrow("Select at most one level for course");
  });

  it("rejects duplicate and unavailable prerequisite selections", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.updatePrerequisites("item-kanji-one", {
        prerequisites: [
          { prerequisiteItemId: "item-component-one" },
          { prerequisiteItemId: "item-component-one" },
        ],
      }),
    ).rejects.toThrow("Duplicate prerequisite: item-component-one");

    await expect(
      adminService.updatePrerequisites("item-kanji-one", {
        prerequisites: [{ prerequisiteItemId: "item-unrelated" }],
      }),
    ).rejects.toThrow("is not available for this item");
  });

  it("paginates the review queue with opaque stable cursors", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());
    const firstPage = await adminService.listReviewItems({ limit: "1" });

    expect(firstPage.items).toHaveLength(1);
    expect(firstPage.pagination.limit).toBe(1);
    expect(firstPage.pagination.nextCursor).toEqual(expect.any(String));

    const secondPage = await adminService.listReviewItems({
      limit: "1",
      cursor: firstPage.pagination.nextCursor,
    });

    expect(secondPage.items).toHaveLength(1);
    expect(secondPage.items[0]?.id).not.toBe(firstPage.items[0]?.id);
    expect(secondPage.pagination).toEqual({ limit: 1, nextCursor: null });
    await expect(adminService.listReviewItems({ cursor: "not-a-cursor" })).rejects.toThrow(
      "cursor is invalid or expired.",
    );
    await expect(adminService.listReviewItems({ limit: "51" })).rejects.toThrow(
      "limit must be an integer from 1 to 50.",
    );
  });

  it("rejects publishing incomplete cards through quality gates", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.updateItem("item-word-empty", { status: "published" }),
    ).rejects.toThrow("Нельзя опубликовать материал");
  });

  it("rejects incomplete edits to already published items", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.updateItem("item-kanji-one", { status: "published" }),
    ).resolves.toMatchObject({
      id: "item-kanji-one",
      status: "published",
    });
    await expect(
      adminService.updateItem("item-kanji-one", {
        mnemonics: [{ locale: "en-US", type: "story", body: "" }],
      }),
    ).rejects.toThrow("Нельзя опубликовать материал");
  });

  it("counts missing data in curriculum completeness report", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    const report = await adminService.getCompletenessReport();
    const n5 = report.bands.find((band) => band.band === "n5");

    expect(n5).toMatchObject({
      totalItems: 1,
      missingAcceptedAnswers: 1,
      missingMnemonics: 1,
      missingAttribution: 1,
      invalidDependencies: 1,
    });
  });

  it("reports progress toward the full kanji and vocabulary course targets", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(adminService.getScaleReadiness()).resolves.toEqual({
      generatedAt: "2026-07-13T10:00:00.000Z",
      items: [
        expect.objectContaining({
          itemType: "kanji",
          targetItems: 2_300,
          publishedItems: 2,
          capacityShortfall: 0,
        }),
        expect.objectContaining({
          itemType: "word",
          targetItems: 8_000,
          publishedItems: 1,
          capacityShortfall: 500,
        }),
      ],
    });
  });

  it("returns the read-only main-course allocation preview", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(adminService.getCourseAllocationPreview()).resolves.toMatchObject({
      policyVersion: "balanced-prerequisite-levels-v1",
      course: { slug: "japanese-ru-n2", levelCount: 60 },
      summary: { publishedItems: 3, existingPlacements: 1, proposedPlacements: 2 },
    });
  });

  it("applies only the currently confirmed course allocation preview", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.applyCourseAllocation({ planVersion: "course-allocation:test-plan" }),
    ).resolves.toMatchObject({
      appliedPlanVersion: "course-allocation:test-plan",
      createdPlacements: 2,
      preview: { summary: { existingPlacements: 3, proposedPlacements: 0 } },
    });

    await expect(
      adminService.applyCourseAllocation({ planVersion: "course-allocation:stale" }),
    ).rejects.toThrow("Allocation preview changed");
  });

  it("rejects allocation apply requests while the preview has blockers", async () => {
    const repository = new InMemoryAdminRepository();
    repository.courseAllocationBlocked = true;

    await expect(
      new AdminService(repository).applyCourseAllocation({
        planVersion: "course-allocation:test-plan",
      }),
    ).rejects.toThrow("Resolve all allocation conflicts");
  });

  it("returns the main-course publication readiness audit", async () => {
    await expect(
      new AdminService(new InMemoryAdminRepository()).getMainCoursePublicationReadiness(),
    ).resolves.toMatchObject({
      policyVersion: "main-course-publication-readiness-v1",
      readyToPublish: false,
      summary: { blockedChecks: 2 },
    });
  });

  it("publishes only a ready main course with the confirmed readiness version", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);
    repository.mainCourseReadyToPublish = true;

    const publication = await adminService.publishMainCourse({
      readinessVersion: "main-course-readiness:test",
    });

    expect(publication).toMatchObject({
      appliedReadinessVersion: "main-course-readiness:test",
      statusChanged: true,
      readiness: { readyToPublish: true, course: { status: "published" } },
    });

    await expect(
      adminService.publishMainCourse({
        readinessVersion: publication.readiness.readinessVersion,
      }),
    ).resolves.toMatchObject({
      statusChanged: false,
      readiness: { course: { status: "published" } },
    });

    await expect(
      adminService.publishMainCourse({ readinessVersion: "main-course-readiness:test" }),
    ).rejects.toThrow("Publication readiness changed");
  });

  it("rejects main-course publication while readiness has blockers", async () => {
    await expect(
      new AdminService(new InMemoryAdminRepository()).publishMainCourse({
        readinessVersion: "main-course-readiness:test",
      }),
    ).rejects.toThrow("Resolve all publication-readiness blockers");
  });

  it("returns a read-only add-only enrollment rollout preview", async () => {
    const repository = new InMemoryAdminRepository();
    repository.mainCourseReadyToPublish = true;
    repository.mainCoursePublished = true;

    await expect(
      new AdminService(repository).getMainCourseEnrollmentRolloutPreview(),
    ).resolves.toMatchObject({
      policyVersion: "main-course-enrollment-rollout-v1",
      readyToApply: true,
      strategy: "add-only",
      summary: { learnerAccounts: 3, newEnrollments: 2 },
    });
  });

  it("returns bounded pages from the deterministic curriculum candidate plan", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    const firstPage = await adminService.getCandidatePlan({ itemType: "word", limit: "1" });

    expect(firstPage).toMatchObject({
      planVersion: "candidate-plan-version-one",
      summary: {
        policyVersion: "independent-frequency-prerequisites-v1",
        selectedItems: { kanji: 0, word: 2 },
      },
      page: {
        itemType: "word",
        offset: 0,
        limit: 1,
        total: 2,
        hasMore: true,
      },
      candidates: [{ selectionRank: 1, targetId: "plan-word-one" }],
    });

    await expect(
      adminService.getCandidatePlan({
        itemType: "word",
        offset: "1",
        limit: "1",
        planVersion: firstPage.planVersion,
      }),
    ).resolves.toMatchObject({
      planVersion: firstPage.planVersion,
      generatedAt: firstPage.generatedAt,
      page: { offset: 1, hasMore: false },
      candidates: [{ selectionRank: 2, targetId: "plan-word-two" }],
    });
    expect(repository.candidatePlanReads).toBe(1);

    await expect(
      adminService.getCandidatePlan({
        itemType: "word",
        search: "アリガトウ",
        planVersion: firstPage.planVersion,
      }),
    ).resolves.toMatchObject({
      planVersion: firstPage.planVersion,
      page: { itemType: "word", search: "アリガトウ", offset: 0, total: 1, hasMore: false },
      candidates: [{ selectionRank: 2, targetId: "plan-word-two", reading: "ありがとう" }],
    });
    expect(repository.candidatePlanReads).toBe(1);

    await expect(
      adminService.getCandidatePlan({
        itemType: "word",
        band: "n5",
        coverage: "missing-russian",
        planVersion: firstPage.planVersion,
      }),
    ).resolves.toMatchObject({
      planVersion: firstPage.planVersion,
      page: {
        itemType: "word",
        search: null,
        band: "n5",
        coverage: "missing-russian",
        total: 1,
      },
      candidates: [{ selectionRank: 2, targetId: "plan-word-two" }],
    });
    expect(repository.candidatePlanReads).toBe(1);

    await expect(
      adminService.getCandidatePlan({
        itemType: "word",
        coverage: "missing-stroke-data",
        planVersion: firstPage.planVersion,
      }),
    ).resolves.toMatchObject({
      page: { coverage: "missing-stroke-data", total: 0 },
      candidates: [],
    });

    await expect(adminService.getCandidatePlan({ limit: "101" })).rejects.toThrow(
      "limit must be an integer from 1 to 100.",
    );
    await expect(adminService.getCandidatePlan({ search: "x".repeat(81) })).rejects.toThrow(
      "search is too long.",
    );
    await expect(adminService.getCandidatePlan({ coverage: "unknown" })).rejects.toThrow(
      "coverage must be bilingual, missing-russian",
    );
    await expect(adminService.getCandidatePlan({ planVersion: "expired-version" })).rejects.toThrow(
      "Candidate plan data changed",
    );
  });

  it("recalculates a candidate plan once when its database version changes during loading", async () => {
    const repository = new InMemoryAdminRepository();
    repository.candidatePlanVersionResponses.push(
      "candidate-plan-version-one",
      "candidate-plan-version-two",
      "candidate-plan-version-two",
      "candidate-plan-version-two",
    );
    const adminService = new AdminService(repository);

    await expect(adminService.getCandidatePlan()).resolves.toMatchObject({
      planVersion: "candidate-plan-version-two",
    });
    expect(repository.candidatePlanReads).toBe(2);
  });

  it("enqueues candidates from an exact cached plan using server-owned metadata", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);
    const page = await adminService.getCandidatePlan({ itemType: "word", limit: "1" });
    const candidate = page.candidates[0];

    if (candidate === undefined) {
      throw new Error("Expected a candidate-plan item.");
    }

    await expect(
      adminService.enqueueCandidatePlan({
        planVersion: page.planVersion,
        candidates: [{ itemType: candidate.itemType, targetId: candidate.targetId }],
      }),
    ).resolves.toEqual({
      planVersion: page.planVersion,
      requestedCount: 1,
      enqueuedCount: 1,
      alreadyQueuedCount: 0,
      items: [
        {
          learningItemId: `item-${candidate.targetId}`,
          targetId: candidate.targetId,
          itemType: "word",
          status: "needs-review",
        },
      ],
    });
    expect(repository.enqueuedCandidateBatches).toEqual([
      [
        {
          targetId: candidate.targetId,
          itemType: candidate.itemType,
          title: `Слово ${candidate.japanese}`,
          band: candidate.suggestedBand,
        },
      ],
    ]);
    expect(repository.candidatePlanReads).toBe(1);
  });

  it("rejects duplicate and out-of-plan enqueue targets", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);
    const page = await adminService.getCandidatePlan({ itemType: "word", limit: "1" });
    const candidate = page.candidates[0];

    if (candidate === undefined) {
      throw new Error("Expected a candidate-plan item.");
    }

    await expect(
      adminService.enqueueCandidatePlan({
        planVersion: page.planVersion,
        candidates: [
          { itemType: candidate.itemType, targetId: candidate.targetId },
          { itemType: candidate.itemType, targetId: candidate.targetId },
        ],
      }),
    ).rejects.toThrow(`candidates contains duplicate target word:${candidate.targetId}.`);
    await expect(
      adminService.enqueueCandidatePlan({
        planVersion: page.planVersion,
        candidates: [{ itemType: "word", targetId: "not-in-plan" }],
      }),
    ).rejects.toThrow(`is not part of candidate plan ${page.planVersion}.`);
    await expect(
      adminService.enqueueCandidatePlan({
        planVersion: "expired-version",
        candidates: [{ itemType: candidate.itemType, targetId: candidate.targetId }],
      }),
    ).rejects.toThrow("Candidate plan data changed");
    await expect(
      adminService.enqueueCandidatePlan({ planVersion: page.planVersion, candidates: [] }),
    ).rejects.toThrow("candidates must contain from 1 to 100 items.");
    expect(repository.enqueuedCandidateBatches).toHaveLength(0);
  });

  it("enqueues only missing learning items without overwriting existing curation", async () => {
    const existingItem = {
      id: "existing-learning-item",
      targetType: "KANJI",
      targetId: "existing-kanji",
      status: "PUBLISHED",
    };
    const newItem = {
      id: "new-learning-item",
      targetType: "WORD",
      targetId: "new-word",
      status: "NEEDS_REVIEW",
    };
    const findMany = vi
      .fn()
      .mockResolvedValueOnce([existingItem])
      .mockResolvedValueOnce([existingItem, newItem]);
    const createMany = vi.fn().mockResolvedValue({ count: 1 });
    const transactionDb = { learningItem: { findMany, createMany } };
    const transaction = vi.fn(
      async (callback: (db: typeof transactionDb) => Promise<AdminCandidatePlanEnqueueResult>) =>
        callback(transactionDb),
    );
    const repository = new PrismaAdminRepository({ db: { $transaction: transaction } } as never);

    await expect(
      repository.enqueueCandidatePlanCandidates([
        {
          itemType: "kanji",
          targetId: "existing-kanji",
          title: "Кандзи 一",
          band: "foundation",
        },
        { itemType: "word", targetId: "new-word", title: "Слово 水", band: "n5" },
      ]),
    ).resolves.toEqual({
      requestedCount: 2,
      enqueuedCount: 1,
      alreadyQueuedCount: 1,
      items: [
        {
          learningItemId: existingItem.id,
          targetId: existingItem.targetId,
          itemType: "kanji",
          status: "published",
        },
        {
          learningItemId: newItem.id,
          targetId: newItem.targetId,
          itemType: "word",
          status: "needs-review",
        },
      ],
    });
    expect(createMany).toHaveBeenCalledWith({
      data: [
        {
          kind: "WORD",
          targetType: "WORD",
          targetId: "new-word",
          title: "Слово 水",
          levelHint: null,
          curriculumBand: "N5",
          status: "NEEDS_REVIEW",
        },
      ],
      skipDuplicates: true,
    });
  });

  it("persists and restores an audited candidate rejection through Prisma", async () => {
    const wordCount = vi.fn().mockResolvedValue(1);
    const findLearningItem = vi.fn().mockResolvedValue(null);
    const rejectionRow = {
      id: "rejection-1",
      targetType: "WORD",
      targetId: "word-1",
      reason: "DATA_QUALITY",
      note: "Broken source gloss.",
      rejectedByUserId: "admin-1",
      createdAt: new Date("2026-07-13T16:00:00.000Z"),
      updatedAt: new Date("2026-07-13T16:00:00.000Z"),
    };
    const upsertRejection = vi.fn().mockResolvedValue(rejectionRow);
    const deleteRejection = vi.fn().mockResolvedValue({ count: 1 });
    const repository = new PrismaAdminRepository({
      db: {
        word: { count: wordCount },
        learningItem: { findUnique: findLearningItem },
        importedCandidateRejection: {
          upsert: upsertRejection,
          deleteMany: deleteRejection,
        },
      },
    } as never);

    await expect(
      repository.rejectImportedCandidate({
        itemType: "word",
        targetId: "word-1",
        reason: "data-quality",
        note: "Broken source gloss.",
        rejectedByUserId: "admin-1",
      }),
    ).resolves.toEqual({
      id: "rejection-1",
      targetType: "word",
      targetId: "word-1",
      reason: "data-quality",
      note: "Broken source gloss.",
      rejectedByUserId: "admin-1",
      createdAt: "2026-07-13T16:00:00.000Z",
      updatedAt: "2026-07-13T16:00:00.000Z",
    });
    expect(wordCount).toHaveBeenCalledWith({
      where: { id: "word-1", jmdictImportedRecordId: { not: null } },
    });
    expect(upsertRejection).toHaveBeenCalledWith({
      where: { targetType_targetId: { targetType: "WORD", targetId: "word-1" } },
      update: {
        reason: "DATA_QUALITY",
        note: "Broken source gloss.",
        rejectedByUserId: "admin-1",
      },
      create: {
        targetType: "WORD",
        targetId: "word-1",
        reason: "DATA_QUALITY",
        note: "Broken source gloss.",
        rejectedByUserId: "admin-1",
      },
    });
    await expect(
      repository.restoreImportedCandidate({ itemType: "word", targetId: "word-1" }),
    ).resolves.toBe(true);
    expect(deleteRejection).toHaveBeenCalledWith({
      where: { targetType: "WORD", targetId: "word-1" },
    });
  });

  it("resolves rejected candidate labels from current dictionary rows", async () => {
    const listRejections = vi.fn().mockResolvedValue([
      {
        id: "rejection-kanji",
        targetType: "KANJI",
        targetId: "kanji-1",
        reason: "OUT_OF_SCOPE",
        note: null,
        rejectedByUserId: "admin-1",
        createdAt: new Date("2026-07-14T08:00:00.000Z"),
        updatedAt: new Date("2026-07-14T08:00:00.000Z"),
      },
      {
        id: "rejection-word",
        targetType: "WORD",
        targetId: "word-1",
        reason: "DATA_QUALITY",
        note: "Check the source row.",
        rejectedByUserId: "admin-1",
        createdAt: new Date("2026-07-14T07:00:00.000Z"),
        updatedAt: new Date("2026-07-14T07:00:00.000Z"),
      },
    ]);
    const listKanji = vi
      .fn()
      .mockResolvedValue([{ id: "kanji-1", character: "一", readings: [{ reading: "いち" }] }]);
    const listWords = vi
      .fn()
      .mockResolvedValue([{ id: "word-1", expression: "水", reading: "みず" }]);
    const repository = new PrismaAdminRepository({
      db: {
        importedCandidateRejection: { findMany: listRejections },
        kanji: { findMany: listKanji },
        word: { findMany: listWords },
      },
    } as never);

    await expect(repository.listImportedCandidateRejections()).resolves.toEqual([
      expect.objectContaining({
        id: "rejection-kanji",
        japanese: "一",
        reading: "いち",
      }),
      expect.objectContaining({
        id: "rejection-word",
        japanese: "水",
        reading: "みず",
      }),
    ]);
    expect(listKanji).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["kanji-1"] } } }),
    );
    expect(listWords).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: { in: ["word-1"] } } }),
    );
  });

  it("promotes an import-derived target into a curated learning item", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.promoteImportedCandidate({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Imported word",
        band: "n5",
        level: 6,
      }),
    ).resolves.toMatchObject({
      id: "item-target-imported-word",
      itemType: "word",
      band: "n5",
      title: "Imported word",
      level: 6,
      status: "needs-review",
      qualityIssues: expect.arrayContaining([
        expect.objectContaining({ code: "missing-accepted-answer" }),
      ]),
    });
  });

  it("returns ranked import-derived candidates", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(adminService.listImportedCandidates()).resolves.toEqual({
      candidates: [
        expect.objectContaining({
          rank: 1,
          score: 100,
          targetId: "target-imported-word",
          sourceName: "JMdict",
          suggestedBand: "n5",
        }),
      ],
    });
  });

  it("persists and restores an imported candidate rejection", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.rejectImportedCandidate("admin-1", "word", "target-imported-word", {
        reason: "data-quality",
        note: "Dictionary row needs correction.",
      }),
    ).resolves.toMatchObject({
      targetType: "word",
      targetId: "target-imported-word",
      reason: "data-quality",
      note: "Dictionary row needs correction.",
      rejectedByUserId: "admin-1",
    });
    await expect(adminService.listImportedCandidates()).resolves.toEqual({ candidates: [] });
    await expect(adminService.listImportedCandidateRejections()).resolves.toEqual({
      rejections: [expect.objectContaining({ targetId: "target-imported-word" })],
    });
    await expect(
      adminService.promoteImportedCandidate({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Rejected word",
        band: "n5",
      }),
    ).rejects.toThrow("Candidate word:target-imported-word was rejected");

    await expect(
      adminService.restoreImportedCandidate("word", "target-imported-word"),
    ).resolves.toEqual({
      targetType: "word",
      targetId: "target-imported-word",
      restored: true,
    });
    await expect(
      adminService.restoreImportedCandidate("word", "target-imported-word"),
    ).resolves.toEqual({
      targetType: "word",
      targetId: "target-imported-word",
      restored: false,
    });
    await expect(adminService.listImportedCandidates()).resolves.toEqual({
      candidates: [expect.objectContaining({ targetId: "target-imported-word" })],
    });
  });

  it("excludes a rejection from fresh plans and blocks staging an older snapshot", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);
    const originalPlan = await adminService.getCandidatePlan({ itemType: "word", limit: "2" });

    await adminService.rejectImportedCandidate("admin-1", "word", "plan-word-one", {
      reason: "low-educational-value",
    });

    await expect(
      adminService.enqueueCandidatePlan({
        planVersion: originalPlan.planVersion,
        candidates: [{ itemType: "word", targetId: "plan-word-one" }],
      }),
    ).rejects.toThrow("Candidate word:plan-word-one was rejected");
    await expect(adminService.getCandidatePlan({ itemType: "word", limit: "2" })).resolves.toEqual(
      expect.objectContaining({
        planVersion: "candidate-plan-version-two",
        page: expect.objectContaining({ total: 1 }),
        candidates: [expect.objectContaining({ targetId: "plan-word-two" })],
      }),
    );
  });

  it("validates imported candidate rejection reasons and notes", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.rejectImportedCandidate("admin-1", "word", "target-imported-word", {
        reason: "not-a-reason",
      }),
    ).rejects.toThrow("reason must be duplicate, out-of-scope, data-quality");
    await expect(
      adminService.rejectImportedCandidate("admin-1", "word", "target-imported-word", {
        reason: "other",
        note: "x".repeat(501),
      }),
    ).rejects.toThrow("note is too long.");
  });

  it("returns traceable bilingual details for one import-derived candidate", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.getImportedCandidateDetails("word", "target-imported-word"),
    ).resolves.toEqual({
      targetId: "target-imported-word",
      itemType: "word",
      japanese: "水",
      reading: "みず",
      readings: [{ text: "みず", type: "word" }],
      meanings: { ru: ["вода"], en: ["water"] },
      jlptLevel: null,
      sourcePriority: 1_000,
      schoolGrade: null,
      strokeCount: null,
      hasStrokeData: null,
      source: {
        name: "JMdict",
        sourceRecordId: "jmdict-1",
        sourceUrl: "https://www.edrdg.org/jmdict/j_jmdict.html",
        licenseName: "EDRDG License",
        attributionText: "EDRDG dictionary data.",
        importRunId: "import-run-jmdict",
        sourceVersion: "2026-06",
        sourceFileName: "JMdict_e.gz",
        checksumSha256: "sha256-jmdict",
      },
    });
  });

  it("maps kanji source details without leaking unsupported meaning locales", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      id: "kanji-one",
      character: "一",
      strokeCount: 1,
      grade: 1,
      jlptLevel: 4,
      frequencyRank: 2,
      readings: [
        { reading: "イチ", readingType: "ONYOMI" },
        { reading: "ひと.つ", readingType: "KUNYOMI" },
      ],
      meanings: [
        { locale: "en-US", meaning: "one" },
        { locale: "fr-FR", meaning: "un" },
        { locale: "ru-RU", meaning: "один" },
      ],
      strokeGraphic: { id: "stroke-one" },
      importedRecord: {
        sourceRecordId: "4e00",
        importRun: {
          id: "run-kanjidic2",
          sourceVersion: "2026-07",
          sourceFileName: "kanjidic2.xml.gz",
          checksumSha256: "sha256-kanjidic2",
          dataSource: {
            name: "KANJIDIC2",
            homepageUrl: "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
            attributionText: "KANJIDIC2 data.",
            license: { name: "EDRDG License" },
          },
        },
      },
    });
    const repository = new PrismaAdminRepository({
      db: { kanji: { findFirst } },
    } as never);

    await expect(repository.findImportedCandidateDetails("kanji", "kanji-one")).resolves.toEqual(
      expect.objectContaining({
        itemType: "kanji",
        reading: "イチ",
        readings: [
          { text: "イチ", type: "on" },
          { text: "ひと.つ", type: "kun" },
        ],
        meanings: { ru: ["один"], en: ["one"] },
        jlptLevel: "N5",
        schoolGrade: 1,
        strokeCount: 1,
        hasStrokeData: true,
        source: expect.objectContaining({
          name: "KANJIDIC2",
          sourceRecordId: "4e00",
          checksumSha256: "sha256-kanjidic2",
        }),
      }),
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          meanings: expect.objectContaining({
            where: {
              locale: { in: ["ru-RU", "en-US"] },
              sourceKind: "IMPORTED",
            },
          }),
        }),
      }),
    );
  });

  it("validates and rejects missing imported candidate details", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.getImportedCandidateDetails("sentence", "target-imported-word"),
    ).rejects.toThrow("targetType must be kanji or word.");
    await expect(
      adminService.getImportedCandidateDetails("word", "missing-target"),
    ).rejects.toThrow("Import-derived target not found.");
  });

  it("approves bilingual imported meanings into authored cards", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(
      adminService.approveImportedTranslation({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Слово 水",
        band: "n5",
        level: 6,
        meanings: { ru: "вода", en: "water" },
        acceptedAnswers: { ru: ["Вода"], en: ["Water"] },
        acceptedReadings: ["ミズ", "みず"],
      }),
    ).resolves.toMatchObject({
      itemType: "word",
      meanings: { ru: "вода", en: "water" },
      status: "needs-review",
      cards: [
        {
          answerType: "meaning",
          acceptedAnswers: [
            { locale: "ru-RU", normalizedText: "вода", isPrimary: true },
            { locale: "en-US", normalizedText: "water", isPrimary: true },
          ],
        },
        {
          answerType: "reading",
          acceptedAnswers: [{ text: "ミズ", normalizedText: "みず", isPrimary: true }],
        },
      ],
    });
  });

  it("authors a missing Russian locale for an import-derived kanji", async () => {
    const transactionDb = {
      learningItem: {
        upsert: vi.fn().mockResolvedValue({ id: "item-planned-kanji" }),
      },
      kanjiMeaning: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue({}),
      },
      learningCard: {
        upsert: vi
          .fn()
          .mockResolvedValueOnce({ id: "meaning-card" })
          .mockResolvedValueOnce({ id: "reading-card" }),
      },
      learningAnswer: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        createMany: vi.fn().mockResolvedValue({ count: 2 }),
      },
    };
    const transaction = vi.fn(async (callback: (db: typeof transactionDb) => Promise<string>) =>
      callback(transactionDb),
    );
    const repository = new PrismaAdminRepository({ db: { $transaction: transaction } } as never);
    const details: AdminImportedCandidateDetailsDto = {
      targetId: "plan-kanji-one",
      itemType: "kanji",
      japanese: "一",
      reading: "イチ",
      readings: [{ text: "イチ", type: "on" }],
      meanings: { ru: [], en: ["one"] },
      jlptLevel: "N5",
      sourcePriority: 1,
      schoolGrade: 1,
      strokeCount: 1,
      hasStrokeData: true,
      source: {
        name: "KANJIDIC2",
        sourceRecordId: "4e00",
        sourceUrl: null,
        licenseName: "EDRDG License",
        attributionText: "KANJIDIC2 data.",
        importRunId: "run-kanjidic2",
        sourceVersion: "2026-07",
        sourceFileName: "kanjidic2.xml.gz",
        checksumSha256: "sha256-kanjidic2",
      },
    };
    const approvedItem = { id: "item-planned-kanji" } as AdminCurationItemDto;
    const detailsLookup = vi
      .spyOn(repository, "findImportedCandidateDetails")
      .mockResolvedValue(details);
    vi.spyOn(repository, "findCurationItem").mockResolvedValue(approvedItem);

    await expect(
      repository.approveImportedTranslation({
        targetType: "kanji",
        targetId: details.targetId,
        title: "Кандзи 一",
        band: "n5",
        level: null,
        meanings: { ru: "один", en: "one" },
        acceptedAnswers: [
          {
            locale: "ru-RU",
            text: "один",
            normalizedText: "один",
            answerKind: "meaning",
            isPrimary: true,
          },
          {
            locale: "en-US",
            text: "one",
            normalizedText: "one",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
        acceptedReadings: [
          {
            locale: "ru-RU",
            text: "イチ",
            normalizedText: "いち",
            answerKind: "reading",
            isPrimary: true,
          },
        ],
      }),
    ).resolves.toBe(approvedItem);

    expect(detailsLookup).toHaveBeenCalledWith("kanji", details.targetId);
    expect(transaction).toHaveBeenCalledOnce();
    expect(transactionDb.kanjiMeaning.create).toHaveBeenCalledWith({
      data: {
        kanjiId: details.targetId,
        locale: "ru-RU",
        meaning: "один",
        isPrimary: true,
        sourceKind: "PROJECT_AUTHORED",
      },
    });
    expect(transactionDb.kanjiMeaning.create).toHaveBeenCalledTimes(2);
    expect(transactionDb.learningAnswer.createMany).toHaveBeenCalledTimes(2);
    expect(transactionDb.learningAnswer.createMany).toHaveBeenLastCalledWith({
      data: [
        {
          learningCardId: "reading-card",
          text: "イチ",
          normalizedText: "いち",
          answerKind: "READING",
          locale: "ru-RU",
          isPrimary: true,
          sourceKind: "PROJECT_AUTHORED",
        },
      ],
    });
  });

  it("derives published component prerequisites for a kanji curation item", async () => {
    const learningItem = {
      findUnique: vi.fn().mockResolvedValue({
        id: "item-kanji-one",
        targetType: "KANJI",
        targetId: "kanji-one",
        dependencies: [
          {
            requiredStage: 2,
            prerequisiteItem: {
              id: "item-component-one",
              title: "Компонент один",
              kind: "COMPONENT",
              status: "PUBLISHED",
            },
          },
        ],
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "item-component-line",
          title: "Компонент линия",
          kind: "COMPONENT",
          status: "PUBLISHED",
        },
      ]),
    };
    const kanjiComponent = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ componentId: "component-one" }, { componentId: "component-line" }]),
    };
    const repository = new PrismaAdminRepository({
      db: { learningItem, kanjiComponent },
    } as never);

    await expect(repository.listPrerequisiteCandidates("item-kanji-one")).resolves.toEqual({
      itemId: "item-kanji-one",
      candidates: [
        {
          prerequisiteItemId: "item-component-one",
          prerequisiteTitle: "Компонент один",
          prerequisiteItemType: "component",
          prerequisiteStatus: "published",
          selected: true,
          requiredStage: 2,
          suggestionReason: "existing",
        },
        {
          prerequisiteItemId: "item-component-line",
          prerequisiteTitle: "Компонент линия",
          prerequisiteItemType: "component",
          prerequisiteStatus: "published",
          selected: false,
          requiredStage: null,
          suggestionReason: "component",
        },
      ],
    });
    expect(kanjiComponent.findMany).toHaveBeenCalledWith({
      where: { kanjiId: "kanji-one" },
      select: { componentId: true },
      orderBy: { componentId: "asc" },
    });
  });

  it("derives published kanji prerequisites from word orthography", async () => {
    const learningItem = {
      findUnique: vi.fn().mockResolvedValue({
        id: "item-word-person",
        targetType: "WORD",
        targetId: "word-person",
        dependencies: [],
      }),
      findMany: vi.fn().mockResolvedValue([
        {
          id: "item-kanji-person",
          title: "Кандзи 人",
          kind: "KANJI",
          status: "PUBLISHED",
        },
      ]),
    };
    const word = { findUnique: vi.fn().mockResolvedValue({ expression: "一人かな" }) };
    const kanji = {
      findMany: vi.fn().mockResolvedValue([{ id: "kanji-one" }, { id: "kanji-person" }]),
    };
    const repository = new PrismaAdminRepository({
      db: { learningItem, word, kanji },
    } as never);

    await expect(repository.listPrerequisiteCandidates("item-word-person")).resolves.toEqual({
      itemId: "item-word-person",
      candidates: [
        {
          prerequisiteItemId: "item-kanji-person",
          prerequisiteTitle: "Кандзи 人",
          prerequisiteItemType: "kanji",
          prerequisiteStatus: "published",
          selected: false,
          requiredStage: null,
          suggestionReason: "kanji",
        },
      ],
    });
    expect(kanji.findMany).toHaveBeenCalledWith({
      where: { character: { in: ["一", "人"] } },
      select: { id: true },
      orderBy: { character: "asc" },
    });
  });

  it("appends a new course placement and removes the previous level in one transaction", async () => {
    const outerLearningItem = {
      findUnique: vi
        .fn()
        .mockResolvedValueOnce({ id: "item-kanji-one" })
        .mockResolvedValueOnce({
          id: "item-kanji-one",
          courseLevelItems: [{ courseLevelId: "course-level-2", sortOrder: 8 }],
        }),
    };
    const outerCourseLevel = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "course-level-2",
          levelNumber: 2,
          titleRu: "Первые кандзи",
          band: "FOUNDATION",
          course: {
            id: "course-main",
            titleRu: "Основной курс",
            status: "PUBLISHED",
            courseType: "STRUCTURED",
          },
        },
      ]),
    };
    const transactionDb = {
      learningItem: {
        findUnique: vi.fn().mockResolvedValue({
          status: "PUBLISHED",
          courseLevelItems: [{ courseLevelId: "course-level-1" }],
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      courseLevel: {
        findMany: vi.fn().mockResolvedValue([{ id: "course-level-2", courseId: "course-main" }]),
      },
      courseLevelItem: {
        deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
        findFirst: vi.fn().mockResolvedValue({ sortOrder: 7 }),
        create: vi.fn().mockResolvedValue({}),
      },
    };
    const transaction = vi.fn(async (callback: (db: typeof transactionDb) => Promise<void>) =>
      callback(transactionDb),
    );
    const repository = new PrismaAdminRepository({
      db: {
        learningItem: outerLearningItem,
        courseLevel: outerCourseLevel,
        $transaction: transaction,
      },
    } as never);

    await expect(
      repository.replaceCoursePlacements("item-kanji-one", {
        courseLevelIds: ["course-level-2"],
      }),
    ).resolves.toMatchObject({
      itemId: "item-kanji-one",
      levels: [{ courseLevelId: "course-level-2", selected: true, sortOrder: 8 }],
    });
    expect(transactionDb.courseLevelItem.deleteMany).toHaveBeenCalledWith({
      where: {
        learningItemId: "item-kanji-one",
        courseLevel: { course: { courseType: { in: ["STRUCTURED", "DEMO"] } } },
        courseLevelId: { notIn: ["course-level-2"] },
      },
    });
    expect(transactionDb.courseLevelItem.create).toHaveBeenCalledWith({
      data: {
        courseLevelId: "course-level-2",
        learningItemId: "item-kanji-one",
        sortOrder: 8,
        unlockPolicyJson: { policy: "level-order" },
      },
    });
  });

  it("builds the allocation preview from published items in the main course", async () => {
    const course = {
      findUnique: vi.fn().mockResolvedValue({
        id: "course-main",
        slug: "japanese-ru-n2",
        titleRu: "Основной курс",
        status: "DRAFT",
        levels: [{ id: "level-1", levelNumber: 1, band: "FOUNDATION" }],
      }),
    };
    const learningItem = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "component-one",
          title: "Компонент один",
          kind: "COMPONENT",
          curriculumBand: "FOUNDATION",
          levelHint: 1,
          dependencies: [],
          courseLevelItems: [{ courseLevel: { levelNumber: 1 } }],
        },
      ]),
    };
    const repository = new PrismaAdminRepository({ db: { course, learningItem } } as never);

    await expect(repository.getCourseAllocationPreview()).resolves.toMatchObject({
      course: { id: "course-main", levelCount: 1 },
      summary: { publishedItems: 1, existingPlacements: 1, proposedPlacements: 0 },
    });
    expect(course.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slug: "japanese-ru-n2" } }),
    );
    expect(learningItem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "PUBLISHED" },
        select: expect.objectContaining({
          courseLevelItems: expect.objectContaining({
            where: { courseLevel: { courseId: "course-main" } },
          }),
        }),
      }),
    );
  });

  it("appends confirmed allocation items without changing existing placements", async () => {
    let applied = false;
    const course = {
      findUnique: vi.fn().mockResolvedValue({
        id: "course-main",
        slug: "japanese-ru-n2",
        titleRu: "Основной курс",
        status: "DRAFT",
        levels: [
          { id: "level-1", levelNumber: 1, band: "FOUNDATION" },
          { id: "level-2", levelNumber: 2, band: "FOUNDATION" },
        ],
      }),
    };
    const learningItem = {
      findMany: vi.fn().mockImplementation(() =>
        Promise.resolve([
          {
            id: "component-one",
            title: "Компонент один",
            kind: "COMPONENT",
            curriculumBand: "FOUNDATION",
            levelHint: 1,
            dependencies: [],
            courseLevelItems: [{ courseLevel: { levelNumber: 1 } }],
          },
          {
            id: "kanji-one",
            title: "Кандзи один",
            kind: "KANJI",
            curriculumBand: "FOUNDATION",
            levelHint: 2,
            dependencies: [{ prerequisiteItemId: "component-one" }],
            courseLevelItems: applied ? [{ courseLevel: { levelNumber: 2 } }] : [],
          },
        ]),
      ),
    };
    const courseLevelItem = {
      findFirst: vi.fn().mockResolvedValue({ sortOrder: 4 }),
      createMany: vi.fn().mockImplementation(() => {
        applied = true;
        return Promise.resolve({ count: 1 });
      }),
    };
    const transactionDb = { course, learningItem, courseLevelItem };
    const transaction = vi.fn(async (callback: (db: typeof transactionDb) => Promise<unknown>) =>
      callback(transactionDb),
    );
    const repository = new PrismaAdminRepository({
      db: { course, learningItem, courseLevelItem, $transaction: transaction },
    } as never);
    const preview = await repository.getCourseAllocationPreview();

    const result = await repository.applyCourseAllocation(preview!.planVersion);

    expect(result).toMatchObject({
      appliedPlanVersion: preview!.planVersion,
      createdPlacements: 1,
      preview: { summary: { existingPlacements: 2, proposedPlacements: 0 } },
    });
    expect(courseLevelItem.createMany).toHaveBeenCalledWith({
      data: [{ courseLevelId: "level-2", learningItemId: "kanji-one", sortOrder: 5 }],
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
  });

  it("does not write an allocation when its confirmation version is stale", async () => {
    const course = {
      findUnique: vi.fn().mockResolvedValue({
        id: "course-main",
        slug: "japanese-ru-n2",
        titleRu: "Основной курс",
        status: "DRAFT",
        levels: [{ id: "level-1", levelNumber: 1, band: "FOUNDATION" }],
      }),
    };
    const learningItem = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "component-one",
          title: "Компонент один",
          kind: "COMPONENT",
          curriculumBand: "FOUNDATION",
          levelHint: 1,
          dependencies: [],
          courseLevelItems: [],
        },
      ]),
    };
    const courseLevelItem = {
      findFirst: vi.fn(),
      createMany: vi.fn(),
    };
    const transactionDb = { course, learningItem, courseLevelItem };
    const transaction = vi.fn(async (callback: (db: typeof transactionDb) => Promise<unknown>) =>
      callback(transactionDb),
    );
    const repository = new PrismaAdminRepository({ db: { $transaction: transaction } } as never);

    await expect(
      repository.applyCourseAllocation("course-allocation:stale"),
    ).rejects.toBeInstanceOf(CourseAllocationPlanChangedError);
    expect(courseLevelItem.createMany).not.toHaveBeenCalled();
  });

  it("returns a stale-plan conflict for concurrent allocation writes", async () => {
    const transaction = vi.fn().mockRejectedValue({ code: "P2034" });
    const repository = new PrismaAdminRepository({ db: { $transaction: transaction } } as never);

    await expect(
      repository.applyCourseAllocation("course-allocation:test-plan"),
    ).rejects.toBeInstanceOf(CourseAllocationPlanChangedError);
  });

  it("audits and atomically publishes the seeded main course without changing enrollments", async () => {
    const blueprint = buildMainCourseBlueprint();
    let courseStatus = "DRAFT";
    const allocationCourse = {
      id: "course-main",
      slug: blueprint.course.slug,
      titleRu: blueprint.course.titleRu,
      get status() {
        return courseStatus;
      },
      levels: blueprint.levels.map((level) => ({
        id: `level-${level.levelNumber}`,
        levelNumber: level.levelNumber,
        band: level.band,
      })),
    };
    const readinessCourse = {
      ...allocationCourse,
      descriptionRu: blueprint.course.descriptionRu,
      targetLevel: blueprint.course.targetLevel,
      band: blueprint.course.band,
      courseType: "STRUCTURED",
      get status() {
        return courseStatus;
      },
      levels: blueprint.levels.map((level) => ({
        levelNumber: level.levelNumber,
        band: level.band,
        titleRu: level.titleRu,
        descriptionRu: level.descriptionRu,
        _count: { items: 1 },
      })),
    };
    const course = {
      findUnique: vi.fn(async (query: { where: { id?: string } }) =>
        query.where.id === undefined ? allocationCourse : readinessCourse,
      ),
      updateMany: vi.fn().mockImplementation(async () => {
        courseStatus = "PUBLISHED";
        return { count: 1 };
      }),
    };
    const learningItem = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "component-one",
          title: "Компонент один",
          kind: "COMPONENT",
          curriculumBand: "FOUNDATION",
          levelHint: 1,
          dependencies: [],
          courseLevelItems: [{ courseLevel: { levelNumber: 1 } }],
        },
      ]),
      count: vi.fn(async (query: { where: { kind?: string } }) => {
        if (query.where.kind === "KANJI") {
          return 2_300;
        }

        return query.where.kind === "WORD" ? 8_000 : 1;
      }),
    };
    const courseLevelItem = { count: vi.fn().mockResolvedValue(0) };
    const userEnrollment = { updateMany: vi.fn() };
    const user = {
      findMany: vi.fn().mockResolvedValue([
        {
          id: "learner-new",
          enrollments: [{ status: "ACTIVE", course: { slug: "starter-demo" } }],
        },
        {
          id: "learner-active",
          enrollments: [{ status: "ACTIVE", course: { slug: blueprint.course.slug } }],
        },
        {
          id: "learner-paused",
          enrollments: [
            { status: "PAUSED", course: { slug: blueprint.course.slug } },
            { status: "ACTIVE", course: { slug: "starter-demo" } },
          ],
        },
      ]),
    };
    const transactionDatabase = { course, learningItem, courseLevelItem, user, userEnrollment };
    const transaction = vi.fn(
      async (callback: (database: typeof transactionDatabase) => Promise<unknown>) =>
        callback(transactionDatabase),
    );
    const repository = new PrismaAdminRepository({
      db: { ...transactionDatabase, $transaction: transaction },
    } as never);

    const readiness = await repository.getMainCoursePublicationReadiness();

    expect(readiness).toMatchObject({
      readyToPublish: true,
      summary: { passedChecks: 8, blockedChecks: 0 },
    });
    expect(courseLevelItem.count).toHaveBeenCalledWith({
      where: {
        courseLevel: { courseId: "course-main" },
        learningItem: { status: { not: "PUBLISHED" } },
      },
    });
    expect(learningItem.count).toHaveBeenCalledTimes(3);

    await expect(repository.publishMainCourse(readiness!.readinessVersion)).resolves.toMatchObject({
      appliedReadinessVersion: readiness!.readinessVersion,
      statusChanged: true,
      readiness: { readyToPublish: true, course: { status: "published" } },
    });
    expect(course.updateMany).toHaveBeenCalledWith({
      where: { id: "course-main", status: "DRAFT" },
      data: { status: "PUBLISHED" },
    });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: "Serializable",
    });
    expect(userEnrollment.updateMany).not.toHaveBeenCalled();

    await expect(repository.getMainCourseEnrollmentRolloutPreview()).resolves.toMatchObject({
      readyToApply: true,
      summary: {
        learnerAccounts: 3,
        newEnrollments: 1,
        existingActiveEnrollments: 1,
        preservedInactiveEnrollments: 1,
        activeStarterEnrollments: 2,
      },
    });
    expect(user.findMany).toHaveBeenCalledWith({
      where: { role: "USER" },
      select: {
        id: true,
        enrollments: {
          where: {
            course: { slug: { in: [blueprint.course.slug, "starter-demo"] } },
          },
          select: {
            status: true,
            course: { select: { slug: true } },
          },
        },
      },
      orderBy: { id: "asc" },
    });
    expect(userEnrollment.updateMany).not.toHaveBeenCalled();
  });

  it("returns a stale-readiness conflict for concurrent course publication writes", async () => {
    const transaction = vi.fn().mockRejectedValue({ code: "P2034" });
    const repository = new PrismaAdminRepository({ db: { $transaction: transaction } } as never);

    await expect(repository.publishMainCourse("main-course-readiness:test")).rejects.toBeInstanceOf(
      MainCourseReadinessChangedError,
    );
  });

  it("requires non-empty RU and EN accepted answers for translation approval", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.approveImportedTranslation({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Слово 水",
        band: "n5",
        meanings: { ru: "вода", en: "water" },
        acceptedAnswers: { ru: ["вода"], en: [] },
        acceptedReadings: ["みず"],
      }),
    ).rejects.toThrow("acceptedAnswers.en must contain at least one answer");
  });

  it("requires explicitly reviewed readings for translation approval", async () => {
    const adminService = new AdminService(new InMemoryAdminRepository());

    await expect(
      adminService.approveImportedTranslation({
        targetType: "word",
        targetId: "target-imported-word",
        title: "Слово 水",
        band: "n5",
        meanings: { ru: "вода", en: "water" },
        acceptedAnswers: { ru: ["вода"], en: ["water"] },
        acceptedReadings: [],
      }),
    ).rejects.toThrow("acceptedReadings must contain at least one answer");
  });

  it("lists import runs with status, checksum, stats, and errors", async () => {
    const repository = new InMemoryAdminRepository();
    const adminService = new AdminService(repository);

    await expect(adminService.listImportRuns()).resolves.toEqual({
      importRuns: [
        expect.objectContaining({
          id: "import-run-1",
          dataSourceName: "Project authored",
          checksumSha256: "sha256-test",
          status: "success",
          stats: { items: 1 },
          errorText: null,
        }),
        expect.objectContaining({
          id: "import-run-failed",
          dataSourceName: "JMdict",
          checksumSha256: "sha256-failed",
          status: "failed",
          stats: { entries: 0 },
          errorText: "Parser failed.",
        }),
      ],
    });
  });
});

class InMemoryAdminRepository extends AdminRepository implements OverridesRepository {
  candidatePlanReads = 0;
  courseAllocationBlocked = false;
  mainCoursePublished = false;
  mainCourseReadyToPublish = false;
  readonly candidatePlanVersionResponses: string[] = [];
  readonly enqueuedCandidateBatches: (readonly AdminCandidatePlanEnqueueItemInput[])[] = [];
  private rejectionRevision = 0;
  private readonly candidateRejections = new Map<string, AdminImportedCandidateRejectionDto>();
  private coursePlacementLevelId: string | null = null;

  private readonly importedCandidates: readonly AdminImportedCandidateDto[] = [
    {
      rank: 1,
      score: 100,
      targetId: "target-imported-word",
      itemType: "word",
      japanese: "水",
      reading: "みず",
      meanings: { ru: ["вода"], en: ["water"] },
      jlptLevel: null,
      sourcePriority: 1_000,
      sourceName: "JMdict",
      suggestedBand: "n5",
      suggestedTitle: "Слово 水",
      reasons: [
        { code: "source-priority", points: 55 },
        { code: "ru-coverage", points: 15 },
        { code: "en-coverage", points: 15 },
        { code: "reading", points: 10 },
        { code: "kanji-orthography", points: 5 },
      ],
    },
  ];
  private readonly importRuns: readonly AdminImportRunSummaryDto[] = [
    {
      id: "import-run-1",
      dataSourceName: "Project authored",
      licenseName: "Project content",
      sourceVersion: "bootstrap-1",
      sourceFileName: "seed.ts",
      checksumSha256: "sha256-test",
      status: "success",
      startedAt: "2026-06-22T07:00:00.000Z",
      finishedAt: "2026-06-22T07:01:00.000Z",
      recordCount: 1,
      stats: { items: 1 },
      errorText: null,
    },
    {
      id: "import-run-failed",
      dataSourceName: "JMdict",
      licenseName: "EDRDG License",
      sourceVersion: "2026-06",
      sourceFileName: "JMdict_e.gz",
      checksumSha256: "sha256-failed",
      status: "failed",
      startedAt: "2026-06-23T07:00:00.000Z",
      finishedAt: "2026-06-23T07:00:30.000Z",
      recordCount: 0,
      stats: { entries: 0 },
      errorText: "Parser failed.",
    },
  ];

  private items: AdminCurationItemDto[] = [
    {
      id: "item-kanji-one",
      itemType: "kanji",
      band: "foundation",
      title: "Кандзи 一",
      japanese: "一",
      reading: "いち",
      level: 1,
      jlptLevel: "N5",
      status: "needs-review",
      updatedAt: "2026-06-22T08:00:00.000Z",
      meanings: { ru: "один", en: "one" },
      cards: [
        {
          id: "card-meaning",
          promptType: "meaning",
          answerType: "meaning",
          locale: "ru-RU",
          sortOrder: 1,
          updatedAt: "2026-06-22T08:00:00.000Z",
          acceptedAnswers: [
            {
              id: "answer-1",
              cardId: "card-meaning",
              locale: "ru-RU",
              text: "один",
              normalizedText: "один",
              answerKind: "meaning",
              isPrimary: true,
            },
            {
              id: "answer-2",
              cardId: "card-meaning",
              locale: "en-US",
              text: "one",
              normalizedText: "one",
              answerKind: "meaning",
              isPrimary: true,
            },
          ],
          blockedAnswers: [],
        },
      ],
      hints: [],
      mnemonics: [
        {
          id: "mnemonic-ru",
          locale: "ru-RU",
          type: "story",
          body: "Одна черта задает идею единицы.",
          sourceKind: "curated",
          version: 1,
          updatedAt: "2026-06-22T08:00:00.000Z",
        },
        {
          id: "mnemonic-en",
          locale: "en-US",
          type: "story",
          body: "One stroke gives the idea of one.",
          sourceKind: "curated",
          version: 1,
          updatedAt: "2026-06-22T08:00:00.000Z",
        },
      ],
      dependencies: [
        {
          id: "dependency-component",
          prerequisiteItemId: "item-component-one",
          prerequisiteTitle: "Компонент 一",
          prerequisiteStatus: "published",
          dependencyType: "prerequisite",
          requiredStage: 1,
        },
      ],
      attributions: [
        {
          sourceName: "Project authored",
          licenseName: "Project content",
          attributionText: "Project-authored sample data.",
          sourceUrl: null,
        },
      ],
      importRuns: [
        {
          id: "import-run-1",
          dataSourceName: "Project authored",
          licenseName: "Project content",
          sourceVersion: "bootstrap-1",
          sourceFileName: "seed.ts",
          checksumSha256: "sha256-test",
          status: "success",
          startedAt: "2026-06-22T07:00:00.000Z",
          finishedAt: "2026-06-22T07:01:00.000Z",
          recordCount: 1,
          stats: { items: 1 },
          errorText: null,
        },
      ],
      qualityIssues: [],
    },
    {
      id: "item-word-empty",
      itemType: "word",
      band: "n5",
      title: "Слово 空",
      japanese: "空",
      reading: "そら",
      level: 8,
      jlptLevel: "N5",
      status: "needs-review",
      updatedAt: "2026-06-22T08:30:00.000Z",
      meanings: { ru: "", en: "" },
      cards: [
        {
          id: "card-empty",
          promptType: "meaning",
          answerType: "meaning",
          locale: "ru-RU",
          sortOrder: 1,
          updatedAt: "2026-06-22T08:30:00.000Z",
          acceptedAnswers: [],
          blockedAnswers: [],
        },
      ],
      hints: [],
      mnemonics: [],
      dependencies: [],
      attributions: [],
      importRuns: [],
      qualityIssues: [],
    },
  ];

  async listImportRuns(): Promise<readonly AdminImportRunSummaryDto[]> {
    return this.importRuns;
  }

  async listImportedCandidates(): Promise<readonly AdminImportedCandidateDto[]> {
    return this.importedCandidates.filter(
      (candidate) => !this.candidateRejections.has(`${candidate.itemType}:${candidate.targetId}`),
    );
  }

  async findImportedCandidateDetails(
    targetType: AdminImportedCandidateDetailsDto["itemType"],
    targetId: string,
  ): Promise<AdminImportedCandidateDetailsDto | null> {
    if (
      targetType !== "word" ||
      !["target-imported-word", "plan-word-one", "plan-word-two"].includes(targetId)
    ) {
      return null;
    }

    return {
      targetId,
      itemType: "word",
      japanese: "水",
      reading: "みず",
      readings: [{ text: "みず", type: "word" }],
      meanings: { ru: ["вода"], en: ["water"] },
      jlptLevel: null,
      sourcePriority: 1_000,
      schoolGrade: null,
      strokeCount: null,
      hasStrokeData: null,
      source: {
        name: "JMdict",
        sourceRecordId: "jmdict-1",
        sourceUrl: "https://www.edrdg.org/jmdict/j_jmdict.html",
        licenseName: "EDRDG License",
        attributionText: "EDRDG dictionary data.",
        importRunId: "import-run-jmdict",
        sourceVersion: "2026-06",
        sourceFileName: "JMdict_e.gz",
        checksumSha256: "sha256-jmdict",
      },
    };
  }

  async listImportedCandidateRejections(): Promise<
    readonly AdminImportedCandidateRejectionListItemDto[]
  > {
    const rejections = await Promise.all(
      [...this.candidateRejections.values()].map(async (rejection) => {
        const target = await this.findImportedCandidateDetails(
          rejection.targetType,
          rejection.targetId,
        );

        return {
          ...rejection,
          japanese: target?.japanese ?? null,
          reading: target?.reading ?? null,
        };
      }),
    );

    return rejections.sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
    );
  }

  async findRejectedCandidateKeys(
    candidates: readonly AdminImportedCandidateTargetInput[],
  ): Promise<readonly string[]> {
    return candidates
      .map((candidate) => `${candidate.itemType}:${candidate.targetId}`)
      .filter((key) => this.candidateRejections.has(key));
  }

  async rejectImportedCandidate(
    input: NormalizedAdminRejectImportedCandidateInput,
  ): Promise<AdminImportedCandidateRejectionDto | null> {
    const source = await this.findImportedCandidateDetails(input.itemType, input.targetId);
    const assigned = this.items.some((item) => item.id === `item-${input.targetId}`);

    if (source === null || assigned) {
      return null;
    }

    this.rejectionRevision += 1;
    const key = `${input.itemType}:${input.targetId}`;
    const existing = this.candidateRejections.get(key);
    const updatedAt = new Date(Date.UTC(2026, 6, 13, 16, 0, this.rejectionRevision)).toISOString();
    const rejection: AdminImportedCandidateRejectionDto = {
      id: existing?.id ?? `rejection-${input.targetId}`,
      targetType: input.itemType,
      targetId: input.targetId,
      reason: input.reason,
      note: input.note,
      rejectedByUserId: input.rejectedByUserId,
      createdAt: existing?.createdAt ?? updatedAt,
      updatedAt,
    };

    this.candidateRejections.set(key, rejection);
    return rejection;
  }

  async restoreImportedCandidate(input: AdminImportedCandidateTargetInput): Promise<boolean> {
    const restored = this.candidateRejections.delete(`${input.itemType}:${input.targetId}`);

    if (restored) {
      this.rejectionRevision += 1;
    }

    return restored;
  }

  async listReviewItems(
    filters: NormalizedAdminReviewQueueFilters = { cursor: null, limit: 20 },
  ): Promise<AdminReviewQueuePageResult> {
    const filteredItems = this.items
      .map(applyQualityIssues)
      .filter((item) => (filters.status ?? "needs-review") === item.status)
      .filter((item) => filters.band === undefined || item.band === filters.band)
      .filter((item) => filters.jlptLevel === undefined || item.jlptLevel === filters.jlptLevel)
      .filter(
        (item) =>
          filters.missingAcceptedAnswers !== true ||
          item.qualityIssues.some((issue) => issue.code === "missing-accepted-answer"),
      )
      .filter(
        (item) =>
          filters.missingMnemonics !== true ||
          item.qualityIssues.some(
            (issue) => issue.code === "missing-ru-mnemonic" || issue.code === "missing-en-mnemonic",
          ),
      )
      .sort(
        (left, right) =>
          right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
      )
      .filter((item) => {
        if (filters.cursor === null) {
          return true;
        }

        const updatedAt = new Date(item.updatedAt).getTime();
        const cursorUpdatedAt = filters.cursor.updatedAt.getTime();
        return (
          updatedAt < cursorUpdatedAt ||
          (updatedAt === cursorUpdatedAt && item.id > filters.cursor.id)
        );
      });
    const pageItems = filteredItems.slice(0, filters.limit);

    return {
      items: pageItems.map((item) => ({
        id: item.id,
        itemType: item.itemType,
        band: item.band,
        title: item.title,
        japanese: item.japanese,
        reading: item.reading,
        level: item.level,
        jlptLevel: item.jlptLevel,
        status: item.status,
        updatedAt: item.updatedAt,
        sourceNames: item.attributions.map((source) => source.sourceName),
        qualityIssues: item.qualityIssues,
      })),
      nextCursor:
        filteredItems.length > filters.limit && pageItems.length > 0
          ? {
              updatedAt: new Date(pageItems[pageItems.length - 1]!.updatedAt),
              id: pageItems[pageItems.length - 1]!.id,
            }
          : null,
    };
  }

  async findCurationItem(itemId: string): Promise<AdminCurationItemDto | null> {
    return this.items.find((item) => item.id === itemId) ?? null;
  }

  async listPrerequisiteCandidates(
    itemId: string,
  ): Promise<AdminPrerequisiteCandidateListResponse | null> {
    if (itemId !== "item-kanji-one") {
      return this.items.some((item) => item.id === itemId) ? { itemId, candidates: [] } : null;
    }

    const item = this.items.find((candidate) => candidate.id === itemId)!;
    const currentDependency = item.dependencies.find(
      (dependency) => dependency.prerequisiteItemId === "item-component-one",
    );

    return {
      itemId,
      candidates: [
        {
          prerequisiteItemId: "item-component-one",
          prerequisiteTitle: "Компонент 一",
          prerequisiteItemType: "component",
          prerequisiteStatus: "published",
          selected: currentDependency !== undefined,
          requiredStage: currentDependency?.requiredStage ?? null,
          suggestionReason: "component",
        },
        {
          prerequisiteItemId: "item-component-line",
          prerequisiteTitle: "Компонент линия",
          prerequisiteItemType: "component",
          prerequisiteStatus: "published",
          selected: item.dependencies.some(
            (dependency) => dependency.prerequisiteItemId === "item-component-line",
          ),
          requiredStage:
            item.dependencies.find(
              (dependency) => dependency.prerequisiteItemId === "item-component-line",
            )?.requiredStage ?? null,
          suggestionReason: "component",
        },
      ],
    };
  }

  async listCoursePlacements(itemId: string): Promise<AdminCoursePlacementListResponse | null> {
    if (!this.items.some((item) => item.id === itemId)) {
      return null;
    }

    return {
      itemId,
      levels: [
        {
          courseId: "course-main",
          courseTitle: "Основной курс",
          courseStatus: "published",
          courseType: "structured",
          courseLevelId: "course-level-1",
          levelNumber: 1,
          levelTitle: "Основа",
          band: "foundation",
          selected: this.coursePlacementLevelId === "course-level-1",
          sortOrder: this.coursePlacementLevelId === "course-level-1" ? 5 : null,
        },
        {
          courseId: "course-main",
          courseTitle: "Основной курс",
          courseStatus: "published",
          courseType: "structured",
          courseLevelId: "course-level-2",
          levelNumber: 2,
          levelTitle: "Первые кандзи",
          band: "foundation",
          selected: this.coursePlacementLevelId === "course-level-2",
          sortOrder: this.coursePlacementLevelId === "course-level-2" ? 3 : null,
        },
      ],
    };
  }

  async findItemByCardId(cardId: string): Promise<AdminCurationItemDto | null> {
    return this.items.find((item) => item.cards.some((card) => card.id === cardId)) ?? null;
  }

  async getCompletenessReport() {
    return buildCurriculumCompletenessReport(this.items, new Date("2026-06-22T09:30:00.000Z"));
  }

  async getScaleReadiness(): Promise<AdminCurriculumScaleReadinessDto> {
    return {
      generatedAt: "2026-07-13T10:00:00.000Z",
      items: [
        {
          itemType: "kanji",
          targetItems: 2_300,
          publishedItems: 2,
          inCurationItems: 1,
          importedCandidates: 2_500,
          remainingToPublish: 2_298,
          candidatesNeeded: 2_297,
          fillableCandidateSlots: 2_297,
          capacityShortfall: 0,
          candidateCoverage: {
            withReading: 2_490,
            withRussianMeaning: 10,
            withEnglishMeaning: 2_500,
            withBilingualMeanings: 10,
            withStrokeData: 2_450,
          },
        },
        {
          itemType: "word",
          targetItems: 8_000,
          publishedItems: 1,
          inCurationItems: 499,
          importedCandidates: 7_000,
          remainingToPublish: 7_999,
          candidatesNeeded: 7_500,
          fillableCandidateSlots: 7_000,
          capacityShortfall: 500,
          candidateCoverage: {
            withReading: 7_000,
            withRussianMeaning: 6_500,
            withEnglishMeaning: 7_000,
            withBilingualMeanings: 6_500,
            withStrokeData: null,
          },
        },
      ],
    };
  }

  async getCourseAllocationPreview(): Promise<AdminCourseAllocationPreviewResponse> {
    return {
      policyVersion: "balanced-prerequisite-levels-v1",
      planVersion: "course-allocation:test-plan",
      generatedAt: "2026-07-15T10:00:00.000Z",
      maxItemsPerLevel: 220,
      course: {
        id: "course-main",
        slug: "japanese-ru-n2",
        title: "Основной курс",
        status: "draft",
        levelCount: 60,
      },
      summary: {
        publishedItems: 3,
        existingPlacements: 1,
        proposedPlacements: 2,
        blockedItems: 0,
      },
      bands: [],
      items: [],
      issues: [],
      itemsTruncated: false,
      issuesTruncated: false,
    };
  }

  async applyCourseAllocation(planVersion: string): Promise<AdminApplyCourseAllocationResponse> {
    if (planVersion !== "course-allocation:test-plan") {
      throw new CourseAllocationPlanChangedError();
    }

    if (this.courseAllocationBlocked) {
      throw new CourseAllocationBlockedError();
    }

    const preview = await this.getCourseAllocationPreview();

    return {
      appliedPlanVersion: planVersion,
      appliedAt: "2026-07-15T10:01:00.000Z",
      createdPlacements: 2,
      preview: {
        ...preview,
        planVersion: "course-allocation:applied-plan",
        summary: {
          ...preview.summary,
          existingPlacements: 3,
          proposedPlacements: 0,
        },
      },
    };
  }

  async getMainCoursePublicationReadiness(): Promise<AdminMainCoursePublicationReadinessResponse> {
    const readyToPublish = this.mainCourseReadyToPublish;

    return {
      policyVersion: "main-course-publication-readiness-v1",
      readinessVersion: this.mainCoursePublished
        ? "main-course-readiness:published"
        : "main-course-readiness:test",
      allocationPlanVersion: "course-allocation:test-plan",
      generatedAt: "2026-07-15T12:00:00.000Z",
      readyToPublish,
      course: {
        id: "course-main",
        slug: "japanese-ru-n2",
        title: "Основной курс",
        status: this.mainCoursePublished ? "published" : "draft",
      },
      summary: readyToPublish
        ? { passedChecks: 8, blockedChecks: 0 }
        : { passedChecks: 6, blockedChecks: 2 },
      checks: [
        {
          code: "kanji-target",
          passed: readyToPublish,
          title: "Цель по кандзи",
          message: "В основном курсе размещено кандзи: 2 из 2300.",
          current: readyToPublish ? 2_300 : 2,
          required: 2_300,
        },
        {
          code: "word-target",
          passed: readyToPublish,
          title: "Цель по словам",
          message: "В основном курсе размещено слов: 1 из 8000.",
          current: readyToPublish ? 8_000 : 1,
          required: 8_000,
        },
      ],
    };
  }

  async publishMainCourse(readinessVersion: string): Promise<AdminPublishMainCourseResponse> {
    const readiness = await this.getMainCoursePublicationReadiness();

    if (readiness.readinessVersion !== readinessVersion) {
      throw new MainCourseReadinessChangedError();
    }

    if (!readiness.readyToPublish) {
      throw new MainCoursePublicationBlockedError();
    }

    const statusChanged = !this.mainCoursePublished;
    this.mainCoursePublished = true;

    return {
      appliedReadinessVersion: readinessVersion,
      publishedAt: "2026-07-15T12:01:00.000Z",
      statusChanged,
      readiness: await this.getMainCoursePublicationReadiness(),
    };
  }

  async getMainCourseEnrollmentRolloutPreview(): Promise<AdminMainCourseEnrollmentRolloutPreviewResponse> {
    const readiness = await this.getMainCoursePublicationReadiness();

    return {
      policyVersion: "main-course-enrollment-rollout-v1",
      rolloutVersion: `main-course-enrollment-rollout:${readiness.readinessVersion}`,
      readinessVersion: readiness.readinessVersion,
      generatedAt: "2026-07-15T12:02:00.000Z",
      readyToApply: readiness.readyToPublish && readiness.course.status === "published",
      strategy: "add-only",
      course: readiness.course,
      summary: {
        learnerAccounts: 3,
        newEnrollments: 2,
        existingActiveEnrollments: 1,
        preservedInactiveEnrollments: 0,
        activeStarterEnrollments: 3,
      },
    };
  }

  async getCandidatePlan(): Promise<CurriculumCandidatePlan> {
    this.candidatePlanReads += 1;

    return buildCurriculumCandidatePlan({
      existingItems: { kanji: 2_300, word: 7_998 },
      existingKanji: [],
      poolTruncated: { kanji: true, word: true },
      candidates: [
        {
          targetId: "plan-word-two",
          itemType: "word" as const,
          japanese: "ありがとう",
          reading: "ありがとう",
          meanings: { ru: [], en: ["thank you"] },
          jlptLevel: null,
          sourcePriority: 2_000,
          schoolGrade: null,
          hasStrokeData: false,
          sourceName: "JMdict" as const,
        },
        {
          targetId: "plan-word-one",
          itemType: "word" as const,
          japanese: "はい",
          reading: "はい",
          meanings: { ru: ["да"], en: ["yes"] },
          jlptLevel: null,
          sourcePriority: 1_000,
          schoolGrade: null,
          hasStrokeData: false,
          sourceName: "JMdict" as const,
        },
      ].filter(
        (candidate) => !this.candidateRejections.has(`${candidate.itemType}:${candidate.targetId}`),
      ),
    });
  }

  async getCandidatePlanVersion(): Promise<string> {
    const queuedVersion = this.candidatePlanVersionResponses.shift();

    if (queuedVersion !== undefined) {
      return queuedVersion;
    }

    if (this.rejectionRevision === 0) {
      return "candidate-plan-version-one";
    }

    return this.rejectionRevision === 1
      ? "candidate-plan-version-two"
      : `candidate-plan-version-${this.rejectionRevision + 1}`;
  }

  async enqueueCandidatePlanCandidates(
    candidates: readonly AdminCandidatePlanEnqueueItemInput[],
  ): Promise<AdminCandidatePlanEnqueueResult> {
    this.enqueuedCandidateBatches.push(candidates);

    return {
      requestedCount: candidates.length,
      enqueuedCount: candidates.length,
      alreadyQueuedCount: 0,
      items: candidates.map((candidate) => ({
        learningItemId: `item-${candidate.targetId}`,
        targetId: candidate.targetId,
        itemType: candidate.itemType,
        status: "needs-review",
      })),
    };
  }

  async promoteImportedCandidate(
    input: NormalizedAdminPromoteCandidateInput,
  ): Promise<AdminCurationItemDto | null> {
    if (input.targetId !== "target-imported-word") {
      return null;
    }

    const item = applyQualityIssues({
      id: "item-target-imported-word",
      itemType: input.targetType,
      band: input.band,
      title: input.title,
      japanese: "水",
      reading: "みず",
      level: input.level,
      jlptLevel: "N5",
      status: "needs-review",
      updatedAt: "2026-06-22T09:20:00.000Z",
      meanings: { ru: "", en: "" },
      cards: [],
      hints: [],
      mnemonics: [],
      dependencies: [],
      attributions: [
        {
          sourceName: "JMdict",
          licenseName: "EDRDG License",
          attributionText: "EDRDG dictionary data.",
          sourceUrl: null,
        },
      ],
      importRuns: this.importRuns.slice(1, 2),
      qualityIssues: [],
    });

    this.items = [...this.items, item];

    return item;
  }

  async approveImportedTranslation(
    input: NormalizedAdminApproveImportedTranslationInput,
  ): Promise<AdminCurationItemDto | null> {
    if (input.targetType !== "word" || input.targetId !== "target-imported-word") {
      return null;
    }

    const meaningCardId = "card-target-imported-word-meaning";
    const readingCardId = "card-target-imported-word-reading";
    const item = applyQualityIssues({
      id: "item-target-imported-word",
      itemType: input.targetType,
      band: input.band,
      title: input.title,
      japanese: "水",
      reading: "みず",
      level: input.level,
      jlptLevel: null,
      status: "needs-review",
      updatedAt: "2026-06-22T09:25:00.000Z",
      meanings: input.meanings,
      cards: [
        {
          id: meaningCardId,
          promptType: "meaning",
          answerType: "meaning",
          locale: "ru-RU",
          sortOrder: 1,
          updatedAt: "2026-06-22T09:25:00.000Z",
          acceptedAnswers: input.acceptedAnswers.map((answer, index) => ({
            id: `approved-answer-${index}`,
            cardId: meaningCardId,
            ...answer,
          })),
          blockedAnswers: [],
        },
        {
          id: readingCardId,
          promptType: "reading",
          answerType: "reading",
          locale: "ru-RU",
          sortOrder: 2,
          updatedAt: "2026-06-22T09:25:00.000Z",
          acceptedAnswers: [
            ...input.acceptedReadings.map((answer, index) => ({
              id: `approved-reading-${index}`,
              cardId: readingCardId,
              ...answer,
            })),
          ],
          blockedAnswers: [],
        },
      ],
      hints: [],
      mnemonics: [],
      dependencies: [],
      attributions: [
        {
          sourceName: "JMdict",
          licenseName: "EDRDG License",
          attributionText: "EDRDG dictionary data.",
          sourceUrl: null,
        },
      ],
      importRuns: this.importRuns.slice(1, 2),
      qualityIssues: [],
    });

    this.items = [...this.items.filter((candidate) => candidate.id !== item.id), item];

    return item;
  }

  async updateItemCuration(
    itemId: string,
    input: NormalizedAdminItemCurationInput,
  ): Promise<AdminCurationItemDto | null> {
    const item = this.items.find((candidate) => candidate.id === itemId);

    if (item === undefined) {
      return null;
    }

    const nextItem: AdminCurationItemDto = {
      ...item,
      band: input.band === undefined ? item.band : input.band,
      status: input.status ?? item.status,
      meanings: {
        ru: input.meanings?.ru ?? item.meanings.ru,
        en: input.meanings?.en ?? item.meanings.en,
      },
      updatedAt: "2026-06-22T09:00:00.000Z",
    };
    this.items = this.items.map((candidate) => (candidate.id === itemId ? nextItem : candidate));

    return nextItem;
  }

  async replacePrerequisites(
    itemId: string,
    input: Parameters<AdminRepository["replacePrerequisites"]>[1],
  ): Promise<AdminCurationItemDto | null> {
    const item = this.items.find((candidate) => candidate.id === itemId);

    if (item === undefined) {
      return null;
    }

    const candidateList = await this.listPrerequisiteCandidates(itemId);
    const candidateMap = new Map(
      candidateList?.candidates.map((candidate) => [candidate.prerequisiteItemId, candidate]),
    );
    const nextItem = applyQualityIssues({
      ...item,
      updatedAt: "2026-06-22T09:15:00.000Z",
      dependencies: [
        ...item.dependencies.filter((dependency) => dependency.dependencyType !== "prerequisite"),
        ...input.prerequisites.map((prerequisite, index) => {
          const candidate = candidateMap.get(prerequisite.prerequisiteItemId)!;

          return {
            id: `dependency-${index}`,
            prerequisiteItemId: candidate.prerequisiteItemId,
            prerequisiteTitle: candidate.prerequisiteTitle,
            prerequisiteStatus: candidate.prerequisiteStatus,
            dependencyType: "prerequisite" as const,
            requiredStage: prerequisite.requiredStage,
          };
        }),
      ],
    });
    this.items = this.items.map((candidate) => (candidate.id === itemId ? nextItem : candidate));

    return nextItem;
  }

  async replaceCoursePlacements(
    itemId: string,
    input: Parameters<AdminRepository["replaceCoursePlacements"]>[1],
  ): Promise<AdminCoursePlacementListResponse | null> {
    const item = this.items.find((candidate) => candidate.id === itemId);

    if (item === undefined) {
      return null;
    }

    if (item.status !== "published") {
      throw new CoursePlacementItemNotPublishedError();
    }

    this.coursePlacementLevelId = input.courseLevelIds[0] ?? null;
    return this.listCoursePlacements(itemId);
  }

  async updateCardAnswers(
    cardId: string,
    input: Parameters<AdminRepository["updateCardAnswers"]>[1],
  ): Promise<AdminCurationItemDto | null> {
    const item = this.items.find((candidate) => candidate.cards.some((card) => card.id === cardId));
    const card = item?.cards.find((candidate) => candidate.id === cardId);

    if (item === undefined || card === undefined) {
      return null;
    }

    const nextItem: AdminCurationItemDto = {
      ...item,
      cards: item.cards.map((candidate) =>
        candidate.id === cardId
          ? {
              ...candidate,
              updatedAt: "2026-06-22T09:10:00.000Z",
              acceptedAnswers: input.acceptedAnswers.map((answer, index) => ({
                id: `answer-${index + 1}`,
                cardId,
                locale: answer.locale,
                text: answer.text,
                normalizedText: answer.normalizedText,
                answerKind: answer.answerKind,
                isPrimary: answer.isPrimary,
              })),
              blockedAnswers: input.blockedAnswers.map((answer, index) => ({
                id: `blocked-${index + 1}`,
                cardId,
                text: answer.text,
                normalizedText: answer.normalizedText,
                reason: answer.reason,
              })),
            }
          : candidate,
      ),
      updatedAt: "2026-06-22T09:10:00.000Z",
    };
    this.items = this.items.map((candidate) => (candidate.id === item.id ? nextItem : candidate));

    return nextItem;
  }

  async findCardForValidation(cardId: string): Promise<CardAnswerValidationRecord | null> {
    const card = this.items
      .flatMap((item) => item.cards)
      .find((candidate) => candidate.id === cardId);

    if (card === undefined) {
      return null;
    }

    return {
      cardId,
      answerKind: card.answerType,
      acceptedAnswers: card.acceptedAnswers.map((answer) => answer.normalizedText),
      blockedAnswers: card.blockedAnswers.map((answer) => answer.normalizedText),
    };
  }

  async listKanjiReadings(): Promise<readonly string[]> {
    return [];
  }

  async listAcceptedAnswers(): Promise<readonly UserAcceptedAnswerRecord[]> {
    return [];
  }

  async upsertAcceptedAnswer(_input: UpsertAcceptedAnswerInput): Promise<UserAcceptedAnswerRecord> {
    throw new Error("Not implemented in admin tests.");
  }

  async deleteAcceptedAnswer(): Promise<boolean> {
    return false;
  }

  async upsertPrivateMnemonic(_input: UpsertPrivateMnemonicInput): Promise<UserMnemonicRecord> {
    throw new Error("Not implemented in admin tests.");
  }

  async deletePrivateMnemonic(): Promise<boolean> {
    return false;
  }
}
