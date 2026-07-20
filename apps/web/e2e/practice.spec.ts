import { expect, type Page, test } from "@playwright/test";

import {
  type PracticeAnswerResponse,
  type PracticeQueueResponse,
  type PracticeSessionDto,
  type PracticeSource,
  type ReviewQueueItem,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "practice-session-1";

test.describe("optional practice", () => {
  test("practises a selected source without showing an SRS transition", async ({ page }) => {
    await signIn(page);
    await mockPracticeApi(page);

    await page.goto("/practice?source=burned");

    await expect(page.getByRole("heading", { name: "Практика" })).toBeVisible();
    await expect(page.getByText("Карточек: 1. SRS и расписание не изменяются.")).toBeVisible();
    await expect(page.getByText("学")).toBeVisible();

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

  test("resumes the saved queue and progress after a reload", async ({ page }) => {
    await signIn(page);
    await mockPracticeApi(page, [practiceItem, secondPracticeItem]);

    await page.goto("/practice");
    await page.getByRole("button", { name: "Начать практику" }).click();
    await page.getByLabel("Введите значение").fill("wrong answer");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();

    await expect(page.getByText("2 из 2")).toBeVisible();
    await expect(page.getByText("火", { exact: true })).toBeVisible();
    await expect(page.getByText("Ошибок: 1")).toBeVisible();

    await page.reload();

    await expect(page.getByText("Сохранено: 1 из 2.")).toBeVisible();
    await page.getByRole("button", { name: "Продолжить практику" }).click();
    await expect(page.getByText("2 из 2")).toBeVisible();
    await expect(page.getByText("火", { exact: true })).toBeVisible();
    await expect(page.getByText("Ошибок: 1")).toBeVisible();
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

async function mockPracticeApi(
  page: Page,
  items: readonly ReviewQueueItem[] = [practiceItem],
): Promise<void> {
  let activeSession: PracticeSessionDto | null = null;

  await page.route(`${API_BASE_URL}/reviews/practice/queue?*`, async (route) => {
    const source = new URL(route.request().url()).searchParams.get("source") as PracticeSource;
    const response: PracticeQueueResponse = { source, items };
    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/reviews/practice/active?*`, async (route) => {
    const source = new URL(route.request().url()).searchParams.get("source") as PracticeSource;
    const session = activeSession?.source === source ? activeSession : null;
    await route.fulfill({ json: { session, items: session === null ? [] : items } });
  });

  await page.route(`${API_BASE_URL}/reviews/practice/start`, async (route) => {
    const body = route.request().postDataJSON() as { readonly source: PracticeSource };
    activeSession ??= {
      id: SESSION_ID,
      startedAt: "2026-06-22T08:00:00.000Z",
      source: body.source,
      currentIndex: 0,
      totalItems: items.length,
      progress: { answered: 0, accepted: 0, missed: 0 },
    };
    await route.fulfill({ json: { session: activeSession, items } });
  });

  await page.route(
    `${API_BASE_URL}/reviews/practice/${SESSION_ID}/answer`,
    async (route) => {
      const body = route.request().postDataJSON() as {
        readonly answer: string;
        readonly answerType: string;
        readonly cardId: string;
      };
      expect(body.answerType).toBe("meaning");
      const isRetry = body.answer === "ひと";
      const answer = {
        ...practiceAnswer,
        cardId: body.cardId,
        ...(isRetry
          ? {
              normalizedAnswer: "ひと",
              retry: true,
              feedback: {
                ...practiceAnswer.feedback,
                message:
                  "Это существующее чтение кандзи, но эта карточка ожидает другое чтение.",
                diagnostic: { kind: "alternative-reading", matchedAnswer: "ひと" },
              },
            }
          : {}),
      };

      if (!isRetry && activeSession !== null) {
        activeSession = {
          ...activeSession,
          currentIndex: activeSession.currentIndex + 1,
          progress: {
            answered: activeSession.progress.answered + 1,
            accepted: activeSession.progress.accepted,
            missed: activeSession.progress.missed + 1,
          },
        };
      }

      await route.fulfill({ json: { answer, session: activeSession } });
    },
  );

  await page.route(
    `${API_BASE_URL}/reviews/practice/${SESSION_ID}/finish`,
    async (route) => {
      if (activeSession === null) {
        await route.fulfill({ status: 404, json: { message: "No active practice session" } });
        return;
      }

      const session = activeSession;
      activeSession = null;
      await route.fulfill({
        json: {
          session: {
            ...session,
            finishedAt: "2026-06-22T08:02:00.000Z",
          },
          summary: session.progress,
        },
      });
    },
  );
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

const secondPracticeItem: ReviewQueueItem = {
  ...practiceItem,
  card: {
    ...practiceItem.card,
    id: "card-fire-meaning",
    learningItemId: "item-fire",
    prompt: { japanese: "火", reading: "ひ" },
  },
  item: {
    ...practiceItem.item,
    id: "item-fire",
    slug: "kanji:火",
    japanese: "火",
    reading: "ひ",
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
