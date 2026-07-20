import { describe, expect, it } from "vitest";

import {
  ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS,
  ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS,
  DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  SUPPORTED_CONTENT_LOCALES,
  SUPPORTED_COURSE_BANDS,
  getContentLocalesForDisplayMode,
  isContentLocale,
  isCourseBand,
  isLessonOrderMode,
  isReviewOrderMode,
  isTranslationDisplayMode,
  normalizeDashboardWidgetPreferences,
  workspacePackages,
  type AdminCurriculumCompletenessReportDto,
  type AdminReviewQueueResponse,
  type ActiveLessonSessionResponse,
  type DashboardDto,
  type AdminImportRunListResponse,
  type AdminImportedCandidateRejectionListResponse,
  type DeckDetailsDto,
  type LearningCardDto,
  type LessonQueueItem,
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

describe("lesson settings", () => {
  it("accepts only supported lesson order modes", () => {
    expect(isLessonOrderMode("course")).toBe(true);
    expect(isLessonOrderMode("interleaved")).toBe(true);
    expect(isLessonOrderMode("random")).toBe(false);
  });
});

describe("review settings", () => {
  it("accepts only supported review order modes", () => {
    expect(isReviewOrderMode("shuffled")).toBe(true);
    expect(isReviewOrderMode("oldest-first")).toBe(true);
    expect(isReviewOrderMode("lower-levels-first")).toBe(true);
    expect(isReviewOrderMode("future-first")).toBe(false);
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

describe("course bands", () => {
  it("defines Foundation through N2 course bands", () => {
    expect(SUPPORTED_COURSE_BANDS).toEqual(["foundation", "n5", "n4", "n3", "n2"]);
    expect(isCourseBand("n2")).toBe(true);
    expect(isCourseBand("n1")).toBe(false);
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

  it("keeps lesson memory content bilingual and separated by purpose", () => {
    const memoryContent = {
      mnemonics: [
        {
          purpose: "story",
          texts: {
            ru: [{ locale: "ru-RU", text: "Личная история", sourceKind: "user" }],
            en: [{ locale: "en-US", text: "Personal story", sourceKind: "user" }],
          },
        },
      ],
      hints: [
        {
          purpose: "usage",
          texts: {
            ru: [{ locale: "ru-RU", text: "Подсказка по употреблению" }],
            en: [{ locale: "en-US", text: "Usage hint" }],
          },
        },
      ],
    } satisfies Pick<LessonQueueItem, "mnemonics" | "hints">;

    expect(JSON.parse(JSON.stringify(memoryContent))).toEqual(memoryContent);
    expect(memoryContent.mnemonics[0]?.purpose).toBe("story");
    expect(memoryContent.hints[0]?.purpose).toBe("usage");
  });

  it("keeps resumable lesson session progress serializable", () => {
    const response: ActiveLessonSessionResponse = {
      session: {
        id: "lesson-session-1",
        startedAt: "2026-07-13T08:00:00.000Z",
        finishedAt: null,
        mode: "lesson",
        deckId: null,
        itemIds: ["item-one", "item-two"],
        currentItemId: "item-two",
        phase: "reading",
      },
      items: [],
      source: { kind: "course" },
      completedItemCount: 1,
      createdSrsStateCount: 2,
    };

    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it("puts translation display mode in dashboard user settings", () => {
    const dashboard: DashboardDto = {
      user: {
        id: "user-1",
        displayName: "Demo",
        locale: "ru-RU",
        translationDisplayMode: "en",
        timezone: "Europe/Moscow",
        dashboardWidgets: DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
      },
      counts: {
        dueReviews: 3,
        availableLessons: 4,
        burnedCards: 1,
        leechCandidates: 0,
      },
      currentCourse: null,
      workload: {
        reviews: {
          dueNow: 3,
          next24Hours: 2,
          laterThisWeek: 4,
          budget: 20,
          pressurePercent: 25,
        },
        lessons: {
          completedToday: 1,
          remainingToday: 9,
          dailyLimit: 10,
          percent: 10,
        },
      },
      reviewForecast: [],
      srsStageSpread: [],
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
      recentActivity: {
        mistakes: [],
        availableLessons: [],
        burned: [],
      },
      studyActivity: {
        rangeStart: "2025-06-19",
        rangeEnd: "2026-06-18",
        currentStreak: 0,
        longestStreak: 0,
        activeDays: 0,
        totalReviews: 0,
        totalLessons: 0,
        days: [],
      },
    };

    expect(dashboard.user.translationDisplayMode).toBe("en");
    expect(JSON.parse(JSON.stringify(dashboard))).toEqual(dashboard);
  });

  it("normalizes persisted dashboard widgets without losing a valid custom order", () => {
    const preferences = normalizeDashboardWidgetPreferences([
      { id: "review-forecast", visible: false, presentation: "expanded" },
      { id: "summary", visible: true, presentation: "compact" },
      { id: "summary", visible: false, presentation: "expanded" },
      { id: "unknown", visible: true, presentation: "compact" },
    ]);

    expect(preferences.slice(0, 2)).toEqual([
      { id: "review-forecast", visible: false, presentation: "expanded" },
      { id: "summary", visible: true, presentation: "compact" },
    ]);
    expect(preferences).toHaveLength(DEFAULT_DASHBOARD_WIDGET_PREFERENCES.length);
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

  it("keeps imported candidate rejection reasons bounded and serializable", () => {
    const response: AdminImportedCandidateRejectionListResponse = {
      rejections: [
        {
          id: "rejection-1",
          targetType: "word",
          targetId: "word-1",
          japanese: "水",
          reading: "みず",
          reason: "data-quality",
          note: "Source row needs correction.",
          rejectedByUserId: "admin-1",
          createdAt: "2026-07-13T16:00:00.000Z",
          updatedAt: "2026-07-13T16:00:00.000Z",
        },
      ],
    };

    expect(ADMIN_IMPORTED_CANDIDATE_REJECTION_REASONS).toEqual([
      "duplicate",
      "out-of-scope",
      "data-quality",
      "low-educational-value",
      "other",
    ]);
    expect(JSON.parse(JSON.stringify(response))).toEqual(response);
  });

  it("keeps candidate-plan coverage filters bounded", () => {
    expect(ADMIN_CANDIDATE_PLAN_COVERAGE_FILTERS).toEqual([
      "bilingual",
      "missing-russian",
      "missing-english",
      "missing-reading",
      "missing-stroke-data",
    ]);
  });

  it("keeps admin curriculum review and completeness DTOs serializable", () => {
    const queue: AdminReviewQueueResponse = {
      items: [
        {
          id: "item-word-empty",
          itemType: "word",
          band: "n5",
          title: "Word candidate",
          japanese: "空",
          reading: "そら",
          level: 8,
          jlptLevel: "N5",
          status: "needs-review",
          updatedAt: "2026-06-24T10:00:00.000Z",
          sourceNames: ["JMdict"],
          qualityIssues: [
            {
              code: "missing-accepted-answer",
              message: "Missing accepted answer.",
              cardId: "card-empty",
              dependencyItemId: null,
            },
          ],
        },
      ],
      pagination: { limit: 20, nextCursor: "next-page" },
    };
    const report: AdminCurriculumCompletenessReportDto = {
      generatedAt: "2026-06-24T10:00:00.000Z",
      bands: [
        {
          band: "n5",
          totalItems: 1,
          publishedItems: 0,
          draftItems: 0,
          needsReviewItems: 1,
          archivedItems: 0,
          importDerivedCandidates: 1,
          missingAcceptedAnswers: 1,
          missingMnemonics: 1,
          missingLocaleCoverage: 1,
          missingAttribution: 1,
          invalidDependencies: 1,
        },
      ],
    };

    expect(JSON.parse(JSON.stringify(queue))).toEqual(queue);
    expect(JSON.parse(JSON.stringify(report))).toEqual(report);
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
