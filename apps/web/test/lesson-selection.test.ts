import { describe, expect, it } from "vitest";

import { type ItemKind, type LessonQueueItem } from "@kanji-srs/shared";

import { orderLessonSelection } from "../src/lib/lesson-selection";

describe("orderLessonSelection", () => {
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
    mnemonics: { ru: [], en: [] },
    hints: { ru: [], en: [] },
  };
}

function toId(lesson: LessonQueueItem): string {
  return lesson.item.id;
}
