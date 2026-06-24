import { expect, type Page, test } from "@playwright/test";

import { type ItemDetails, type ItemSummary, type SearchResponseDto } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("search UI", () => {
  test("searches by kanji and opens the item page", async ({ page }) => {
    await signIn(page);
    await mockSearchApi(page);
    await mockItemApi(page, buildItemDetails(kanjiSummary));

    await page.goto("/search");
    await page.getByLabel("Запрос").fill("学");
    await page.getByRole("button", { name: "Искать" }).click();

    await expect(page.getByRole("region", { name: "Результаты поиска" })).toBeVisible();
    await expect(page.getByText("Кандзи", { exact: true })).toBeVisible();
    await expect(page.getByText("学", { exact: true })).toBeVisible();
    await expect(page.getByText("учеба / study")).toBeVisible();
    await expect(page.getByText("がく")).toBeVisible();
    await expect(page.getByText("N5")).toBeVisible();
    await expect(page.getByText("Apprentice 1")).toBeVisible();

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
    cards: [],
    relations: [],
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
