import { expect, test, type Page } from "@playwright/test";

const API = "http://localhost:3001";
const ID = "00000000-0000-4000-8000-000000000010";
const outline = { id: ID, title: "Учебная программа", description: null, levels: [
  { levelNumber: 1, title: "Компоненты", band: "foundation", publishedItemCount: 32 },
  { levelNumber: 2, title: "Кандзи", band: "foundation", publishedItemCount: 2 },
] };
async function signIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kanji-srs.accessToken", "explorer-token");
    localStorage.setItem("kanji-srs.user", JSON.stringify({ id: "explorer-user", email: "explorer@example.test", displayName: "Тест", role: "USER", settings: { translationDisplayMode: "ru-en", timezone: "Europe/Moscow" } }));
  });
}
test.describe("published course explorer", () => {
  test("shows a read-only syllabus and retries a failed outline", async ({ page }) => {
    await signIn(page);
    let reads = 0;
    await page.route(`${API}/courses/${ID}/outline`, (route) => {
      expect(route.request().method()).toBe("GET");
      return route.fulfill(++reads === 1 ? { status: 503, json: { message: "Временно недоступно" } } : { json: outline });
    });
    await page.goto(`/courses/${ID}`);
    await expect(page.getByRole("alert")).toContainText("Временно недоступно");
    await page.getByRole("button", { name: "Повторить загрузку" }).click();
    await expect(page.getByRole("heading", { name: outline.title })).toBeVisible();
    await expect(page.getByRole("list", { name: "Уровни курса" })).toContainText("32 материалов");
  });
  test("requires login and does not fetch a private progress view as a guest", async ({ page }) => {
    await page.goto(`/courses/${ID}`);
    await expect(page.getByText("Для просмотра курса нужен вход.")).toBeVisible();
  });
});
