import { describe, expect, it } from "vitest";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  SUPPORTED_CONTENT_LOCALES,
  getContentLocalesForDisplayMode,
  isContentLocale,
  isTranslationDisplayMode,
  workspacePackages,
  type DashboardDto,
  type AdminImportRunListResponse,
  type DeckDetailsDto,
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
        leechCandidates: 0,
      },
      currentCourse: null,
      reviewForecast: [],
      leechCandidates: [],
      recentReviewStats: {
        since: "2026-06-11T09:00:00.000Z",
        total: 0,
        correct: 0,
        wrong: 0,
        typo: 0,
        reveal: 0,
        manualIgnore: 0,
        resurrect: 0,
        accuracy: null,
      },
      recentItems: [],
    };

    expect(dashboard.user.translationDisplayMode).toBe("en");
    expect(JSON.parse(JSON.stringify(dashboard))).toEqual(dashboard);
  });

  it("keeps admin import run responses serializable", () => {
    const response: AdminImportRunListResponse = {
      importRuns: [
        {
          id: "import-run-1",
          dataSourceName: "JMdict",
          licenseName: "EDRDG License",
          sourceVersion: "2026-06",
          sourceFileName: "JMdict_e.xml",
          checksumSha256: "sha256-test",
          status: "success",
          startedAt: "2026-06-24T10:00:00.000Z",
          finishedAt: "2026-06-24T10:01:00.000Z",
          recordCount: 12,
          stats: { entries: 12, words: 18 },
          errorText: null,
        },
      ],
    };

    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it("keeps dynamic text deck details serializable", () => {
    const deck: DeckDetailsDto = {
      id: "deck-1",
      title: "Text deck",
      description: "Dynamic text deck",
      status: "active",
      itemCount: 1,
      newItemCount: 1,
      translationDisplayMode: "ru-en",
      createdAt: "2026-06-24T09:00:00.000Z",
      updatedAt: "2026-06-24T09:00:00.000Z",
      items: [
        {
          sortOrder: 1,
          isNewForUser: true,
          reasons: [
            {
              code: "appears-in-text",
              detail: "Matched in pasted text.",
              matchedText: "学校",
            },
          ],
          item: {
            id: "item-word-school",
            itemType: "word",
            slug: "word:学校",
            japanese: "学校",
            reading: "がっこう",
            translations: {
              displayMode: "ru-en",
              primaryRu: "школа",
              primaryEn: "school",
              ru: [{ locale: "ru-RU", text: "школа", isPrimary: true }],
              en: [{ locale: "en-US", text: "school", isPrimary: true }],
            },
            level: 1,
            jlptLevel: "N5",
            srs: null,
          },
        },
      ],
    };

    expect(JSON.parse(JSON.stringify(deck))).toEqual(deck);
    expect(deck.items[0]?.reasons[0]?.code).toBe("appears-in-text");
  });
});
