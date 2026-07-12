import { expect, type Page, test } from "@playwright/test";

import { type CompleteLessonItemResponse, type LessonQueueItem } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "lesson-session-1";

test.describe("lesson session", () => {
  test("requires every lesson quiz answer before completing one item", async ({ page }) => {
    await signIn(page);
    await mockLessonApi(page);

    await page.goto("/lessons");

    await expect(page.getByRole("heading", { name: "Уроки" })).toBeVisible();
    await expect(page.getByText(/Выбрано: 1 из максимум 5/)).toBeVisible();
    await expect(page.getByText("один / one")).toBeVisible();

    const optionalLesson = page.getByLabel("Выбрать 二: два / two");
    await expect(optionalLesson).not.toBeChecked();
    await optionalLesson.check();
    await expect(page.getByText(/Выбрано: 2 из максимум 5/)).toBeVisible();
    await page.getByRole("button", { name: "Чередовать типы" }).click();
    await expect(page.getByRole("button", { name: "Чередовать типы" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await optionalLesson.uncheck();

    await page.getByRole("button", { name: "Начать урок" }).click();

    await expect(page.getByRole("heading", { name: "Изучение" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Значения" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Чтения" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Связи" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Мнемоника и подсказка" })).toBeVisible();
    await expect(page.getByText("Представьте одну длинную черту.")).toBeVisible();
    await expect(page.getByText("Picture one long horizontal stroke.")).toBeVisible();
    await expect(page.getByText("Моя личная история про единицу.")).toBeVisible();
    await expect(page.getByText("RU · личное")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Примеры употребления" })).toBeVisible();
    await expect(page.getByText("Дайте один, пожалуйста. / One, please.")).toBeVisible();
    await expect(page.getByText("Project examples · LicenseRef-Project-Authored")).toBeVisible();
    await expect(page.getByText("компонент один")).toBeVisible();

    await page.getByRole("button", { name: "Перейти к проверке" }).click();

    await expect(page.getByRole("heading", { name: "Обязательная проверка" })).toBeVisible();
    await expect(page.getByLabel("Ваше значение")).toBeFocused();
    await page.getByLabel("Ваше значение").fill("не один");
    await page.keyboard.press("Enter");

    await expect(page.getByLabel("Ваше чтение")).toBeFocused();
    await page.getByLabel("Ваше чтение").fill("いち");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("alert", { name: "Результат проверки" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Попробуйте ещё раз" })).toBeVisible();
    await expect(page.getByText("один")).toBeVisible();
    await expect(page.getByLabel("Ваше значение")).toBeFocused();
    await page.getByLabel("Ваше значение").fill("один");
    await page.keyboard.press("Enter");

    await expect(
      page.getByText("Сессия завершена. Новые карточки добавлены в систему повторений."),
    ).toBeVisible();
    await expect(page.getByText("Изучено")).toBeVisible();
    await expect(page.getByText("Карточек повторения")).toBeVisible();
  });

  test("starts the existing lesson flow from a saved deck", async ({ page }) => {
    await signIn(page);
    const startBody = await mockDeckLessonApi(page);

    await page.goto("/lessons?deckId=deck-saved");

    await expect(page.getByRole("heading", { name: "Уроки колоды" })).toBeVisible();
    await expect(page.getByText(/Новости на японском\. Выбрано: 1/)).toBeVisible();
    await page.getByRole("button", { name: "Начать урок" }).click();

    await expect(page.getByRole("heading", { name: "Изучение" })).toBeVisible();
    expect(startBody()).toEqual({ deckId: "deck-saved" });
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

async function mockLessonApi(page: Page): Promise<void> {
  await page.route(`${API_BASE_URL}/lessons/queue`, async (route) => {
    await route.fulfill({
      json: {
        items: [lessonQueueItem],
        availableItems: [lessonQueueItem, optionalLessonQueueItem],
        batchLimit: 5,
        remainingToday: 20,
        source: { kind: "course" },
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/start`, async (route) => {
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          finishedAt: null,
          mode: "lesson",
          deckId: null,
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/complete-item`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answers: readonly { readonly cardId: string; readonly answer: string }[];
    };
    const meaningAnswer = body.answers.find((answer) => answer.cardId === "card-kanji-one-meaning");

    await route.fulfill({
      json:
        meaningAnswer?.answer === "один" ? completeLessonItemResponse : failedLessonItemResponse,
    });
  });

  await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/finish`, async (route) => {
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          finishedAt: "2026-06-22T08:04:00.000Z",
          mode: "lesson",
          deckId: null,
        },
      },
    });
  });
}

async function mockDeckLessonApi(page: Page): Promise<() => unknown> {
  let startBody: unknown = null;

  await page.route(`${API_BASE_URL}/lessons/queue?deckId=deck-saved`, async (route) => {
    await route.fulfill({
      json: {
        items: [lessonQueueItem],
        availableItems: [lessonQueueItem],
        batchLimit: 5,
        remainingToday: 20,
        source: { kind: "deck", deckId: "deck-saved", title: "Новости на японском" },
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/start`, async (route) => {
    startBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          finishedAt: null,
          mode: "lesson",
          deckId: "deck-saved",
        },
      },
    });
  });

  return () => startBody;
}

const lessonQueueItem: LessonQueueItem = {
  item: {
    id: "item-kanji-one",
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
    srs: null,
  },
  cards: [
    {
      id: "card-kanji-one-meaning",
      learningItemId: "item-kanji-one",
      itemType: "kanji",
      cardType: "lesson",
      promptType: "meaning",
      answerType: "meaning",
      translationDisplayMode: "ru-en",
      prompt: {
        japanese: "一",
        reading: "いち",
      },
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
      blockedAnswers: [],
      sortOrder: 1,
    },
    {
      id: "card-kanji-one-reading",
      learningItemId: "item-kanji-one",
      itemType: "kanji",
      cardType: "lesson",
      promptType: "reading",
      answerType: "reading",
      translationDisplayMode: "ru-en",
      prompt: {
        japanese: "一",
        reading: "いち",
      },
      translations: {
        displayMode: "ru-en",
        primaryRu: "один",
        primaryEn: "one",
        ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
        en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
      },
      acceptedAnswers: [{ locale: "ru-RU", text: "いち", isPrimary: true, sourceKind: "curated" }],
      blockedAnswers: [],
      sortOrder: 2,
    },
  ],
  unlockedBy: [
    {
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
      srs: {
        stageIndex: 1,
        stageName: "Apprentice 1",
        availableAt: "2026-06-22T08:00:00.000Z",
        burnedAt: null,
        wrongCount: 0,
        correctStreak: 1,
      },
    },
  ],
  mnemonics: {
    ru: [
      {
        locale: "ru-RU",
        text: "Представьте одну длинную черту.",
        sourceKind: "curated",
      },
      {
        locale: "ru-RU",
        text: "Моя личная история про единицу.",
        sourceKind: "user",
      },
    ],
    en: [
      {
        locale: "en-US",
        text: "Picture one long horizontal stroke.",
        sourceKind: "curated",
      },
    ],
  },
  hints: {
    ru: [{ locale: "ru-RU", text: "Считайте от одного.", sourceKind: "curated" }],
    en: [{ locale: "en-US", text: "Count from one.", sourceKind: "curated" }],
  },
  exampleSentences: [
    {
      id: "sentence-one-please",
      japaneseText: "一つください。",
      readingText: "ひとつください。",
      translationRu: "Дайте один, пожалуйста.",
      translationEn: "One, please.",
      difficulty: 1,
      attribution: {
        sourceName: "Project examples",
        licenseName: "LicenseRef-Project-Authored",
        attributionText: "Project-authored example.",
        sourceUrl: null,
      },
    },
  ],
};

const optionalLessonQueueItem: LessonQueueItem = {
  ...lessonQueueItem,
  item: {
    ...lessonQueueItem.item,
    id: "item-kanji-two",
    slug: "kanji:二",
    japanese: "二",
    reading: "に",
    translations: {
      displayMode: "ru-en",
      primaryRu: "два",
      primaryEn: "two",
      ru: [{ locale: "ru-RU", text: "два", isPrimary: true, sourceKind: "curated" }],
      en: [{ locale: "en-US", text: "two", isPrimary: true, sourceKind: "curated" }],
    },
  },
  cards: lessonQueueItem.cards.map((card) => ({
    ...card,
    id: `${card.id}-two`,
    learningItemId: "item-kanji-two",
    prompt: { japanese: "二", reading: "に" },
  })),
};

const completeLessonItemResponse: CompleteLessonItemResponse = {
  itemId: "item-kanji-one",
  passed: true,
  createdSrsStateCount: 2,
  answers: [
    {
      cardId: "card-kanji-one-meaning",
      answerType: "meaning",
      accepted: true,
      result: "correct",
      normalizedAnswer: "один",
      expected: [
        { locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" },
        { locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" },
      ],
    },
    {
      cardId: "card-kanji-one-reading",
      answerType: "reading",
      accepted: true,
      result: "correct",
      normalizedAnswer: "いち",
      expected: [{ locale: "ru-RU", text: "いち", isPrimary: true, sourceKind: "curated" }],
    },
  ],
  cards: [
    {
      cardId: "card-kanji-one-meaning",
      srs: {
        stageIndex: 1,
        stageName: "Apprentice 1",
        availableAt: "2026-06-22T12:00:00.000Z",
        burnedAt: null,
        wrongCount: 0,
        correctStreak: 0,
      },
    },
    {
      cardId: "card-kanji-one-reading",
      srs: {
        stageIndex: 1,
        stageName: "Apprentice 1",
        availableAt: "2026-06-22T12:00:00.000Z",
        burnedAt: null,
        wrongCount: 0,
        correctStreak: 0,
      },
    },
  ],
};

const failedLessonItemResponse: CompleteLessonItemResponse = {
  itemId: "item-kanji-one",
  passed: false,
  createdSrsStateCount: 0,
  answers: [
    {
      cardId: "card-kanji-one-meaning",
      answerType: "meaning",
      accepted: false,
      result: "wrong",
      normalizedAnswer: "не один",
      expected: [
        { locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" },
        { locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" },
      ],
    },
    {
      cardId: "card-kanji-one-reading",
      answerType: "reading",
      accepted: true,
      result: "correct",
      normalizedAnswer: "いち",
      expected: [{ locale: "ru-RU", text: "いち", isPrimary: true, sourceKind: "curated" }],
    },
  ],
  cards: [],
};
