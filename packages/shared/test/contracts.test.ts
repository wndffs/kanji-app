import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  SUPPORTED_CONTENT_LOCALES,
  getContentLocalesForDisplayMode,
  isContentLocale,
  isTranslationDisplayMode,
  workspacePackages,
  type DashboardDto,
  type LearningCardDto,
} from "../src";

describe("workspacePackages", () => {
  it("lists the required domain packages", () => {
    expect(workspacePackages.map((pkg) => pkg.name)).toEqual([
      "@kanji-srs/db",
      "@kanji-srs/srs",
      "@kanji-srs/japanese",
      "@kanji-srs/content-importers",
      "@kanji-srs/shared",
      "@kanji-srs/ui",
    ]);
  });
});

describe("translation display modes", () => {
  it("defines supported bilingual content locales", () => {
    expect(SUPPORTED_CONTENT_LOCALES).toEqual(["ru-RU", "en-US"]);
    expect(DEFAULT_TRANSLATION_DISPLAY_MODE).toBe("ru");
  });

  it("maps display modes to locales", () => {
    expect(getContentLocalesForDisplayMode("ru")).toEqual(["ru-RU"]);
    expect(getContentLocalesForDisplayMode("en")).toEqual(["en-US"]);
    expect(getContentLocalesForDisplayMode("ru-en")).toEqual(["ru-RU", "en-US"]);
  });

  it("guards locale and display mode strings", () => {
    expect(isContentLocale("ru-RU")).toBe(true);
    expect(isContentLocale("ja-JP")).toBe(false);
    expect(isTranslationDisplayMode("ru-en")).toBe(true);
    expect(isTranslationDisplayMode("all")).toBe(false);
  });
});

describe("shared DTO contracts", () => {
  it("keeps learning card DTOs serializable and bilingual", () => {
    const card: LearningCardDto = {
      id: "card-1",
      learningItemId: "item-1",
      itemType: "kanji",
      cardType: "review",
      promptType: "meaning",
      answerType: "meaning",
      translationDisplayMode: "ru-en",
      prompt: {
        japanese: "一",
        reading: "いち",
      },
      translations: {
        displayMode: "ru-en",
        primaryRu: "один",
        primaryEn: "one",
        ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
        en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
      },
      acceptedAnswers: [
        { locale: "ru-RU", text: "один", isPrimary: true },
        { locale: "en-US", text: "one", isPrimary: true },
      ],
      blockedAnswers: [],
      sortOrder: 1,
    };

    expect(JSON.parse(JSON.stringify(card))).toEqual(card);
    expect(card.translations.ru[0]?.text).toBe("один");
    expect(card.translations.en[0]?.text).toBe("one");
  });

  it("puts translation display mode in dashboard user settings", () => {
    const dashboard: DashboardDto = {
      user: {
        id: "user-1",
        displayName: "Demo",
        locale: "ru-RU",
        translationDisplayMode: "en",
        timezone: "Europe/Moscow",
      },
      counts: {
        dueReviews: 3,
        availableLessons: 4,
        burnedCards: 1,
      },
      currentCourse: null,
      reviewForecast: [],
      recentItems: [],
    };

    expect(dashboard.user.translationDisplayMode).toBe("en");
    expect(JSON.parse(JSON.stringify(dashboard))).toEqual(dashboard);
  });
});
