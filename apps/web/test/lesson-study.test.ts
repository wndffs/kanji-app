import { describe, expect, it } from "vitest";

import { type LessonQueueItem } from "@kanji-srs/shared";

import { getLessonPronunciationText, getLessonStudyPhases } from "../src/lib/lesson-study";

describe("getLessonStudyPhases", () => {
  it("keeps a meaning-only item on one stage", () => {
    expect(getLessonStudyPhases(createLesson())).toEqual(["meaning"]);
  });

  it("adds reading and context in learning order when content exists", () => {
    const lesson = createLesson({
      item: { ...createLesson().item, reading: "いち" },
      mnemonics: [
        {
          purpose: "story",
          texts: {
            ru: [{ locale: "ru-RU", text: "История" }],
            en: [{ locale: "en-US", text: "Story" }],
          },
        },
      ],
    });

    expect(getLessonStudyPhases(lesson)).toEqual(["meaning", "reading", "context"]);
  });

  it("skips reading while retaining context when an item has no reading material", () => {
    const lesson = createLesson({
      hints: [
        {
          purpose: "usage",
          texts: {
            ru: [{ locale: "ru-RU", text: "Употребление" }],
            en: [{ locale: "en-US", text: "Usage" }],
          },
        },
      ],
    });

    expect(getLessonStudyPhases(lesson)).toEqual(["meaning", "context"]);
  });
});

describe("getLessonPronunciationText", () => {
  it("prefers the item reading and falls back to an accepted reading answer", () => {
    const explicit = createLesson({ item: { ...createLesson().item, reading: " いち " } });
    const answerOnly = createLesson({
      cards: [
        {
          id: "card-reading",
          learningItemId: "item-one",
          itemType: "kanji",
          cardType: "lesson",
          promptType: "reading",
          answerType: "reading",
          translationDisplayMode: "ru-en",
          prompt: { japanese: "一", reading: null },
          translations: createLesson().item.translations,
          acceptedAnswers: [{ locale: "ru-RU", text: "いち" }],
          blockedAnswers: [],
          sortOrder: 1,
        },
      ],
    });

    expect(getLessonPronunciationText(explicit)).toBe("いち");
    expect(getLessonPronunciationText(answerOnly)).toBe("いち");
    expect(getLessonPronunciationText(createLesson())).toBeNull();
  });
});

function createLesson(overrides: Partial<LessonQueueItem> = {}): LessonQueueItem {
  return {
    item: {
      id: "item-one",
      itemType: "kanji",
      slug: "kanji:一",
      japanese: "一",
      reading: null,
      translations: {
        displayMode: "ru-en",
        primaryRu: "один",
        primaryEn: "one",
        ru: [{ locale: "ru-RU", text: "один" }],
        en: [{ locale: "en-US", text: "one" }],
      },
      level: 1,
      jlptLevel: "N5",
      srs: null,
    },
    cards: [],
    unlockedBy: [],
    mnemonics: [],
    hints: [],
    exampleSentences: [],
    ...overrides,
  };
}
