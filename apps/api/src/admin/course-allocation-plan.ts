import { createHash } from "node:crypto";

import {
  type AdminContentStatus,
  type AdminCourseAllocationIssueDto,
  type AdminCourseAllocationPreviewItemDto,
  type AdminCourseAllocationPreviewResponse,
  type CourseBand,
  type ItemKind,
  SUPPORTED_COURSE_BANDS,
} from "@kanji-srs/shared";

export const COURSE_ALLOCATION_POLICY_VERSION = "balanced-prerequisite-levels-v1" as const;
export const COURSE_ALLOCATION_MAX_ITEMS_PER_LEVEL = 220;
export const COURSE_ALLOCATION_PREVIEW_LIMIT = 100;

export type CourseAllocationLevelInput = {
  readonly id: string;
  readonly levelNumber: number;
  readonly band: CourseBand;
};

export type CourseAllocationItemInput = {
  readonly id: string;
  readonly title: string;
  readonly itemType: ItemKind;
  readonly band: CourseBand | null;
  readonly levelHint: number | null;
  readonly prerequisiteItemIds: readonly string[];
  readonly currentLevelNumbers: readonly number[];
};

export type CourseAllocationPlanInput = {
  readonly course: {
    readonly id: string;
    readonly slug: string;
    readonly title: string;
    readonly status: AdminContentStatus;
  };
  readonly levels: readonly CourseAllocationLevelInput[];
  readonly items: readonly CourseAllocationItemInput[];
};

type Allocation = AdminCourseAllocationPreviewItemDto;

type CourseAllocationOptions = {
  readonly now?: Date;
  readonly maxItemsPerLevel?: number;
  readonly previewLimit?: number;
};

export function buildCourseAllocationPreview(
  input: CourseAllocationPlanInput,
  options: CourseAllocationOptions = {},
): AdminCourseAllocationPreviewResponse {
  const maxItemsPerLevel = options.maxItemsPerLevel ?? COURSE_ALLOCATION_MAX_ITEMS_PER_LEVEL;
  const previewLimit = options.previewLimit ?? COURSE_ALLOCATION_PREVIEW_LIMIT;

  if (!Number.isInteger(maxItemsPerLevel) || maxItemsPerLevel <= 0) {
    throw new Error("maxItemsPerLevel must be a positive integer.");
  }

  if (!Number.isInteger(previewLimit) || previewLimit <= 0) {
    throw new Error("previewLimit must be a positive integer.");
  }

  const levels = [...input.levels].sort((left, right) => left.levelNumber - right.levelNumber);
  const levelByNumber = new Map(levels.map((level) => [level.levelNumber, level]));
  const levelsByBand = new Map<CourseBand, readonly CourseAllocationLevelInput[]>(
    SUPPORTED_COURSE_BANDS.map((band) => [band, levels.filter((level) => level.band === band)]),
  );
  const itemById = new Map(input.items.map((item) => [item.id, item]));
  const cycleItemIds = findPrerequisiteCycleItemIds(input.items);
  const occupancy = new Map(levels.map((level) => [level.levelNumber, 0]));
  const allocations = new Map<string, Allocation>();
  const issues: AdminCourseAllocationIssueDto[] = [];
  const issueKeys = new Set<string>();
  const visiting = new Set<string>();
  const resolved = new Set<string>();

  const addIssue = (
    item: CourseAllocationItemInput,
    code: AdminCourseAllocationIssueDto["code"],
    message: string,
  ): void => {
    const key = `${item.id}:${code}`;

    if (issueKeys.has(key)) {
      return;
    }

    issueKeys.add(key);
    issues.push({ learningItemId: item.id, title: item.title, code, message });
  };

  for (const itemId of cycleItemIds) {
    const item = itemById.get(itemId);

    if (item !== undefined) {
      addIssue(item, "prerequisite-cycle", "Обнаружен цикл prerequisite-связей.");
    }
  }

  for (const item of input.items) {
    const currentLevels = [...new Set(item.currentLevelNumbers)].sort(
      (left, right) => left - right,
    );

    for (const levelNumber of currentLevels) {
      if (occupancy.has(levelNumber)) {
        occupancy.set(levelNumber, (occupancy.get(levelNumber) ?? 0) + 1);
      }
    }

    const currentLevelNumber = currentLevels[0];

    if (currentLevelNumber === undefined) {
      continue;
    }

    if (currentLevels.length > 1) {
      addIssue(
        item,
        "multiple-placements",
        "Материал размещён на нескольких уровнях одного курса.",
      );
    }

    const currentLevel = levelByNumber.get(currentLevelNumber);

    if (item.band !== null && currentLevel !== undefined && currentLevel.band !== item.band) {
      addIssue(
        item,
        "placement-band-mismatch",
        `Текущий уровень ${currentLevelNumber} не относится к band ${item.band.toUpperCase()}.`,
      );
    }

    allocations.set(item.id, {
      learningItemId: item.id,
      title: item.title,
      itemType: item.itemType,
      band: item.band,
      levelNumber: currentLevelNumber,
      prerequisiteLevelFloor: currentLevelNumber,
      placement: "existing",
    });
    resolved.add(item.id);
  }

  const allocate = (item: CourseAllocationItemInput): Allocation | null => {
    const existing = allocations.get(item.id);

    if (existing !== undefined) {
      return existing;
    }

    if (resolved.has(item.id)) {
      return null;
    }

    if (cycleItemIds.has(item.id)) {
      resolved.add(item.id);
      return null;
    }

    if (visiting.has(item.id)) {
      addIssue(item, "prerequisite-cycle", "Обнаружен цикл prerequisite-связей.");
      return null;
    }

    if (item.band === null) {
      addIssue(item, "missing-band", "У опубликованного материала не указан curriculum band.");
      resolved.add(item.id);
      return null;
    }

    visiting.add(item.id);
    let prerequisiteLevelFloor = 0;
    let prerequisiteUnavailable = false;

    for (const prerequisiteItemId of item.prerequisiteItemIds) {
      const prerequisite = itemById.get(prerequisiteItemId);

      if (prerequisite === undefined) {
        addIssue(
          item,
          "missing-prerequisite",
          `Prerequisite ${prerequisiteItemId} не опубликован или отсутствует.`,
        );
        prerequisiteUnavailable = true;
        continue;
      }

      const prerequisiteAllocation = allocate(prerequisite);

      if (prerequisiteAllocation === null) {
        addIssue(
          item,
          "prerequisite-unavailable",
          `Prerequisite «${prerequisite.title}» нельзя разместить в текущем плане.`,
        );
        prerequisiteUnavailable = true;
        continue;
      }

      prerequisiteLevelFloor = Math.max(prerequisiteLevelFloor, prerequisiteAllocation.levelNumber);
    }

    visiting.delete(item.id);

    if (prerequisiteUnavailable) {
      resolved.add(item.id);
      return null;
    }

    const bandLevels = levelsByBand.get(item.band) ?? [];
    const eligibleLevels = bandLevels.filter(
      (level) => level.levelNumber >= prerequisiteLevelFloor,
    );

    if (eligibleLevels.length === 0) {
      addIssue(
        item,
        "prerequisite-after-band",
        "Prerequisite расположен позже всех уровней выбранного band.",
      );
      resolved.add(item.id);
      return null;
    }

    const hintedLevel =
      item.levelHint === null
        ? undefined
        : eligibleLevels.find(
            (level) =>
              level.levelNumber === item.levelHint &&
              (occupancy.get(level.levelNumber) ?? 0) < maxItemsPerLevel,
          );
    const selectedLevel =
      hintedLevel ??
      [...eligibleLevels]
        .filter((level) => (occupancy.get(level.levelNumber) ?? 0) < maxItemsPerLevel)
        .sort(
          (left, right) =>
            (occupancy.get(left.levelNumber) ?? 0) - (occupancy.get(right.levelNumber) ?? 0) ||
            left.levelNumber - right.levelNumber,
        )[0];

    if (selectedLevel === undefined) {
      addIssue(item, "capacity-exhausted", "На доступных уровнях band закончились места.");
      resolved.add(item.id);
      return null;
    }

    occupancy.set(selectedLevel.levelNumber, (occupancy.get(selectedLevel.levelNumber) ?? 0) + 1);
    const allocation: Allocation = {
      learningItemId: item.id,
      title: item.title,
      itemType: item.itemType,
      band: item.band,
      levelNumber: selectedLevel.levelNumber,
      prerequisiteLevelFloor,
      placement: hintedLevel === undefined ? "balanced" : "level-hint",
    };

    allocations.set(item.id, allocation);
    resolved.add(item.id);
    return allocation;
  };

  for (const item of [...input.items].sort(compareAllocationItems)) {
    allocate(item);
  }

  for (const item of input.items) {
    const allocation = allocations.get(item.id);

    if (allocation?.placement !== "existing") {
      continue;
    }

    let prerequisiteLevelFloor = 0;

    for (const prerequisiteItemId of item.prerequisiteItemIds) {
      const prerequisite = itemById.get(prerequisiteItemId);
      const prerequisiteAllocation = allocations.get(prerequisiteItemId);

      if (prerequisite === undefined || prerequisiteAllocation === undefined) {
        addIssue(
          item,
          "missing-prerequisite",
          `Prerequisite ${prerequisite?.title ?? prerequisiteItemId} недоступен в плане.`,
        );
        continue;
      }

      prerequisiteLevelFloor = Math.max(prerequisiteLevelFloor, prerequisiteAllocation.levelNumber);

      if (prerequisiteAllocation.levelNumber > allocation.levelNumber) {
        addIssue(
          item,
          "placement-prerequisite-order",
          `Текущий уровень ${allocation.levelNumber} раньше prerequisite «${prerequisite.title}» на уровне ${prerequisiteAllocation.levelNumber}.`,
        );
      }
    }

    allocations.set(item.id, { ...allocation, prerequisiteLevelFloor });
  }

  const allAllocations = [...allocations.values()].sort(
    (left, right) =>
      left.levelNumber - right.levelNumber ||
      itemKindOrder(left.itemType) - itemKindOrder(right.itemType) ||
      left.title.localeCompare(right.title, "ru") ||
      left.learningItemId.localeCompare(right.learningItemId),
  );
  const sortedIssues = [...issues].sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      left.title.localeCompare(right.title, "ru") ||
      left.learningItemId.localeCompare(right.learningItemId),
  );
  const blockedItemIds = new Set(
    input.items.filter((item) => !allocations.has(item.id)).map((item) => item.id),
  );

  return {
    policyVersion: COURSE_ALLOCATION_POLICY_VERSION,
    planVersion: buildCourseAllocationPlanVersion(input, maxItemsPerLevel),
    generatedAt: (options.now ?? new Date()).toISOString(),
    maxItemsPerLevel,
    course: {
      ...input.course,
      levelCount: levels.length,
    },
    summary: {
      publishedItems: input.items.length,
      existingPlacements: allAllocations.filter((item) => item.placement === "existing").length,
      proposedPlacements: allAllocations.filter((item) => item.placement !== "existing").length,
      blockedItems: blockedItemIds.size,
    },
    bands: SUPPORTED_COURSE_BANDS.map((band) => ({
      band,
      levelCount: levelsByBand.get(band)?.length ?? 0,
      publishedItems: input.items.filter((item) => item.band === band).length,
      existingPlacements: allAllocations.filter(
        (item) => item.band === band && item.placement === "existing",
      ).length,
      proposedPlacements: allAllocations.filter(
        (item) => item.band === band && item.placement !== "existing",
      ).length,
      blockedItems: input.items.filter((item) => item.band === band && blockedItemIds.has(item.id))
        .length,
    })),
    items: allAllocations.slice(0, previewLimit),
    issues: sortedIssues.slice(0, previewLimit),
    itemsTruncated: allAllocations.length > previewLimit,
    issuesTruncated: sortedIssues.length > previewLimit,
  };
}

function buildCourseAllocationPlanVersion(
  input: CourseAllocationPlanInput,
  maxItemsPerLevel = COURSE_ALLOCATION_MAX_ITEMS_PER_LEVEL,
): string {
  const payload = {
    policyVersion: COURSE_ALLOCATION_POLICY_VERSION,
    maxItemsPerLevel,
    course: input.course,
    levels: [...input.levels]
      .sort(
        (left, right) => left.levelNumber - right.levelNumber || left.id.localeCompare(right.id),
      )
      .map((level) => ({
        id: level.id,
        levelNumber: level.levelNumber,
        band: level.band,
      })),
    items: [...input.items]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((item) => ({
        id: item.id,
        title: item.title,
        itemType: item.itemType,
        band: item.band,
        levelHint: item.levelHint,
        prerequisiteItemIds: [...item.prerequisiteItemIds].sort(),
        currentLevelNumbers: [...item.currentLevelNumbers].sort((left, right) => left - right),
      })),
  };
  const checksum = createHash("sha256").update(JSON.stringify(payload)).digest("hex");

  return `course-allocation:${checksum}`;
}

function compareAllocationItems(
  left: CourseAllocationItemInput,
  right: CourseAllocationItemInput,
): number {
  return (
    itemKindOrder(left.itemType) - itemKindOrder(right.itemType) ||
    (left.levelHint ?? Number.MAX_SAFE_INTEGER) - (right.levelHint ?? Number.MAX_SAFE_INTEGER) ||
    left.title.localeCompare(right.title, "ru") ||
    left.id.localeCompare(right.id)
  );
}

function itemKindOrder(itemType: ItemKind): number {
  switch (itemType) {
    case "component":
      return 0;
    case "kanji":
      return 1;
    case "word":
      return 2;
    case "sentence":
      return 3;
  }
}

function findPrerequisiteCycleItemIds(
  items: readonly CourseAllocationItemInput[],
): ReadonlySet<string> {
  const itemById = new Map(items.map((item) => [item.id, item]));
  const states = new Map<string, "visiting" | "resolved">();
  const stack: string[] = [];
  const cycleItemIds = new Set<string>();

  const visit = (itemId: string): void => {
    const state = states.get(itemId);

    if (state === "resolved") {
      return;
    }

    if (state === "visiting") {
      const cycleStart = stack.lastIndexOf(itemId);

      for (const cycleItemId of stack.slice(Math.max(0, cycleStart))) {
        cycleItemIds.add(cycleItemId);
      }

      return;
    }

    const item = itemById.get(itemId);

    if (item === undefined) {
      return;
    }

    states.set(itemId, "visiting");
    stack.push(itemId);

    for (const prerequisiteItemId of item.prerequisiteItemIds) {
      if (itemById.has(prerequisiteItemId)) {
        visit(prerequisiteItemId);
      }
    }

    stack.pop();
    states.set(itemId, "resolved");
  };

  for (const item of items) {
    visit(item.id);
  }

  return cycleItemIds;
}
