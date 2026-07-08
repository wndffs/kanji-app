import { expect, type Page, test } from "@playwright/test";

import {
  type ContentLocale,
  type ItemDetails,
  type UserMnemonicDto,
  type UserOverrideDto,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const ITEM_ID = "item-kanji-one";

test.describe("item details", () => {
  test("opens an item page", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);

    await expect(page.getByText("Кандзи", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "一" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Значения" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Глобальные ответы" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Порядок черт" })).toBeVisible();
    await expect(page.getByTestId("kanji-stroke-graphic")).toBeVisible();
    await expect(page.getByTestId("kanji-stroke-graphic").locator("path")).toHaveCount(1);
    await expect(page.getByText("KANJIDIC2")).toBeVisible();
    await expect(page.getByText("KanjiVG", { exact: true })).toBeVisible();
  });

  test("suggests mnemonic review for leech items", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);

    await expect(page.getByTestId("item-leech-notice")).toContainText("Балл 29");
    await expect(page.getByTestId("item-leech-notice")).toContainText("мнемонику");
  });

  test("adds a private synonym", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);
    const acceptedPanel = privatePanel(page, "Приватные ответы");
    await page.getByTestId("private-answer-text").fill("единица");
    await page.getByTestId("private-answer-note").fill("Мой вариант из учебника.");
    await page.getByTestId("private-answer-submit").click();

    await expect(page.getByText("Приватный ответ сохранён.")).toBeVisible();
    await expect(
      acceptedPanel.locator(".private-override-list").getByText("единица"),
    ).toBeVisible();
    await expect(
      acceptedPanel.locator(".private-override-list").getByText("Мой вариант из учебника."),
    ).toBeVisible();
  });

  test("edits a private mnemonic", async ({ page }) => {
    await signIn(page);
    await mockItemApi(page);

    await page.goto(`/items/${ITEM_ID}`);
    const mnemonicPanel = privatePanel(page, "Приватная заметка");
    await page.getByTestId("private-mnemonic-body").fill("Одна длинная горизонтальная линия.");
    await page.getByTestId("private-mnemonic-submit").click();

    await expect(page.getByText("Приватная заметка сохранена.")).toBeVisible();
    await expect(
      mnemonicPanel.locator(".lesson-text-list").getByText("Одна длинная горизонтальная линия."),
    ).toBeVisible();

    await page.getByTestId("private-mnemonic-body").fill("Один чистый штрих.");
    await page.getByTestId("private-mnemonic-submit").click();

    await expect(
      mnemonicPanel.locator(".lesson-text-list").getByText("Один чистый штрих."),
    ).toBeVisible();
  });
});

function privatePanel(page: Page, heading: string) {
  return page.locator(".item-side .panel").filter({
    has: page.getByRole("heading", { name: heading }),
  });
}

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

async function mockItemApi(page: Page): Promise<void> {
  const privateOverrides: UserOverrideDto[] = [];
  let privateMnemonic: UserMnemonicDto | null = null;

  await page.route(`${API_BASE_URL}/items/${ITEM_ID}`, async (route) => {
    await route.fulfill({
      json: buildItemDetails(privateOverrides, privateMnemonic),
    });
  });

  await page.route(`${API_BASE_URL}/kanji/${encodeURIComponent("一")}`, async (route) => {
    await route.fulfill({
      json: buildItemDetails(privateOverrides, privateMnemonic),
    });
  });

  await page.route(`${API_BASE_URL}/cards/card-kanji-one-meaning/overrides`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly text?: string;
      readonly locale?: ContentLocale;
      readonly note?: string | null;
    };
    const override: UserOverrideDto = {
      id: `override-${privateOverrides.length + 1}`,
      learningCardId: "card-kanji-one-meaning",
      kind: "accepted-answer",
      locale: body.locale ?? "ru-RU",
      text: body.text ?? "",
      normalizedText: body.text ?? "",
      note: body.note ?? null,
      createdAt: "2026-06-22T08:01:00.000Z",
      updatedAt: "2026-06-22T08:01:00.000Z",
    };
    privateOverrides.push(override);

    await route.fulfill({ json: override });
  });

  await page.route(`${API_BASE_URL}/items/${ITEM_ID}/private-mnemonic`, async (route) => {
    if (route.request().method() === "DELETE") {
      privateMnemonic = null;
      await route.fulfill({ json: { deleted: true } });
      return;
    }

    const body = route.request().postDataJSON() as {
      readonly body?: string;
      readonly locale?: ContentLocale;
      readonly mnemonicType?: UserMnemonicDto["mnemonicType"];
    };
    privateMnemonic = {
      id: "mnemonic-1",
      learningItemId: ITEM_ID,
      locale: body.locale ?? "ru-RU",
      mnemonicType: body.mnemonicType ?? "story",
      body: body.body ?? "",
      createdAt: "2026-06-22T08:02:00.000Z",
      updatedAt: "2026-06-22T08:03:00.000Z",
    };

    await route.fulfill({ json: { mnemonic: privateMnemonic } });
  });
}

function buildItemDetails(
  privateOverrides: readonly UserOverrideDto[],
  privateMnemonic: UserMnemonicDto | null,
): ItemDetails {
  return {
    id: ITEM_ID,
    itemType: "kanji",
    slug: "kanji:一",
    japanese: "一",
    reading: "いち",
    translations: {
      displayMode: "ru-en",
      primaryRu: "один",
      primaryEn: "one",
      ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
      en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
    },
    level: 1,
    jlptLevel: "N5",
    srs: {
      stageIndex: 4,
      stageName: "Apprentice 4",
      availableAt: "2026-06-24T15:00:00.000Z",
      burnedAt: null,
      wrongCount: 8,
      correctStreak: 1,
      leech: {
        score: 29,
        isCandidate: true,
        wrongCount: 8,
        correctStreak: 1,
        recentWrongCount: 2,
        stageDropCount: 1,
        stageDropMagnitude: 4,
        reasons: ["wrong-count", "recent-wrong", "stage-instability"],
      },
    },
    strokeGraphic: {
      sourceRecordId: "kanjivg:04e00",
      viewBox: "0 0 109 109",
      strokes: [
        {
          id: "kvg:04e00-s1",
          order: 1,
          path: "M18,54 C34,52 72,52 91,54",
          type: "㇐",
        },
      ],
    },
    cards: [
      {
        id: "card-kanji-one-meaning",
        learningItemId: ITEM_ID,
        itemType: "kanji",
        cardType: "review",
        promptType: "meaning",
        answerType: "meaning",
        translationDisplayMode: "ru-en",
        prompt: { japanese: "一", reading: "いち" },
        translations: {
          displayMode: "ru-en",
          primaryRu: "один",
          primaryEn: "one",
          ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
          en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
        },
        acceptedAnswers: [
          { locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" },
          { locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" },
        ],
        blockedAnswers: [{ locale: "ru-RU", text: "линия", sourceKind: "curated" }],
        sortOrder: 1,
      },
      {
        id: "card-kanji-one-reading",
        learningItemId: ITEM_ID,
        itemType: "kanji",
        cardType: "review",
        promptType: "reading",
        answerType: "reading",
        translationDisplayMode: "ru-en",
        prompt: { japanese: "一", reading: "いち" },
        translations: {
          displayMode: "ru-en",
          primaryRu: "один",
          primaryEn: "one",
          ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
          en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
        },
        acceptedAnswers: [
          { locale: "ru-RU", text: "いち", isPrimary: true, sourceKind: "curated" },
        ],
        blockedAnswers: [],
        sortOrder: 2,
      },
    ],
    relations: [
      {
        relationType: "dependency",
        item: {
          id: "item-component-one",
          itemType: "component",
          slug: "component:一",
          japanese: "一",
          reading: null,
          translations: {
            displayMode: "ru-en",
            primaryRu: "компонент один",
            primaryEn: "one component",
            ru: [
              {
                locale: "ru-RU",
                text: "компонент один",
                isPrimary: true,
                sourceKind: "curated",
              },
            ],
            en: [
              {
                locale: "en-US",
                text: "one component",
                isPrimary: true,
                sourceKind: "curated",
              },
            ],
          },
          level: 1,
          jlptLevel: null,
          srs: null,
        },
      },
    ],
    mnemonics: {
      ru: [
        {
          locale: "ru-RU",
          text: "Один предмет легко представить как один штрих.",
          sourceKind: "curated",
        },
        ...(privateMnemonic === null || privateMnemonic.locale !== "ru-RU"
          ? []
          : [
              { locale: "ru-RU" as const, text: privateMnemonic.body, sourceKind: "user" as const },
            ]),
      ],
      en:
        privateMnemonic === null || privateMnemonic.locale !== "en-US"
          ? []
          : [{ locale: "en-US", text: privateMnemonic.body, sourceKind: "user" }],
    },
    hints: {
      ru: [
        {
          locale: "ru-RU",
          text: "Для базового счёта используйте чтение いち.",
          sourceKind: "curated",
        },
      ],
      en: [],
    },
    exampleSentences: [
      {
        id: "sentence-1",
        japaneseText: "一つください。",
        readingText: "ひとつください。",
        translationRu: "Дайте один, пожалуйста.",
        translationEn: "One, please.",
        difficulty: 1,
        attribution: null,
      },
    ],
    attributions: [
      {
        sourceName: "KANJIDIC2",
        licenseName: "CC BY-SA 4.0",
        attributionText: "EDRDG kanji metadata.",
        sourceUrl: "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
      },
      {
        sourceName: "KanjiVG",
        licenseName: "LicenseRef-KanjiVG",
        attributionText: "Stroke order data is derived from KanjiVG.",
        sourceUrl: "https://kanjivg.tagaini.net/",
      },
    ],
    userOverrides: privateOverrides,
  };
}
