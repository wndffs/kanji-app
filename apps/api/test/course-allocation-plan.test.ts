import { describe, expect, it } from "vitest";

import {
  buildCourseAllocationPreview,
  type CourseAllocationPlanInput,
} from "../src/admin/course-allocation-plan";

describe("course allocation plan", () => {
  it("keeps existing placements and allocates prerequisites no later than dependents", () => {
    const preview = buildCourseAllocationPreview(
      createInput({
        levels: [
          { id: "level-1", levelNumber: 1, band: "foundation" },
          { id: "level-2", levelNumber: 2, band: "foundation" },
          { id: "level-6", levelNumber: 6, band: "n5" },
        ],
        items: [
          createItem({ id: "component", itemType: "component", currentLevelNumbers: [1] }),
          createItem({
            id: "kanji",
            itemType: "kanji",
            levelHint: 2,
            prerequisiteItemIds: ["component"],
          }),
          createItem({
            id: "word",
            itemType: "word",
            band: "n5",
            prerequisiteItemIds: ["kanji"],
          }),
        ],
      }),
      { now: new Date("2026-07-15T10:00:00.000Z") },
    );

    expect(preview.summary).toEqual({
      publishedItems: 3,
      existingPlacements: 1,
      proposedPlacements: 2,
      blockedItems: 0,
    });
    expect(preview.items).toEqual([
      expect.objectContaining({
        learningItemId: "component",
        levelNumber: 1,
        placement: "existing",
      }),
      expect.objectContaining({
        learningItemId: "kanji",
        levelNumber: 2,
        prerequisiteLevelFloor: 1,
        placement: "level-hint",
      }),
      expect.objectContaining({
        learningItemId: "word",
        levelNumber: 6,
        prerequisiteLevelFloor: 2,
        placement: "balanced",
      }),
    ]);
    expect(preview.issues).toEqual([]);
  });

  it("balances new items across available levels deterministically", () => {
    const preview = buildCourseAllocationPreview(
      createInput({
        levels: [
          { id: "level-1", levelNumber: 1, band: "foundation" },
          { id: "level-2", levelNumber: 2, band: "foundation" },
        ],
        items: [
          createItem({ id: "component-b", title: "Бета", itemType: "component" }),
          createItem({ id: "component-a", title: "Альфа", itemType: "component" }),
        ],
      }),
    );

    expect(preview.items).toEqual([
      expect.objectContaining({ learningItemId: "component-a", levelNumber: 1 }),
      expect.objectContaining({ learningItemId: "component-b", levelNumber: 2 }),
    ]);
  });

  it("versions the allocation inputs independently of preview time and truncation", () => {
    const input = createInput({
      levels: [{ id: "level-1", levelNumber: 1, band: "foundation" }],
      items: [createItem({ id: "component", itemType: "component" })],
    });
    const first = buildCourseAllocationPreview(input, {
      now: new Date("2026-07-15T10:00:00.000Z"),
      previewLimit: 1,
    });
    const second = buildCourseAllocationPreview(input, {
      now: new Date("2026-07-16T10:00:00.000Z"),
      previewLimit: 100,
    });
    const changed = buildCourseAllocationPreview({
      ...input,
      items: [{ ...input.items[0]!, levelHint: 1 }],
    });

    expect(first.planVersion).toBe(second.planVersion);
    expect(changed.planVersion).not.toBe(first.planVersion);
  });

  it("reports blocking prerequisites, missing bands, and unsafe existing placements", () => {
    const preview = buildCourseAllocationPreview(
      createInput({
        levels: [
          { id: "level-1", levelNumber: 1, band: "foundation" },
          { id: "level-6", levelNumber: 6, band: "n5" },
        ],
        items: [
          createItem({
            id: "late-prerequisite",
            itemType: "kanji",
            band: "n5",
            currentLevelNumbers: [6],
          }),
          createItem({
            id: "blocked-foundation",
            itemType: "kanji",
            prerequisiteItemIds: ["late-prerequisite"],
          }),
          createItem({ id: "missing-band", itemType: "word", band: null }),
          createItem({
            id: "missing-prerequisite",
            itemType: "word",
            band: "n5",
            prerequisiteItemIds: ["not-published"],
          }),
          createItem({
            id: "unsafe-existing",
            itemType: "word",
            band: "foundation",
            currentLevelNumbers: [1, 6],
            prerequisiteItemIds: ["late-prerequisite"],
          }),
        ],
      }),
    );

    expect(preview.summary.blockedItems).toBe(3);
    expect(preview.issues.map((issue) => [issue.learningItemId, issue.code])).toEqual(
      expect.arrayContaining([
        ["blocked-foundation", "prerequisite-after-band"],
        ["missing-band", "missing-band"],
        ["missing-prerequisite", "missing-prerequisite"],
        ["unsafe-existing", "multiple-placements"],
        ["unsafe-existing", "placement-prerequisite-order"],
      ]),
    );
  });

  it("reports exhausted level capacity without moving existing items", () => {
    const preview = buildCourseAllocationPreview(
      createInput({
        levels: [{ id: "level-1", levelNumber: 1, band: "foundation" }],
        items: [
          createItem({ id: "existing", itemType: "component", currentLevelNumbers: [1] }),
          createItem({ id: "new", itemType: "component" }),
        ],
      }),
      { maxItemsPerLevel: 1 },
    );

    expect(preview.summary).toMatchObject({
      existingPlacements: 1,
      proposedPlacements: 0,
      blockedItems: 1,
    });
    expect(preview.issues).toEqual([
      expect.objectContaining({ learningItemId: "new", code: "capacity-exhausted" }),
    ]);
  });

  it("blocks prerequisite cycles instead of assigning an arbitrary order", () => {
    const preview = buildCourseAllocationPreview(
      createInput({
        levels: [{ id: "level-1", levelNumber: 1, band: "foundation" }],
        items: [
          createItem({ id: "cycle-a", itemType: "kanji", prerequisiteItemIds: ["cycle-b"] }),
          createItem({ id: "cycle-b", itemType: "kanji", prerequisiteItemIds: ["cycle-a"] }),
        ],
      }),
    );

    expect(preview.summary).toMatchObject({ proposedPlacements: 0, blockedItems: 2 });
    expect(preview.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ learningItemId: "cycle-a", code: "prerequisite-cycle" }),
        expect.objectContaining({ learningItemId: "cycle-b", code: "prerequisite-cycle" }),
      ]),
    );
  });
});

function createInput(
  overrides: Pick<CourseAllocationPlanInput, "levels" | "items">,
): CourseAllocationPlanInput {
  return {
    course: {
      id: "course-main",
      slug: "japanese-ru-n2",
      title: "Основной курс",
      status: "draft",
    },
    ...overrides,
  };
}

function createItem(
  overrides: Partial<CourseAllocationPlanInput["items"][number]> &
    Pick<CourseAllocationPlanInput["items"][number], "id" | "itemType">,
): CourseAllocationPlanInput["items"][number] {
  return {
    title: overrides.id,
    band: "foundation",
    levelHint: null,
    prerequisiteItemIds: [],
    currentLevelNumbers: [],
    ...overrides,
  };
}
