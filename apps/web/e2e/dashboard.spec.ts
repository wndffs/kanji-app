import { expect, type Page, test } from "@playwright/test";

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
          },
          counts: {
            dueReviews: 4,
            availableLessons: 2,
            burnedCards: 1,
            leechCandidates: 1,
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
              itemsByType: [
                {
                  itemType: "component",
                  totalItems: 1,
                  locked: 0,
                  available: 0,
                  inProgress: 0,
                  burned: 1,
                },
                {
                  itemType: "kanji",
                  totalItems: 2,
                  locked: 0,
                  available: 1,
                  inProgress: 1,
                  burned: 0,
                },
                {
                  itemType: "word",
                  totalItems: 1,
                  locked: 1,
                  available: 0,
                  inProgress: 0,
                  burned: 0,
                },
              ],
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
          recentItems: [],
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
    await expect(page.getByRole("progressbar", { name: "Материалы уровня 50%" })).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Карточки уровня 67%" })).toBeVisible();
    await expect(page.getByLabel("Текущий курс")).toHaveValue("course-1");
    await expect(page.getByTestId("level-progress-type")).toHaveCount(3);
    await expect(page.getByTestId("level-progress-type").nth(1)).toContainText("Кандзи");
    await expect(page.getByRole("main").getByRole("link", { name: "Практика" })).toHaveAttribute(
      "href",
      "/practice",
    );
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

function buildMinimalDashboard(courseId: string, courseTitle: string) {
  return {
    user: {
      id: "user-1",
      displayName: "Тестовый ученик",
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
    },
    counts: { dueReviews: 0, availableLessons: 1, burnedCards: 0, leechCandidates: 0 },
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
        itemsByType: [
          {
            itemType: "kanji",
            totalItems: 1,
            locked: 0,
            available: 1,
            inProgress: 0,
            burned: 0,
          },
        ],
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
    recentItems: [],
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
