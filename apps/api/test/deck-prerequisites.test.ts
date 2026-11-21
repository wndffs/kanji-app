import { BadRequestException, NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { DeckPrerequisitesService } from "../src/decks/deck-prerequisites.service";
import { type CreateTextDeckInput } from "../src/decks/decks.types";
import {
  type LessonEligibilityItemRecord,
  type UserItemProgressRecord,
} from "../src/lessons/lessons.types";

function item(
  id: string,
  itemType: LessonEligibilityItemRecord["itemType"],
  dependencies: readonly string[] = [],
  cardCount = 1,
): LessonEligibilityItemRecord {
  return {
    id,
    itemType,
    dependencies: dependencies.map((prerequisiteItemId) => ({
      prerequisiteItemId,
      requiredStage: 2,
    })),
    cards: Array.from({ length: cardCount }, (_, index) => ({ id: `${id}-${index}` })),
  };
}

function harness() {
  const rows = [
    item("word", "word", ["kanji", "waiting", "unpublished", "internal"]),
    item("internal", "component"),
    item("kanji", "kanji", ["root"]),
    item("root", "component"),
    item("waiting", "kanji", [], 2),
  ];
  const addProgress = (learningItemId: string, index: number, stageIndex: number) => {
    progress.push({
      learningItemId,
      learningCardId: `${learningItemId}-${index}`,
      createdAt: new Date("2026-11-01T00:00:00Z"),
      stageIndex,
    });
  };
  const progress: UserItemProgressRecord[] = [];
  addProgress("waiting", 0, 5);
  addProgress("waiting", 1, 1);
  const lessons = {
    findDeckEligibility: vi.fn(async (userId: string, deckId: string) =>
      userId !== "owner" || deckId !== "source"
        ? null
        : { title: "Чтение", status: "active", items: rows.slice(0, 2).map((item) => ({ item })) },
    ),
    loadLessonEligibilityItems: vi.fn(async (ids: string[]) =>
      rows.filter(({ id }) => ids.includes(id)),
    ),
    listUserProgress: vi.fn(async (_userId: string, ids: string[]) =>
      progress.filter((row) => ids.includes(row.learningItemId)),
    ),
    loadLessonItems: vi.fn(
      async (_userId: string, ids: string[]) =>
        new Map(ids.map((id) => [id, { id, target: { japanese: id === "root" ? "木" : "林" } }])),
    ),
  };
  const createTextDeck = vi.fn(async (input: CreateTextDeckInput) => ({
    id: "followup",
    itemCount: input.items.length,
  }));
  const service = new DeckPrerequisitesService(lessons as never, { createTextDeck } as never);
  return { service, lessons, createTextDeck, addProgress };
}

describe("private deck prerequisite recovery", () => {
  it("walks only unmet prerequisites to a startable external leaf without writes", async () => {
    const { service, lessons, createTextDeck } = harness();
    await expect(service.preview("owner", "source")).resolves.toEqual({
      readyCount: 1,
      waitingReviewCount: 1,
      unavailableCount: 1,
      preview: [{ id: "root", japanese: "木" }],
    });
    expect(createTextDeck).not.toHaveBeenCalled();
    expect(lessons.listUserProgress).toHaveBeenNthCalledWith(1, "owner", ["word", "internal"]);
    expect(lessons.loadLessonEligibilityItems).toHaveBeenCalledTimes(2);
    expect(lessons.loadLessonItems).toHaveBeenCalledExactlyOnceWith("owner", ["root"]);
  });

  it("creates a separate owner deck from live eligibility, preserving the original membership", async () => {
    const { service, createTextDeck, addProgress } = harness();
    await service.preview("owner", "source");
    addProgress("root", 0, 2);
    const created = await service.create("owner", "source");
    expect(created).toEqual({ deckId: "followup", itemCount: 1 });
    expect(createTextDeck).toHaveBeenCalledExactlyOnceWith({
      ownerUserId: "owner",
      title: "Предпосылки: Чтение",
      sourceText: null,
      items: [
        expect.objectContaining({
          learningItemId: "kanji",
          sortOrder: 1,
          reasons: [expect.objectContaining({ code: "prerequisite-kanji" })],
        }),
      ],
    });
  });

  it("does not create a stalled followup for a started prerequisite below the required stage", async () => {
    const { service, addProgress, createTextDeck } = harness();
    addProgress("root", 0, 1);
    await expect(service.preview("owner", "source")).resolves.toMatchObject({
      readyCount: 0,
      waitingReviewCount: 2,
    });
    await expect(service.create("owner", "source")).rejects.toBeInstanceOf(BadRequestException);
    expect(createTextDeck).not.toHaveBeenCalled();
  });

  it("rejects an unowned source before touching progress or creating a new deck", async () => {
    const { service, lessons, createTextDeck } = harness();
    await expect(service.preview("other", "source")).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.create("other", "source")).rejects.toBeInstanceOf(NotFoundException);
    expect(lessons.listUserProgress).not.toHaveBeenCalled();
    expect(createTextDeck).not.toHaveBeenCalled();
  });
});
