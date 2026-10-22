import { expect, type Page, test } from "@playwright/test";

import {
  type ContentLocale,
  type ActiveReviewSessionResponse,
  type InterfacePreferences,
  type ReviewAnswerResponse,
  type ReviewQueueItem,
  type ReviewSessionSummaryDto,
  type TranslationDisplayMode,
} from "@kanji-srs/shared";

import { createSilentWav } from "./support/test-audio";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "review-session-1";

type CapturedReviewAnswerRequest = {
  readonly cardId?: string;
  readonly answerType?: string;
  readonly listeningEvidence?: {
    readonly completed: boolean;
    readonly playCount: number;
  };
};

test.describe("review session", () => {
  test("reports browser offline hints before receiving an API response", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    await page.goto("/login");
    await expect(page.getByRole("status", { name: "Состояние сети" })).toContainText(
      "Браузер сообщает: нет сети",
    );
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByRole("status", { name: "Состояние сети" })).toContainText(
      "Соединение с сервером ещё не подтверждено",
    );
  });

  test("retains an unconfirmed answer across offline hints without automatic retry", async ({
    page,
  }) => {
    await signIn(page);
    await mockReviewApi(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
    });
    let attempts = 0;
    let failAnswer = true;
    await page.route(`${API_BASE_URL}/reviews/${SESSION_ID}/answer`, async (route) => {
      attempts++;
      if (failAnswer) await route.abort("internetdisconnected");
      else await route.fallback();
    });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await expect(page.getByRole("status", { name: "Состояние сети" })).toBeHidden();
    const storedBefore = await page.evaluate(() => ({ ...localStorage }));
    await page.getByLabel("Ответ значением").fill("солнце");
    await page.evaluate(() => window.dispatchEvent(new Event("offline")));
    await expect(page.getByRole("status", { name: "Состояние сети" })).toContainText(
      "Браузер сообщает: нет сети",
    );
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "Результат запроса не подтверждён" }),
    ).toBeVisible();
    await expect(page.getByLabel("Ответ значением")).toHaveValue("солнце");
    expect(await page.evaluate(() => ({ ...localStorage }))).toEqual(storedBefore);
    await expect(page.getByText("Сессия завершена.")).toBeHidden();
    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeHidden();
    expect(attempts).toBe(1);
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.getByRole("status", { name: "Состояние сети" })).toContainText(
      "Соединение с сервером ещё не подтверждено",
    );
    await expect(page.getByLabel("Ответ значением")).toHaveValue("солнце");
    expect(attempts).toBe(1);
    failAnswer = false;
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await expect(page.getByRole("status", { name: "Состояние сети" })).toBeHidden();
    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByText("Сессия завершена.")).toBeVisible();
    expect(attempts).toBe(2);
  });

  test("keeps an active snapshot paused during vacation and resumes it afterwards", async ({
    page,
  }) => {
    await signIn(page);
    await mockReviewApi(page, { resumable: true });
    let vacation = false;
    await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
      await route.fulfill({
        json: {
          items: vacation ? [] : [reviewQueueItem],
          orderMode: "shuffled",
          vacationStartedAt: vacation ? "2026-10-21T09:00:00.000Z" : null,
        },
      });
    });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await expect(page.getByLabel("Ответ значением")).toBeVisible();
    vacation = true;
    await page.reload();
    await expect(page.getByText("Режим отпуска включён.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Ответ значением")).toBeHidden();
    vacation = false;
    await page.reload();
    await expect(page.getByLabel("Ответ значением")).toBeVisible();
    await page.getByLabel("Ответ значением").fill("солнце");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByText("Сессия завершена.")).toBeVisible();
  });

  test("resumes only unanswered scheduled cards and preserves the original position", async ({
    page,
  }) => {
    const answerRequests: CapturedReviewAnswerRequest[] = [];
    await signIn(page);
    await mockReviewApi(page, {
      resumable: true,
      queue: [reviewQueueItem, secondReviewQueueItem],
      answerRequests,
    });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("солнце");
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("2 из 2", { exact: true })).toBeVisible();
    await expect(page.getByText("月", { exact: true })).toBeVisible();
    await page.getByLabel("Ответ значением").fill("луна");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByText("Сессия завершена.")).toBeVisible();
    await expect(page.getByText("100%", { exact: true })).toBeVisible();
    expect(answerRequests.map((request) => request.cardId)).toEqual([
      reviewQueueItem.card.id,
      secondReviewQueueItem.card.id,
    ]);
  });

  test("corrects misses after scheduled cards without changing original review accuracy", async ({
    page,
  }) => {
    const answerRequests: CapturedReviewAnswerRequest[] = [];
    const correctionRequests: string[] = [];
    await signIn(page);
    await mockReviewApi(page, {
      resumable: true,
      queue: [reviewQueueItem, secondReviewQueueItem],
      answerRequests,
      correctionRequests,
    });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("wrong");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByText("月", { exact: true })).toBeVisible();
    await page.getByLabel("Ответ значением").fill("луна");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByRole("heading", { name: "Исправление ошибок" })).toBeVisible();
    await expect(page.getByText("日", { exact: true })).toBeVisible();
    await page.getByLabel("Ответ значением").fill("still wrong");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Без изменений", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ответить снова" }).click();
    await expect(page.getByLabel("Ответ значением")).toBeFocused();
    await page.getByLabel("Ответ значением").fill("солнце");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();
    await expect(page.getByText("Сессия завершена.")).toBeVisible();
    await expect(page.getByText("50%", { exact: true })).toBeVisible();
    expect(answerRequests).toHaveLength(2);
    expect(correctionRequests).toEqual(["still wrong", "солнце"]);
  });

  test("resumes corrections after reload and never treats a failed write as completion", async ({
    page,
  }) => {
    const answerRequests: CapturedReviewAnswerRequest[] = [];
    const correctionRequests: string[] = [];
    await signIn(page);
    await mockReviewApi(page, {
      resumable: true,
      answerRequests,
      correctionRequests,
      failCorrectionOnce: true,
    });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByLabel("Ответ значением").fill("wrong");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Дальше" }).click();
    await page.reload();
    await expect(page.getByRole("heading", { name: "Исправление ошибок" })).toBeVisible();
    await page.getByLabel("Ответ значением").fill("солнце");
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("alert").filter({ hasText: "Не удалось сохранить исправление." }),
    ).toBeVisible();
    await expect(page.getByLabel("Ответ значением")).toHaveValue("солнце");
    await expect(page.getByText("Сессия завершена.")).toBeHidden();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
    await page.reload();
    await expect(page.getByText("Сессия завершена.")).toBeVisible();
    await expect(page.getByText("0%", { exact: true })).toBeVisible();
    expect(answerRequests).toHaveLength(1);
    expect(correctionRequests).toEqual(["солнце", "солнце"]);
  });

  for (const preset of ["standard", "large", "extra-large"] as const) {
    test(`keeps ${preset} Japanese text readable without horizontal overflow`, async ({
      page,
    }, testInfo) => {
      await signIn(page, "ru-en", false, { studyTextSize: preset, interfaceTheme: "dark" });
      await mockReviewApi(page, { queue: [sentenceReviewQueueItem] });
      await page.goto("/reviews");
      await page.getByRole("button", { name: "Начать повторение" }).click();
      const metrics = await page.locator(".review-japanese").evaluate((element) => ({
        size: Number.parseFloat(getComputedStyle(element).fontSize),
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
      const sizes =
        testInfo.project.name === "mobile"
          ? { standard: 24, large: 28, "extra-large": 32 }
          : { standard: 36, large: 42, "extra-large": 48 };
      expect(metrics.size).toBe(sizes[preset]);
      expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
      await expect(page.locator("html")).toHaveAttribute("data-interface-theme", "dark");
    });
  }

  test("completes one correct review", async ({ page }) => {
    await signIn(page, "ru-en", true);
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
    await expect(page.getByText(/Повышение ·/)).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __answerSoundFrequencies: readonly number[];
              }
            ).__answerSoundFrequencies[0],
        ),
      )
      .toBe(660);

    await page.keyboard.press("Enter");

    await expect(page.getByText("Сессия завершена.")).toBeVisible();
    await expect(page.getByText("Ответов")).toBeVisible();
    await expect(page.getByText("100%")).toBeVisible();
    await expect(page.getByText("Повышено")).toBeVisible();
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
    await expect(
      page.getByRole("region", { name: "Результат ответа" }).getByRole("status"),
    ).toContainText("Ответ не принят.");
    await expect(page.getByText("Правильные ответы")).toBeVisible();
    await expect(page.getByText("солнце")).toBeVisible();
  });

  test("pauses hidden listening audio without completing or grading it", async ({ page }) => {
    const answerRequests: CapturedReviewAnswerRequest[] = [];
    await signIn(page);
    await mockReviewApi(page, { answerRequests, queue: [listeningReviewQueueItem] });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    const play = page.getByRole("button", { name: "Воспроизвести аудио", exact: true });
    await expect(play).toBeEnabled();
    await page.locator(".listening-prompt audio").evaluate((element: HTMLAudioElement) => {
      element.play = () => {
        element.dispatchEvent(new Event("play"));
        return Promise.resolve();
      };
      element.pause = () => {
        element.dataset.pauses = String(Number(element.dataset.pauses ?? 0) + 1);
      };
    });
    await play.click();
    await expect(page.getByText("Дослушайте запись до конца.")).toBeVisible();
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.locator(".listening-prompt audio")).toHaveAttribute("data-pauses", "1");
    await expect(page.getByLabel("Ответ чтением")).toBeDisabled();
    await expect(play).toBeEnabled();
    expect(answerRequests).toEqual([]);
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "visible",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await play.click();
    await expect(page.getByLabel("Ответ чтением")).toBeDisabled();
    await expect(page.getByText("Запись прослушана. Можно отвечать.")).toHaveCount(0);
  });

  test("retires the old audio element and ignores its pending replay after the next listening card", async ({
    page,
  }) => {
    const second: ReviewQueueItem = {
      ...listeningReviewQueueItem,
      card: {
        ...listeningReviewQueueItem.card,
        id: "listening-second",
        learningItemId: "word-second",
        prompt: { japanese: "二つ", reading: "ふたつ" },
        audio: {
          ...listeningReviewQueueItem.card.audio!,
          id: "audio-second",
          learningItemId: "word-second",
          mediaUrl: "https://media.example.test/futatsu.wav",
        },
      },
      item: {
        ...listeningReviewQueueItem.item,
        id: "word-second",
        japanese: "二つ",
        reading: "ふたつ",
      },
    };
    await signIn(page);
    await mockReviewApi(page, { queue: [listeningReviewQueueItem, second] });
    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();
    await page.getByRole("button", { name: "Воспроизвести аудио", exact: true }).click();
    await expect(page.getByText("Запись прослушана. Можно отвечать.")).toBeVisible();
    await page.locator(".listening-prompt audio").evaluate((element: HTMLAudioElement) => {
      const audit = window as typeof window & {
        __retiredPauses: number;
        __rejectReplay: () => void;
      };
      audit.__retiredPauses = 0;
      const pause = element.pause.bind(element);
      element.pause = () => {
        audit.__retiredPauses++;
        pause();
      };
      element.play = () =>
        new Promise<void>((_resolve, reject) => {
          audit.__rejectReplay = () => reject(new Error("retired replay"));
        });
    });
    await page.getByRole("button", { name: "Воспроизвести аудио ещё раз" }).click();
    await page.getByLabel("Ответ чтением").fill("ひとつ");
    await page.keyboard.press("Enter");
    await expect(page.getByText("Верно", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Дальше", exact: true }).click();
    await expect(page.locator(".listening-prompt audio")).toHaveAttribute(
      "src",
      second.card.audio!.mediaUrl!,
    );
    await expect(
      page.getByRole("button", { name: "Воспроизвести аудио", exact: true }),
    ).toBeEnabled();
    await page.evaluate(() =>
      (window as typeof window & { __rejectReplay: () => void }).__rejectReplay(),
    );
    expect(
      await page.evaluate(
        () => (window as typeof window & { __retiredPauses: number }).__retiredPauses,
      ),
    ).toBeGreaterThan(0);
    await expect(
      page.getByRole("button", { name: "Воспроизвести аудио", exact: true }),
    ).toBeEnabled();
    await expect(page.getByLabel("Ответ чтением")).toBeDisabled();
    await expect(page.getByText("retired replay")).toHaveCount(0);
  });

  test("requires completed audio and reveals licensed listening metadata", async ({ page }) => {
    const answerRequests: CapturedReviewAnswerRequest[] = [];

    await signIn(page);
    await mockReviewApi(page, {
      answerRequests,
      queue: [listeningReviewQueueItem],
    });

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();

    const answerInput = page.getByLabel("Ответ чтением");
    await expect(answerInput).toBeDisabled();
    await expect(page.getByText("一つ", { exact: true })).toBeHidden();

    const playButton = page.getByRole("button", { name: "Воспроизвести аудио" });
    await expect(playButton).toBeEnabled();
    const audio = page.locator(".listening-prompt audio");
    await audio.evaluate((element: HTMLAudioElement) => {
      let completed = 0;
      element.addEventListener("ended", () => {
        element.dataset.auditCompletions = String(++completed);
      });
    });
    await playButton.click();

    await expect(audio).toHaveAttribute("data-audit-completions", "1");
    await expect(page.getByText("Запись прослушана. Можно отвечать.")).toBeVisible();
    await page.getByRole("button", { name: "Воспроизвести аудио ещё раз" }).click();
    await expect(audio).toHaveAttribute("data-audit-completions", "2");
    await expect(page.getByText("Запись прослушана. Можно отвечать.")).toBeVisible();
    await expect(answerInput).toBeEnabled();
    await answerInput.fill("ひとつ");
    await page.keyboard.press("Enter");

    await expect
      .poll(() => answerRequests)
      .toEqual([
        expect.objectContaining({
          cardId: listeningReviewQueueItem.card.id,
          answerType: "reading",
          listeningEvidence: { completed: true, playCount: 2 },
        }),
      ]);
    const listeningDetails = page.locator(".listening-feedback-details");
    await expect(listeningDetails.getByText("一つ", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("ひとつ", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("Project speaker", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("Project recordings", { exact: true })).toBeVisible();
    await expect(listeningDetails.getByText("Project-owned audio", { exact: true })).toBeVisible();
    await expect(
      listeningDetails.getByText("Recorded for Kanji SRS.", { exact: true }),
    ).toBeVisible();
  });

  test("keeps a failed listening prompt recoverable and ungraded", async ({ page }) => {
    const answerRequests: CapturedReviewAnswerRequest[] = [];

    await signIn(page);
    await mockReviewApi(page, {
      answerRequests,
      failAudio: true,
      queue: [listeningReviewQueueItem],
    });

    await page.goto("/reviews");
    await page.getByRole("button", { name: "Начать повторение" }).click();

    await expect(
      page.getByText("Аудио недоступно. Ответ не будет оценён; попробуйте воспроизвести ещё раз."),
    ).toBeVisible();
    await expect(page.getByLabel("Ответ чтением")).toBeDisabled();
    await expect(page.getByRole("button", { name: "Ответить" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Воспроизвести аудио" })).toBeEnabled();
    expect(answerRequests).toEqual([]);
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
    let queueAvailable = false;

    await signIn(page);
    await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
      await route.fulfill({
        json: {
          items: queueAvailable ? [reviewQueueItem] : [],
          orderMode: "shuffled",
          vacationStartedAt: null,
        },
      });
    });

    await page.goto("/reviews");
    await expect(page.getByText("Нет карточек к повторению.")).toBeVisible();
    queueAvailable = true;
    await page.getByRole("button", { name: "Проверить снова" }).click();
    await expect(page.getByText("Готово карточек: 1")).toBeVisible();
  });

  test("shows vacation mode instead of an ordinary empty queue", async ({ page }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
      await route.fulfill({
        json: {
          items: [],
          orderMode: "shuffled",
          vacationStartedAt: "2026-07-20T09:00:00.000Z",
        },
      });
    });

    await page.goto("/reviews");

    await expect(page.getByText("Режим отпуска включён.", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Начать повторение" })).toBeHidden();
    await expect(page.getByRole("link", { name: "Настроить режим отпуска" })).toBeVisible();
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

async function signIn(
  page: Page,
  displayMode: TranslationDisplayMode = "ru-en",
  soundFeedback = false,
  presentation: Partial<InterfacePreferences> = {},
): Promise<void> {
  await page.route(`${API_BASE_URL}/reviews/active`, async (route) => {
    await route.fulfill({
      json: { session: null, items: [], currentIndex: 0, corrections: [], progress: null },
    });
  });
  await page.addInitScript(
    ({
      accessToken,
      mode,
      soundFeedback: storedSoundFeedback,
      presentation: storedPresentation,
    }) => {
      const audioWindow = window as typeof window & {
        __answerSoundFrequencies: number[];
      };
      audioWindow.__answerSoundFrequencies = [];
      class MockAudioContext {
        currentTime = 0;
        destination = {};

        close(): Promise<void> {
          return Promise.resolve();
        }

        createGain() {
          return {
            connect: () => undefined,
            gain: {
              exponentialRampToValueAtTime: () => undefined,
              setValueAtTime: () => undefined,
            },
          };
        }

        createOscillator() {
          return {
            connect: () => undefined,
            frequency: {
              exponentialRampToValueAtTime: (value: number) => {
                audioWindow.__answerSoundFrequencies.push(value);
              },
              setValueAtTime: (value: number) => {
                audioWindow.__answerSoundFrequencies.push(value);
              },
            },
            start: () => undefined,
            stop: () => undefined,
            type: "sine",
          };
        }
      }

      Object.defineProperty(window, "AudioContext", {
        configurable: true,
        value: MockAudioContext,
      });
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
            ...storedPresentation,
            locale: "ru-RU",
            translationDisplayMode: mode,
            timezone: "Europe/Moscow",
            dailyLessonLimit: 20,
            reviewBudget: 100,
            reviewOrderMode: "shuffled",
            strictMode: false,
            vacationStartedAt: null,
            speechVoiceUri: null,
            speechRate: 0.8,
            speechAutoplay: false,
            soundFeedback: storedSoundFeedback,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN, mode: displayMode, soundFeedback, presentation },
  );
}

async function mockReviewApi(
  page: Page,
  options: {
    readonly answerRequests?: CapturedReviewAnswerRequest[];
    readonly failAudio?: boolean;
    readonly queue?: readonly ReviewQueueItem[];
    readonly resumable?: boolean;
    readonly correctionRequests?: string[];
    readonly failCorrectionOnce?: boolean;
  } = {},
): Promise<() => { readonly queueRequests: number; readonly savedSettings: unknown }> {
  const privateAnswers = new Set<string>();
  const queue = options.queue ?? [reviewQueueItem];
  let queueRequests = 0;
  let reviewOrderMode = "shuffled";
  let savedSettings: unknown = null;
  const completedAnswers: ReviewAnswerResponse[] = [];
  const corrected = new Set<string>();
  let active = false;
  let correctionFailed = false;
  const session = {
    id: SESSION_ID,
    startedAt: "2026-06-22T08:00:00.000Z",
    mode: "review" as const,
  };
  function activeResponse(): ActiveReviewSessionResponse {
    if (!active)
      return { session: null, items: [], currentIndex: 0, corrections: [], progress: null };
    const missed = completedAnswers.filter((answer) => !answer.accepted);
    return {
      session,
      items: queue.filter(
        (item) => !completedAnswers.some((answer) => answer.cardId === item.card.id),
      ),
      currentIndex: 0,
      corrections: queue.filter(
        (item) =>
          missed.some((answer) => answer.cardId === item.card.id) && !corrected.has(item.card.id),
      ),
      progress: {
        scheduledTotal: queue.length,
        scheduledAnswered: completedAnswers.length,
        correctionsRequired: missed.length,
        correctedCardIds: [...corrected],
        original: createSessionSummary(completedAnswers),
      },
    };
  }

  await page.route(`${API_BASE_URL}/reviews/active`, async (route) => {
    await route.fulfill({ json: activeResponse() });
  });

  await page.route("https://media.example.test/**", async (route) => {
    if (options.failAudio) {
      await route.abort("failed");
      return;
    }

    await route.fulfill({
      body: createSilentWav(800),
      contentType: "audio/wav",
      headers: { "Accept-Ranges": "bytes" },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
    queueRequests += 1;
    await route.fulfill({
      json: { items: queue, orderMode: reviewOrderMode, vacationStartedAt: null },
    });
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
          vacationStartedAt: null,
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/start`, async (route) => {
    if (options.resumable) active = true;
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          mode: "review",
        },
        ...(options.resumable ? activeResponse() : {}),
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/${SESSION_ID}/correction`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answer: string;
      readonly cardId: string;
    };
    options.correctionRequests?.push(body.answer);
    if (options.failCorrectionOnce && !correctionFailed) {
      correctionFailed = true;
      await route.fulfill({ status: 503, json: { message: "Не удалось сохранить исправление." } });
      return;
    }
    const item = queue.find((candidate) => candidate.card.id === body.cardId)!;
    const accepted =
      getExpectedAnswerTexts(item).includes(body.answer) || privateAnswers.has(body.answer);
    const response = createAnswerResponse({
      answer: body.answer,
      accepted,
      item,
      result: accepted ? "correct" : "wrong",
    });
    const {
      previousSrs: _previous,
      nextSrs: _next,
      srsTransition: _transition,
      ...answer
    } = response;
    const alreadyCorrected = corrected.has(body.cardId);
    if (accepted) corrected.add(body.cardId);
    await route.fulfill({
      json: {
        ...answer,
        corrected: accepted,
        alreadyCorrected,
        progress: activeResponse().progress,
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/${SESSION_ID}/answer`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly answer?: string;
      readonly answerType?: string;
      readonly cardId?: string;
      readonly listeningEvidence?: CapturedReviewAnswerRequest["listeningEvidence"];
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
      listeningEvidence: body.listeningEvidence,
    });

    const response = createAnswerResponse({
      answer,
      accepted,
      item,
      result: accepted ? "correct" : "wrong",
    });
    const isRetry = answer === "ひと";

    if (!isRetry) {
      completedAnswers.push(response);
    }

    await route.fulfill({
      json: isRetry
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
    const pending = activeResponse();
    if (options.resumable && (pending.items.length > 0 || pending.corrections.length > 0)) {
      await route.fulfill({ status: 409, json: { message: "Есть незавершённые шаги." } });
      return;
    }
    active = false;
    await route.fulfill({
      json: {
        session: {
          id: SESSION_ID,
          startedAt: "2026-06-22T08:00:00.000Z",
          finishedAt: "2026-06-22T08:02:00.000Z",
          mode: "review",
        },
        summary: createSessionSummary(completedAnswers),
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

const listeningReviewQueueItem: ReviewQueueItem = {
  card: {
    id: "card-listening-word-1",
    learningItemId: "item-word-1",
    itemType: "word",
    cardType: "review",
    promptType: "listening",
    answerType: "reading",
    prompt: {
      japanese: "一つ",
      reading: "ひとつ",
    },
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
    srsTransition: accepted ? "advanced" : "unchanged",
  };
}

function createSessionSummary(answers: readonly ReviewAnswerResponse[]): ReviewSessionSummaryDto {
  const correctAnswers = answers.filter((answer) => answer.accepted).length;
  const incorrectAnswers = answers.length - correctAnswers;

  return {
    totalAnswers: answers.length,
    correctAnswers,
    incorrectAnswers,
    ignoredAnswers: 0,
    accuracyPercent:
      answers.length === 0 ? null : Math.round((correctAnswers / answers.length) * 100),
    advanced: answers.filter((answer) => answer.srsTransition === "advanced").length,
    unchanged: answers.filter((answer) => answer.srsTransition === "unchanged").length,
    demoted: answers.filter((answer) => answer.srsTransition === "demoted").length,
    burned: answers.filter((answer) => answer.srsTransition === "burned").length,
    durationSeconds: 120,
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
