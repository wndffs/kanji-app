import { expect, type Page, test } from "@playwright/test";

import { DEFAULT_INTERFACE_PREFERENCES } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";

test.describe("settings", () => {
  test("retains drafts between sections and reveals invalid hidden controls before saving", async ({ page }) => {
    await signIn(page);
    let writes = 0;
    await page.route(`${API_BASE_URL}/auth/me`, (route) => route.fulfill({ json: createUser() }));
    await page.route(`${API_BASE_URL}/users/settings`, (route) => {
      writes++;
      return route.fulfill({ json: { ...createUser(), settings: { ...createUser().settings, ...route.request().postDataJSON() } } });
    });
    await page.goto("/settings");
    await expect(page.getByText("Загружаю настройки.")).toBeHidden();
    await expect(page.getByLabel("Новых материалов в день")).toBeHidden();
    await page.getByRole("tab", { name: "Обучение", exact: true }).click();
    await page.getByLabel("Новых материалов в день").fill("7");
    await page.getByRole("tab", { name: "Внешний вид", exact: true }).click();
    await page.getByLabel("Тема", { exact: true }).selectOption("dark");
    await page.getByRole("tab", { name: "Обучение", exact: true }).click();
    await expect(page.getByLabel("Новых материалов в день")).toHaveValue("7");
    await page.getByLabel("Новых материалов в день").fill("0");
    await page.getByRole("tab", { name: "Внешний вид", exact: true }).click();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByRole("tab", { name: "Обучение", exact: true })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("alert")).toContainText("Лимит уроков в день");
    expect(writes).toBe(0);
    await page.getByLabel("Новых материалов в день").fill("7");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByText("Сохранено.")).toBeVisible();
    expect(writes).toBe(1);
    await page.getByRole("tab", { name: "Внешний вид", exact: true }).click();
    await expect(page.getByLabel("Тема", { exact: true })).toHaveValue("dark");
  });
  for (const outcome of ["granted", "denied", "unsupported"] as const) {
    test(`review reminders require a direct gesture and Save (${outcome})`, async ({ page }) => {
      await signIn(page);
      await page.addInitScript((outcome) => {
        const state = { requests: 0, gesture: false };
        Object.assign(window, { __reminderPermissionTest: state });
        if (outcome === "unsupported") {
          Object.defineProperty(window, "Notification", { configurable: true, value: undefined });
        } else {
          class MockNotification {
            static permission = "default";
            static async requestPermission() {
              state.requests++;
              state.gesture = navigator.userActivation.isActive;
              this.permission = outcome;
              return outcome;
            }
          }
          Object.defineProperty(window, "Notification", {
            configurable: true,
            value: MockNotification,
          });
        }
      }, outcome);
      const writes: Record<string, unknown>[] = [];
      await page.route(`${API_BASE_URL}/auth/me`, (route) => route.fulfill({ json: createUser() }));
      await page.route(`${API_BASE_URL}/users/settings`, (route) => {
        const body = route.request().postDataJSON() as Record<string, unknown>;
        writes.push(body);
        return route.fulfill({
          json: { ...createUser(), settings: { ...createUser().settings, ...body } },
        });
      });
      await page.goto("/settings");
      await expect(page.getByText("Загружаю настройки.")).toBeHidden();
      const reminder = page.getByLabel("Напоминать о повторениях", { exact: true });
      await page.getByRole("tab", { name: "Расписание", exact: true }).click();
      await expect(reminder).not.toBeChecked();
      await expect(page.getByLabel("Час напоминания", { exact: true })).toHaveValue("9");
      const permissionState = () =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __reminderPermissionTest: { requests: number; gesture: boolean };
              }
            ).__reminderPermissionTest,
        );
      expect((await permissionState()).requests).toBe(0);
      await reminder.click();
      if (outcome === "granted") {
        await expect(reminder).toBeChecked();
        expect(await permissionState()).toEqual({ requests: 1, gesture: true });
        await page.getByLabel("Час напоминания", { exact: true }).fill("0");
      } else {
        await expect(reminder).not.toBeChecked();
        await expect(
          page.getByText(
            outcome === "denied"
              ? "Уведомления заблокированы в браузере."
              : "Уведомления недоступны в этом браузере.",
          ),
        ).toBeVisible();
      }
      expect(writes).toHaveLength(0);
      await page.getByRole("button", { name: "Сохранить", exact: true }).click();
      await expect(page.getByText("Сохранено.")).toBeVisible();
      expect(writes[0]).toMatchObject({
        reviewReminderHour: outcome === "granted" ? 0 : 9,
      });
      if (outcome === "granted") expect(writes[0]?.reviewRemindersEnabled).toBe(true);
      else expect(writes[0]).not.toHaveProperty("reviewRemindersEnabled");
      if (outcome === "granted") {
        await reminder.uncheck();
        expect(writes).toHaveLength(1);
        await page.getByRole("button", { name: "Сохранить", exact: true }).click();
        await expect.poll(() => writes.length).toBe(2);
        expect(writes[1]?.reviewRemindersEnabled).toBe(false);
        expect((await permissionState()).requests).toBe(1);
      }
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
    });
  }

  test("preserves an enabled account preference when this browser blocks notifications", async ({
    page,
  }) => {
    await signIn(page);
    await page.addInitScript(() => {
      Object.defineProperty(window, "Notification", {
        configurable: true,
        value: Object.assign(function () {}, {
          permission: "denied",
          requestPermission: () => {
            throw new Error("Unexpected permission request");
          },
        }),
      });
    });
    const savedUser = {
      ...createUser(),
      settings: { ...createUser().settings, reviewRemindersEnabled: true, reviewReminderHour: 9 },
    };
    await page.route(`${API_BASE_URL}/auth/me`, (route) => route.fulfill({ json: savedUser }));
    let received: Record<string, unknown> | undefined;
    await page.route(`${API_BASE_URL}/users/settings`, (route) => {
      received = route.request().postDataJSON();
      return route.fulfill({
        json: { ...savedUser, settings: { ...savedUser.settings, ...received } },
      });
    });
    await page.goto("/settings");
    await expect(page.getByText("Загружаю настройки.")).toBeHidden();
    await expect(page.getByLabel("Напоминать о повторениях", { exact: true })).toBeChecked();
    await page.getByRole("tab", { name: "Расписание", exact: true }).click();
    await expect(page.getByText("Уведомления заблокированы в браузере.")).toBeVisible();
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByText("Сохранено.")).toBeVisible();
    expect(received).not.toHaveProperty("reviewRemindersEnabled");
    await expect(page.getByLabel("Напоминать о повторениях", { exact: true })).toBeChecked();
  });

  test("persists presentation preferences and restores server settings on reload", async ({
    page,
  }) => {
    let settings: Record<string, unknown> = { ...createUser().settings };
    await signIn(page);
    await page.route(`${API_BASE_URL}/auth/me`, async (route) => {
      await route.fulfill({ json: { ...createUser(), settings } });
    });
    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      settings = { ...settings, ...route.request().postDataJSON() };
      await route.fulfill({ json: { ...createUser(), settings } });
    });
    await page.goto("/settings");
    await expect(page.getByText("Загружаю настройки.")).toBeHidden();
    await page.getByLabel("Тема", { exact: true }).selectOption("dark");
    await page.getByLabel("Плотность интерфейса", { exact: true }).selectOption("compact");
    await page.getByLabel("Анимация", { exact: true }).selectOption("reduced");
    await page.getByLabel("Размер японского текста", { exact: true }).selectOption("extra-large");
    await page.getByLabel("Плотность учебных блоков", { exact: true }).selectOption("compact");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.getByText("Сохранено.")).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("data-interface-theme", "dark");
    await expect(page.locator("html")).toHaveAttribute("data-interface-density", "compact");
    await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "reduced");
    await expect(page.locator("html")).toHaveAttribute("data-study-text-size", "extra-large");
    await expect(page.locator("html")).toHaveAttribute("data-study-information-density", "compact");

    await page.evaluate(() => {
      localStorage.removeItem("kanji-srs.interface-preferences");
      const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
      for (const key of [
        "interfaceTheme",
        "interfaceDensity",
        "interfaceMotion",
        "studyTextSize",
        "studyInformationDensity",
      ]) {
        delete user.settings[key];
      }
      localStorage.setItem("kanji-srs.user", JSON.stringify(user));
    });
    await page.reload();
    await expect(page.getByLabel("Тема", { exact: true })).toHaveValue("dark");
    await expect(page.locator("html")).toHaveAttribute("data-study-text-size", "extra-large");
    const metrics = await page
      .getByRole("button", { name: "Сохранить", exact: true })
      .evaluate((element) => ({
        height: element.getBoundingClientRect().height,
        transition: getComputedStyle(element).transitionDuration,
        width: document.documentElement.scrollWidth,
        viewport: window.innerWidth,
      }));
    expect(metrics.height).toBeGreaterThanOrEqual(44);
    expect(metrics.transition).toBe("0s");
    expect(metrics.width).toBeLessThanOrEqual(metrics.viewport);
  });

  test("honors the OS theme and reduced motion while allowing an explicit light theme", async ({
    page,
  }) => {
    await page.emulateMedia({ colorScheme: "dark", reducedMotion: "reduce" });
    await page.goto("/settings");
    await expect(page.getByLabel("Тема", { exact: true })).toHaveValue("system");
    const systemBackground = await page
      .locator("body")
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    await page.getByLabel("Тема", { exact: true }).selectOption("light");
    await page.getByRole("button", { name: "Сохранить", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-interface-theme", "light");
    expect(
      await page.locator("body").evaluate((element) => getComputedStyle(element).backgroundColor),
    ).not.toBe(systemBackground);
    await page.reload();
    await expect(page.getByLabel("Тема", { exact: true })).toHaveValue("light");
  });

  test("saves workload controls", async ({ page }) => {
    let receivedSettings: unknown = null;

    await signIn(page);

    await page.route(`${API_BASE_URL}/auth/me`, async (route) => {
      await route.fulfill({ json: createUser() });
    });

    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      receivedSettings = route.request().postDataJSON();

      await route.fulfill({
        json: {
          ...createUser(),
          settings: {
            ...createUser().settings,
            ...(receivedSettings as Record<string, unknown>),
          },
        },
      });
    });

    await page.goto("/settings");
    await expect(page.getByRole("button", { name: "Выйти: Тестовый ученик" })).toBeVisible();
    await expect(page.getByLabel("Новых материалов в день")).toBeEnabled();

    await page.getByLabel("Перевод карточек").selectOption("en");
    await page.getByRole("tab", { name: "Обучение", exact: true }).click();
    await page.getByLabel("Новых материалов в день").fill("7");
    await page.getByLabel("Размер группы урока").fill("3");
    await page.getByRole("button", { name: "Чередовать типы" }).click();
    await page.getByLabel("Бюджет повторений").fill("18");
    await page.getByLabel("Порядок повторений").selectOption("lower-levels-first");
    await page.getByLabel("Строгая проверка").check();
    await page.getByRole("tab", { name: "Расписание", exact: true }).click();
    await page.getByLabel("Часовой пояс").fill("Asia/Tokyo");
    await page.getByRole("tab", { name: "Произношение", exact: true }).click();
    await page.getByRole("button", { name: "Фуригана над текстом" }).click();
    await page.getByLabel("Показывать ромадзи в уроках").check();
    await page.getByRole("button", { name: "Сохранить" }).click();

    await expect(page.getByText("Сохранено.")).toBeVisible();
    expect(receivedSettings).toEqual({
      ...DEFAULT_INTERFACE_PREFERENCES,
      translationDisplayMode: "en",
      timezone: "Asia/Tokyo",
      dailyLessonLimit: 7,
      lessonBatchSize: 3,
      lessonOrderMode: "interleaved",
      reviewBudget: 18,
      reviewOrderMode: "lower-levels-first",
      strictMode: true,
      speechVoiceUri: null,
      speechRate: 0.8,
      speechAutoplay: false,
      soundFeedback: false,
      lessonPronunciationMode: "furigana",
      lessonRomaji: true,
      reviewReminderHour: 9,
    });
    expect(receivedSettings).not.toHaveProperty("reviewRemindersEnabled");
  });

  test("previews and saves study audio preferences", async ({ page }) => {
    let receivedSettings: Record<string, unknown> | null = null;

    await signIn(page);
    await page.route(`${API_BASE_URL}/auth/me`, async (route) => {
      await route.fulfill({ json: createUser() });
    });
    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      receivedSettings = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        json: {
          ...createUser(),
          settings: {
            ...createUser().settings,
            ...receivedSettings,
          },
        },
      });
    });

    await page.goto("/settings");

    await page.getByRole("tab", { name: "Произношение", exact: true }).click();
    await page.getByLabel("Японский голос").selectOption("voice-ja-b");
    await page.getByLabel("Скорость речи").fill("1.2");
    await page.getByLabel("Автоматически озвучивать учебные материалы").check();
    await page.getByLabel("Звуковые сигналы правильных и неправильных ответов").check();
    await page.getByRole("button", { name: "Прослушать голос" }).click();

    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __spokenSettings: readonly {
                rate: number;
                text: string;
                voiceUri: string | null;
              }[];
            }
          ).__spokenSettings.at(-1),
        ),
      )
      .toEqual({
        rate: 1.2,
        text: "日本語の発音",
        voiceUri: "voice-ja-b",
      });

    await page.getByRole("button", { name: "Сохранить" }).click();
    await expect(page.getByText("Сохранено.")).toBeVisible();
    expect(receivedSettings).toMatchObject({
      speechVoiceUri: "voice-ja-b",
      speechRate: 1.2,
      speechAutoplay: true,
      soundFeedback: true,
    });
  });

  test("enables and disables vacation mode independently", async ({ page }) => {
    const requests: boolean[] = [];
    let vacationStartedAt: string | null = null;

    await signIn(page);

    await page.route(`${API_BASE_URL}/auth/me`, async (route) => {
      await route.fulfill({
        json: {
          ...createUser(),
          settings: {
            ...createUser().settings,
            vacationStartedAt,
          },
        },
      });
    });

    await page.route(`${API_BASE_URL}/users/settings/vacation`, async (route) => {
      const body = route.request().postDataJSON() as { readonly enabled: boolean };
      requests.push(body.enabled);
      vacationStartedAt = body.enabled ? "2026-07-20T09:00:00.000Z" : null;

      await route.fulfill({
        json: {
          user: {
            ...createUser(),
            settings: {
              ...createUser().settings,
              vacationStartedAt,
            },
          },
          shiftedReviewCount: body.enabled ? 0 : 4,
          vacationDurationSeconds: body.enabled ? 0 : 86_400,
        },
      });
    });

    await page.goto("/settings");

    const toggle = page.getByLabel("Приостановить расписание повторений");
    await page.getByRole("tab", { name: "Расписание", exact: true }).click();
    await toggle.check();
    await expect(page.getByText("Режим отпуска включён.", { exact: true })).toBeVisible();
    await expect(toggle).toBeChecked();

    await toggle.uncheck();
    await expect(
      page.getByText("Режим отпуска выключен. Расписание сдвинуто для 4 карточек."),
    ).toBeVisible();
    await expect(toggle).not.toBeChecked();
    expect(requests).toEqual([true, false]);
  });
});

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ({ accessToken, user }) => {
      const speechWindow = window as typeof window & {
        __spokenSettings: {
          rate: number;
          text: string;
          voiceUri: string | null;
        }[];
      };
      speechWindow.__spokenSettings = [];
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
      const voices = [
        {
          default: true,
          lang: "ja-JP",
          name: "Japanese A",
          voiceURI: "voice-ja-a",
        },
        {
          default: false,
          lang: "ja-JP",
          name: "Japanese B",
          voiceURI: "voice-ja-b",
        },
      ];

      Object.defineProperty(window, "SpeechSynthesisUtterance", {
        configurable: true,
        value: MockSpeechSynthesisUtterance,
      });
      Object.defineProperty(window, "speechSynthesis", {
        configurable: true,
        value: {
          addEventListener: () => undefined,
          cancel: () => undefined,
          getVoices: () => voices,
          removeEventListener: () => undefined,
          speak: (utterance: MockSpeechSynthesisUtterance) => {
            speechWindow.__spokenSettings.push({
              rate: utterance.rate,
              text: utterance.text,
              voiceUri: utterance.voice?.voiceURI ?? null,
            });
          },
        },
      });

      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem(
        "kanji-srs.translationDisplayMode",
        user.settings.translationDisplayMode,
      );
      window.localStorage.setItem("kanji-srs.user", JSON.stringify(user));
    },
    { accessToken: ACCESS_TOKEN, user: createUser() },
  );
}

function createUser() {
  return {
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
      reviewOrderMode: "shuffled",
      strictMode: false,
      vacationStartedAt: null,
      speechVoiceUri: null,
      speechRate: 0.8,
      speechAutoplay: false,
      soundFeedback: false,
      lessonPronunciationMode: "kana",
      lessonRomaji: false,
    },
  };
}
