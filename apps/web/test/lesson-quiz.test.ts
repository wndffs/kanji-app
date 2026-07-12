import { describe, expect, it } from "vitest";

import { type LearningCardDto, type LessonQueueItem } from "@kanji-srs/shared";

import { advanceLessonQuizCardQueue, buildLessonQuizQueue } from "../src/lib/lesson-quiz";

describe("buildLessonQuizQueue", () => {
  it("creates a stable quiz order without mutating study order", () => {
    const lessons = [createLesson("one"), createLesson("two"), createLesson("three")];
    const originalItemIds = lessons.map((lesson) => lesson.item.id);
    const originalCardIds = lessons.map((lesson) => lesson.cards.map((card) => card.id));
    const first = buildLessonQuizQueue(lessons, "session-stable");
    const second = buildLessonQuizQueue(lessons, "session-stable");

    expect(first.map((lesson) => lesson.item.id)).toEqual(second.map((lesson) => lesson.item.id));
    expect(first.map((lesson) => lesson.cards.map((card) => card.id))).toEqual(
      second.map((lesson) => lesson.cards.map((card) => card.id)),
    );
    expect(lessons.map((lesson) => lesson.item.id)).toEqual(originalItemIds);
    expect(lessons.map((lesson) => lesson.cards.map((card) => card.id))).toEqual(originalCardIds);
    expect(first.every((lesson) => lesson.cards[0]?.answerType === "reading")).toBe(true);
  });

  it("keeps the relative item order stable when completed items disappear after reload", () => {
    const lessons = [
      createLesson("one"),
      createLesson("two"),
      createLesson("three"),
      createLesson("four"),
    ];
    const fullOrder = buildLessonQuizQueue(lessons, "session-resume").map(
      (lesson) => lesson.item.id,
    );
    const remainingLessons = lessons.filter((lesson) => lesson.item.id !== fullOrder[0]);
    const remainingOrder = buildLessonQuizQueue(remainingLessons, "session-resume").map(
      (lesson) => lesson.item.id,
    );

    expect(remainingOrder).toEqual(fullOrder.slice(1));
  });
});

describe("advanceLessonQuizCardQueue", () => {
  it("removes an accepted card from the pending queue", () => {
    expect(
      advanceLessonQuizCardQueue(["card-one", "card-two"], createFeedback("card-one", true)),
    ).toEqual(["card-two"]);
  });

  it("moves a missed card behind the remaining cards", () => {
    expect(
      advanceLessonQuizCardQueue(
        ["card-one", "card-two", "card-three"],
        createFeedback("card-one", false),
      ),
    ).toEqual(["card-two", "card-three", "card-one"]);
  });

  it("does not change the queue for stale feedback", () => {
    const queue = ["card-one", "card-two"];

    expect(advanceLessonQuizCardQueue(queue, createFeedback("card-two", true))).toBe(queue);
  });
});

function createLesson(id: string): LessonQueueItem {
  return {
    item: {
      id: `item-${id}`,
      itemType: "kanji",
      slug: `kanji:${id}`,
      japanese: id,
      reading: "かな",
      translations: {
        displayMode: "ru-en",
        primaryRu: id,
        primaryEn: id,
        ru: [{ locale: "ru-RU", text: id }],
        en: [{ locale: "en-US", text: id }],
      },
      level: 1,
      jlptLevel: "N5",
      srs: null,
    },
    cards: [createCard(id, "meaning"), createCard(id, "reading")],
    unlockedBy: [],
    mnemonics: [],
    hints: [],
    exampleSentences: [],
  };
}

function createCard(id: string, answerType: "meaning" | "reading"): LearningCardDto {
  return {
    id: `card-${id}-${answerType}`,
    learningItemId: `item-${id}`,
    itemType: "kanji",
    cardType: "lesson",
    promptType: answerType,
    answerType,
    translationDisplayMode: "ru-en",
    prompt: { japanese: id, reading: "かな" },
    translations: {
      displayMode: "ru-en",
      primaryRu: id,
      primaryEn: id,
      ru: [{ locale: "ru-RU", text: id }],
      en: [{ locale: "en-US", text: id }],
    },
    acceptedAnswers: [{ locale: "ru-RU", text: id }],
    blockedAnswers: [],
    sortOrder: answerType === "meaning" ? 1 : 2,
  };
}

function createFeedback(cardId: string, accepted: boolean) {
  return {
    cardId,
    answerType: "meaning" as const,
    accepted,
    result: accepted ? ("correct" as const) : ("wrong" as const),
    normalizedAnswer: accepted ? "one" : "wrong",
    expected: [],
  };
}
