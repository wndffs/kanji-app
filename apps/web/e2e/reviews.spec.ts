import { expect, type Page, test } from "@playwright/test";

import {
  type ContentLocale,
  type ReviewAnswerResponse,
  type ReviewQueueItem,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "review-session-1";

test.describe("review session", () => {
  test("completes one correct review", async ({ page }) => {
    await signIn(page);
    await mockReviewApi(page);

    await page.goto("/reviews");

    await expect(page.getByRole("heading", { name: "Повторения" })).toBeVisible();
    await expect(page.getByText("Готово карточек: 1")).toBeVisible();
    await page.getByRole("button", { name: "Начать повторение" }).click();

    await expect(page.getByRole("heading", { name: "Повторение" })).toBeVisible();
    await expect(page.getByText("Значение", { exact: true })).toBeVisible();
    await expect(page.getByText("Правильные ответы")).toBeHidden();

    await page.getByLabel("Ответ значением").fill("солнце");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await expect(page.getByText("Верно")).toBeVisible();
    await expect(page.getByText("Правильные ответы")).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Правильные ответы" }).getByText("солнце", { exact: true }),
    ).toBeVisible();

    await page.keyboard.press("Enter");

    await expect(page.getByText("Сессия завершена.")).toBeVisible();
    await expect(page.getByText("Ответов")).toBeVisible();
  });

  test("shows feedback for a wrong answer", async ({ page }) => {
    await signIn(page);
    await mockReviewApi(page);

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("луна");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await expect(page.getByText("Ошибка")).toBeVisible();
    await expect(page.getByText("Ответ не принят.")).toBeVisible();
    await expect(page.getByText("Правильные ответы")).toBeVisible();
    await expect(page.getByText("солнце")).toBeVisible();
  });

  test("retries an alternative kanji reading without advancing the review", async ({ page }) => {
    await signIn(page);
    await mockReviewApi(page);

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    const answerInput = page.getByLabel("Ответ значением");
    await answerInput.fill("ひと");
    await page.keyboard.press("Enter");

    const feedback = page.getByRole("region", { name: "Результат ответа" });
    await expect(feedback.getByText("Другое чтение", { exact: true })).toBeVisible();
    await expect(feedback).toHaveClass(/feedback-panel-neutral/);
    await expect(page.getByRole("button", { name: "Ответить снова" })).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(answerInput).toBeFocused();
    await expect(answerInput).toHaveValue("");
    await expect(page.getByText("1 из 1")).toBeVisible();
    await expect(page.getByText("Сессия завершена.")).toBeHidden();
  });

  test("filters expected meanings by English display mode", async ({ page }) => {
    await signIn(page, "en");
    await mockReviewApi(page);

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("wrong");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("list", { name: "Правильные ответы" })).toBeVisible();
    await expect(page.getByText("sun", { exact: true })).toBeVisible();
    await expect(page.getByText("солнце", { exact: true })).toBeHidden();
  });

  test("keeps Enter-only keyboard flow across multiple cards", async ({ page }) => {
    const answerRequests: Array<{ readonly cardId?: string; readonly answerType?: string }> = [];

    await signIn(page);
    await mockReviewApi(page, {
      answerRequests,
      queue: [reviewQueueItem, secondReviewQueueItem],
    });

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();

    const answerInput = page.getByLabel("Ответ значением");
    await expect(answerInput).toBeFocused();
    await answerInput.fill("солнце");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Дальше" })).toBeFocused();
    expect(answerRequests[0]).toMatchObject({
      answerType: "meaning",
      cardId: reviewQueueItem.card.id,
    });

    await page.keyboard.press("Enter");
    await expect(page.getByText("2 из 2")).toBeVisible();
    await expect(page.getByText("月", { exact: true })).toBeVisible();
    await expect(answerInput).toBeFocused();
    await expect(answerInput).toHaveValue("");

    await answerInput.fill("луна");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("button", { name: "Дальше" })).toBeFocused();
    expect(answerRequests[1]).toMatchObject({
      answerType: "meaning",
      cardId: secondReviewQueueItem.card.id,
    });

    await page.keyboard.press("Enter");
    await expect(page.getByText("Сессия завершена.")).toBeVisible();
  });

  test("persists and reloads the selected review order", async ({ page }) => {
    await signIn(page);
    const getMockState = await mockReviewApi(page, {
      queue: [reviewQueueItem, secondReviewQueueItem],
    });

    await page.goto("/reviews");
    await page.getByLabel("Порядок карточек").selectOption("lower-levels-first");

    await expect.poll(getMockState).toMatchObject({
      queueRequests: 2,
      savedSettings: { reviewOrderMode: "lower-levels-first" },
    });
    await expect(page.getByLabel("Порядок карточек")).toHaveValue("lower-levels-first");
  });

  test("shows empty queue state and reloads", async ({ page }) => {
    let requestCount = 0;

    await signIn(page);
    await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
      requestCount += 1;
      await route.fulfill({
        json: {
          items: requestCount === 1 ? [] : [reviewQueueItem],
          orderMode: "shuffled",
        },
      });
    });

    await page.goto("/reviews");
    await expect(page.getByText("Нет карточек к повторению.")).toBeVisible();
    await page.getByRole("button", { name: "Проверить снова" }).click();
    await expect(page.getByText("Готово карточек: 1")).toBeVisible();
  });

  test("keeps mobile review input sticky and Japanese prompt readable", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile", "mobile-only layout assertion");

    await signIn(page);
    await mockReviewApi(page, { queue: [sentenceReviewQueueItem] });

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await expect(page.getByText(sentenceReviewQueueItem.card.prompt.japanese)).toBeVisible();
    await expect(page.locator(".review-japanese")).toHaveAttribute("lang", "ja");

    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

    const metrics = await page.locator(".review-answer-bar").evaluate((element) => {
      const bar = element.getBoundingClientRect();
      const input = element.querySelector("input")?.getBoundingClientRect();
      const prompt = document.querySelector(".review-japanese")?.getBoundingClientRect();
      const promptStyles =
        document.querySelector(".review-japanese") === null
          ? null
          : window.getComputedStyle(document.querySelector(".review-japanese") as HTMLElement);

      return {
        barBottom: bar.bottom,
        barTop: bar.top,
        fontSize: promptStyles === null ? 0 : Number.parseFloat(promptStyles.fontSize),
        inputHeight: input?.height ?? 0,
        promptBottom: prompt?.bottom ?? 0,
        scrollWidth: document.documentElement.scrollWidth,
        viewportHeight: window.innerHeight,
        viewportWidth: window.innerWidth,
      };
    });

    expect(metrics.barTop).toBeGreaterThanOrEqual(0);
    expect(metrics.barBottom).toBeLessThanOrEqual(metrics.viewportHeight + 1);
    expect(metrics.inputHeight).toBeGreaterThanOrEqual(44);
    expect(metrics.fontSize).toBeGreaterThanOrEqual(22);
    expect(metrics.promptBottom).toBeLessThan(metrics.barTop);
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth);
  });

  test("saves a private answer and accepts it in a later review", async ({ page }) => {
    await signIn(page);
    await mockReviewApi(page);

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("день");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Ошибка")).toBeVisible();
    await page.getByRole("button", { name: "Сохранить вариант" }).click();
    await expect(page.getByText("Приватный вариант сохранён.")).toBeVisible();

    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByText("Сессия завершена.")).toBeVisible();

    await page.getByRole("button", { name: "Обновить очередь" }).click();
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("день");
    await page.keyboard.press("Enter");

    await expect(page.getByText("Верно")).toBeVisible();
    await expect(page.getByText("Ответ принят.")).toBeVisible();
  });
});

async function signIn(page: Page, displayMode: TranslationDisplayMode = "ru-en"): Promise<void> {
  await page.addInitScript(
    ({ accessToken, mode }) => {
      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem("kanji-srs.translationDisplayMode", mode);
      window.localStorage.setItem(
        "kanji-srs.user",
        JSON.stringify({
          id: "user-1",
          email: "learner@example.test",
          displayName: "Тестовый ученик",
          role: "USER",
          settings: {
            locale: "ru-RU",
            translationDisplayMode: mode,
            timezone: "Europe/Moscow",
            dailyLessonLimit: 20,
            reviewBudget: 100,
            reviewOrderMode: "shuffled",
            strictMode: false,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN, mode: displayMode },
  );
}

async function mockReviewApi(
  page: Page,
  options: {
    readonly answerRequests?: Array<{ readonly cardId?: string; readonly answerType?: string }>;
    readonly queue?: readonly ReviewQueueItem[];
  } = {},
): Promise<() => { readonly queueRequests: number; readonly savedSettings: unknown }> {
  const privateAnswers = new Set<string>();
  const queue = options.queue ?? [reviewQueueItem];
  let queueRequests = 0;
  let reviewOrderMode = "shuffled";
  let savedSettings: unknown = null;

  await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
    queueRequests += 1;
    await route.fulfill({ json: { items: queue, orderMode: reviewOrderMode } });
  });

  await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
    savedSettings = route.request().postDataJSON();
    const requestedMode = (savedSettings as { readonly reviewOrderMode?: string }).reviewOrderMode;

    if (requestedMode !== undefined) {
      reviewOrderMode = requestedMode;
    }

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
          reviewBudget: 100,
          reviewOrderMode,
          strictMode: false,
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/start`, async (route) => {
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          mode: "review",
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/${SESSION_ID}/answer`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answer?: string;
      readonly answerType?: string;
      readonly cardId?: string;
    };
    const answer = body.answer ?? "";
    const item = queue.find((candidate) => candidate.card.id === body.cardId) ?? queue[0];
    if (item === undefined) {
      await route.fulfill({ status: 404, json: { message: "No review item" } });
      return;
    }
    const accepted = getExpectedAnswerTexts(item).includes(answer) || privateAnswers.has(answer);

    options.answerRequests?.push({
      answerType: body.answerType,
      cardId: body.cardId,
    });

    const response = createAnswerResponse({
      answer,
      accepted,
      item,
      result: accepted ? "correct" : "wrong",
    });

    await route.fulfill({
      json:
        answer === "ひと"
          ? {
              ...response,
              retry: true,
              feedback: {
                ...response.feedback,
                message: "Это существующее чтение кандзи, но эта карточка ожидает другое чтение.",
                diagnostic: { kind: "alternative-reading", matchedAnswer: "ひと" },
              },
              nextSrs: item.srs,
            }
          : response,
    });
  });

  await page.route(`${API_BASE_URL}/reviews/${SESSION_ID}/finish`, async (route) => {
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          finishedAt: "2026-06-22T08:02:00.000Z",
          mode: "review",
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/cards/*/overrides`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly text?: string;
      readonly locale?: ContentLocale;
    };
    const text = body.text ?? "";
    const locale = body.locale ?? "ru-RU";
    privateAnswers.add(text);

    await route.fulfill({
      json: {
        id: "override-1",
        learningCardId:
          route.request().url().split("/cards/")[1]?.split("/")[0] ?? reviewQueueItem.card.id,
        kind: "accepted-answer",
        locale,
        text,
        normalizedText: text,
        note: "Добавлено из сессии повторения.",
        createdAt: "2026-06-22T08:01:00.000Z",
        updatedAt: "2026-06-22T08:01:00.000Z",
      },
    });
  });

  return () => ({ queueRequests, savedSettings });
}

const reviewQueueItem: ReviewQueueItem = {
  card: {
    id: "card-meaning-1",
    learningItemId: "item-kanji-1",
    itemType: "kanji",
    cardType: "review",
    promptType: "meaning",
    answerType: "meaning",
    prompt: {
      japanese: "日",
      reading: "にち",
    },
    sortOrder: 1,
  },
  item: {
    id: "item-kanji-1",
    itemType: "kanji",
    slug: "kanji:日",
    japanese: "日",
    reading: "にち",
    level: 1,
    jlptLevel: "N5",
  },
  dueAt: "2026-06-22T08:00:00.000Z",
  srs: {
    stageIndex: 1,
    stageName: "Apprentice 1",
    availableAt: "2026-06-22T08:00:00.000Z",
    burnedAt: null,
    wrongCount: 0,
    correctStreak: 0,
  },
};

const secondReviewQueueItem: ReviewQueueItem = {
  card: {
    id: "card-meaning-2",
    learningItemId: "item-kanji-2",
    itemType: "kanji",
    cardType: "review",
    promptType: "meaning",
    answerType: "meaning",
    prompt: {
      japanese: "月",
      reading: "げつ",
    },
    sortOrder: 1,
  },
  item: {
    id: "item-kanji-2",
    itemType: "kanji",
    slug: "kanji:月",
    japanese: "月",
    reading: "げつ",
    level: 1,
    jlptLevel: "N5",
  },
  dueAt: "2026-06-22T08:00:00.000Z",
  srs: {
    stageIndex: 1,
    stageName: "Apprentice 1",
    availableAt: "2026-06-22T08:00:00.000Z",
    burnedAt: null,
    wrongCount: 0,
    correctStreak: 0,
  },
};

const sentenceReviewQueueItem: ReviewQueueItem = {
  card: {
    id: "card-sentence-meaning-1",
    learningItemId: "item-sentence-1",
    itemType: "sentence",
    cardType: "review",
    promptType: "meaning",
    answerType: "meaning",
    prompt: {
      japanese: "今日は日本語を勉強します",
      reading: "きょうはにほんごをべんきょうします",
    },
    sortOrder: 1,
  },
  item: {
    id: "item-sentence-1",
    itemType: "sentence",
    slug: "sentence:study-japanese",
    japanese: "今日は日本語を勉強します",
    reading: "きょうはにほんごをべんきょうします",
    level: 1,
    jlptLevel: "N5",
  },
  dueAt: "2026-06-22T08:00:00.000Z",
  srs: {
    stageIndex: 1,
    stageName: "Apprentice 1",
    availableAt: "2026-06-22T08:00:00.000Z",
    burnedAt: null,
    wrongCount: 0,
    correctStreak: 0,
  },
};

function createAnswerResponse({
  answer,
  accepted,
  item,
  result,
}: {
  readonly answer: string;
  readonly accepted: boolean;
  readonly item: ReviewQueueItem;
  readonly result: ReviewAnswerResponse["result"];
}): ReviewAnswerResponse {
  return {
    cardId: item.card.id,
    accepted,
    result,
    normalizedAnswer: answer,
    matchedAnswer: accepted ? answer : null,
    feedback: {
      message: accepted ? "Ответ принят." : "Ответ не принят.",
      expected: getExpectedAnswers(item),
      blockedReason: null,
    },
    previousSrs: item.srs,
    nextSrs: {
      stageIndex: accepted ? 2 : 1,
      stageName: accepted ? "Apprentice 2" : "Apprentice 1",
      availableAt: accepted ? "2026-06-22T16:00:00.000Z" : "2026-06-22T12:00:00.000Z",
      burnedAt: null,
      wrongCount: accepted ? 0 : 1,
      correctStreak: accepted ? 1 : 0,
    },
  };
}

function getExpectedAnswers(item: ReviewQueueItem): ReviewAnswerResponse["feedback"]["expected"] {
  if (item.card.answerType === "reading") {
    return [
      {
        locale: "ru-RU",
        text: item.card.prompt.reading ?? item.item.reading ?? "",
        isPrimary: true,
        sourceKind: "curated",
      },
    ];
  }

  if (item.card.id === secondReviewQueueItem.card.id) {
    return [
      {
        locale: "ru-RU",
        text: "луна",
        isPrimary: true,
        sourceKind: "curated",
      },
      {
        locale: "en-US",
        text: "moon",
        sourceKind: "curated",
      },
    ];
  }

  if (item.card.id === sentenceReviewQueueItem.card.id) {
    return [
      {
        locale: "ru-RU",
        text: "сегодня я занимаюсь японским",
        isPrimary: true,
        sourceKind: "curated",
      },
      {
        locale: "en-US",
        text: "today I study Japanese",
        sourceKind: "curated",
      },
    ];
  }

  return [
    {
      locale: "ru-RU",
      text: "солнце",
      isPrimary: true,
      sourceKind: "curated",
    },
    {
      locale: "en-US",
      text: "sun",
      sourceKind: "curated",
    },
  ];
}

function getExpectedAnswerTexts(item: ReviewQueueItem): readonly string[] {
  return getExpectedAnswers(item).map((answer) => answer.text);
}
