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
          currentCourse: null,
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
          recentItems: [],
        },
      });
    });

    await page.goto("/dashboard");

    await expect(page.getByTestId("forecast-bucket").first()).toContainText("24.06.2026, 15:00");
    await expect(page.getByTestId("forecast-bucket").first()).toContainText("3");
    await expect(page.getByTestId("forecast-bucket").nth(1)).toContainText("16:00");
    await expect(page.getByTestId("forecast-bucket").nth(1)).toContainText("1");
    await expect(page.locator(".leech-list")).toContainText("困");
    await expect(page.locator(".leech-list")).toContainText("29");
  });
});

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
