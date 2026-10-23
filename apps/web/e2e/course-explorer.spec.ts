import { expect, test, type Page } from "@playwright/test";

const API = "http://localhost:3001";
const ID = "00000000-0000-4000-8000-000000000010";
const outline = { id: ID, title: "Учебная программа", description: null, levels: [
  { levelNumber: 1, title: "Компоненты", band: "foundation", publishedItemCount: 32 },
  { levelNumber: 2, title: "Кандзи", band: "foundation", publishedItemCount: 2 },
] };
async function signIn(page: Page) {
  await page.route(`${API}/courses/${ID}/levels/*/items*`, (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") ?? 1);
    return route.fulfill({ json: { courseId: ID, levelNumber: 1, page: pageNumber, pageSize: 30, total: 32,
      items: [{ id: `material-${pageNumber}`, itemType: "kanji", japanese: pageNumber === 1 ? "一" : "二", title: "Число", reading: "いち", meaningRu: "один", meaningEn: "one", studyState: "not-started", cardCount: 2, startedCardCount: 0, burnedCardCount: 0 }] } });
  });
  await page.addInitScript(() => {
    localStorage.setItem("kanji-srs.accessToken", "explorer-token");
    localStorage.setItem("kanji-srs.user", JSON.stringify({ id: "explorer-user", email: "explorer@example.test", displayName: "Тест", role: "USER", settings: { translationDisplayMode: "ru-en", timezone: "Europe/Moscow" } }));
  });
}
test.describe("published course explorer", () => {
  test("pages level materials without enrollment or scheduling writes", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}`);
    const materials = page.getByRole("region", { name: "Материалы уровня", exact: true });
    await expect(materials.getByRole("link")).toContainText("一");
    await expect(materials.getByRole("link")).toContainText("いち");
    await expect(materials.getByRole("link")).toContainText("один");
    await expect(materials.getByRole("link")).toContainText("one");
    await materials.getByRole("button", { name: "Следующая страница материалов" }).click();
    await expect(materials.getByRole("link")).toContainText("二");
    await expect(materials.getByRole("link")).toHaveAttribute("href", "/items/material-2");
    await materials.getByLabel("Тип материала", { exact: true }).selectOption("word");
    await expect(materials.getByText("Страница 1 из 2")).toBeVisible();
    await expect(page).toHaveURL(/itemType=word/u);
    await page.reload();
    await expect(materials.getByLabel("Тип материала", { exact: true })).toHaveValue("word");
    await page.goBack();
    await expect(materials.getByText("Страница 2 из 2")).toBeVisible();
  });
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
    await page.getByRole("button", { name: "Все уровни", exact: true }).click();
    await expect(page.getByRole("list", { name: "Уровни курса" })).toContainText("32 материалов");
  });
  test("moves between existing levels while resetting only the page", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}?level=1&page=2&itemType=word`);
    await page.getByRole("button", { name: "Следующий уровень", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ID}\\?level=2&itemType=word$`, "u"));
    await expect(page.getByRole("button", { name: "Следующий уровень", exact: true })).toBeDisabled();
    await expect(page.getByLabel("Тип материала", { exact: true })).toHaveValue("word");
  });
  test("requires login and does not fetch a private progress view as a guest", async ({ page }) => {
    await page.goto(`/courses/${ID}`);
    await expect(page.getByText("Для просмотра курса нужен вход.")).toBeVisible();
  });
});
