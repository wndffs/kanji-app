import { expect, type Page, test } from "@playwright/test";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("settings", () => {
  test("saves workload controls", async ({ page }) => {
    let receivedSettings: unknown = null;

    await signIn(page);

    await page.route(`${API_BASE_URL}/auth/me`, async (route) => {
      await route.fulfill({ json: createUser() });
    });

    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      receivedSettings = route.request().postDataJSON();

      await route.fulfill({
        json: {
          ...createUser(),
          settings: {
            ...createUser().settings,
            ...(receivedSettings as Record<string, unknown>),
          },
        },
      });
    });

    await page.goto("/settings");

    await page.getByLabel("Перевод карточек").selectOption("en");
    await page.getByLabel("Лимит уроков в день").fill("7");
    await page.getByLabel("Бюджет повторений").fill("18");
    await page.getByLabel("Часовой пояс").fill("Asia/Tokyo");
    await page.getByLabel("Строгая проверка").check();
    await page.getByRole("button", { name: "Сохранить" }).click();

    await expect(page.getByText("Сохранено.")).toBeVisible();
    expect(receivedSettings).toEqual({
      translationDisplayMode: "en",
      timezone: "Asia/Tokyo",
      dailyLessonLimit: 7,
      reviewBudget: 18,
      strictMode: true,
    });
  });
});

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ({ accessToken, user }) => {
      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem(
        "kanji-srs.translationDisplayMode",
        user.settings.translationDisplayMode,
      );
      window.localStorage.setItem("kanji-srs.user", JSON.stringify(user));
    },
    { accessToken: ACCESS_TOKEN, user: createUser() },
  );
}

function createUser() {
  return {
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
  };
}
