import { expect, type Page, test } from "@playwright/test";

import { type CreateTextDeckResponse } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("dynamic text decks", () => {
  test("creates a deck from pasted Japanese text", async ({ page }) => {
    await signIn(page);
    const requestBody = await mockCreateTextDeckApi(page);

    await page.goto("/decks");

    await expect(page.getByRole("heading", { name: "Колоды" })).toBeVisible();
    await page.getByLabel("Название").fill("Текст про школу");
    await page.getByLabel("Японский текст").fill("学校で学ぶ。");
    await page.getByRole("button", { name: "Создать колоду" }).click();

    await expect(page.getByRole("heading", { name: "Текст про школу" })).toBeVisible();
    await expect(page.getByText("Кандидатов: 4. Совпадений с базой: 1.")).toBeVisible();
    await expect(page.getByText("школа / school")).toBeVisible();
    await expect(page.getByText("Есть в тексте: 学校")).toBeVisible();
    expect(requestBody()).toMatchObject({
      title: "Текст про школу",
      text: "学校で学ぶ。",
      maxItems: 80,
    });
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

async function mockCreateTextDeckApi(page: Page): Promise<() => unknown> {
  let requestBody: unknown = null;

  await page.route(`${API_BASE_URL}/decks/from-text`, async (route) => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({ json: createTextDeckResponse });
  });

  return () => requestBody;
}

const createTextDeckResponse: CreateTextDeckResponse = {
  deck: {
    id: "deck-1",
    title: "Текст про школу",
    description: "Dynamic text deck",
    status: "active",
    itemCount: 1,
    newItemCount: 1,
    translationDisplayMode: "ru-en",
    createdAt: "2026-06-24T09:00:00.000Z",
    updatedAt: "2026-06-24T09:00:00.000Z",
    items: [
      {
        item: {
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
        },
        sortOrder: 1,
        isNewForUser: true,
        reasons: [
          {
            code: "appears-in-text",
            detail: "Matched in text.",
            matchedText: "学校",
          },
        ],
      },
    ],
  },
  tokenization: {
    strategy: "substring-fallback",
    candidateCount: 4,
    matchedItemCount: 1,
    unmatchedCandidateCount: 3,
  },
};
