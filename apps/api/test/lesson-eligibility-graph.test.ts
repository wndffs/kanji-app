import { describe, expect, it, vi } from "vitest";

import { PrismaLessonsRepository } from "../src/lessons/lessons.repository";

const item = {
  id: "item",
  kind: "KANJI",
  dependencies: [{ prerequisiteItemId: "base", requiredStage: null }],
  cards: [
    { id: "meaning", promptType: "MEANING", audioAsset: null },
    { id: "reading", promptType: "READING", audioAsset: null },
    { id: "bad-audio", promptType: "LISTENING", audioAsset: null },
  ],
};

const base = { ...item, id: "base", kind: "COMPONENT", dependencies: [] };
const level = {
  levelNumber: 2,
  items: [
    { sortOrder: 3, unlockPolicyJson: null, learningItem: item },
    {
      sortOrder: 4,
      unlockPolicyJson: null,
      learningItem: { ...item, id: "empty", cards: [] },
    },
  ],
};

function harness() {
  const db = {
    userSettings: { findUnique: vi.fn().mockResolvedValue({ currentCourseId: "course" }) },
    userEnrollment: {
      findMany: vi.fn().mockResolvedValue([
        {
          courseId: "course",
          startedAt: new Date(),
          course: { slug: "course" },
        },
      ]),
    },
    courseLevel: { findFirst: vi.fn().mockResolvedValue(level) },
    learningItem: { findMany: vi.fn().mockResolvedValue([base]) },
    deck: { findFirst: vi.fn() },
  };
  return { db, repository: new PrismaLessonsRepository({ db } as never) };
}

describe("lightweight lesson eligibility", () => {
  it("loads the first possible current level and only its course prerequisite metadata", async () => {
    const { db, repository } = harness();
    expect(await repository.listCourseEligibility("owner", [])).toEqual({
      items: [
        {
          courseId: "course",
          courseLevelNumber: 2,
          sortOrder: 3,
          unlockPolicy: null,
          item: {
            id: "item",
            itemType: "kanji",
            cards: [{ id: "meaning" }, { id: "reading" }],
            dependencies: [{ prerequisiteItemId: "base", requiredStage: 1 }],
          },
        },
      ],
      prerequisiteItems: [
        {
          id: "base",
          itemType: "component",
          cards: [{ id: "meaning" }, { id: "reading" }],
          dependencies: [],
        },
      ],
    });
    expect(db.courseLevel.findFirst).toHaveBeenCalledTimes(1);
    const query = db.courseLevel.findFirst.mock.calls[0]![0];
    expect(query.orderBy).toEqual({ levelNumber: "asc" });
    expect(query.where).toMatchObject({
      courseId: "course",
      course: { status: "PUBLISHED", enrollments: { some: { userId: "owner", status: "ACTIVE" } } },
      items: {
        some: {
          learningItem: {
            status: "PUBLISHED",
            cards: {
              none: { promptType: { not: "LISTENING" }, srsStates: { some: { userId: "owner" } } },
            },
          },
        },
      },
    });
    const select = query.select.items.select.learningItem.select;
    expect(Object.keys(select).sort()).toEqual(["cards", "dependencies", "id", "kind"]);
    expect(select.cards.select).not.toHaveProperty("answers");
    expect(db.learningItem.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["base"] },
        status: "PUBLISHED",
        courseLevelItems: { some: { courseLevel: { courseId: "course" } } },
      },
      select,
    });
  });
  it("does not load a course when there is no selected enrollment", async () => {
    const { db, repository } = harness();
    db.userEnrollment.findMany.mockResolvedValue([]);
    expect(await repository.listCourseEligibility("owner", [])).toEqual({
      items: [],
      prerequisiteItems: [],
    });
    expect(db.courseLevel.findFirst).not.toHaveBeenCalled();
  });
  it("seeks past a candidate where all eligible cards are started or audio is invalid", async () => {
    const { db, repository } = harness();
    db.courseLevel.findFirst.mockResolvedValueOnce(level).mockResolvedValueOnce(null);
    const progress = [
      { learningItemId: "item", learningCardId: "reading", stageIndex: 1, createdAt: new Date() },
    ];
    expect(await repository.listCourseEligibility("owner", progress)).toEqual({
      items: [],
      prerequisiteItems: [],
    });
    expect(db.courseLevel.findFirst.mock.calls[1]![0].where.levelNumber).toEqual({ gt: 2 });
    expect(db.learningItem.findMany).not.toHaveBeenCalled();
  });
  it("loads only the owner's published deck items, keeping archive metadata", async () => {
    const { db, repository } = harness();
    db.deck.findFirst.mockResolvedValue({
      id: "deck",
      title: "Private",
      status: "ARCHIVED",
      items: [{ sortOrder: 7, learningItem: item }],
    });
    expect(await repository.findDeckEligibility("owner", "deck")).toMatchObject({
      id: "deck",
      status: "archived",
      items: [
        { sortOrder: 7, item: { id: "item", cards: [{ id: "meaning" }, { id: "reading" }] } },
      ],
    });
    const query = db.deck.findFirst.mock.calls[0]![0];
    expect(query.where).toEqual({ id: "deck", ownerUserId: "owner" });
    expect(query.select.items.where).toEqual({ learningItem: { status: "PUBLISHED" } });
    expect(query.select.items.select.learningItem.select).not.toHaveProperty("mnemonics");
    db.deck.findFirst.mockResolvedValue(null);
    expect(await repository.findDeckEligibility("stranger", "deck")).toBeNull();
  });
  it("does not select a deck graph when only ownership/status is needed", async () => {
    const { db, repository } = harness();
    db.deck.findFirst.mockResolvedValue({ id: "deck", title: "Private", status: "ACTIVE" });
    expect(await repository.findDeckEligibility("owner", "deck", false)).toMatchObject({
      items: [],
    });
    expect(db.deck.findFirst.mock.calls[0]![0].select).not.toHaveProperty("items");
  });
});
