import { expect, type Page, test } from "@playwright/test";
import { changeAccount } from "./support/change-account";

import {
  type CreateTextDeckResponse,
  type DeckDetailsDto,
  type DeckListResponse,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("dynamic text decks", () => {
  test("retries the library without clearing a builder draft and resets an empty filter", async ({
    page,
  }) => {
    await signIn(page);
    let reads = 0;
    await page.route(`${API_BASE_URL}/decks`, (route) => {
      reads++;
      return reads === 1
        ? route.fulfill({ status: 503, json: { message: "Недоступно" } })
        : route.fulfill({ json: savedDeckListResponse });
    });
    await page.goto("/decks");
    await page.getByRole("button", { name: "Новая колода", exact: true }).click();
    await page.getByLabel("Название", { exact: true }).fill("Черновик без потери");
    await page.getByLabel("Японский текст").fill("学校");
    await page.getByRole("button", { name: "Повторить загрузку колод", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Сохранённые колоды", exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Черновик без потери");
    await expect(page.getByLabel("Японский текст")).toHaveValue("学校");
    await page.getByLabel("Найти колоду").fill("несуществующая");
    await page.getByRole("button", { name: "Сбросить поиск колод", exact: true }).click();
    await expect(page.getByLabel("Найти колоду")).toHaveValue("");
    await expect(page.getByRole("button", { name: "Открыть", exact: true })).toBeVisible();
    expect(reads).toBe(2);
  });
  for (const status of [200, 401])
    test(`ignores a late create response after account change (${status})`, async ({ page }) => {
      await signIn(page);
      await mockSavedDecksApi(page, { decks: [] });
      let release!: () => void;
      let started!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        started = resolve;
      });
      await page.route(`${API_BASE_URL}/decks/from-text`, async (route) => {
        started();
        await held;
        await route
          .fulfill({
            status,
            json: status === 200 ? createTextDeckResponse : { message: "Old create expired" },
          })
          .catch(() => undefined);
      });
      try {
        await page.goto("/decks");
        await page.getByRole("button", { name: "Новая колода", exact: true }).click();
        await page.getByLabel("Японский текст").fill("学校");
        await page.getByRole("button", { name: "Создать колоду", exact: true }).click();
        await pending;
        await changeAccount(page);
        await expect(page.getByRole("button", { name: "Новая колода", exact: true })).toBeEnabled();
        const old = page.waitForResponse((response) => response.url().endsWith("/decks/from-text"));
        release();
        await (await old).finished();
        await expect(
          page.getByRole("heading", { name: "Текст про школу", exact: true }),
        ).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
          "new-owner-token",
        );
      } finally {
        release();
      }
    });
  for (const status of [200, 401])
    test(`clears private drafts and ignores an old library ${status}`, async ({ page }) => {
      await signIn(page);
      let release!: () => void;
      let started!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        started = resolve;
      });
      await page.route(`${API_BASE_URL}/decks`, async (route) => {
        if (route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`) {
          started();
          await held;
          await route
            .fulfill({
              status,
              json: status === 200 ? savedDeckListResponse : { message: "Old account expired" },
            })
            .catch(() => undefined);
        } else
          await route.fulfill({
            json: {
              decks: [
                {
                  ...savedDeckListResponse.decks[0]!,
                  id: "new-deck",
                  title: "Новая личная колода",
                },
              ],
            },
          });
      });
      try {
        await page.goto("/decks");
        await pending;
        await page.getByRole("button", { name: "Новая колода", exact: true }).click();
        await page.getByLabel("Японский текст").fill("Старый личный текст");
        await changeAccount(page);
        await expect(page.getByText("Новая личная колода", { exact: true })).toBeVisible();
        await page.getByRole("button", { name: "Новая колода", exact: true }).click();
        await expect(page.getByLabel("Японский текст")).toHaveValue("");
        const old = page.waitForResponse(
          (response) =>
            response.url().endsWith("/decks") &&
            response.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`,
        );
        release();
        await (await old).finished();
        await expect(page.getByText(savedDeckDetails.title, { exact: true })).toHaveCount(0);
        expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
          "new-owner-token",
        );
      } finally {
        release();
      }
    });

  test("retains a hidden builder draft, validates limits and filters library and path", async ({
    page,
  }) => {
    await signIn(page);
    await mockSavedDecksApi(page, savedDeckListResponse, savedDeckDetails);
    let writes = 0;
    await page.route(`${API_BASE_URL}/decks/from-text`, (route) => {
      writes++;
      return route.fulfill({ json: createTextDeckResponse });
    });
    await page.goto("/decks");
    await page.getByRole("button", { name: "Новая колода", exact: true }).click();
    await page.getByLabel("Название", { exact: true }).fill("Черновик");
    await page.getByLabel("Японский текст").fill("学校");
    await page.getByRole("button", { name: "Скрыть форму", exact: true }).click();
    await page.getByRole("button", { name: "Новая колода", exact: true }).click();
    await expect(page.getByLabel("Название", { exact: true })).toHaveValue("Черновик");
    await page.getByLabel("Максимум элементов").fill("0");
    await page.getByRole("button", { name: "Создать колоду", exact: true }).click();
    await expect(page.locator("#deck-builder").getByRole("alert")).toContainText("от 1 до 160");
    expect(writes).toBe(0);
    await page.getByRole("button", { name: "Скрыть форму", exact: true }).click();
    await page.getByLabel("Найти колоду").fill("нет такой");
    await expect(page.getByText("Колоды не найдены.", { exact: true })).toBeVisible();
    await page.getByLabel("Найти колоду").fill("новости");
    await page.getByRole("button", { name: "Открыть", exact: true }).click();
    await page.getByLabel("Изучение в колоде").selectOption("started");
    await expect(page.getByText("Материалы не найдены.", { exact: true })).toBeVisible();
    await page.getByLabel("Изучение в колоде").selectOption("new");
    await expect(page.getByRole("link", { name: "学校", exact: true })).toHaveAttribute(
      "href",
      "/items/item-word-school",
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("deck-library.png"), fullPage: true });
  });
  test("creates a deck from pasted Japanese text", async ({ page }) => {
    await signIn(page);
    await mockSavedDecksApi(page, { decks: [] });
    const requestBody = await mockCreateTextDeckApi(page);

    await page.goto("/decks");

    await expect(page.getByRole("heading", { name: "Колоды", exact: true })).toBeVisible();
    await expect(page.getByLabel("Японский текст")).toBeHidden();
    await page.getByRole("button", { name: "Новая колода", exact: true }).click();
    await page.getByLabel("Название").fill("Текст про школу");
    await page.getByLabel("Японский текст").fill("学校で学ぶ。");
    await page.getByRole("button", { name: "Создать колоду" }).click();

    await expect(page.getByRole("heading", { name: "Текст про школу" })).toBeVisible();
    await page.getByRole("button", { name: "Разбор текста", exact: true }).click();
    await expect(
      page.getByText("Найдено материалов: 1. Перекрывающихся слов исключено: 0."),
    ).toBeVisible();
    await expect(page.getByText("школа / school")).toBeVisible();
    await page.getByRole("button", { name: "Почему в колоде", exact: true }).click();
    await expect(page.getByText("Есть в тексте: 学校")).toBeVisible();
    await expect(page.getByRole("link", { name: "Учить колоду" })).toHaveAttribute(
      "href",
      "/lessons?deckId=deck-1",
    );
    await expect(page.getByRole("button", { name: "Архивировать" })).toBeVisible();
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

    await details.getByRole("button", { name: "Архивировать" }).click();
    await expect(details.getByText(/Колода в архиве/)).toBeVisible();
    await expect(details.getByRole("link", { name: "Учить колоду" })).toHaveCount(0);
    await page.getByRole("tab", { name: "Архив", exact: true }).click();
    await expect(page.getByText("2 элемента · новых: 1 · архив")).toBeVisible();

    await details.getByRole("button", { name: "Восстановить" }).click();
    await page.getByRole("tab", { name: "Активные", exact: true }).click();
    await expect(details.getByText(/Колода в архиве/)).toHaveCount(0);
    await expect(details.getByRole("link", { name: "Учить колоду" })).toBeVisible();

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
    let currentDetails = detailsResponse;

    await page.route(`${API_BASE_URL}/decks/${detailsResponse.id}`, async (route) => {
      await route.fulfill({ json: currentDetails });
    });
    await page.route(`${API_BASE_URL}/decks/${detailsResponse.id}/status`, async (route) => {
      const body = route.request().postDataJSON() as { readonly status: "active" | "archived" };
      currentDetails = {
        ...currentDetails,
        status: body.status,
        updatedAt: "2026-06-24T10:00:00.000Z",
      };
      await route.fulfill({ json: currentDetails });
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
    strategy: "dictionary-longest-match",
    candidateCount: 4,
    matchedItemCount: 1,
    unmatchedCandidateCount: 3,
    discardedOverlapCount: 0,
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
