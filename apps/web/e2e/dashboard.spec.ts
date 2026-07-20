import { expect, type Page, test } from "@playwright/test";

import {
  DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
  type DashboardWidgetPreferenceDto,
  type ItemKind,
  type ItemSummary,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("dashboard smoke", () => {
  test("loads the dashboard shell", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveTitle("Кандзи SRS");
    await expect(page.getByRole("link", { name: "Кандзи SRS" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Панель" })).toBeVisible();
    await expect(page.getByText("Нужен вход в аккаунт.")).toBeVisible();
    await expect(page.getByLabel("Режим перевода карточек")).toBeVisible();
  });

  test("displays forecast bucket due counts", async ({ page }) => {
    await signIn(page);

    await page.route(`${API_BASE_URL}/courses`, async (route) => {
      await route.fulfill({ json: buildCourseList("course-1") });
    });

    await page.route(`${API_BASE_URL}/dashboard`, async (route) => {
      await route.fulfill({
        json: {
          user: {
            id: "user-1",
            displayName: "Тестовый ученик",
            locale: "ru-RU",
            translationDisplayMode: "ru-en",
            timezone: "Europe/Moscow",
            dashboardWidgets: DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
          },
          counts: {
            dueReviews: 4,
            availableLessons: 2,
            burnedCards: 1,
            leechCandidates: 1,
          },
          newLearnerGuide: {
            kana: {
              hiragana: { masteredCount: 46, totalCount: 46 },
              katakana: { masteredCount: 46, totalCount: 46 },
            },
            firstLessonCompleted: true,
            firstReviewCompleted: true,
          },
          currentCourse: {
            id: "course-1",
            title: "Базовый курс",
            currentLevel: 3,
            levelProgress: {
              level: 3,
              completedItems: 2,
              totalItems: 4,
              completedCards: 4,
              totalCards: 6,
              percent: 50,
              cardPercent: 67,
              pass: {
                policyVersion: 1,
                itemType: "kanji",
                stageIndex: 5,
                stageName: "Guru 1",
                requiredPercentage: 90,
                passedItems: 1,
                requiredItems: 2,
                totalItems: 2,
                percent: 50,
                currentlyPassed: false,
                completedAt: null,
              },
              itemsByType: [
                {
                  itemType: "component",
                  totalItems: 1,
                  locked: 0,
                  available: 0,
                  inProgress: 0,
                  passed: 0,
                  burned: 1,
                },
                {
                  itemType: "kanji",
                  totalItems: 2,
                  locked: 0,
                  available: 1,
                  inProgress: 1,
                  passed: 0,
                  burned: 0,
                },
                {
                  itemType: "word",
                  totalItems: 1,
                  locked: 1,
                  available: 0,
                  inProgress: 0,
                  passed: 0,
                  burned: 0,
                },
              ],
            },
            journey: {
              newlyUnlocked: {
                reviewSessionId: "review-latest",
                unlockedAt: "2026-06-24T10:00:00.000Z",
                groups: [
                  {
                    itemType: "word",
                    items: [buildRecentDashboardItem("new-word", "word", "一つ", "один предмет")],
                  },
                ],
              },
              nextLocked: {
                target: buildRecentDashboardItem("locked-word", "word", "人口", "население"),
                unmetPrerequisites: [
                  {
                    item: buildRecentDashboardItem("required-kanji", "kanji", "口", "рот"),
                    currentStage: 3,
                    requiredStage: 5,
                  },
                ],
                shortestPath: [
                  {
                    item: buildRecentDashboardItem("required-kanji", "kanji", "口", "рот"),
                    currentStage: 3,
                    requiredStage: 5,
                  },
                ],
              },
              nextAction: { kind: "review", availableAt: null },
            },
          },
          workload: {
            reviews: {
              dueNow: 4,
              next24Hours: 3,
              laterThisWeek: 1,
              budget: 100,
              pressurePercent: 7,
            },
            lessons: {
              completedToday: 2,
              remainingToday: 18,
              dailyLimit: 20,
              percent: 10,
            },
          },
          reviewForecast: [
            {
              bucketKey: "2026-06-24T15:00",
              localDate: "2026-06-24",
              localHour: 15,
              dueCount: 3,
            },
            {
              bucketKey: "2026-06-24T16:00",
              localDate: "2026-06-24",
              localHour: 16,
              dueCount: 1,
            },
          ],
          leechCandidates: [
            {
              learningCardId: "card-kanji-trouble-meaning",
              item: {
                id: "item-kanji-trouble",
                itemType: "kanji",
                slug: "kanji:困",
                japanese: "困",
                reading: "こま",
                translations: {
                  displayMode: "ru-en",
                  primaryRu: "затруднение",
                  primaryEn: "trouble",
                  ru: [{ locale: "ru-RU", text: "затруднение", isPrimary: true }],
                  en: [{ locale: "en-US", text: "trouble", isPrimary: true }],
                },
                level: 12,
                jlptLevel: "N3",
                srs: {
                  stageIndex: 4,
                  stageName: "Apprentice 4",
                  availableAt: "2026-06-24T15:00:00.000Z",
                  burnedAt: null,
                  wrongCount: 8,
                  correctStreak: 1,
                  leech: {
                    score: 29,
                    isCandidate: true,
                    wrongCount: 8,
                    correctStreak: 1,
                    recentWrongCount: 2,
                    stageDropCount: 1,
                    stageDropMagnitude: 4,
                    reasons: ["wrong-count", "recent-wrong", "stage-instability"],
                  },
                },
              },
              leech: {
                score: 29,
                isCandidate: true,
                wrongCount: 8,
                correctStreak: 1,
                recentWrongCount: 2,
                stageDropCount: 1,
                stageDropMagnitude: 4,
                reasons: ["wrong-count", "recent-wrong", "stage-instability"],
              },
            },
          ],
          recentReviewStats: {
            since: "2026-06-17T00:00:00.000Z",
            total: 0,
            correct: 0,
            wrong: 0,
            typo: 0,
            reveal: 0,
            manualIgnore: 0,
            resurrect: 0,
            accuracy: null,
          },
          srsStageSpread: [
            {
              srsSystemId: "srs-default",
              srsSystemTitle: "Основная SRS",
              totalCards: 5,
              stages: [
                {
                  stageIndex: 1,
                  name: "Apprentice 1",
                  isBurned: false,
                  totalCards: 4,
                  cardsByItemType: { component: 1, kanji: 2, word: 1, sentence: 0 },
                },
                {
                  stageIndex: 9,
                  name: "Burned",
                  isBurned: true,
                  totalCards: 1,
                  cardsByItemType: { component: 0, kanji: 0, word: 1, sentence: 0 },
                },
              ],
            },
          ],
          recentActivity: {
            mistakes: [
              {
                occurredAt: "2026-06-24T10:00:00.000Z",
                item: buildRecentDashboardItem("recent-mistake", "kanji", "困", "трудность"),
              },
            ],
            availableLessons: [
              {
                occurredAt: null,
                item: buildRecentDashboardItem("available-word", "word", "一つ", "один предмет"),
              },
            ],
            burned: [
              {
                occurredAt: "2026-06-23T10:00:00.000Z",
                item: buildRecentDashboardItem("burned-component", "component", "口", "рот"),
              },
            ],
          },
          studyActivity: {
            rangeStart: "2025-06-25",
            rangeEnd: "2026-06-24",
            currentStreak: 2,
            longestStreak: 3,
            activeDays: 3,
            totalReviews: 9,
            totalLessons: 2,
            days: [
              {
                localDate: "2026-06-22",
                reviewCount: 2,
                lessonCount: 1,
                totalCount: 3,
              },
              {
                localDate: "2026-06-23",
                reviewCount: 3,
                lessonCount: 0,
                totalCount: 3,
              },
              {
                localDate: "2026-06-24",
                reviewCount: 4,
                lessonCount: 1,
                totalCount: 5,
              },
            ],
          },
        },
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("forecast-bucket").first()).toContainText("24.06.2026, 15:00");
    await expect(page.getByTestId("forecast-bucket").first()).toContainText("3");
    await expect(page.getByTestId("forecast-bucket").nth(1)).toContainText("16:00");
    await expect(page.getByTestId("forecast-bucket").nth(1)).toContainText("1");
    await expect(page.getByTestId("srs-spread-stage")).toHaveCount(2);
    await expect(page.getByTestId("srs-spread-stage").first()).toContainText("Ученик 1");
    await expect(page.getByTestId("srs-spread-stage").last()).toContainText("Закреплено");
    await expect(page.locator(".leech-list")).toContainText("困");
    await expect(page.locator(".leech-list")).toContainText("29");
    await expect(page.getByRole("heading", { name: "Баланс нагрузки" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Нагрузка повторений 7%" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Дневной лимит уроков 10%" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Активность за год" })).toBeVisible();
    await expect(page.getByTestId("study-current-streak")).toHaveText("2");
    await expect(page.getByTestId("study-activity-day")).toHaveCount(365);
    await expect(page.locator('[data-local-date="2026-06-24"]')).toHaveAttribute(
      "data-activity-level",
      "4",
    );
    await expect(page.getByRole("progressbar", { name: "Материалы уровня 50%" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Карточки уровня 67%" })).toBeVisible();
    await expect(
      page.getByRole("progressbar", { name: "Порог уровня выполнен на 50%" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Открыто последними повторениями" }),
    ).toBeVisible();
    await expect(page.locator('.journey-item-links a[href="/items/new-word"]')).toContainText("一つ");
    await expect(page.getByRole("heading", { name: /Путь к.*人口/ })).toBeVisible();
    await expect(page.getByText("этап 3 из 5")).toBeVisible();
    await expect(page.getByLabel("Текущий курс")).toHaveValue("course-1");
    await expect(page.getByTestId("level-progress-type")).toHaveCount(3);
    await expect(page.getByTestId("level-progress-type").nth(1)).toContainText("Кандзи");
    await expect(page.getByTestId("recent-mistakes-item")).toContainText("困");
    await expect(page.getByTestId("recent-available-item")).toContainText("一つ");
    await expect(page.getByTestId("recent-burned-item")).toContainText("口");
    await expect(page.getByRole("link", { name: "Практиковать" }).first()).toHaveAttribute(
      "href",
      "/practice?source=recent-mistakes",
    );
    await expect(page.getByRole("main").getByRole("link", { name: "Практика" })).toHaveAttribute(
      "href",
      "/practice",
    );
  });

  test("shows before-completion, just-completed, and waiting journey states after reload", async ({
    page,
  }) => {
    await signIn(page);
    let phase: "before" | "completed" | "waiting" = "before";

    await page.route(`${API_BASE_URL}/courses`, async (route) => {
      await route.fulfill({ json: buildCourseList("course-1") });
    });
    await page.route(`${API_BASE_URL}/dashboard`, async (route) => {
      const dashboard = buildMinimalDashboard("course-1", "Базовый курс");
      const pass =
        phase === "before"
          ? dashboard.currentCourse.levelProgress.pass
          : {
              ...dashboard.currentCourse.levelProgress.pass,
              passedItems: phase === "completed" ? 1 : 0,
              percent: phase === "completed" ? 100 : 0,
              currentlyPassed: phase === "completed",
              completedAt: "2026-07-20T18:00:00.000Z",
            };
      const journey =
        phase === "before"
          ? dashboard.currentCourse.journey
          : phase === "completed"
            ? {
                newlyUnlocked: {
                  reviewSessionId: "review-completed",
                  unlockedAt: "2026-07-20T18:00:00.000Z",
                  groups: [
                    {
                      itemType: "word" as const,
                      items: [
                        buildRecentDashboardItem(
                          "unlocked-after-level",
                          "word",
                          "一人",
                          "один человек",
                        ),
                      ],
                    },
                  ],
                },
                nextLocked: null,
                nextAction: { kind: "lesson" as const, availableAt: null },
              }
            : {
                newlyUnlocked: null,
                nextLocked: {
                  target: buildRecentDashboardItem("waiting-word", "word", "入口", "вход"),
                  unmetPrerequisites: [
                    {
                      item: buildRecentDashboardItem("waiting-kanji", "kanji", "入", "входить"),
                      currentStage: 4,
                      requiredStage: 5,
                    },
                  ],
                  shortestPath: [
                    {
                      item: buildRecentDashboardItem("waiting-kanji", "kanji", "入", "входить"),
                      currentStage: 4,
                      requiredStage: 5,
                    },
                  ],
                },
                nextAction: {
                  kind: "wait" as const,
                  availableAt: "2026-07-21T09:00:00.000Z",
                },
              };

      await route.fulfill({
        json: {
          ...dashboard,
          currentCourse: {
            ...dashboard.currentCourse,
            levelProgress: {
              ...dashboard.currentCourse.levelProgress,
              pass,
            },
            journey,
          },
        },
      });
    });

    await page.goto("/dashboard");
    await expect(
      page.getByRole("progressbar", { name: "Порог уровня выполнен на 0%" }),
    ).toBeVisible();

    phase = "completed";
    await page.reload();
    await expect(page.getByText("Уровень завершён.")).toBeVisible();
    await expect(page.getByRole("link", { name: /一人/ })).toBeVisible();

    phase = "waiting";
    await page.reload();
    await expect(
      page.getByText("Уровень завершён; текущие этапы карточек могли снизиться после ошибок."),
    ).toBeVisible();
    await expect(page.getByText(/Следующий шаг: дождаться повторения/)).toBeVisible();
    await expect(page.getByText("этап 4 из 5")).toBeVisible();
  });

  test("guides a new learner through kana, the first lesson, and the first review", async ({
    page,
  }) => {
    await signIn(page);
    let firstLessonCompleted = false;
    let firstReviewCompleted = false;
    let dueReviews = 0;

    await page.route(`${API_BASE_URL}/courses`, async (route) => {
      await route.fulfill({ json: buildCourseList("course-1") });
    });

    await page.route(`${API_BASE_URL}/dashboard`, async (route) => {
      const dashboard = buildMinimalDashboard("course-1", "Базовый курс");
      await route.fulfill({
        json: {
          ...dashboard,
          counts: { ...dashboard.counts, dueReviews },
          newLearnerGuide: {
            kana: {
              hiragana: { masteredCount: 0, totalCount: 46 },
              katakana: { masteredCount: 0, totalCount: 46 },
            },
            firstLessonCompleted,
            firstReviewCompleted,
          },
          reviewForecast: firstLessonCompleted
            ? [
                {
                  bucketKey: "2026-07-20T22:00",
                  localDate: "2026-07-20",
                  localHour: 22,
                  dueCount: 1,
                },
              ]
            : [],
        },
      });
    });

    await page.goto("/dashboard");

    const guide = page.getByTestId("new-learner-guide");
    await expect(guide.getByRole("heading", { name: "Первый учебный цикл" })).toBeVisible();
    await expect(
      guide.getByRole("progressbar", { name: "Хирагана: освоено 0 из 46" }),
    ).toBeVisible();
    await expect(
      guide.getByRole("progressbar", { name: "Катакана: освоено 0 из 46" }),
    ).toBeVisible();
    await expect(guide.getByRole("link", { name: "Начать хирагану" })).toHaveAttribute(
      "href",
      "/kana",
    );

    firstLessonCompleted = true;
    await page.reload();
    await expect(guide.locator('li[data-status="waiting"]')).toContainText(
      "Ближайшее повторение: 20.07.2026, 22:00.",
    );
    await expect(guide.locator('li[data-status="parallel"]')).toContainText("Кана для старта");
    await expect(guide.getByRole("link", { name: "Начать хирагану" })).toBeVisible();

    dueReviews = 1;
    await page.reload();
    await expect(guide.getByRole("link", { name: "Начать первое повторение" })).toHaveAttribute(
      "href",
      "/reviews",
    );

    firstReviewCompleted = true;
    await page.reload();
    await expect(guide).toHaveCount(0);
  });

  test("switches the current course and explains an active lesson conflict", async ({ page }) => {
    await signIn(page);
    let currentCourseId = "starter-course";

    await page.route(`${API_BASE_URL}/courses`, async (route) => {
      await route.fulfill({ json: buildCourseList(currentCourseId) });
    });

    await page.route(`${API_BASE_URL}/courses/current`, async (route) => {
      const body = route.request().postDataJSON() as { readonly courseId?: string };

      if (body.courseId === "starter-course") {
        await route.fulfill({
          status: 409,
          json: { message: "Finish or abandon the active lesson before changing course." },
        });
        return;
      }

      currentCourseId = body.courseId ?? currentCourseId;
      await route.fulfill({ json: buildCourseList(currentCourseId) });
    });

    await page.route(`${API_BASE_URL}/dashboard`, async (route) => {
      await route.fulfill({
        json: buildMinimalDashboard(currentCourseId, currentCourseTitle(currentCourseId)),
      });
    });

    await page.goto("/dashboard");

    const selector = page.getByLabel("Текущий курс");
    await expect(selector).toHaveValue("starter-course");
    await selector.selectOption("main-course");
    await expect(selector).toHaveValue("main-course");
    await expect(page.getByText("Выбран курс «Основной курс».")).toBeVisible();
    await expect(page.locator(".course-progress > div").first()).toContainText("Основной курс");

    await selector.selectOption("starter-course");
    await expect(page.locator(".course-selector-error[role='alert']")).toContainText(
      "Завершите или покиньте текущий урок перед сменой курса.",
    );
    await expect(page.getByRole("link", { name: "Открыть урок" })).toHaveAttribute(
      "href",
      "/lessons",
    );
    await expect(selector).toHaveValue("main-course");
  });

  test("customizes and persists dashboard widgets", async ({ page }) => {
    await signIn(page);
    let dashboardWidgets: readonly DashboardWidgetPreferenceDto[] =
      DEFAULT_DASHBOARD_WIDGET_PREFERENCES;
    let savedWidgets: readonly DashboardWidgetPreferenceDto[] = [];

    await page.route(`${API_BASE_URL}/courses`, async (route) => {
      await route.fulfill({ json: buildCourseList("course-1") });
    });

    await page.route(`${API_BASE_URL}/dashboard`, async (route) => {
      const dashboard = buildMinimalDashboard("course-1", "Базовый курс");
      await route.fulfill({
        json: {
          ...dashboard,
          user: { ...dashboard.user, dashboardWidgets },
        },
      });
    });

    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      const body = route.request().postDataJSON() as {
        readonly dashboardWidgets?: readonly DashboardWidgetPreferenceDto[];
      };
      dashboardWidgets = body.dashboardWidgets ?? dashboardWidgets;
      savedWidgets = dashboardWidgets;

      await route.fulfill({
        json: {
          id: "user-1",
          email: "learner@example.test",
          displayName: "Тестовый ученик",
          role: "USER",
          settings: {
            locale: "ru-RU",
            translationDisplayMode: "ru-en",
            timezone: "Europe/Moscow",
            dailyLessonLimit: 20,
            reviewBudget: 100,
            strictMode: false,
            dashboardWidgets,
          },
        },
      });
    });

    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Настроить панель" }).click();
    await expect(page.getByTestId("dashboard-widget-setting")).toHaveCount(9);

    const forecastSetting = page
      .getByTestId("dashboard-widget-setting")
      .filter({ hasText: "Прогноз повторений" });
    await forecastSetting.getByRole("checkbox").uncheck();

    await page
      .getByRole("group", { name: "Размер виджета «Главные показатели»" })
      .getByRole("button", { name: "Компактно" })
      .click();
    await page.getByRole("button", { name: "Переместить «Последние ответы» выше" }).click();

    await expect(page.getByRole("heading", { name: "Прогноз" })).toBeHidden();
    await expect(page.locator('[data-dashboard-widget="summary"]')).toHaveClass(/compact/);

    await page.getByRole("button", { name: "Сохранить макет" }).click();
    await expect(page.getByRole("heading", { name: "Настройка панели" })).toBeHidden();
    expect(savedWidgets.find(({ id }) => id === "review-forecast")?.visible).toBe(false);
    expect(savedWidgets.find(({ id }) => id === "summary")?.presentation).toBe("compact");
    expect(savedWidgets.at(-2)?.id).toBe("recent-review-stats");

    await page.reload();
    await expect(page.getByRole("heading", { name: "Прогноз" })).toBeHidden();
    await expect(page.locator('[data-dashboard-widget="summary"]')).toHaveClass(/compact/);
  });
});

function buildCourseList(currentCourseId: string) {
  if (currentCourseId === "course-1") {
    return {
      currentCourseId,
      courses: [
        {
          id: "course-1",
          slug: "basic",
          title: "Базовый курс",
          description: null,
          targetLevel: "N5",
          band: "n5",
          courseType: "structured",
          enrollmentStatus: "active",
          isCurrent: true,
        },
      ],
    };
  }

  return {
    currentCourseId,
    courses: [
      {
        id: "starter-course",
        slug: "starter-demo",
        title: "Стартовый курс",
        description: null,
        targetLevel: "N5",
        band: "foundation",
        courseType: "demo",
        enrollmentStatus: "active",
        isCurrent: currentCourseId === "starter-course",
      },
      {
        id: "main-course",
        slug: "japanese-ru-n2",
        title: "Основной курс",
        description: null,
        targetLevel: "N2",
        band: "n2",
        courseType: "structured",
        enrollmentStatus: "active",
        isCurrent: currentCourseId === "main-course",
      },
    ],
  };
}

function currentCourseTitle(courseId: string): string {
  return courseId === "main-course" ? "Основной курс" : "Стартовый курс";
}

function buildRecentDashboardItem(
  id: string,
  itemType: ItemKind,
  japanese: string,
  translation: string,
): ItemSummary {
  return {
    id,
    itemType,
    slug: `${itemType}:${japanese}`,
    japanese,
    reading: null,
    translations: {
      displayMode: "ru-en",
      primaryRu: translation,
      primaryEn: translation,
      ru: [{ locale: "ru-RU", text: translation, isPrimary: true }],
      en: [{ locale: "en-US", text: translation, isPrimary: true }],
    },
    level: 1,
    jlptLevel: null,
    srs: null,
  };
}

function buildMinimalDashboard(courseId: string, courseTitle: string) {
  return {
    user: {
      id: "user-1",
      displayName: "Тестовый ученик",
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
      dashboardWidgets: DEFAULT_DASHBOARD_WIDGET_PREFERENCES,
    },
    counts: { dueReviews: 0, availableLessons: 1, burnedCards: 0, leechCandidates: 0 },
    newLearnerGuide: {
      kana: {
        hiragana: { masteredCount: 0, totalCount: 46 },
        katakana: { masteredCount: 0, totalCount: 46 },
      },
      firstLessonCompleted: false,
      firstReviewCompleted: false,
    },
    currentCourse: {
      id: courseId,
      title: courseTitle,
      currentLevel: 1,
      levelProgress: {
        level: 1,
        completedItems: 0,
        totalItems: 1,
        completedCards: 0,
        totalCards: 2,
        percent: 0,
        cardPercent: 0,
        pass: {
          policyVersion: 1,
          itemType: "kanji",
          stageIndex: 5,
          stageName: "Guru 1",
          requiredPercentage: 90,
          passedItems: 0,
          requiredItems: 1,
          totalItems: 1,
          percent: 0,
          currentlyPassed: false,
          completedAt: null,
        },
        itemsByType: [
          {
            itemType: "kanji",
            totalItems: 1,
            locked: 0,
            available: 1,
            inProgress: 0,
            passed: 0,
            burned: 0,
          },
        ],
      },
      journey: {
        newlyUnlocked: null,
        nextLocked: null,
        nextAction: { kind: "lesson", availableAt: null },
      },
    },
    workload: {
      reviews: {
        dueNow: 0,
        next24Hours: 0,
        laterThisWeek: 0,
        budget: 100,
        pressurePercent: 0,
      },
      lessons: { completedToday: 0, remainingToday: 20, dailyLimit: 20, percent: 0 },
    },
    reviewForecast: [],
    leechCandidates: [],
    recentReviewStats: {
      since: "2026-07-09T00:00:00.000Z",
      total: 0,
      correct: 0,
      wrong: 0,
      typo: 0,
      reveal: 0,
      manualIgnore: 0,
      resurrect: 0,
      accuracy: null,
    },
    srsStageSpread: [],
    recentActivity: {
      mistakes: [],
      availableLessons: [],
      burned: [],
    },
    studyActivity: {
      rangeStart: "2025-07-10",
      rangeEnd: "2026-07-09",
      currentStreak: 0,
      longestStreak: 0,
      activeDays: 0,
      totalReviews: 0,
      totalLessons: 0,
      days: [],
    },
  };
}

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ({ accessToken }) => {
      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem("kanji-srs.translationDisplayMode", "ru-en");
      window.localStorage.setItem(
        "kanji-srs.user",
        JSON.stringify({
          id: "user-1",
          email: "learner@example.test",
          displayName: "Тестовый ученик",
          role: "USER",
          settings: {
            locale: "ru-RU",
            translationDisplayMode: "ru-en",
            timezone: "Europe/Moscow",
            dailyLessonLimit: 20,
            reviewBudget: 100,
            strictMode: false,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN },
  );
}
