import { expect, type Page, test } from "@playwright/test";

import {
  type CreateTextDeckResponse,
  type DeckDetailsDto,
  type DeckListResponse,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("dynamic text decks", () => {
  test("creates a deck from pasted Japanese text", async ({ page }) => {
    await signIn(page);
    await mockSavedDecksApi(page, { decks: [] });
    const requestBody = await mockCreateTextDeckApi(page);

    await page.goto("/decks");

    await expect(page.getByRole("heading", { name: "Колоды", exact: true })).toBeVisible();
    await page.getByLabel("Название").fill("Текст про школу");
    await page.getByLabel("Японский текст").fill("学校で学ぶ。");
    await page.getByRole("button", { name: "Создать колоду" }).click();

    await expect(page.getByRole("heading", { name: "Текст про школу" })).toBeVisible();
    await expect(page.getByText("Кандидатов: 4. Совпадений с базой: 1.")).toBeVisible();
    await expect(page.getByText("школа / school")).toBeVisible();
    await expect(page.getByText("Есть в тексте: 学校")).toBeVisible();
    await expect(page.getByRole("link", { name: "Учить колоду" })).toHaveAttribute(
      "href",
      "/lessons?deckId=deck-1",
    );
    expect(requestBody()).toMatchObject({
      title: "Текст про школу",
      text: "学校で学ぶ。",
      maxItems: 80,
    });
    await expect(page.getByRole("button", { name: "Открыть" })).toBeVisible();
  });

  test("opens a saved deck after returning to the page", async ({ page }) => {
    await signIn(page);
    await mockSavedDecksApi(page, savedDeckListResponse, savedDeckDetails);

    await page.goto("/decks");

    await expect(page.getByRole("heading", { name: "Сохранённые колоды" })).toBeVisible();
    await expect(page.getByText("2 элемента · новых: 1")).toBeVisible();
    await page.getByRole("button", { name: "Открыть" }).click();

    const details = page.getByRole("region", { name: "Колода Новости на японском" });
    await expect(details.getByRole("heading", { name: "Новости на японском" })).toBeVisible();
    await expect(details.getByText("Сохранённая колода")).toBeVisible();
    await expect(details.getByText("школа / school")).toBeVisible();
    await expect(details.getByRole("link", { name: "Учить колоду" })).toHaveAttribute(
      "href",
      "/lessons?deckId=deck-saved",
    );

    await details.getByRole("button", { name: "Закрыть" }).click();
    await expect(details).toBeHidden();
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

async function mockSavedDecksApi(
  page: Page,
  listResponse: DeckListResponse,
  detailsResponse?: DeckDetailsDto,
): Promise<void> {
  await page.route(`${API_BASE_URL}/decks`, async (route) => {
    await route.fulfill({ json: listResponse });
  });

  if (detailsResponse !== undefined) {
    await page.route(`${API_BASE_URL}/decks/${detailsResponse.id}`, async (route) => {
      await route.fulfill({ json: detailsResponse });
    });
  }
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

const savedDeckDetails: DeckDetailsDto = {
  ...createTextDeckResponse.deck,
  id: "deck-saved",
  title: "Новости на японском",
  itemCount: 2,
  newItemCount: 1,
};

const savedDeckListResponse: DeckListResponse = {
  decks: [
    {
      id: savedDeckDetails.id,
      title: savedDeckDetails.title,
      description: savedDeckDetails.description,
      status: savedDeckDetails.status,
      itemCount: savedDeckDetails.itemCount,
      newItemCount: savedDeckDetails.newItemCount,
      translationDisplayMode: savedDeckDetails.translationDisplayMode,
      createdAt: savedDeckDetails.createdAt,
      updatedAt: savedDeckDetails.updatedAt,
    },
  ],
};
