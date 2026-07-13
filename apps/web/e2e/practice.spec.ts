import { expect, type Page, test } from "@playwright/test";

import {
  type PracticeAnswerResponse,
  type PracticeQueueResponse,
  type PracticeSource,
  type ReviewQueueItem,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("optional practice", () => {
  test("practises a selected source without showing an SRS transition", async ({ page }) => {
    await signIn(page);
    await mockPracticeApi(page);

    await page.goto("/practice");

    await expect(page.getByRole("heading", { name: "Практика" })).toBeVisible();
    await expect(page.getByText("Карточек: 1. SRS и расписание не изменяются.")).toBeVisible();
    await expect(page.getByText("学")).toBeVisible();

    await page.getByRole("tab", { name: "Сожжённые" }).click();
    await expect(page.getByRole("tab", { name: "Сожжённые" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Карточек: 1. SRS и расписание не изменяются.")).toBeVisible();

    await page.getByRole("button", { name: "Начать практику" }).click();
    await expect(page.getByRole("region", { name: "Сессия практики" })).toBeVisible();
    await expect(page.getByText("Без изменения SRS")).toBeVisible();
    await expect(page.getByLabel("Введите значение")).toBeFocused();
    await page.getByLabel("Введите значение").fill("wrong answer");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Ответ не принят." })).toBeVisible();
    await expect(page.getByText("study")).toBeVisible();
    await expect(page.getByText("Без изменений")).toBeVisible();
    await page.getByRole("button", { name: "Дальше" }).click();

    await expect(page.getByRole("region", { name: "Результат практики" })).toBeVisible();
    await expect(page.getByText("Практика завершена")).toBeVisible();
    await expect(page.getByText("Ошибок")).toBeVisible();
  });

  test("retries an alternative kanji reading without counting a practice error", async ({
    page,
  }) => {
    await signIn(page);
    await mockPracticeApi(page);

    await page.goto("/practice");
    await page.getByRole("button", { name: "Начать практику" }).click();
    const answerInput = page.getByLabel("Введите значение");
    await answerInput.fill("ひと");
    await page.keyboard.press("Enter");

    const feedback = page.getByRole("region", { name: "Результат ответа" });
    await expect(feedback.getByText("Другое чтение", { exact: true })).toBeVisible();
    await expect(feedback).toHaveClass(/feedback-panel-neutral/);
    await page.getByRole("button", { name: "Ответить снова" }).click();

    await expect(answerInput).toBeFocused();
    await expect(answerInput).toHaveValue("");
    await expect(page.getByText("Верно: 0")).toBeVisible();
    await expect(page.getByText("Ошибок: 0")).toBeVisible();
    await expect(page.getByText("Практика завершена")).toBeHidden();
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

async function mockPracticeApi(page: Page): Promise<void> {
  await page.route(`${API_BASE_URL}/reviews/practice/queue?*`, async (route) => {
    const source = new URL(route.request().url()).searchParams.get("source") as PracticeSource;
    const response: PracticeQueueResponse = { source, items: [practiceItem] };
    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/reviews/practice/answer`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answer: string;
      readonly answerType: string;
      readonly cardId: string;
    };
    expect(body).toMatchObject({ cardId: "card-study-meaning", answerType: "meaning" });
    await route.fulfill({
      json:
        body.answer === "ひと"
          ? {
              ...practiceAnswer,
              normalizedAnswer: "ひと",
              retry: true,
              feedback: {
                ...practiceAnswer.feedback,
                message: "Это существующее чтение кандзи, но эта карточка ожидает другое чтение.",
                diagnostic: { kind: "alternative-reading", matchedAnswer: "ひと" },
              },
            }
          : practiceAnswer,
    });
  });
}

const practiceItem: ReviewQueueItem = {
  card: {
    id: "card-study-meaning",
    learningItemId: "item-study",
    itemType: "kanji",
    cardType: "review",
    promptType: "meaning",
    answerType: "meaning",
    prompt: { japanese: "学", reading: "がく" },
    sortOrder: 1,
  },
  item: {
    id: "item-study",
    itemType: "kanji",
    slug: "kanji:学",
    japanese: "学",
    reading: "がく",
    level: 1,
    jlptLevel: "N5",
  },
  dueAt: "2026-06-22T08:00:00.000Z",
  srs: {
    stageIndex: 9,
    stageName: "Burned",
    availableAt: null,
    burnedAt: "2026-06-20T08:00:00.000Z",
    wrongCount: 2,
    correctStreak: 4,
  },
};

const practiceAnswer: PracticeAnswerResponse = {
  cardId: "card-study-meaning",
  accepted: false,
  result: "wrong",
  normalizedAnswer: "wrong answer",
  matchedAnswer: null,
  feedback: {
    message: "Ответ не принят.",
    expected: [
      { locale: "ru-RU", text: "учёба", isPrimary: true, sourceKind: "curated" },
      { locale: "en-US", text: "study", isPrimary: true, sourceKind: "curated" },
    ],
    blockedReason: null,
  },
};
