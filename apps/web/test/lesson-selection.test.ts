import { describe, expect, it } from "vitest";

import { type ItemKind, type LessonQueueItem } from "@kanji-srs/shared";

import {
  boundedLessonSelection,
  lessonBatchCapacity,
  lessonSelectionCardCount,
  orderLessonSelection,
} from "../src/lib/lesson-selection";

describe("orderLessonSelection", () => {
  it("caps recommendations to eligible unique materials and the remaining daily allowance", () => {
    const lessons = [createLesson("one", "kanji"), createLesson("two", "word")];
    expect(boundedLessonSelection(lessons, ["missing", "two", "two", "one"], 2)).toEqual([
      "two",
      "one",
    ]);
    expect(boundedLessonSelection(lessons, ["two", "one"], 1)).toEqual(["two"]);
    expect(lessonBatchCapacity(5, 2)).toBe(2);
    expect(lessonBatchCapacity(5, -1)).toBe(0);
    expect(lessonBatchCapacity(3.9, 20)).toBe(3);
    expect(lessonBatchCapacity(5, Number.NaN)).toBe(0);
    expect(lessonSelectionCardCount(lessons)).toBe(0);
  });
  it("preserves course order when interleaving is disabled", () => {
    const lessons = [createLesson("component-1", "component"), createLesson("kanji-1", "kanji")];

    expect(orderLessonSelection(lessons, "course").map(toId)).toEqual(["component-1", "kanji-1"]);
    expect(orderLessonSelection(lessons, "course")).not.toBe(lessons);
  });

  it("alternates item types while preserving order within each type", () => {
    const lessons = [
      createLesson("component-1", "component"),
      createLesson("component-2", "component"),
      createLesson("kanji-1", "kanji"),
      createLesson("word-1", "word"),
      createLesson("component-3", "component"),
    ];

    expect(orderLessonSelection(lessons, "interleaved").map(toId)).toEqual([
      "component-1",
      "kanji-1",
      "word-1",
      "component-2",
      "component-3",
    ]);
  });
});

function createLesson(id: string, itemType: ItemKind): LessonQueueItem {
  return {
    item: {
      id,
      itemType,
      slug: `${itemType}:${id}`,
      japanese: id,
      reading: null,
      translations: {
        displayMode: "ru-en",
        primaryRu: null,
        primaryEn: null,
        ru: [],
        en: [],
      },
      level: null,
      jlptLevel: null,
      srs: null,
    },
    cards: [],
    unlockedBy: [],
    mnemonics: [],
    hints: [],
    exampleSentences: [],
  };
}

function toId(lesson: LessonQueueItem): string {
  return lesson.item.id;
}
