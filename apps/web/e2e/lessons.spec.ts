import { expect, type Page, test } from "@playwright/test";

import { type CompleteLessonItemResponse, type LessonQueueItem } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "lesson-session-1";

test.describe("lesson session", () => {
  test("requires every lesson quiz answer before completing one item", async ({ page }) => {
    await signIn(page);
    const savedSettings = await mockLessonApi(page);

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
    await expect.poll(savedSettings).toEqual({ lessonOrderMode: "interleaved" });
    await optionalLesson.uncheck();

    await page.getByRole("button", { name: "Начать урок" }).click();

    await expect(page.getByRole("heading", { name: "Изучение" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Значение" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Значения" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Связи" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Мнемоника и подсказка" })).toBeVisible();
    await expect(page.getByText("Представьте одну длинную черту.")).toBeVisible();
    await expect(page.getByText("Picture one long horizontal stroke.")).toBeVisible();
    await expect(page.getByText("компонент один")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Чтения" })).not.toBeVisible();
    await expect(page.getByText("Моя личная история про единицу.")).not.toBeVisible();

    await page.getByRole("button", { name: "Далее: Чтение" }).click();

    await expect(page.getByRole("tab", { name: "Чтение" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Чтения" })).toBeVisible();
    await expect(page.getByText("Свяжите いち со значением один.")).toBeVisible();
    await page.getByRole("button", { name: "Озвучить чтение" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __spokenJapanese: readonly { text: string; lang: string; rate: number }[];
            }
          ).__spokenJapanese.at(-1),
        ),
      )
      .toEqual({ text: "いち", lang: "ja-JP", rate: 0.78 });
    await expect(page.getByRole("button", { name: "Предыдущий этап" })).toBeVisible();
    await page.getByRole("button", { name: "Предыдущий этап" }).click();
    await expect(page.getByRole("tab", { name: "Значение" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Чтение" }).click();

    await page.getByRole("button", { name: "Далее: Контекст" }).click();

    await expect(page.getByRole("tab", { name: "Контекст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "История" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Употребление" })).toBeVisible();
    await expect(page.getByText("Моя личная история про единицу.")).toBeVisible();
    await expect(page.getByText("RU · личное")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Примеры употребления" })).toBeVisible();
    await expect(page.getByText("Дайте один, пожалуйста. / One, please.")).toBeVisible();
    await expect(page.getByText("Project examples · LicenseRef-Project-Authored")).toBeVisible();
    await page.getByRole("button", { name: "Озвучить пример 一つください。" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __spokenJapanese: readonly { text: string; lang: string; rate: number }[];
            }
          ).__spokenJapanese.at(-1),
        ),
      )
      .toEqual({ text: "一つください。", lang: "ja-JP", rate: 0.78 });

    await page.getByRole("button", { name: "Перейти к проверке" }).click();

    await expect(page.getByRole("heading", { name: "Обязательная проверка" })).toBeVisible();
    await expect(page.getByLabel("Ваше чтение")).toBeFocused();
    await page.getByLabel("Ваше чтение").fill("ひと");
    await page.keyboard.press("Enter");

    await expect(
      page.getByRole("heading", { name: "Это другое чтение этого кандзи" }),
    ).toBeVisible();
    await expect(
      page.getByText(/Чтение существует, но эта карточка проверяет другое/),
    ).toBeVisible();
    await expect(page.getByText("いち")).toBeVisible();
    await expect(page.getByRole("button", { name: "Ответить снова" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Ваше чтение")).toBeFocused();
    await page.getByLabel("Ваше чтение").fill("いち");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Верно" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Продолжить" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByLabel("Ваше значение")).toBeFocused();
    await page.getByLabel("Ваше значение").fill("один");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: "Верно" })).toBeVisible();
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
    expect(startBody()).toEqual({ deckId: "deck-saved", itemIds: ["item-kanji-one"] });
  });

  test("resumes the server-confirmed item and study phase after reload", async ({ page }) => {
    await signIn(page);
    let progressBody: unknown = null;
    let active = true;
    let abandonCalled = false;

    await page.route(`${API_BASE_URL}/lessons/active`, async (route) => {
      await route.fulfill({
        json: active
          ? {
              session: lessonSession("reading"),
              items: [lessonQueueItem],
              source: { kind: "course" },
              completedItemCount: 0,
              createdSrsStateCount: 0,
            }
          : {
              session: null,
              items: [],
              source: null,
              completedItemCount: 0,
              createdSrsStateCount: 0,
            },
      });
    });
    await page.route(`${API_BASE_URL}/lessons/queue`, async (route) => {
      await route.fulfill({
        json: {
          items: [lessonQueueItem],
          availableItems: [lessonQueueItem],
          batchLimit: 5,
          remainingToday: 20,
          orderMode: "course",
          source: { kind: "course" },
        },
      });
    });
    await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/progress`, async (route) => {
      progressBody = route.request().postDataJSON();
      const body = progressBody as { currentItemId: string; phase: "context" };
      await route.fulfill({ json: { session: lessonSession(body.phase, body.currentItemId) } });
    });
    await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/abandon`, async (route) => {
      active = false;
      abandonCalled = true;
      await route.fulfill({
        json: {
          session: { ...lessonSession("context"), finishedAt: "2026-06-22T08:05:00.000Z" },
        },
      });
    });

    await page.goto("/lessons");

    await expect(page.getByRole("heading", { name: "Изучение" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Чтение" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Чтения" })).toBeVisible();
    await page.getByRole("button", { name: "Далее: Контекст" }).click();
    await expect(page.getByRole("tab", { name: "Контекст" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(progressBody).toEqual({ currentItemId: "item-kanji-one", phase: "context" });

    await page.getByRole("button", { name: "Выйти из урока" }).click();
    const exitDialog = page.getByRole("dialog", { name: "Завершить текущий урок?" });
    await expect(exitDialog).toBeVisible();
    await expect(exitDialog.getByRole("button", { name: "Продолжить урок" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(exitDialog).not.toBeVisible();

    await page.getByRole("button", { name: "Выйти из урока" }).click();
    await exitDialog.getByRole("button", { name: "Завершить урок" }).click();
    await expect(page.getByRole("heading", { name: "Уроки" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Начать урок" })).toBeVisible();
    expect(abandonCalled).toBe(true);
  });
});

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ({ accessToken }) => {
      const speechWindow = window as typeof window & {
        __spokenJapanese: { text: string; lang: string; rate: number }[];
      };
      speechWindow.__spokenJapanese = [];
      class MockSpeechSynthesisUtterance {
        lang = "";
        pitch = 1;
        rate = 1;
        text: string;
        voice: SpeechSynthesisVoice | null = null;

        constructor(text: string) {
          this.text = text;
        }
      }

      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          addEventListener: () => undefined,
          cancel: () => undefined,
          getVoices: () => [{ default: true, lang: "ja-JP", name: "Test Japanese" }],
          removeEventListener: () => undefined,
          speak: (utterance: MockSpeechSynthesisUtterance) => {
            speechWindow.__spokenJapanese.push({
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
            });
          },
        },
      });

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
            lessonBatchSize: 5,
            lessonOrderMode: "course",
            reviewBudget: 100,
            strictMode: false,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN },
  );
}

async function mockLessonApi(page: Page): Promise<() => unknown> {
  let savedSettings: unknown = null;
  await mockNoActiveLesson(page);

  await page.route(`${API_BASE_URL}/lessons/queue`, async (route) => {
    await route.fulfill({
      json: {
        items: [lessonQueueItem],
        availableItems: [lessonQueueItem, optionalLessonQueueItem],
        batchLimit: 5,
        remainingToday: 20,
        orderMode: "course",
        source: { kind: "course" },
      },
    });
  });

  await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
    savedSettings = route.request().postDataJSON();
    await route.fulfill({
      json: {
        id: "user-1",
        email: "learner@example.test",
        displayName: "Тестовый ученик",
        role: "USER",
        settings: {
          locale: "ru-RU",
          translationDisplayMode: "ru-en",
          timezone: "Europe/Moscow",
          dailyLessonLimit: 20,
          lessonBatchSize: 5,
          lessonOrderMode: "interleaved",
          reviewBudget: 100,
          strictMode: false,
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/start`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({ itemIds: ["item-kanji-one"] });
    await route.fulfill({
      json: {
        session: lessonSession("meaning"),
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/progress`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly currentItemId: string;
      readonly phase: "meaning" | "reading" | "context" | "quiz";
    };
    await route.fulfill({ json: { session: lessonSession(body.phase, body.currentItemId) } });
  });

  await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/check-answer`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly cardId: string;
      readonly answer: string;
    };
    const acceptedAnswer = completeLessonItemResponse.answers.find(
      (answer) => answer.cardId === body.cardId,
    );
    const failedAnswer = failedLessonItemResponse.answers.find(
      (answer) => answer.cardId === body.cardId,
    );
    const alternativeReadingAnswer =
      body.cardId === "card-kanji-one-reading" && body.answer === "ひと"
        ? {
            ...acceptedAnswer,
            accepted: false,
            result: "wrong" as const,
            normalizedAnswer: "ひと",
            diagnostic: { kind: "alternative-reading" as const, matchedAnswer: "ひと" },
          }
        : null;

    await route.fulfill({
      json:
        alternativeReadingAnswer ??
        (body.cardId === "card-kanji-one-meaning" && body.answer !== "один"
          ? failedAnswer
          : acceptedAnswer),
    });
  });

  await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/complete-item`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answers: readonly { readonly cardId: string; readonly answer: string }[];
    };
    expect(body.answers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ cardId: "card-kanji-one-meaning", answer: "один" }),
        expect.objectContaining({ cardId: "card-kanji-one-reading", answer: "いち" }),
      ]),
    );
    await route.fulfill({
      json: completeLessonItemResponse,
    });
  });

  await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/finish`, async (route) => {
    await route.fulfill({
      json: {
        session: { ...lessonSession("quiz"), finishedAt: "2026-06-22T08:04:00.000Z" },
      },
    });
  });

  return () => savedSettings;
}

async function mockDeckLessonApi(page: Page): Promise<() => unknown> {
  let startBody: unknown = null;
  await mockNoActiveLesson(page);

  await page.route(`${API_BASE_URL}/lessons/queue?deckId=deck-saved`, async (route) => {
    await route.fulfill({
      json: {
        items: [lessonQueueItem],
        availableItems: [lessonQueueItem],
        batchLimit: 5,
        remainingToday: 20,
        orderMode: "interleaved",
        source: { kind: "deck", deckId: "deck-saved", title: "Новости на японском" },
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/start`, async (route) => {
    startBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        session: lessonSession("meaning", "item-kanji-one", "deck-saved"),
      },
    });
  });

  return () => startBody;
}

async function mockNoActiveLesson(page: Page): Promise<void> {
  await page.route(`${API_BASE_URL}/lessons/active`, async (route) => {
    await route.fulfill({
      json: {
        session: null,
        items: [],
        source: null,
        completedItemCount: 0,
        createdSrsStateCount: 0,
      },
    });
  });
}

function lessonSession(
  phase: "meaning" | "reading" | "context" | "quiz",
  currentItemId = "item-kanji-one",
  deckId: string | null = null,
) {
  return {
    id: SESSION_ID,
    startedAt: "2026-06-22T08:00:00.000Z",
    finishedAt: null,
    mode: "lesson" as const,
    deckId,
    itemIds: ["item-kanji-one"],
    currentItemId,
    phase,
  };
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
  mnemonics: [
    {
      purpose: "meaning",
      texts: {
        ru: [
          {
            locale: "ru-RU",
            text: "Представьте одну длинную черту.",
            sourceKind: "curated",
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
    },
    {
      purpose: "reading",
      texts: {
        ru: [
          {
            locale: "ru-RU",
            text: "Свяжите いち со значением один.",
            sourceKind: "curated",
          },
        ],
        en: [
          {
            locale: "en-US",
            text: "Connect いち with the meaning one.",
            sourceKind: "curated",
          },
        ],
      },
    },
    {
      purpose: "story",
      texts: {
        ru: [
          {
            locale: "ru-RU",
            text: "Моя личная история про единицу.",
            sourceKind: "user",
          },
        ],
        en: [],
      },
    },
  ],
  hints: [
    {
      purpose: "usage",
      texts: {
        ru: [{ locale: "ru-RU", text: "Считайте от одного.", sourceKind: "curated" }],
        en: [{ locale: "en-US", text: "Count from one.", sourceKind: "curated" }],
      },
    },
  ],
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
