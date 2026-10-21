import { expect, type Page, test } from "@playwright/test";

import {
  type PracticeAnswerResponse,
  type PracticeQueueResponse,
  type PracticeSessionDto,
  type PracticeSource,
  type ReviewQueueItem,
} from "@kanji-srs/shared";

import { createSilentWav } from "./support/test-audio";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "practice-session-1";

type CapturedPracticeAnswerRequest = {
  readonly answerType: string;
  readonly cardId: string;
  readonly listeningEvidence?: {
    readonly completed: boolean;
    readonly playCount: number;
  };
};

test.describe("optional practice", () => {
  for (const staleStatus of [200, 401]) {
    test(`restores the practice source with Back and ignores a late ${staleStatus}`, async ({
      page,
    }) => {
      let release = () => {};
      let started = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const requested = new Promise<void>((resolve) => {
        started = resolve;
      });
      await signIn(page);
      await mockPracticeApi(page);
      await page.route(`${API_BASE_URL}/reviews/practice/queue?source=burned`, async (route) => {
        started();
        await held;
        await route.fulfill({
          status: staleStatus,
          json:
            staleStatus === 200
              ? { source: "burned", items: [secondPracticeItem] }
              : { message: "Expired old request" },
        });
      });
      await page.goto("/practice?source=recent-lessons");
      await expect(page.getByRole("button", { name: "Начать практику" })).toBeVisible();
      await page.getByRole("tab", { name: "Сожжённые" }).click();
      await requested;
      await expect(page).toHaveURL(/source=burned$/);
      await page.goBack();
      await expect(page).toHaveURL(/source=recent-lessons$/);
      await expect(page.getByRole("button", { name: "Начать практику" })).toBeVisible();
      const lateResponse = page.waitForResponse((response) =>
        response.url().includes("queue?source=burned"),
      );
      release();
      await lateResponse;
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(page.getByText("学", { exact: true })).toBeVisible();
      await expect(page.getByText("火", { exact: true })).toBeHidden();
      await expect(page.getByRole("link", { name: "Войти", exact: true })).toBeHidden();
    });
  }

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

  test("supports licensed listening cards without changing SRS", async ({ page }) => {
    const answerRequests: CapturedPracticeAnswerRequest[] = [];

    await signIn(page);
    await mockPracticeApi(page, [listeningPracticeItem], answerRequests);

    await page.goto("/practice");
    await expect(page.getByText("Аудирование", { exact: true })).toBeVisible();
    await expect(page.getByText("一つ", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Начать практику" }).click();

    const answerInput = page.getByLabel("Введите чтение");
    await expect(answerInput).toBeDisabled();
    await expect(page.getByText("一つ", { exact: true })).toBeHidden();
    const playButton = page.getByRole("button", { name: "Воспроизвести аудио" });
    await expect(playButton).toBeEnabled();
    await playButton.click();
    await expect(page.getByText("Запись прослушана. Можно отвечать.")).toBeVisible();

    await answerInput.fill("ひとつ");
    await page.keyboard.press("Enter");

    expect(answerRequests).toEqual([
      {
        answerType: "reading",
        cardId: listeningPracticeItem.card.id,
        listeningEvidence: { completed: true, playCount: 1 },
      },
    ]);
    const listeningDetails = page.locator(".listening-feedback-details");
    await expect(listeningDetails.getByText("一つ", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("ひとつ", { exact: true })).toBeVisible();
    await expect(
      listeningDetails.getByText("один предмет / one thing", { exact: true }),
    ).toBeVisible();
    await expect(listeningDetails.getByText("Project speaker", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("Project recordings", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("Project-owned audio", { exact: true })).toBeVisible();
    await expect(page.getByText("Без изменений", { exact: true })).toBeVisible();
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
  answerRequests?: CapturedPracticeAnswerRequest[],
): Promise<void> {
  let activeSession: PracticeSessionDto | null = null;

  await page.route("https://media.example.test/**", async (route) => {
    await route.fulfill({
      body: createSilentWav(800),
      contentType: "audio/wav",
      headers: { "Accept-Ranges": "bytes" },
    });
  });

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

  await page.route(`${API_BASE_URL}/reviews/practice/${SESSION_ID}/answer`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answer: string;
      readonly answerType: string;
      readonly cardId: string;
      readonly listeningEvidence?: CapturedPracticeAnswerRequest["listeningEvidence"];
    };
    const item = items.find((candidate) => candidate.card.id === body.cardId) ?? items[0];
    expect(body.answerType).toBe(item?.card.answerType);
    answerRequests?.push({
      answerType: body.answerType,
      cardId: body.cardId,
      listeningEvidence: body.listeningEvidence,
    });
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
              message: "Это существующее чтение кандзи, но эта карточка ожидает другое чтение.",
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
  });

  await page.route(`${API_BASE_URL}/reviews/practice/${SESSION_ID}/finish`, async (route) => {
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

const listeningPracticeItem: ReviewQueueItem = {
  card: {
    id: "card-listening-word-1",
    learningItemId: "item-word-1",
    itemType: "word",
    cardType: "review",
    promptType: "listening",
    answerType: "reading",
    prompt: { japanese: "一つ", reading: "ひとつ" },
    sortOrder: 1,
    audio: {
      id: "audio-word-1",
      learningItemId: "item-word-1",
      mediaUrl: "https://media.example.test/hitotsu.wav",
      storageKey: "audio/project/hitotsu.wav",
      checksumSha256: "a".repeat(64),
      durationMs: 800,
      locale: "ja-JP",
      speakerName: "Project speaker",
      voiceMetadata: null,
      sourceName: "Project recordings",
      sourceUrl: null,
      licenseName: "Project-owned audio",
      licenseUrl: null,
      attributionText: "Recorded for Kanji SRS.",
      importRunId: null,
      status: "published",
    },
  },
  item: {
    id: "item-word-1",
    itemType: "word",
    slug: "word:hitotsu",
    japanese: "一つ",
    reading: "ひとつ",
    level: 1,
    jlptLevel: "N5",
    translations: {
      displayMode: "ru-en",
      primaryRu: "один предмет",
      primaryEn: "one thing",
      ru: [{ locale: "ru-RU", text: "один предмет", isPrimary: true }],
      en: [{ locale: "en-US", text: "one thing", isPrimary: true }],
    },
  },
  dueAt: "2026-06-22T08:00:00.000Z",
  srs: {
    stageIndex: 9,
    stageName: "Burned",
    availableAt: null,
    burnedAt: "2026-06-20T08:00:00.000Z",
    wrongCount: 0,
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
