import { expect, test, type Page } from "@playwright/test";

const API = "http://localhost:3001";
const ID = "00000000-0000-4000-8000-000000000010";
const outline = {
  id: ID,
  title: "Основа японского: компоненты, кандзи и повседневная лексика",
  description: null,
  levels: [
    { levelNumber: 1, title: "Компоненты", band: "foundation", publishedItemCount: 32 },
    { levelNumber: 2, title: "Кандзи", band: "foundation", publishedItemCount: 2 },
  ],
};
async function signIn(page: Page) {
  await page.route(`${API}/courses/${ID}/levels/*/items*`, (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") ?? 1);
    return route.fulfill({
      json: {
        courseId: ID,
        levelNumber: 1,
        page: pageNumber,
        pageSize: 30,
        total: 32,
        summary: { total: 32, newCount: 30, learningCount: 1, burnedCount: 1, dueItemCount: 1,
          byKind: { component: 0, kanji: 32, word: 0, sentence: 0 } },
        items: [
          {
            id: `material-${pageNumber}`,
            itemType: "kanji",
            japanese: pageNumber === 1 ? "一" : "二",
            title: "Число",
            reading: "いち",
            meaningRu: "один",
            meaningEn: "one",
            studyState: "not-started",
            cardCount: 2,
            startedCardCount: 0,
            burnedCardCount: 0,
            dueCardCount: 0,
            scheduledCardCount: 0,
            nextReviewAt: null,
            progressCards: [],
          },
        ],
      },
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("kanji-srs.translationDisplayMode", "ru-en");
    localStorage.setItem("kanji-srs.accessToken", "explorer-token");
    localStorage.setItem(
      "kanji-srs.user",
      JSON.stringify({
        id: "explorer-user",
        email: "explorer@example.test",
        displayName: "Тест",
        role: "USER",
        settings: { translationDisplayMode: "ru-en", timezone: "Europe/Moscow" },
      }),
    );
  });
}
test.describe("published course explorer", () => {
  for (const status of [200, 401]) {
    test(`ignores stale level data after account replacement (${status})`, async ({ page }) => {
      await signIn(page);
      await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
      let release = () => {};
      let requested = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const seen = new Promise<void>((resolve) => {
        requested = resolve;
      });
      await page.route(`${API}/courses/${ID}/levels/*/items*`, async (route) => {
        const older = route.request().headers().authorization === "Bearer explorer-token";
        if (older) {
          requested();
          await held;
        }
        await route.fulfill({
          status: older ? status : 200,
          json:
            older && status === 401
              ? { message: "Old session" }
              : { courseId: ID, levelNumber: 1, page: 1, pageSize: 30, total: 0, items: [] },
        });
      });
      await page.goto(`/courses/${ID}`);
      await seen;
      await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
        localStorage.setItem("kanji-srs.accessToken", "explorer-next-token");
        localStorage.setItem(
          "kanji-srs.user",
          JSON.stringify({ ...user, id: "explorer-next-user" }),
        );
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(page.getByText("Найдено: 0", { exact: true })).toBeVisible();
      const response = page.waitForResponse(
        (response) =>
          response.url().includes("/levels/") &&
          response.request().headers().authorization === "Bearer explorer-token",
      );
      release();
      await response;
      await expect(page.getByText("Найдено: 0", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
        "explorer-next-token",
      );
    });
  }
  test("pages level materials without enrollment or scheduling writes", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}`);
    const materials = page.getByRole("region", { name: "Материалы уровня", exact: true });
    await expect(materials.getByRole("link")).toContainText("一");
    await expect(materials.getByRole("link")).toContainText("いち");
    await expect(materials.getByRole("link")).toContainText("один");
    await expect(materials.getByRole("link")).toContainText("one");
    await expect(materials.getByRole("link")).toBeInViewport({ ratio: 0.5 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await materials.getByRole("button", { name: "Следующая страница материалов" }).click();
    await expect(materials.getByRole("link")).toContainText("二");
    await expect(materials.getByRole("link")).toHaveAttribute(
      "href",
      new RegExp(`/items/material-2\\?level=1&page=2&courseId=${ID}$`, "u"),
    );
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
      return route.fulfill(
        ++reads === 1
          ? { status: 503, json: { message: "Временно недоступно" } }
          : { json: outline },
      );
    });
    await page.goto(`/courses/${ID}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Временно недоступно");
    await page.getByRole("button", { name: "Повторить загрузку" }).click();
    await expect(page.getByRole("heading", { name: outline.title })).toBeVisible();
    await page.getByRole("button", { name: "Все уровни", exact: true }).click();
    await expect(page.getByRole("list", { name: "Уровни курса" })).toContainText("32 материалов");
    await page.getByRole("list", { name: "Уровни курса" }).getByRole("link", { name: /Уровень 2:/u }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ID}\\?level=2$`, "u"));
    await expect(page.getByLabel("Уровень курса", { exact: true })).toHaveValue("2");
  });
  test("moves between existing levels while resetting only the page", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}?level=1&page=2&itemType=word`);
    await page.getByRole("button", { name: "Следующий уровень", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ID}\\?level=2&itemType=word$`, "u"));
    await expect(
      page.getByRole("button", { name: "Следующий уровень", exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Тип материала", { exact: true })).toHaveValue("word");
  });
  test("requires login and does not fetch a private progress view as a guest", async ({ page }) => {
    await page.goto(`/courses/${ID}`);
    await expect(page.getByText("Для просмотра курса нужен вход.")).toBeVisible();
  });
  test("opens whole-level progress counts without scheduling writes", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    const writes: string[] = [];
    page.on("request", (request) => { if (request.url().startsWith(API) && request.method() !== "GET" && request.method() !== "OPTIONS") writes.push(request.url()); });
    await page.goto(`/courses/${ID}?itemType=kanji&page=2`);
    await page.getByRole("navigation", { name: "Прогресс уровня" }).getByRole("button", { name: "Срок наступил: 1", exact: true }).click();
    await expect(page).toHaveURL(/reviewState=due/u);
    await expect(page.getByLabel("Срок повторения", { exact: true })).toHaveValue("due");
    await expect(page.getByText("Страница 1 из 2")).toBeVisible();
    expect(writes).toEqual([]);
  });
});
