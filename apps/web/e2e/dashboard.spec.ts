import { expect, test } from "@playwright/test";

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
});
