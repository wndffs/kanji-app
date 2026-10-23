import { expect, type Page, test } from "@playwright/test";

import { type ItemDetails, type ItemSummary, type SearchResponseDto } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("search UI", () => {
  test("reopens a hidden invalid filter without sending a request", async ({ page }) => {
    await signIn(page);
    let requests = 0;
    await page.route(`${API_BASE_URL}/search?*`, (route) => {
      requests++;
      return route.fulfill({ json: buildSearchResponse("school") });
    });
    await page.goto("/search");
    await page.getByLabel("Запрос", { exact: true }).fill("school");
    await page.getByRole("button", { name: "Фильтры", exact: true }).click();
    await page.getByLabel("Учебный уровень", { exact: true }).fill("0");
    await page.getByRole("button", { name: "Фильтры", exact: true }).click();
    await page.getByRole("button", { name: "Искать", exact: true }).click();
    await expect(page.getByLabel("Учебный уровень", { exact: true })).toBeVisible();
    expect(requests).toBe(0);
    await page.getByLabel("Учебный уровень", { exact: true }).fill("1");
    await page.getByRole("button", { name: "Искать", exact: true }).click();
    await expect(page).toHaveURL(/q=school&level=1$/);
  });
  test("removes applied filters independently and resets pagination", async ({ page }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/search?*`, (route) =>
      route.fulfill({ json: buildSearchResponse("school") }),
    );
    await page.goto("/search?q=school&page=2&itemType=word&level=1");
    await page.getByRole("button", { name: "Убрать учебный уровень", exact: true }).click();
    await expect(page).toHaveURL(/q=school&itemType=word$/);
    await page.getByRole("button", { name: "Убрать тип материала", exact: true }).click();
    await expect(page).toHaveURL(/search\?q=school$/);
    await expect(page.getByLabel("Тип материала", { exact: true })).toBeHidden();
    await expect(page.locator(".search-result-reading")).toHaveText("がっこう");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("search-focused.png"), fullPage: true });
  });
  test("keeps pages and filters through navigation, reload and back", async ({
    page,
  }, testInfo) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/search?*`, async (route) => {
      const url = new URL(route.request().url());
      const current = Number(url.searchParams.get("page") ?? "1");
      expect(route.request().headers().authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
      expect(url.searchParams.get("itemType")).toBe("kanji");
      expect(["1", "2"]).toContain(url.searchParams.get("level"));
      await route.fulfill({
        json: {
          query: "学",
          items: [{ ...kanjiSummary, id: `page-${current}` }],
          pagination: { page: current, limit: 20, total: 40, hasNextPage: current === 1 },
        },
      });
    });
    await page.goto("/search?q=学&itemType=kanji&level=1");
    await expect(page.locator("a.search-result-card")).toHaveAttribute("href", "/items/page-1");
    await page.getByRole("link", { name: "Следующая страница", exact: true }).click();
    await expect(page).toHaveURL(/page=2/);
    await expect(page.locator("a.search-result-card")).toHaveAttribute("href", "/items/page-2");
    await page.reload();
    await expect(page.getByLabel("Тип материала", { exact: true })).toHaveValue("kanji");
    await expect(page.getByLabel("Учебный уровень", { exact: true })).toHaveValue("1");
    await expect(page.getByRole("navigation", { name: "Страницы поиска" })).toContainText(
      "Страница 2 из 2",
    );
    await page.screenshot({ path: testInfo.outputPath("search-pagination.png"), fullPage: true });
    await page.goBack();
    await expect(page.locator("a.search-result-card")).toHaveAttribute("href", "/items/page-1");
    await page.getByRole("button", { name: "Искать", exact: true }).click();
    await expect(page).not.toHaveURL(/page=2/);
    await page.getByLabel("Учебный уровень", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Искать", exact: true }).click();
    await expect(page).toHaveURL(/itemType=kanji&level=2/);
    await expect(page).not.toHaveURL(/page=/);
    await expect(page.locator("a.search-result-card")).toHaveAttribute("href", "/items/page-1");
  });

  test("a superseded result cannot overwrite a newer search", async ({ page }) => {
    await signIn(page);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(`${API_BASE_URL}/search?*`, async (route) => {
      if (new URL(route.request().url()).searchParams.get("q") === "old") {
        started();
        await gate;
        await route
          .fulfill({ json: { ...buildSearchResponse("学"), query: "old" } })
          .catch(() => undefined);
      } else await route.fulfill({ json: buildSearchResponse("school") });
    });
    try {
      await page.goto("/search?q=old");
      await pending;
      await page.getByLabel("Запрос").fill("school");
      await page.getByRole("button", { name: "Искать", exact: true }).click();
      await expect(
        page.getByRole("region", { name: "Результаты поиска" }).getByText("学校", { exact: true }),
      ).toBeVisible();
      release();
      await expect(page.locator("a.search-result-card")).toHaveAttribute(
        "href",
        `/items/${wordSummary.id}`,
      );
    } finally {
      release();
    }
  });

  test("a late unauthorized response cannot clear a newer login", async ({ page }) => {
    await signIn(page);
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(`${API_BASE_URL}/search?*`, async (route) => {
      if (route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`) {
        started();
        await gate;
        await route.fulfill({ status: 401, json: { message: "Expired" } }).catch(() => undefined);
      } else await route.fulfill({ json: buildSearchResponse("school") });
    });
    try {
      await page.goto("/search?q=school");
      await pending;
      await page.evaluate(() => {
        localStorage.setItem("kanji-srs.accessToken", "new-token");
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(page.locator("a.search-result-card")).toHaveAttribute(
        "href",
        `/items/${wordSummary.id}`,
      );
      release();
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
        "new-token",
      );
    } finally {
      release();
    }
  });

  test("searches by kanji and opens the item page", async ({ page }) => {
    await signIn(page);
    await mockSearchApi(page);
    await mockItemApi(page, buildItemDetails(kanjiSummary));

    await page.goto("/search");
    await page.getByLabel("Запрос").fill("学");
    await page.getByRole("button", { name: "Искать" }).click();

    await expect(page.getByRole("region", { name: "Результаты поиска" })).toBeVisible();
    await expect(
      page.getByRole("region", { name: "Результаты поиска" }).getByText("Кандзи", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("学", { exact: true })).toBeVisible();
    await expect(page.getByText("учеба / study")).toBeVisible();
    await expect(page.getByText("がく")).toBeVisible();
    await expect(page.getByText("N5")).toBeVisible();
    await expect(page.getByText("Знакомство 1")).toBeVisible();

    await page.getByRole("link", { name: /学/ }).click();

    await expect(page).toHaveURL(/\/items\/item-kanji-study$/);
  });

  test("searches by Russian and English meaning", async ({ page }) => {
    await signIn(page);
    await mockSearchApi(page);

    await page.goto("/search");
    await page.getByLabel("Запрос").fill("школа");
    await page.getByRole("button", { name: "Искать" }).click();

    await expect(page.getByText("Слово", { exact: true })).toBeVisible();
    await expect(page.getByText("学校", { exact: true })).toBeVisible();
    await expect(page.getByText("школа / school")).toBeVisible();

    await page.getByLabel("Запрос").fill("school");
    await page.getByRole("button", { name: "Искать" }).click();

    await expect(page.getByText("Слово", { exact: true })).toBeVisible();
    await expect(page.getByText("学校", { exact: true })).toBeVisible();
    await expect(page.getByText("школа / school")).toBeVisible();
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

async function mockSearchApi(page: Page): Promise<void> {
  await page.route(`${API_BASE_URL}/search?*`, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q") ?? "";

    expect(route.request().headers().authorization).toBe(`Bearer ${ACCESS_TOKEN}`);

    await route.fulfill({ json: buildSearchResponse(query) });
  });
}

async function mockItemApi(page: Page, item: ItemDetails): Promise<void> {
  await page.route(`${API_BASE_URL}/items/${item.id}`, async (route) => {
    await route.fulfill({ json: item });
  });
}

function buildSearchResponse(query: string): SearchResponseDto {
  const items =
    query === "学"
      ? [kanjiSummary]
      : query.toLowerCase() === "school" || query.toLowerCase() === "школа"
        ? [wordSummary]
        : [];

  return {
    query,
    items,
    pagination: {
      page: 1,
      limit: 20,
      total: items.length,
      hasNextPage: false,
    },
  };
}

function buildItemDetails(summary: ItemSummary): ItemDetails {
  return {
    ...summary,
    componentDetails: null,
    kanjiDetails: null,
    wordDetails: null,
    cards: [],
    relations: [],
    relationGroups: [],
    nextReviewAt: summary.srs?.availableAt ?? null,
    reviewHistory: { items: [], nextCursor: null },
    mnemonics: { ru: [], en: [] },
    hints: { ru: [], en: [] },
    exampleSentences: [],
    attributions: [],
    userOverrides: [],
    strokeGraphic: null,
  };
}

const kanjiSummary: ItemSummary = {
  id: "item-kanji-study",
  itemType: "kanji",
  slug: "kanji:学",
  japanese: "学",
  reading: "がく",
  translations: {
    displayMode: "ru-en",
    primaryRu: "учеба",
    primaryEn: "study",
    ru: [{ locale: "ru-RU", text: "учеба", isPrimary: true, sourceKind: "curated" }],
    en: [{ locale: "en-US", text: "study", isPrimary: true, sourceKind: "curated" }],
  },
  level: 1,
  jlptLevel: "N5",
  srs: {
    stageIndex: 1,
    stageName: "Apprentice 1",
    availableAt: "2026-06-24T13:00:00.000Z",
    burnedAt: null,
    wrongCount: 0,
    correctStreak: 1,
  },
};

const wordSummary: ItemSummary = {
  id: "item-word-school",
  itemType: "word",
  slug: "word:学校",
  japanese: "学校",
  reading: "がっこう",
  translations: {
    displayMode: "ru-en",
    primaryRu: "школа",
    primaryEn: "school",
    ru: [{ locale: "ru-RU", text: "школа", isPrimary: true, sourceKind: "curated" }],
    en: [{ locale: "en-US", text: "school", isPrimary: true, sourceKind: "curated" }],
  },
  level: 1,
  jlptLevel: "N5",
  srs: null,
};
