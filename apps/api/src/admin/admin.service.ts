import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { normalizeJapaneseReading, normalizeMeaning } from "@kanji-srs/japanese";
import {
  ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS,
  type AdminApplyCourseAllocationResponse,
  type AdminCandidatePlanCoverageFilter,
  type AdminContentStatus,
  type AdminCourseAllocationPreviewResponse,
  type AdminCoursePlacementListResponse,
  type AdminCurriculumCandidatePlanItemDto,
  type AdminCurriculumCandidatePlanResponse,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurriculumScaleReadinessDto,
  type AdminCurationItemDto,
  type AdminEnqueueCandidatePlanResponse,
  type AdminImportRunListResponse,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateListResponse,
  type AdminImportedCandidateRejectionDto,
  type AdminImportedCandidateRejectionListResponse,
  type AdminMainCoursePublicationReadinessResponse,
  type AdminPrerequisiteCandidateListResponse,
  type AdminRestoreImportedCandidateResponse,
  type AdminReviewQueueResponse,
  type AdminUpdateItemRequest,
  type CardAnswerType,
  type ContentLocale,
  type CourseBand,
  ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS,
  isCourseBand,
} from "@kanji-srs/shared";

import {
  AdminRepository,
  CourseAllocationBlockedError,
  CourseAllocationPlanChangedError,
  CoursePlacementItemNotPublishedError,
  CoursePlacementSelectionChangedError,
  PrerequisiteSelectionChangedError,
} from "./admin.repository";
import {
  CurriculumCandidatePlanCache,
  type CurriculumCandidatePlanCacheEntry,
} from "./curriculum-candidate-plan-cache";
import {
  previewAdminCardAnswersUpdate,
  previewAdminItemUpdate,
  getAdminQualityIssues,
} from "./curriculum-quality";
import {
  type NormalizedAdminCardAnswersInput,
  type NormalizedAdminApproveImportedTranslationInput,
  type NormalizedAdminCandidatePlanEnqueueInput,
  type NormalizedAdminCandidatePlanFilters,
  type NormalizedAdminItemCurationInput,
  type NormalizedAdminPromoteCandidateInput,
  type NormalizedAdminRejectImportedCandidateInput,
  type NormalizedAdminReviewQueueFilters,
  type NormalizedAdminTextInput,
  type NormalizedAdminUpdateCoursePlacementsInput,
  type NormalizedAdminUpdatePrerequisitesInput,
} from "./admin.types";

const MAX_MEANING_LENGTH = 240;
const MAX_ANSWER_LENGTH = 120;
const MAX_ACCEPTED_ANSWERS_PER_LOCALE = 20;
const MAX_BLOCKED_REASON_LENGTH = 500;
const MAX_CANDIDATE_REJECTION_NOTE_LENGTH = 500;
const MAX_TEXT_BODY_LENGTH = 4_000;
const DEFAULT_CANDIDATE_PLAN_PAGE_LIMIT = 50;
const MAX_CANDIDATE_PLAN_PAGE_LIMIT = 100;
const MAX_CANDIDATE_PLAN_SEARCH_LENGTH = 80;
const DEFAULT_REVIEW_QUEUE_PAGE_LIMIT = 20;
const MAX_REVIEW_QUEUE_PAGE_LIMIT = 50;
const MAX_PREREQUISITES = 50;
const MAX_COURSE_PLACEMENTS = 10;

@Injectable()
export class AdminService {
  private readonly candidatePlanCache = new CurriculumCandidatePlanCache();

  constructor(@Inject(AdminRepository) private readonly adminRepository: AdminRepository) {}

  async listImportRuns(): Promise<AdminImportRunListResponse> {
    return {
      importRuns: await this.adminRepository.listImportRuns(),
    };
  }

  async listImportedCandidates(): Promise<AdminImportedCandidateListResponse> {
    return {
      candidates: await this.adminRepository.listImportedCandidates(),
    };
  }

  async getImportedCandidateDetails(
    targetType: unknown,
    targetId: unknown,
  ): Promise<AdminImportedCandidateDetailsDto> {
    const parsedTargetType = parseImportedCandidateTargetType(targetType);
    const parsedTargetId = parseRequiredString(targetId, "targetId", { maxLength: 80 });
    const candidate = await this.adminRepository.findImportedCandidateDetails(
      parsedTargetType,
      parsedTargetId,
    );

    if (candidate === null) {
      throw new NotFoundException("Import-derived target not found.");
    }

    return candidate;
  }

  async listImportedCandidateRejections(): Promise<AdminImportedCandidateRejectionListResponse> {
    return {
      rejections: await this.adminRepository.listImportedCandidateRejections(),
    };
  }

  async rejectImportedCandidate(
    rejectedByUserId: unknown,
    targetType: unknown,
    targetId: unknown,
    body: unknown,
  ): Promise<AdminImportedCandidateRejectionDto> {
    const itemType = parseImportedCandidateTargetType(targetType);
    const parsedTargetId = parseRequiredString(targetId, "targetId", { maxLength: 80 });
    const input = parseRejectImportedCandidateRequest(body, {
      itemType,
      targetId: parsedTargetId,
      rejectedByUserId: parseRequiredString(rejectedByUserId, "rejectedByUserId", {
        maxLength: 80,
      }),
    });

    await this.getImportedCandidateDetails(itemType, parsedTargetId);
    const rejection = await this.adminRepository.rejectImportedCandidate(input);

    if (rejection === null) {
      throw new ConflictException(
        "Import-derived candidate is already assigned to the curriculum and cannot be rejected.",
      );
    }

    return rejection;
  }

  async restoreImportedCandidate(
    targetType: unknown,
    targetId: unknown,
  ): Promise<AdminRestoreImportedCandidateResponse> {
    const itemType = parseImportedCandidateTargetType(targetType);
    const parsedTargetId = parseRequiredString(targetId, "targetId", { maxLength: 80 });

    return {
      targetType: itemType,
      targetId: parsedTargetId,
      restored: await this.adminRepository.restoreImportedCandidate({
        itemType,
        targetId: parsedTargetId,
      }),
    };
  }

  async listReviewItems(query: unknown = {}): Promise<AdminReviewQueueResponse> {
    const filters = parseReviewQueueFilters(query);
    const page = await this.adminRepository.listReviewItems(filters);

    return {
      items: page.items,
      pagination: {
        limit: filters.limit,
        nextCursor: page.nextCursor === null ? null : encodeReviewQueueCursor(page.nextCursor),
      },
    };
  }

  async getCompletenessReport(): Promise<AdminCurriculumCompletenessReportDto> {
    return this.adminRepository.getCompletenessReport();
  }

  async getScaleReadiness(): Promise<AdminCurriculumScaleReadinessDto> {
    return this.adminRepository.getScaleReadiness();
  }

  async getCourseAllocationPreview(): Promise<AdminCourseAllocationPreviewResponse> {
    const preview = await this.adminRepository.getCourseAllocationPreview();

    if (preview === null) {
      throw new NotFoundException(
        "Main structured course not found. Run the current database seed first.",
      );
    }

    return preview;
  }

  async applyCourseAllocation(body: unknown): Promise<AdminApplyCourseAllocationResponse> {
    const record = parseRecord(body, "Request body");
    const planVersion = parseRequiredString(record.planVersion, "planVersion", {
      maxLength: 128,
    });

    try {
      const result = await this.adminRepository.applyCourseAllocation(planVersion);

      if (result === null) {
        throw new NotFoundException(
          "Main structured course not found. Run the current database seed first.",
        );
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof CourseAllocationPlanChangedError) {
        throw new ConflictException(
          "Allocation preview changed. Refresh the preview and confirm the current plan.",
        );
      }

      if (error instanceof CourseAllocationBlockedError) {
        throw new ConflictException(
          "Resolve all allocation conflicts before applying the course plan.",
        );
      }

      throw error;
    }
  }

  async getMainCoursePublicationReadiness(): Promise<AdminMainCoursePublicationReadinessResponse> {
    const readiness = await this.adminRepository.getMainCoursePublicationReadiness();

    if (readiness === null) {
      throw new NotFoundException(
        "Main structured course not found. Run the current database seed first.",
      );
    }

    return readiness;
  }

  async getCandidatePlan(query: unknown = {}): Promise<AdminCurriculumCandidatePlanResponse> {
    const filters = parseCandidatePlanFilters(query);
    const entry = await this.resolveCandidatePlan(filters.planVersion);
    const candidateSearch = filters.search;
    const hasCandidateFilters =
      candidateSearch !== null || filters.band !== null || filters.coverage !== null;
    const candidates = !hasCandidateFilters
      ? entry.plan.candidates[filters.itemType]
      : entry.plan.candidates[filters.itemType].filter(
          (candidate) =>
            (candidateSearch === null || matchesCandidatePlanSearch(candidate, candidateSearch)) &&
            (filters.band === null || candidate.suggestedBand === filters.band) &&
            (filters.coverage === null ||
              matchesCandidatePlanCoverage(candidate, filters.coverage)),
        );
    const pageCandidates = candidates.slice(filters.offset, filters.offset + filters.limit);

    return {
      planVersion: entry.version,
      generatedAt: entry.generatedAt,
      summary: entry.plan.summary,
      page: {
        itemType: filters.itemType,
        search: filters.search,
        band: filters.band,
        coverage: filters.coverage,
        offset: filters.offset,
        limit: filters.limit,
        total: candidates.length,
        hasMore: filters.offset + pageCandidates.length < candidates.length,
      },
      candidates: pageCandidates,
    };
  }

  async enqueueCandidatePlan(body: unknown): Promise<AdminEnqueueCandidatePlanResponse> {
    const request = parseCandidatePlanEnqueueRequest(body);
    await this.assertCandidatesNotRejected(request.candidates);
    const entry = await this.resolveCandidatePlan(request.planVersion);
    const candidatesByKey = new Map<string, AdminCurriculumCandidatePlanItemDto>();

    for (const itemType of ["kanji", "word"] as const) {
      for (const candidate of entry.plan.candidates[itemType]) {
        candidatesByKey.set(candidatePlanTargetKey(candidate), candidate);
      }
    }

    const candidates = request.candidates.map((requestedCandidate, index) => {
      const candidate = candidatesByKey.get(candidatePlanTargetKey(requestedCandidate));

      if (candidate === undefined) {
        throw new BadRequestException(
          `candidates[${index}] is not part of candidate plan ${entry.version}.`,
        );
      }

      return {
        targetId: candidate.targetId,
        itemType: candidate.itemType,
        title:
          candidate.itemType === "kanji"
            ? `Кандзи ${candidate.japanese}`
            : `Слово ${candidate.japanese}`,
        band: candidate.suggestedBand,
      };
    });
    const result = await this.adminRepository.enqueueCandidatePlanCandidates(candidates);

    return {
      planVersion: entry.version,
      ...result,
    };
  }

  private async resolveCandidatePlan(
    requestedVersion: string | null,
  ): Promise<CurriculumCandidatePlanCacheEntry> {
    const cached =
      requestedVersion === null ? null : this.candidatePlanCache.getCached(requestedVersion);

    if (cached !== null) {
      return cached;
    }

    const currentVersion = await this.adminRepository.getCandidatePlanVersion();

    if (requestedVersion !== null && requestedVersion !== currentVersion) {
      throw candidatePlanConflict();
    }

    return this.loadCandidatePlan(currentVersion, requestedVersion === null);
  }

  private async assertCandidatesNotRejected(
    candidates: readonly { readonly itemType: "kanji" | "word"; readonly targetId: string }[],
  ): Promise<void> {
    const rejectedKeys = new Set(await this.adminRepository.findRejectedCandidateKeys(candidates));
    const rejectedCandidate = candidates.find((candidate) =>
      rejectedKeys.has(candidatePlanTargetKey(candidate)),
    );

    if (rejectedCandidate !== undefined) {
      throw new ConflictException(
        `Candidate ${candidatePlanTargetKey(rejectedCandidate)} was rejected. Restore it before curation.`,
      );
    }
  }

  private async loadCandidatePlan(
    version: string,
    allowVersionRetry: boolean,
  ): Promise<CurriculumCandidatePlanCacheEntry> {
    try {
      return await this.candidatePlanCache.getOrLoad(version, async () => {
        const plan = await this.adminRepository.getCandidatePlan();
        const confirmedVersion = await this.adminRepository.getCandidatePlanVersion();

        if (confirmedVersion !== version) {
          throw new CandidatePlanVersionChangedError();
        }

        return plan;
      });
    } catch (error) {
      if (!(error instanceof CandidatePlanVersionChangedError)) {
        throw error;
      }

      if (!allowVersionRetry) {
        throw candidatePlanConflict();
      }

      const refreshedVersion = await this.adminRepository.getCandidatePlanVersion();
      return this.loadCandidatePlan(refreshedVersion, false);
    }
  }

  async getCurationItem(itemId: string): Promise<AdminCurationItemDto> {
    const item = await this.adminRepository.findCurationItem(itemId);

    if (item === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return item;
  }

  async getPrerequisiteCandidates(itemId: string): Promise<AdminPrerequisiteCandidateListResponse> {
    const result = await this.adminRepository.listPrerequisiteCandidates(itemId);

    if (result === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return result;
  }

  async getCoursePlacements(itemId: string): Promise<AdminCoursePlacementListResponse> {
    const result = await this.adminRepository.listCoursePlacements(itemId);

    if (result === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return result;
  }

  async updatePrerequisites(itemId: string, body: unknown): Promise<AdminCurationItemDto> {
    const request = parseUpdatePrerequisitesRequest(body);
    const [current, available] = await Promise.all([
      this.getCurationItem(itemId),
      this.getPrerequisiteCandidates(itemId),
    ]);
    const candidates = new Map(
      available.candidates.map((candidate) => [candidate.prerequisiteItemId, candidate]),
    );

    for (const prerequisite of request.prerequisites) {
      const candidate = candidates.get(prerequisite.prerequisiteItemId);

      if (candidate === undefined || candidate.prerequisiteItemId === current.id) {
        throw new BadRequestException(
          `Prerequisite ${prerequisite.prerequisiteItemId} is not available for this item.`,
        );
      }

      if (candidate.prerequisiteStatus !== "published") {
        throw new ConflictException(
          `Prerequisite ${prerequisite.prerequisiteItemId} must be published first.`,
        );
      }
    }

    if (current.status === "published") {
      assertPublishable({
        ...current,
        dependencies: [
          ...current.dependencies.filter(
            (dependency) => dependency.dependencyType !== "prerequisite",
          ),
          ...request.prerequisites.map((prerequisite, index) => {
            const candidate = candidates.get(prerequisite.prerequisiteItemId)!;

            return {
              id: `preview-prerequisite-${index}`,
              prerequisiteItemId: candidate.prerequisiteItemId,
              prerequisiteTitle: candidate.prerequisiteTitle,
              prerequisiteStatus: candidate.prerequisiteStatus,
              dependencyType: "prerequisite" as const,
              requiredStage: prerequisite.requiredStage,
            };
          }),
        ],
      });
    }

    try {
      const item = await this.adminRepository.replacePrerequisites(itemId, request);

      if (item === null) {
        throw new NotFoundException("Learning item not found.");
      }

      return item;
    } catch (error) {
      if (error instanceof PrerequisiteSelectionChangedError) {
        throw new ConflictException(
          "Prerequisite availability changed. Refresh the candidates and try again.",
        );
      }

      throw error;
    }
  }

  async updateCoursePlacements(
    itemId: string,
    body: unknown,
  ): Promise<AdminCoursePlacementListResponse> {
    const request = parseUpdateCoursePlacementsRequest(body);
    const [current, available] = await Promise.all([
      this.getCurationItem(itemId),
      this.getCoursePlacements(itemId),
    ]);

    if (current.status !== "published") {
      throw new ConflictException("Publish the learning item before placing it in a course.");
    }

    const levels = new Map(available.levels.map((level) => [level.courseLevelId, level]));
    const selectedCourseIds = new Set<string>();

    for (const courseLevelId of request.courseLevelIds) {
      const level = levels.get(courseLevelId);

      if (level === undefined) {
        throw new BadRequestException(`Course level ${courseLevelId} is not available.`);
      }

      if (selectedCourseIds.has(level.courseId)) {
        throw new BadRequestException(`Select at most one level for course ${level.courseTitle}.`);
      }

      selectedCourseIds.add(level.courseId);
    }

    try {
      const result = await this.adminRepository.replaceCoursePlacements(itemId, request);

      if (result === null) {
        throw new NotFoundException("Learning item not found.");
      }

      return result;
    } catch (error) {
      if (error instanceof CoursePlacementItemNotPublishedError) {
        throw new ConflictException("The learning item is no longer published. Refresh and retry.");
      }

      if (error instanceof CoursePlacementSelectionChangedError) {
        throw new ConflictException("Course levels changed. Refresh the list and try again.");
      }

      throw error;
    }
  }

  async updateItem(itemId: string, body: unknown): Promise<AdminCurationItemDto> {
    const request = parseUpdateItemRequest(body);
    const current = await this.getCurationItem(itemId);

    if ((request.status ?? current.status) === "published") {
      assertPublishable(previewAdminItemUpdate(current, request));
    }

    const item = await this.adminRepository.updateItemCuration(itemId, request);

    if (item === null) {
      throw new NotFoundException("Learning item not found.");
    }

    return item;
  }

  async updateCardAnswers(cardId: string, body: unknown): Promise<AdminCurationItemDto> {
    const request = parseUpdateCardAnswersRequest(body);
    const current = await this.adminRepository.findItemByCardId(cardId);

    if (current !== null && current.status === "published") {
      assertPublishable(
        previewAdminCardAnswersUpdate(
          current,
          cardId,
          request.acceptedAnswers.map((answer, index) => ({
            id: `preview-answer-${index}`,
            cardId,
            locale: answer.locale,
            text: answer.text,
            normalizedText: answer.normalizedText,
            answerKind: answer.answerKind,
            isPrimary: answer.isPrimary,
          })),
          request.blockedAnswers.map((answer, index) => ({
            id: `preview-blocked-${index}`,
            cardId,
            text: answer.text,
            normalizedText: answer.normalizedText,
            reason: answer.reason,
          })),
        ),
      );
    }

    const item = await this.adminRepository.updateCardAnswers(cardId, request);

    if (item === null) {
      throw new NotFoundException("Learning card not found.");
    }

    return item;
  }

  async promoteImportedCandidate(body: unknown): Promise<AdminCurationItemDto> {
    const request = parsePromoteCandidateRequest(body);

    if (request.targetType === "kanji" || request.targetType === "word") {
      await this.assertCandidatesNotRejected([
        { itemType: request.targetType, targetId: request.targetId },
      ]);
    }

    const item = await this.adminRepository.promoteImportedCandidate(request);

    if (item === null) {
      throw new NotFoundException("Import-derived target not found.");
    }

    return item;
  }

  async approveImportedTranslation(body: unknown): Promise<AdminCurationItemDto> {
    const request = parseApproveImportedTranslationRequest(body);
    await this.assertCandidatesNotRejected([
      { itemType: request.targetType, targetId: request.targetId },
    ]);
    const item = await this.adminRepository.approveImportedTranslation(request);

    if (item === null) {
      throw new NotFoundException("Import-derived target not found.");
    }

    return item;
  }
}

class CandidatePlanVersionChangedError extends Error {}

function candidatePlanConflict(): ConflictException {
  return new ConflictException(
    "Candidate plan data changed. Restart pagination from the first page.",
  );
}

function parseReviewQueueFilters(query: unknown): NormalizedAdminReviewQueueFilters {
  const record =
    typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};

  return {
    ...(record.band === undefined ? {} : { band: parseCourseBand(record.band, "band") }),
    ...(record.jlptLevel === undefined ? {} : { jlptLevel: parseJlptLevel(record.jlptLevel) }),
    ...(record.status === undefined ? {} : { status: parseRequiredStatus(record.status) }),
    ...(record.missingAcceptedAnswers === undefined
      ? {}
      : {
          missingAcceptedAnswers: parseBooleanQuery(
            record.missingAcceptedAnswers,
            "missingAcceptedAnswers",
          ),
        }),
    ...(record.missingMnemonics === undefined
      ? {}
      : { missingMnemonics: parseBooleanQuery(record.missingMnemonics, "missingMnemonics") }),
    cursor:
      record.cursor === undefined || record.cursor === ""
        ? null
        : parseReviewQueueCursor(record.cursor),
    limit: parseBoundedNonNegativeInteger(
      record.limit,
      "limit",
      DEFAULT_REVIEW_QUEUE_PAGE_LIMIT,
      MAX_REVIEW_QUEUE_PAGE_LIMIT,
      1,
    ),
  };
}

function parseReviewQueueCursor(value: unknown): NormalizedAdminReviewQueueFilters["cursor"] {
  const encoded = parseRequiredString(value, "cursor", { maxLength: 512 });

  try {
    const decoded = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as unknown;
    const record = parseRecord(decoded, "cursor");
    const updatedAtText = parseRequiredString(record.updatedAt, "cursor.updatedAt", {
      maxLength: 40,
    });
    const id = parseRequiredString(record.id, "cursor.id", { maxLength: 80 });
    const updatedAt = new Date(updatedAtText);

    if (Number.isNaN(updatedAt.getTime())) {
      throw new Error("Invalid cursor date.");
    }

    return { updatedAt, id };
  } catch {
    throw new BadRequestException("cursor is invalid or expired.");
  }
}

function encodeReviewQueueCursor(cursor: NonNullable<NormalizedAdminReviewQueueFilters["cursor"]>) {
  return Buffer.from(
    JSON.stringify({ updatedAt: cursor.updatedAt.toISOString(), id: cursor.id }),
    "utf8",
  ).toString("base64url");
}

function parseCandidatePlanFilters(query: unknown): NormalizedAdminCandidatePlanFilters {
  const record =
    typeof query === "object" && query !== null ? (query as Record<string, unknown>) : {};
  const itemType = record.itemType ?? "kanji";

  if (itemType !== "kanji" && itemType !== "word") {
    throw new BadRequestException("itemType must be kanji or word.");
  }

  const search = parseOptionalString(record.search, "search", {
    maxLength: MAX_CANDIDATE_PLAN_SEARCH_LENGTH,
  });
  const band =
    record.band === undefined || record.band === "" ? null : parseCourseBand(record.band, "band");
  const coverage =
    record.coverage === undefined || record.coverage === ""
      ? null
      : parseCandidatePlanCoverageFilter(record.coverage);

  return {
    itemType,
    search: search === "" ? null : search,
    band,
    coverage,
    offset: parseBoundedNonNegativeInteger(record.offset, "offset", 0, Number.MAX_SAFE_INTEGER),
    limit: parseBoundedNonNegativeInteger(
      record.limit,
      "limit",
      DEFAULT_CANDIDATE_PLAN_PAGE_LIMIT,
      MAX_CANDIDATE_PLAN_PAGE_LIMIT,
      1,
    ),
    planVersion:
      record.planVersion === undefined
        ? null
        : parseRequiredString(record.planVersion, "planVersion", { maxLength: 128 }),
  };
}

function parseCandidatePlanCoverageFilter(value: unknown): AdminCandidatePlanCoverageFilter {
  if (
    typeof value === "string" &&
    (ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS as readonly string[]).includes(value)
  ) {
    return value as AdminCandidatePlanCoverageFilter;
  }

  throw new BadRequestException(
    `coverage must be ${ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS.join(", ")}.`,
  );
}

function matchesCandidatePlanSearch(
  candidate: AdminCurriculumCandidatePlanItemDto,
  search: string,
): boolean {
  const normalizedSearch = normalizeJapaneseReading(search);
  const normalizedJapanese = normalizeJapaneseReading(candidate.japanese);
  const normalizedReading =
    candidate.reading === null ? null : normalizeJapaneseReading(candidate.reading);

  return (
    normalizedJapanese.includes(normalizedSearch) ||
    normalizedReading?.includes(normalizedSearch) === true ||
    candidate.targetId === search
  );
}

function matchesCandidatePlanCoverage(
  candidate: AdminCurriculumCandidatePlanItemDto,
  coverage: AdminCandidatePlanCoverageFilter,
): boolean {
  switch (coverage) {
    case "bilingual":
      return candidate.coverage.russianMeaning && candidate.coverage.englishMeaning;
    case "missing-russian":
      return !candidate.coverage.russianMeaning;
    case "missing-english":
      return !candidate.coverage.englishMeaning;
    case "missing-reading":
      return !candidate.coverage.reading;
    case "missing-stroke-data":
      return candidate.coverage.strokeData === false;
  }
}

function parseCandidatePlanEnqueueRequest(body: unknown): NormalizedAdminCandidatePlanEnqueueInput {
  const record = parseRecord(body, "Request body");
  const candidateValues = parseArray(record.candidates, "candidates");

  if (candidateValues.length < 1 || candidateValues.length > MAX_CANDIDATE_PLAN_PAGE_LIMIT) {
    throw new BadRequestException(
      `candidates must contain from 1 to ${MAX_CANDIDATE_PLAN_PAGE_LIMIT} items.`,
    );
  }

  const targetKeys = new Set<string>();
  const candidates = candidateValues.map((value, index) => {
    const candidate = parseRecord(value, `candidates[${index}]`);
    const parsed = {
      targetId: parseRequiredString(candidate.targetId, `candidates[${index}].targetId`, {
        maxLength: 80,
      }),
      itemType: parseImportedCandidateTargetType(
        candidate.itemType,
        `candidates[${index}].itemType`,
      ),
    };
    const targetKey = candidatePlanTargetKey(parsed);

    if (targetKeys.has(targetKey)) {
      throw new BadRequestException(`candidates contains duplicate target ${targetKey}.`);
    }

    targetKeys.add(targetKey);
    return parsed;
  });

  return {
    planVersion: parseRequiredString(record.planVersion, "planVersion", { maxLength: 128 }),
    candidates,
  };
}

function parseRejectImportedCandidateRequest(
  body: unknown,
  target: Pick<
    NormalizedAdminRejectImportedCandidateInput,
    "itemType" | "targetId" | "rejectedByUserId"
  >,
): NormalizedAdminRejectImportedCandidateInput {
  const record = parseRecord(body, "Request body");
  const reason = ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS.find(
    (candidate) => candidate === record.reason,
  );

  if (reason === undefined) {
    throw new BadRequestException(
      `reason must be ${ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS.join(", ")}.`,
    );
  }

  return {
    ...target,
    reason,
    note: parseOptionalString(record.note, "note", {
      maxLength: MAX_CANDIDATE_REJECTION_NOTE_LENGTH,
    }),
  };
}

function candidatePlanTargetKey(candidate: {
  readonly itemType: "kanji" | "word";
  readonly targetId: string;
}): string {
  return `${candidate.itemType}:${candidate.targetId}`;
}

function parseUpdateItemRequest(body: unknown): NormalizedAdminItemCurationInput {
  const record = parseRecord(body, "Request body");
  const status = parseOptionalStatus(record.status);
  const band = record.band === undefined ? undefined : parseOptionalCourseBand(record.band, "band");
  const meanings = parseOptionalMeanings(record.meanings);

  return {
    ...(status === undefined ? {} : { status }),
    ...(band === undefined ? {} : { band }),
    ...(meanings === undefined ? {} : { meanings }),
    ...(record.hints === undefined ? {} : { hints: parseTextInputs(record.hints, "hint") }),
    ...(record.mnemonics === undefined
      ? {}
      : { mnemonics: parseTextInputs(record.mnemonics, "mnemonic") }),
  };
}

function parseUpdatePrerequisitesRequest(body: unknown): NormalizedAdminUpdatePrerequisitesInput {
  const record = parseRecord(body, "Request body");
  const values = parseArray(record.prerequisites, "prerequisites");

  if (values.length > MAX_PREREQUISITES) {
    throw new BadRequestException(`prerequisites must contain at most ${MAX_PREREQUISITES} items.`);
  }

  const seen = new Set<string>();
  const prerequisites = values.map((value, index) => {
    const prerequisite = parseRecord(value, `prerequisites[${index}]`);
    const prerequisiteItemId = parseRequiredString(
      prerequisite.prerequisiteItemId,
      `prerequisites[${index}].prerequisiteItemId`,
      { maxLength: 80 },
    );

    if (seen.has(prerequisiteItemId)) {
      throw new BadRequestException(`Duplicate prerequisite: ${prerequisiteItemId}.`);
    }

    seen.add(prerequisiteItemId);

    return {
      prerequisiteItemId,
      requiredStage: parseOptionalPositiveInteger(
        prerequisite.requiredStage,
        `prerequisites[${index}].requiredStage`,
      ),
    };
  });

  return { prerequisites };
}

function parseUpdateCoursePlacementsRequest(
  body: unknown,
): NormalizedAdminUpdateCoursePlacementsInput {
  const record = parseRecord(body, "Request body");
  const values = parseArray(record.courseLevelIds, "courseLevelIds");

  if (values.length > MAX_COURSE_PLACEMENTS) {
    throw new BadRequestException(
      `courseLevelIds must contain at most ${MAX_COURSE_PLACEMENTS} items.`,
    );
  }

  const courseLevelIds = values.map((value, index) =>
    parseRequiredString(value, `courseLevelIds[${index}]`, { maxLength: 80 }),
  );

  if (new Set(courseLevelIds).size !== courseLevelIds.length) {
    throw new BadRequestException("courseLevelIds must not contain duplicates.");
  }

  return { courseLevelIds };
}

function parsePromoteCandidateRequest(body: unknown): NormalizedAdminPromoteCandidateInput {
  const record = parseRecord(body, "Request body");
  const targetType = parseItemKind(record.targetType);

  return {
    targetType,
    targetId: parseRequiredString(record.targetId, "targetId", { maxLength: 80 }),
    title: parseRequiredString(record.title, "title", { maxLength: 160 }),
    band: parseCourseBand(record.band, "band"),
    level: parseOptionalPositiveInteger(record.level, "level"),
  };
}

function parseApproveImportedTranslationRequest(
  body: unknown,
): NormalizedAdminApproveImportedTranslationInput {
  const record = parseRecord(body, "Request body");
  const targetType = parseImportedCandidateTargetType(record.targetType);
  const meanings = parseRecord(record.meanings, "meanings");
  const answers = parseRecord(record.acceptedAnswers, "acceptedAnswers");

  return {
    targetType,
    targetId: parseRequiredString(record.targetId, "targetId", { maxLength: 80 }),
    title: parseRequiredString(record.title, "title", { maxLength: 160 }),
    band: parseCourseBand(record.band, "band"),
    level: parseOptionalPositiveInteger(record.level, "level"),
    meanings: {
      ru: parseRequiredString(meanings.ru, "meanings.ru", { maxLength: MAX_MEANING_LENGTH }),
      en: parseRequiredString(meanings.en, "meanings.en", { maxLength: MAX_MEANING_LENGTH }),
    },
    acceptedAnswers: [
      ...parseAcceptedMeaningAnswers(answers.ru, "acceptedAnswers.ru", "ru-RU"),
      ...parseAcceptedMeaningAnswers(answers.en, "acceptedAnswers.en", "en-US"),
    ],
    acceptedReadings: parseAcceptedReadings(record.acceptedReadings),
  };
}

function parseAcceptedReadings(
  value: unknown,
): readonly NormalizedAdminApproveImportedTranslationInput["acceptedReadings"][number][] {
  const normalized = new Set<string>();
  const values = parseArray(value, "acceptedReadings");

  if (values.length > MAX_ACCEPTED_ANSWERS_PER_LOCALE) {
    throw new BadRequestException(
      `acceptedReadings must contain at most ${MAX_ACCEPTED_ANSWERS_PER_LOCALE} answers.`,
    );
  }

  const answers = values.map((answer, index) => {
    const text = parseRequiredString(answer, `acceptedReadings[${index}]`, {
      maxLength: MAX_ANSWER_LENGTH,
    });
    const normalizedText = normalizeJapaneseReading(text);

    if (normalizedText === "") {
      throw new BadRequestException(`acceptedReadings[${index}] is empty after normalization.`);
    }

    return {
      locale: "ru-RU" as const,
      text,
      normalizedText,
      answerKind: "reading" as const,
    };
  });

  if (answers.length === 0) {
    throw new BadRequestException("acceptedReadings must contain at least one answer.");
  }

  const uniqueAnswers = answers.filter((answer) => {
    if (normalized.has(answer.normalizedText)) {
      return false;
    }

    normalized.add(answer.normalizedText);
    return true;
  });

  return uniqueAnswers.map((answer, index) => ({ ...answer, isPrimary: index === 0 }));
}

function parseAcceptedMeaningAnswers(
  value: unknown,
  label: string,
  locale: ContentLocale,
): readonly NormalizedAdminApproveImportedTranslationInput["acceptedAnswers"][number][] {
  const normalized = new Set<string>();
  const values = parseArray(value, label);

  if (values.length > MAX_ACCEPTED_ANSWERS_PER_LOCALE) {
    throw new BadRequestException(
      `${label} must contain at most ${MAX_ACCEPTED_ANSWERS_PER_LOCALE} answers.`,
    );
  }

  const answers = values.map((answer, index) => {
    const text = parseRequiredString(answer, `${label}[${index}]`, {
      maxLength: MAX_ANSWER_LENGTH,
    });
    const normalizedText = normalizeMeaning(text, locale);

    if (normalizedText === "") {
      throw new BadRequestException(`${label}[${index}] is empty after normalization.`);
    }

    return { locale, text, normalizedText, answerKind: "meaning" as const };
  });

  if (answers.length === 0) {
    throw new BadRequestException(`${label} must contain at least one answer.`);
  }

  const uniqueAnswers = answers.filter((answer) => {
    if (normalized.has(answer.normalizedText)) {
      return false;
    }

    normalized.add(answer.normalizedText);
    return true;
  });

  return uniqueAnswers.map((answer, index) => ({ ...answer, isPrimary: index === 0 }));
}

function parseImportedCandidateTargetType(
  value: unknown,
  label = "targetType",
): NormalizedAdminApproveImportedTranslationInput["targetType"] {
  if (value === "kanji" || value === "word") {
    return value;
  }

  throw new BadRequestException(`${label} must be kanji or word.`);
}

function parseUpdateCardAnswersRequest(body: unknown): NormalizedAdminCardAnswersInput {
  const record = parseRecord(body, "Request body");
  const acceptedAnswerRecords = parseArray(record.acceptedAnswers, "acceptedAnswers");
  const blockedAnswerRecords = parseArray(record.blockedAnswers, "blockedAnswers");

  return {
    acceptedAnswers: acceptedAnswerRecords.map((value, index) => {
      const answer = parseRecord(value, `acceptedAnswers[${index}]`);
      const answerKind = parseAnswerKind(answer.answerKind);
      const locale = parseContentLocale(answer.locale);
      const text = parseRequiredString(answer.text, `acceptedAnswers[${index}].text`, {
        maxLength: MAX_ANSWER_LENGTH,
      });
      const normalizedText =
        answerKind === "reading" ? normalizeJapaneseReading(text) : normalizeMeaning(text, locale);

      if (normalizedText === "") {
        throw new BadRequestException(
          `acceptedAnswers[${index}].text is empty after normalization.`,
        );
      }

      return {
        locale,
        text,
        normalizedText,
        answerKind,
        isPrimary: answer.isPrimary === true,
      };
    }),
    blockedAnswers: blockedAnswerRecords.map((value, index) => {
      const answer = parseRecord(value, `blockedAnswers[${index}]`);
      const text = parseRequiredString(answer.text, `blockedAnswers[${index}].text`, {
        maxLength: MAX_ANSWER_LENGTH,
      });
      const normalizedText = normalizeMeaning(text, "ru-RU");

      if (normalizedText === "") {
        throw new BadRequestException(
          `blockedAnswers[${index}].text is empty after normalization.`,
        );
      }

      return {
        text,
        normalizedText,
        reason: parseOptionalString(answer.reason, `blockedAnswers[${index}].reason`, {
          maxLength: MAX_BLOCKED_REASON_LENGTH,
        }),
      };
    }),
  };
}

function parseOptionalStatus(value: unknown): AdminContentStatus | undefined {
  if (value === undefined) {
    return undefined;
  }

  return parseRequiredStatus(value);
}

function parseRequiredStatus(value: unknown): AdminContentStatus {
  if (
    value === "draft" ||
    value === "needs-review" ||
    value === "published" ||
    value === "archived"
  ) {
    return value;
  }

  throw new BadRequestException("status must be draft, needs-review, published, or archived.");
}

function parseCourseBand(value: unknown, label: string): CourseBand {
  if (typeof value === "string" && isCourseBand(value)) {
    return value;
  }

  throw new BadRequestException(`${label} must be foundation, n5, n4, n3, or n2.`);
}

function parseOptionalCourseBand(value: unknown, label: string): CourseBand | null {
  if (value === null || value === "") {
    return null;
  }

  return parseCourseBand(value, label);
}

function parseJlptLevel(value: unknown): "N5" | "N4" | "N3" | "N2" {
  if (value === "N5" || value === "N4" || value === "N3" || value === "N2") {
    return value;
  }

  throw new BadRequestException("jlptLevel must be N5, N4, N3, or N2.");
}

function parseBooleanQuery(value: unknown, label: string): boolean {
  if (value === true || value === "true" || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === "0") {
    return false;
  }

  throw new BadRequestException(`${label} must be true or false.`);
}

function parseItemKind(value: unknown): NormalizedAdminPromoteCandidateInput["targetType"] {
  if (value === "component" || value === "kanji" || value === "word" || value === "sentence") {
    return value;
  }

  throw new BadRequestException("targetType must be component, kanji, word, or sentence.");
}

function parseOptionalPositiveInteger(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new BadRequestException(`${label} must be a positive integer.`);
  }

  return parsed;
}

function parseBoundedNonNegativeInteger(
  value: unknown,
  label: string,
  defaultValue: number,
  maximum: number,
  minimum = 0,
): number {
  if (value === undefined || value === null || value === "") {
    return defaultValue;
  }

  const parsed = typeof value === "number" ? value : Number(value);

  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new BadRequestException(`${label} must be an integer from ${minimum} to ${maximum}.`);
  }

  return parsed;
}

function parseOptionalMeanings(
  value: unknown,
): NonNullable<AdminUpdateItemRequest["meanings"]> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = parseRecord(value, "meanings");

  return {
    ...(record.ru === undefined
      ? {}
      : {
          ru: parseRequiredString(record.ru, "meanings.ru", {
            maxLength: MAX_MEANING_LENGTH,
          }),
        }),
    ...(record.en === undefined
      ? {}
      : {
          en: parseRequiredString(record.en, "meanings.en", {
            maxLength: MAX_MEANING_LENGTH,
          }),
        }),
  };
}

function parseTextInputs(
  value: unknown,
  label: "hint" | "mnemonic",
): readonly NormalizedAdminTextInput[] {
  return parseArray(value, `${label}s`).map((item, index) => {
    const record = parseRecord(item, `${label}s[${index}]`);
    const type = label === "hint" ? parseHintType(record.type) : parseMnemonicType(record.type);

    return {
      locale: parseContentLocale(record.locale),
      type,
      body:
        parseOptionalString(record.body, `${label}s[${index}].body`, {
          maxLength: MAX_TEXT_BODY_LENGTH,
        }) ?? "",
    };
  });
}

function parseHintType(
  value: unknown,
): NonNullable<AdminUpdateItemRequest["hints"]>[number]["type"] {
  if (value === "meaning" || value === "reading" || value === "usage") {
    return value;
  }

  throw new BadRequestException("hint type must be meaning, reading, or usage.");
}

function parseMnemonicType(
  value: unknown,
): NonNullable<AdminUpdateItemRequest["mnemonics"]>[number]["type"] {
  if (value === "meaning" || value === "reading" || value === "story") {
    return value;
  }

  throw new BadRequestException("mnemonic type must be meaning, reading, or story.");
}

function parseAnswerKind(value: unknown): CardAnswerType {
  if (value === "meaning" || value === "reading") {
    return value;
  }

  throw new BadRequestException("answerKind must be meaning or reading.");
}

function parseContentLocale(value: unknown): ContentLocale {
  if (value === "ru-RU" || value === "en-US") {
    return value;
  }

  throw new BadRequestException("locale must be ru-RU or en-US.");
}

function parseArray(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new BadRequestException(`${label} must be an array.`);
  }

  return value;
}

function parseRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new BadRequestException(`${label} must be a JSON object.`);
  }

  return value as Record<string, unknown>;
}

function parseRequiredString(
  value: unknown,
  label: string,
  options: { readonly maxLength: number },
): string {
  const parsed = parseOptionalString(value, label, options);

  if (parsed === null || parsed === "") {
    throw new BadRequestException(`${label} is required.`);
  }

  return parsed;
}

function parseOptionalString(
  value: unknown,
  label: string,
  options: { readonly maxLength: number },
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new BadRequestException(`${label} must be a string.`);
  }

  const trimmed = value.trim();

  if (trimmed.length > options.maxLength) {
    throw new BadRequestException(`${label} is too long.`);
  }

  return trimmed;
}

function assertPublishable(item: AdminCurationItemDto): void {
  const issues = getAdminQualityIssues(item);

  if (issues.length === 0) {
    return;
  }

  throw new BadRequestException(
    `Нельзя опубликовать материал: ${issues.map((issue) => issue.message).join(" ")}`,
  );
}
