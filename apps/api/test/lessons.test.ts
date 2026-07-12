import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateAnswer } from "@kanji-srs/japanese";

import { type CurrentUserDto } from "../src/auth/auth.types";
import { LessonsRepository } from "../src/lessons/lessons.repository";
import { LessonsService } from "../src/lessons/lessons.service";
import type { OverridesService } from "../src/overrides/overrides.service";
import {
  type CompleteLessonItemInput,
  type CompletedLessonItemRecord,
  type CourseLessonItemRecord,
  type DeckLessonRecord,
  type LessonItemRecord,
  type LessonSessionRecord,
  type SrsSystemRecord,
  type UserItemProgressRecord,
} from "../src/lessons/lessons.types";

const NOW = new Date("2026-06-18T09:00:00.000Z");

describe("LessonsService", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns no lessons without active enrollment", async () => {
    const service = createService({ courseItems: [] });

    await expect(service.getQueue(createUser("owner"))).resolves.toEqual({
      items: [],
      availableItems: [],
      batchLimit: 5,
      remainingToday: 10,
      source: { kind: "course" },
    });
  });

  it("returns first-level lessons that have no prerequisites", async () => {
    const service = createService();

    await expect(service.getQueue(createUser("owner"))).resolves.toMatchObject({
      items: [{ item: { id: "item-component-one" } }, { item: { id: "item-component-two" } }],
      availableItems: [
        { item: { id: "item-component-one" } },
        { item: { id: "item-component-two" } },
      ],
    });
  });

  it("locks dependent items until prerequisite stage threshold is reached", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());

    await expect(service.getQueue(createUser("owner"))).resolves.toMatchObject({
      items: expect.not.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ id: "item-kanji-one" }) }),
        expect.objectContaining({ item: expect.objectContaining({ id: "item-word-one" }) }),
      ]),
    });

    repository.addProgress("owner", "item-component-one", ["card-component-one"], 1);

    await expect(service.getQueue(createUser("owner"))).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ id: "item-kanji-one" }) }),
      ]),
    });

    repository.addProgress(
      "owner",
      "item-kanji-one",
      ["card-kanji-one-meaning", "card-kanji-one-reading"],
      1,
    );

    await expect(service.getQueue(createUser("owner"))).resolves.toMatchObject({
      items: expect.not.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ id: "item-word-one" }) }),
      ]),
    });

    repository.addProgress(
      "owner",
      "item-kanji-one",
      ["card-kanji-one-meaning", "card-kanji-one-reading"],
      2,
    );

    await expect(service.getQueue(createUser("owner"))).resolves.toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ item: expect.objectContaining({ id: "item-word-one" }) }),
      ]),
    });
  });

  it("creates initial SRS states when completing a lesson item", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());
    const session = await service.startSession(createUser("owner"));

    const response = await service.completeItem(session.session.id, createUser("owner"), {
      itemId: "item-component-one",
      answers: [
        {
          cardId: "card-component-one",
          answerType: "meaning",
          answer: "study",
        },
      ],
    });

    expect(response).toMatchObject({
      itemId: "item-component-one",
      passed: true,
      createdSrsStateCount: 1,
      answers: [expect.objectContaining({ cardId: "card-component-one", accepted: true })],
      cards: [
        {
          cardId: "card-component-one",
          srs: {
            stageIndex: 1,
            stageName: "Apprentice 1",
            availableAt: "2026-06-18T13:00:00.000Z",
          },
        },
      ],
    });
    expect(response.answers[0]?.expected[0]).toEqual({
      locale: "en-US",
      text: "study",
      isPrimary: true,
      sourceKind: "curated",
    });
    expect(repository.listProgressFor("owner", "item-component-one")).toMatchObject([
      {
        learningCardId: "card-component-one",
        stageIndex: 1,
      },
    ]);
  });

  it("does not create SRS states until every lesson answer is accepted", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());
    const session = await service.startSession(createUser("owner"));

    const response = await service.completeItem(session.session.id, createUser("owner"), {
      itemId: "item-component-one",
      answers: [
        {
          cardId: "card-component-one",
          answerType: "meaning",
          answer: "wrong answer",
        },
      ],
    });

    expect(response).toMatchObject({
      itemId: "item-component-one",
      passed: false,
      createdSrsStateCount: 0,
      answers: [
        {
          cardId: "card-component-one",
          accepted: false,
          result: "wrong",
        },
      ],
      cards: [],
    });
    expect(repository.listProgressFor("owner", "item-component-one")).toEqual([]);
  });

  it("requires exactly one matching answer for every card", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());
    const session = await service.startSession(createUser("owner"));

    await expect(
      service.completeItem(session.session.id, createUser("owner"), {
        itemId: "item-component-one",
        answers: [
          {
            cardId: "card-component-one",
            answerType: "reading",
            answer: "study",
          },
        ],
      }),
    ).rejects.toThrow("answerType must be meaning for card card-component-one");
    expect(repository.listProgressFor("owner", "item-component-one")).toEqual([]);
  });

  it("caps the suggested batch at five while exposing the eligible daily pool", async () => {
    const courseItems = Array.from({ length: 7 }, (_, index) =>
      createCourseItem(
        createItem(`item-component-${index}`, "component", [`card-component-${index}`]),
        index + 1,
      ),
    );
    const service = createService({ courseItems });

    const queue = await service.getQueue(createUser("owner"));

    expect(queue.items).toHaveLength(5);
    expect(queue.availableItems).toHaveLength(7);
    expect(queue).toMatchObject({ batchLimit: 5, remainingToday: 10 });
  });

  it("respects the user's daily lesson limit", async () => {
    const service = createService();

    await expect(service.getQueue(createUser("owner", { dailyLessonLimit: 1 }))).resolves.toEqual({
      items: [
        expect.objectContaining({
          item: expect.objectContaining({ id: "item-component-one" }),
        }),
      ],
      availableItems: [
        expect.objectContaining({
          item: expect.objectContaining({ id: "item-component-one" }),
        }),
      ],
      batchLimit: 5,
      remainingToday: 1,
      source: { kind: "course" },
    });
  });

  it("applies the daily lesson limit in the user's timezone", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());

    repository.addProgress(
      "owner",
      "item-component-two",
      ["card-component-two"],
      1,
      new Date("2026-06-17T22:30:00.000Z"),
    );

    await expect(
      service.getQueue(
        createUser("owner", {
          dailyLessonLimit: 1,
          timezone: "Europe/Moscow",
        }),
      ),
    ).resolves.toEqual({
      items: [],
      availableItems: [],
      batchLimit: 5,
      remainingToday: 0,
      source: { kind: "course" },
    });

    await expect(
      service.getQueue(
        createUser("owner", {
          dailyLessonLimit: 1,
          timezone: "America/Los_Angeles",
        }),
      ),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({
          item: expect.objectContaining({ id: "item-component-one" }),
        }),
      ],
      availableItems: [
        expect.objectContaining({
          item: expect.objectContaining({ id: "item-component-one" }),
        }),
      ],
      batchLimit: 5,
      remainingToday: 1,
      source: { kind: "course" },
    });
  });

  it("uses an owned active deck as a prerequisite-safe lesson source", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());

    await expect(service.getQueue(createUser("owner"), "deck-study")).resolves.toMatchObject({
      source: { kind: "deck", deckId: "deck-study", title: "Study text" },
      items: [{ item: { id: "item-component-one" } }],
      availableItems: [{ item: { id: "item-component-one" } }],
    });

    repository.addProgress("owner", "item-component-one", ["card-component-one"], 1);

    await expect(service.getQueue(createUser("owner"), "deck-study")).resolves.toMatchObject({
      items: [{ item: { id: "item-kanji-one" } }],
    });
    await expect(service.getQueue(createUser("other"), "deck-study")).rejects.toThrow(
      "Deck not found.",
    );
  });

  it("binds lesson completion to the deck stored in the session", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());
    const session = await service.startSession(createUser("owner"), { deckId: "deck-study" });

    expect(session.session.deckId).toBe("deck-study");
    await expect(
      service.completeItem(session.session.id, createUser("owner"), {
        itemId: "item-component-two",
        answers: [
          {
            cardId: "card-component-two",
            answerType: "meaning",
            answer: "study",
          },
        ],
      }),
    ).rejects.toThrow("Lesson item is not currently available.");
  });

  it("finishes an existing deck lesson after the deck is archived", async () => {
    const repository = new InMemoryLessonsRepository();
    const service = new LessonsService(repository, createOverridesService());
    const session = await service.startSession(createUser("owner"), { deckId: "deck-study" });

    repository.setDeckStatus("archived");

    await expect(
      service.completeItem(session.session.id, createUser("owner"), {
        itemId: "item-component-one",
        answers: [
          {
            cardId: "card-component-one",
            answerType: "meaning",
            answer: "study",
          },
        ],
      }),
    ).resolves.toMatchObject({ passed: true, createdSrsStateCount: 1 });
    await expect(service.getQueue(createUser("owner"), "deck-study")).rejects.toThrow(
      "Deck not found.",
    );
  });
});

class InMemoryLessonsRepository extends LessonsRepository {
  private readonly courseItems: readonly CourseLessonItemRecord[];
  private readonly progress: UserItemProgressRecord[];
  private readonly sessions = new Map<string, LessonSessionRecord>();
  private deckStatus: DeckLessonRecord["status"] = "active";
  private nextSessionId = 1;

  constructor(options: { readonly courseItems?: readonly CourseLessonItemRecord[] } = {}) {
    super();
    this.courseItems = options.courseItems ?? createCourseItems();
    this.progress = [];
  }

  async listCourseLessonItems(_userId: string): Promise<readonly CourseLessonItemRecord[]> {
    return this.courseItems;
  }

  async findDeckLesson(userId: string, deckId: string): Promise<DeckLessonRecord | null> {
    return userId === "owner" && deckId === "deck-study" ? createDeckLesson(this.deckStatus) : null;
  }

  async listUserProgress(userId: string): Promise<readonly UserItemProgressRecord[]> {
    return this.progress
      .filter((record) => record.learningItemId.startsWith(`${userId}:`))
      .map((record) => ({
        ...record,
        learningItemId: record.learningItemId.slice(`${userId}:`.length),
      }));
  }

  async getDefaultSrsSystem(): Promise<SrsSystemRecord | null> {
    return {
      id: "srs-default",
      stages: [
        {
          stageIndex: 1,
          name: "Apprentice 1",
          intervalMinutes: 240,
          isBurned: false,
        },
        {
          stageIndex: 2,
          name: "Apprentice 2",
          intervalMinutes: 480,
          isBurned: false,
        },
      ],
    };
  }

  async createLessonSession(
    userId: string,
    now: Date,
    deckId: string | null,
  ): Promise<LessonSessionRecord> {
    const session: LessonSessionRecord = {
      id: `lesson-session-${this.nextSessionId++}`,
      userId,
      startedAt: now,
      finishedAt: null,
      mode: "lesson",
      deckId,
    };

    this.sessions.set(session.id, session);

    return session;
  }

  async findActiveLessonSession(
    userId: string,
    sessionId: string,
  ): Promise<LessonSessionRecord | null> {
    const session = this.sessions.get(sessionId);

    return session === undefined || session.userId !== userId || session.finishedAt !== null
      ? null
      : session;
  }

  async completeLessonItem(input: CompleteLessonItemInput): Promise<CompletedLessonItemRecord> {
    let created = 0;

    for (const card of input.item.cards) {
      const itemKey = `${input.userId}:${input.item.id}`;
      const exists = this.progress.some(
        (record) => record.learningItemId === itemKey && record.learningCardId === card.id,
      );

      if (exists) {
        continue;
      }

      this.progress.push({
        learningItemId: itemKey,
        learningCardId: card.id,
        stageIndex: input.initialStageIndex,
        createdAt: NOW,
      });
      created += 1;
    }

    return { createdSrsStateCount: created };
  }

  async finishLessonSession(
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<LessonSessionRecord | null> {
    const session = await this.findActiveLessonSession(userId, sessionId);

    if (session === null) {
      return null;
    }

    const finished = {
      ...session,
      finishedAt: now,
    };
    this.sessions.set(sessionId, finished);

    return finished;
  }

  addProgress(
    userId: string,
    itemId: string,
    cardIds: readonly string[],
    stageIndex: number,
    createdAt = new Date("2026-06-17T09:00:00.000Z"),
  ): void {
    const itemKey = `${userId}:${itemId}`;

    for (const cardId of cardIds) {
      const existingIndex = this.progress.findIndex(
        (record) => record.learningItemId === itemKey && record.learningCardId === cardId,
      );
      const record = {
        learningItemId: itemKey,
        learningCardId: cardId,
        stageIndex,
        createdAt,
      };

      if (existingIndex === -1) {
        this.progress.push(record);
      } else {
        this.progress[existingIndex] = record;
      }
    }
  }

  listProgressFor(userId: string, itemId: string): readonly UserItemProgressRecord[] {
    return this.progress.filter((record) => record.learningItemId === `${userId}:${itemId}`);
  }

  setDeckStatus(status: DeckLessonRecord["status"]): void {
    this.deckStatus = status;
  }
}

function createService(
  options: { readonly courseItems?: readonly CourseLessonItemRecord[] } = {},
): LessonsService {
  return new LessonsService(new InMemoryLessonsRepository(options), createOverridesService());
}

function createOverridesService(): OverridesService {
  return {
    validateAnswerForUser: async (input) =>
      validateAnswer({
        answerKind: input.answerKind,
        answer: input.answer,
        acceptedAnswers: [input.answerKind === "reading" ? "がく" : "study"],
        blockedAnswers: [],
        userAcceptedAnswers: [],
      }),
  } as OverridesService;
}

function createCourseItems(): readonly CourseLessonItemRecord[] {
  const items = [
    createCourseItem(createItem("item-component-one", "component", ["card-component-one"]), 1),
    createCourseItem(createItem("item-component-two", "component", ["card-component-two"]), 4),
    createCourseItem(
      createItem(
        "item-kanji-one",
        "kanji",
        ["card-kanji-one-meaning", "card-kanji-one-reading"],
        [{ prerequisiteItemId: "item-component-one", requiredStage: 1 }],
      ),
      2,
    ),
    createCourseItem(
      createItem(
        "item-word-one",
        "word",
        ["card-word-one-meaning"],
        [{ prerequisiteItemId: "item-kanji-one", requiredStage: 2 }],
      ),
      3,
    ),
  ];

  return items;
}

function createDeckLesson(status: DeckLessonRecord["status"]): DeckLessonRecord {
  const courseItems = createCourseItems();

  return {
    id: "deck-study",
    title: "Study text",
    status,
    items: courseItems
      .filter((entry) => ["item-component-one", "item-kanji-one"].includes(entry.item.id))
      .map((entry) => ({ sortOrder: entry.sortOrder, item: entry.item })),
  };
}

function createCourseItem(item: LessonItemRecord, sortOrder: number): CourseLessonItemRecord {
  return {
    courseId: "course-demo",
    courseLevelNumber: 1,
    sortOrder,
    item,
    unlockPolicy: { policy: "level-order" },
  };
}

function createItem(
  id: string,
  itemType: LessonItemRecord["itemType"],
  cardIds: readonly string[],
  dependencies: LessonItemRecord["dependencies"] = [],
): LessonItemRecord {
  const japanese = itemType === "word" ? "学校" : itemType === "kanji" ? "学" : "一";
  const reading = itemType === "component" ? null : itemType === "kanji" ? "がく" : "がっこう";

  return {
    id,
    itemType,
    title: id,
    level: 1,
    target: {
      japanese,
      reading,
      jlptLevel: "N5",
      translations: {
        ru: [{ locale: "ru-RU", text: "учеба", isPrimary: true, sourceKind: "curated" }],
        en: [{ locale: "en-US", text: "study", isPrimary: true, sourceKind: "curated" }],
      },
    },
    cards: cardIds.map((cardId, index) => ({
      id: cardId,
      learningItemId: id,
      itemType,
      cardType: "review",
      promptType: index === 1 ? "reading" : "meaning",
      answerType: index === 1 ? "reading" : "meaning",
      sortOrder: index + 1,
      answers: [
        {
          locale: "en-US",
          text: index === 1 ? "がく" : "study",
          normalizedText: index === 1 ? "がく" : "study",
          answerKind: index === 1 ? "reading" : "meaning",
          isPrimary: true,
          sourceKind: "curated",
        },
      ],
      blockedAnswers: [],
    })),
    dependencies,
  };
}

function createUser(
  id: string,
  settings: Partial<CurrentUserDto["settings"]> = {},
): CurrentUserDto {
  return {
    id,
    email: `${id}@example.test`,
    displayName: id,
    role: "USER",
    settings: {
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dailyLessonLimit: 10,
      reviewBudget: 20,
      strictMode: false,
      ...settings,
    },
  };
}
