import { expect, type Page, test } from "@playwright/test";

import {
  type ContentLocale,
  type ReviewAnswerResponse,
  type ReviewQueueItem,
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

async function mockReviewApi(page: Page): Promise<void> {
  const privateAnswers = new Set<string>();

  await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
    await route.fulfill({ json: { items: [reviewQueueItem] } });
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
    const body = route.request().postDataJSON() as { readonly answer?: string };
    const answer = body.answer ?? "";
    const accepted = answer === "солнце" || privateAnswers.has(answer);

    await route.fulfill({
      json: createAnswerResponse({
        answer,
        accepted,
        result: accepted ? "correct" : "wrong",
      }),
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

  await page.route(`${API_BASE_URL}/cards/${reviewQueueItem.card.id}/overrides`, async (route) => {
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
        learningCardId: reviewQueueItem.card.id,
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

function createAnswerResponse({
  answer,
  accepted,
  result,
}: {
  readonly answer: string;
  readonly accepted: boolean;
  readonly result: ReviewAnswerResponse["result"];
}): ReviewAnswerResponse {
  return {
    cardId: reviewQueueItem.card.id,
    accepted,
    result,
    normalizedAnswer: answer,
    matchedAnswer: accepted ? answer : null,
    feedback: {
      message: accepted ? "Ответ принят." : "Ответ не принят.",
      expected: [
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
      ],
      blockedReason: null,
    },
    previousSrs: reviewQueueItem.srs,
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
