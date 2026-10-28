import { expect, type Page, test } from "@playwright/test";
import { captureLearnerThemes } from "./support/capture-learner-themes";
import { changeAccount } from "./support/change-account";

import { type CompleteLessonItemResponse, type LessonQueueItem } from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "test-token";
const SESSION_ID = "lesson-session-1";

test.describe("lesson session", () => {
  test("retains validated course return through picker filters, focus and an empty queue", async ({
    page,
  }) => {
    await signIn(page);
    await mockLessonApi(page);
    const target = "/courses/00000000-0000-4000-8000-000000000010?level=2&itemType=kanji";
    const params = new URLSearchParams({ returnTo: target });
    await page.goto(`/lessons?${params}`);
    await expect(
      page.getByRole("link", { name: "К материалам уровня", exact: true }),
    ).toHaveAttribute("href", target);
    await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
    await page.getByRole("combobox", { name: "Тип материала", exact: true }).selectOption("kanji");
    expect(new URL(page.url()).searchParams.get("returnTo")).toBe(target);
    await page.getByRole("button", { name: "Начать урок", exact: true }).click();
    await expect(page.getByRole("link", { name: "К курсу", exact: true })).toHaveAttribute(
      "href",
      target,
    );
    await page.route(`${API_BASE_URL}/lessons/queue`, (route) =>
      route.fulfill({ json: queueResponse([]) }),
    );
    await page.goto(`/lessons?${params}`);
    await expect(
      page.getByRole("link", { name: "К материалам уровня", exact: true }),
    ).toHaveAttribute("href", target);
    await expect(page.getByRole("button", { name: "Начать урок", exact: true })).toHaveCount(0);
  });
  test("searches with IME, combines rapid URL filters, and retains selections without extra reads", async ({
    page,
  }) => {
    await signIn(page);
    await mockLessonApi(page);
    const items = largeLessonQueue();
    let reads = 0;
    let writes = 0;
    page.on("request", (request) => {
      if (request.url().startsWith(API_BASE_URL) && request.method() !== "GET") writes++;
    });
    await page.route(`${API_BASE_URL}/lessons/queue`, (route) => {
      reads++;
      return route.fulfill({ json: queueResponse(items) });
    });
    await page.goto("/lessons");
    await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
    const input = page.getByRole("searchbox", { name: "Поиск новых материалов", exact: true });
    const rows = page.locator(".lesson-preview-grid > label");
    await expect(rows).toHaveCount(24);
    await input.dispatchEvent("compositionstart");
    await input.fill("missing");
    await input.press("Enter");
    await expect(rows).toHaveCount(24);
    await input.dispatchEvent("compositionend");
    await page.getByRole("button", { name: "Найти новые материалы", exact: true }).click();
    await expect(rows).toHaveCount(0);
    await page.getByRole("button", { name: "Сбросить фильтры материалов", exact: true }).click();
    await page.evaluate(() => {
      const kind = document.querySelector<HTMLSelectElement>(".lesson-picker-filters select")!;
      const level = document.querySelectorAll<HTMLSelectElement>(
        ".lesson-picker-filters select",
      )[1]!;
      kind.value = "word";
      kind.dispatchEvent(new Event("change", { bubbles: true }));
      level.value = "2";
      level.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page).toHaveURL(/kind=word&level=2/u);
    await expect(page.getByRole("combobox", { name: "Тип материала", exact: true })).toHaveValue(
      "word",
    );
    await expect(
      page.getByRole("combobox", { name: "Уровень материалов", exact: true }),
    ).toHaveValue("2");
    await expect(
      page.getByRole("list", { name: "Выбранные материалы", exact: true }).locator("li"),
    ).toHaveCount(1);
    await page.getByRole("button", { name: "Сбросить фильтры материалов", exact: true }).click();
    await page.getByRole("checkbox", { name: "Только выбранные", exact: true }).click();
    await expect(rows).toHaveCount(1);
    expect(reads).toBe(1);
    expect(writes).toBe(0);
    await page
      .getByRole("button", { name: `Убрать из группы ${items[0]!.item.japanese}`, exact: true })
      .click();
    await expect(rows).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Начать урок", exact: true })).toBeDisabled();
  });

  test("restores bounded picker pages and source on reload and Back", async ({ page }) => {
    await signIn(page);
    await mockLessonApi(page);
    await page.route(`${API_BASE_URL}/lessons/queue?deckId=deck-saved`, (route) =>
      route.fulfill({ json: queueResponse(largeLessonQueue(), true) }),
    );
    await page.goto("/lessons?deckId=deck-saved&page=9999");
    await expect(page).toHaveURL("/lessons?deckId=deck-saved&page=3");
    await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
    await expect(page.locator(".lesson-preview-grid > label")).toHaveCount(2);
    await page.reload();
    await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
    await page.getByRole("button", { name: "Предыдущая страница материалов", exact: true }).click();
    await expect(page).toHaveURL("/lessons?deckId=deck-saved&page=2");
    await expect(page.locator(".lesson-preview-grid > label")).toHaveCount(24);
    await page.goBack();
    await expect(page.locator(".lesson-preview-grid > label")).toHaveCount(2);
    await expect(page).toHaveURL("/lessons?deckId=deck-saved&page=3");
  });

  test("previews exact interleaved small batch and starts only those materials", async ({
    page,
  }, info) => {
    await signIn(page);
    await mockLessonApi(page);
    const items = largeLessonQueue();
    await page.route(`${API_BASE_URL}/lessons/queue`, (route) =>
      route.fulfill({ json: queueResponse(items) }),
    );
    let body: unknown;
    await page.route(`${API_BASE_URL}/lessons/start`, (route) => {
      body = route.request().postDataJSON();
      return route.fulfill({
        json: {
          session: {
            ...lessonSession("meaning", "large-0"),
            itemIds: ["large-0", "large-2", "large-3", "large-1", "large-4"],
          },
        },
      });
    });
    await page.goto("/lessons");
    await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
    await page.getByRole("button", { name: "Выбрать группу из 5", exact: true }).click();
    await page.getByRole("button", { name: "Чередовать типы", exact: true }).click();
    await expect(page.getByRole("button", { name: "Начать урок", exact: true })).toBeEnabled();
    await expect(
      page.getByRole("list", { name: "Выбранные материалы", exact: true }).locator("li > strong"),
    ).toHaveText([0, 2, 3, 1, 4].map((i) => items[i]!.item.japanese));
    await expect(page.getByText("Карточек в группе: 10", { exact: true })).toBeVisible();
    const selectedStrip = await page
      .getByRole("list", { name: "Выбранные материалы", exact: true })
      .boundingBox();
    expect(selectedStrip!.height).toBeLessThan(160);
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      window.scrollTo(0, 0);
    });
    await captureLearnerThemes(page, info, "lesson-picker");
    const firstRow = await page.locator(".lesson-preview-grid > label").first().boundingBox();
    expect(firstRow!.height).toBeLessThanOrEqual(90);
    await page.screenshot({
      path: info.outputPath("lesson-picker-viewport.png"),
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Начать урок", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Изучение", exact: true })).toBeVisible();
    expect(body).toEqual({ itemIds: ["large-0", "large-2", "large-3", "large-1", "large-4"] });
  });

  for (const endpoint of ["active", "queue"] as const)
    for (const status of [200, 401]) {
      test(`rejects old-owner ${endpoint} response after login changes (${status})`, async ({
        page,
      }) => {
        await signIn(page);
        await mockLessonApi(page);
        let release!: () => void;
        let started!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const pending = new Promise<void>((resolve) => {
          started = resolve;
        });
        const emptyActive = {
          session: null,
          items: [],
          source: null,
          completedItemCount: 0,
          createdSrsStateCount: 0,
        };
        let oldQueueReads = 0;
        await page.route(`${API_BASE_URL}/lessons/queue`, async (route) => {
          const old = route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`;
          if (old) oldQueueReads++;
          if (endpoint === "queue" && old) {
            started();
            await gate;
            await route
              .fulfill({
                status,
                json:
                  status === 401
                    ? { message: "Old owner expired" }
                    : queueResponse([lessonQueueItem]),
              })
              .catch(() => undefined);
          } else await route.fulfill({ json: queueResponse([optionalLessonQueueItem]) });
        });
        await page.route(`${API_BASE_URL}/lessons/active`, async (route) => {
          const old = route.request().headers().authorization === `Bearer ${ACCESS_TOKEN}`;
          if (endpoint === "active" && old) {
            started();
            await gate;
            await route
              .fulfill({
                status,
                json: status === 401 ? { message: "Old owner expired" } : emptyActive,
              })
              .catch(() => undefined);
          } else await route.fulfill({ json: emptyActive });
        });
        try {
          await page.goto("/lessons");
          await pending;
          await changeAccount(page);
          await expect(
            page.getByRole("list", { name: "Выбранные материалы", exact: true }),
          ).toContainText("二");
          release();
          await expect(page.getByText("Old owner expired", { exact: true })).toHaveCount(0);
          expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
            "new-owner-token",
          );
          if (endpoint === "active") expect(oldQueueReads).toBe(0);
        } finally {
          release();
        }
      });
    }

  for (const activeDeck of [false, true]) {
    test(`continues the unfinished other source without fetching or replacing the requested queue (${activeDeck})`, async ({
      page,
    }) => {
      await signIn(page);
      let queueReads = 0;
      let writes = 0;
      page.on("request", (request) => {
        if (request.url().startsWith(API_BASE_URL) && request.method() !== "GET") writes++;
      });
      await page.route(`${API_BASE_URL}/lessons/queue**`, (route) => {
        queueReads++;
        return route.fulfill({ json: queueResponse([lessonQueueItem]) });
      });
      await page.route(`${API_BASE_URL}/lessons/active`, (route) =>
        route.fulfill({
          json: {
            session: lessonSession("reading", "item-kanji-one", activeDeck ? "deck-saved" : null),
            items: [lessonQueueItem],
            source: activeDeck
              ? { kind: "deck", deckId: "deck-saved", title: "Saved deck" }
              : { kind: "course" },
            completedItemCount: 0,
            createdSrsStateCount: 0,
          },
        }),
      );
      await page.goto(activeDeck ? "/lessons" : "/lessons?deckId=deck-saved");
      await expect(
        page.getByRole("heading", { name: "Есть незавершённый урок", exact: true }),
      ).toBeVisible();
      await page.getByRole("link", { name: "Продолжить урок", exact: true }).click();
      await expect(page.getByRole("tab", { name: "Чтение", exact: true })).toHaveAttribute(
        "aria-selected",
        "true",
      );
      expect(queueReads).toBe(0);
      expect(writes).toBe(0);
    });
  }

  test("freezes a pending start and sends only one write for two same-turn clicks", async ({
    page,
  }) => {
    await signIn(page);
    await mockLessonApi(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let writes = 0;
    await page.route(`${API_BASE_URL}/lessons/start`, async (route) => {
      writes++;
      expect(route.request().postDataJSON()).toEqual({ itemIds: ["item-kanji-one"] });
      await gate;
      await route.fulfill({ json: { session: lessonSession("meaning") } });
    });
    try {
      await page.goto("/lessons");
      await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
      await page
        .getByRole("button", { name: "Начать урок", exact: true })
        .evaluate((button: HTMLButtonElement) => {
          button.click();
          button.click();
        });
      await expect(page.getByRole("button", { name: "Начинаю...", exact: true })).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Убрать из группы 一", exact: true }),
      ).toBeDisabled();
      await expect(page.getByRole("button", { name: "Очистить", exact: true })).toBeDisabled();
      await expect(
        page.getByRole("searchbox", { name: "Поиск новых материалов", exact: true }),
      ).toBeDisabled();
      release();
      await expect(page.getByRole("heading", { name: "Изучение", exact: true })).toBeVisible();
      expect(writes).toBe(1);
    } finally {
      release();
    }
  });

  test("blocks start during settings save and never overwrites a newer owner with its late response", async ({
    page,
  }) => {
    await signIn(page);
    await mockLessonApi(page);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      await gate;
      await route
        .fulfill({
          json: {
            id: "user-1",
            email: "old@example.test",
            displayName: "Old owner",
            role: "USER",
            settings: { translationDisplayMode: "ru-en", lessonOrderMode: "interleaved" },
          },
        })
        .catch(() => undefined);
    });
    try {
      await page.goto("/lessons");
      await page.getByRole("button", { name: "Изменить группу", exact: true }).click();
      await page.getByRole("button", { name: "Чередовать типы", exact: true }).click();
      await expect(page.getByRole("button", { name: "Начать урок", exact: true })).toBeDisabled();
      await changeAccount(page);
      await expect(page.getByRole("button", { name: "Начать урок", exact: true })).toBeEnabled();
      release();
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem("kanji-srs.user")!).id),
      ).toBe("new-owner");
    } finally {
      release();
    }
  });

  test("returns to the previous teaching material only after a confirmed progress write", async ({
    page,
  }) => {
    await signIn(page);
    await mockLessonApi(page);
    let writes = 0;
    await page.route(`${API_BASE_URL}/lessons/active`, (route) =>
      route.fulfill({
        json: {
          session: {
            ...lessonSession("meaning", optionalLessonQueueItem.item.id),
            itemIds: [lessonQueueItem.item.id, optionalLessonQueueItem.item.id],
          },
          items: [lessonQueueItem, optionalLessonQueueItem],
          source: { kind: "course" },
          completedItemCount: 0,
          createdSrsStateCount: 0,
        },
      }),
    );
    await page.route(`${API_BASE_URL}/lessons/${SESSION_ID}/progress`, (route) => {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        currentItemId: lessonQueueItem.item.id,
        phase: "meaning",
      });
      return route.fulfill(
        writes === 1
          ? { status: 503, json: { message: "Position not saved" } }
          : { json: { session: lessonSession("meaning") } },
      );
    });
    await page.goto("/lessons");
    await expect(page.getByText("Материал 2 из 2 · этап 1 из 3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Предыдущий материал", exact: true }).click();
    await expect(page.getByText("Position not saved", { exact: true })).toBeVisible();
    await expect(page.getByText("Материал 2 из 2 · этап 1 из 3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Предыдущий материал", exact: true }).click();
    await expect(page.getByText("Материал 1 из 2 · этап 1 из 3", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Предыдущий материал", exact: true }),
    ).toHaveCount(0);
    expect(writes).toBe(2);
  });

  test("does not convert an invalid source into a course and offers real empty-queue destinations", async ({
    page,
  }) => {
    await signIn(page);
    await mockLessonApi(page);
    let reads = 0;
    await page.route(`${API_BASE_URL}/lessons/queue`, (route) => {
      reads++;
      return route.fulfill({ json: { ...queueResponse([]), remainingToday: 0 } });
    });
    await page.goto("/lessons?deckId=..%2Fsecret");
    await expect(page.getByText("Некорректный источник урока.", { exact: true })).toBeVisible();
    expect(reads).toBe(0);
    await page.goto("/lessons");
    await expect(page.getByText("Дневной лимит исчерпан.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "К курсам", exact: true })).toHaveAttribute(
      "href",
      "/courses",
    );
    await expect(page.getByRole("link", { name: "К повторениям", exact: true })).toHaveAttribute(
      "href",
      "/reviews",
    );
    await expect(page.getByRole("button", { name: "Начать урок", exact: true })).toHaveCount(0);
  });

  test("requires every lesson quiz answer before completing one item", async ({ page }) => {
    await signIn(page);
    const savedSettings = await mockLessonApi(page);
    const returnTo = "/courses/00000000-0000-4000-8000-000000000010?level=2";
    await page.goto(`/lessons?${new URLSearchParams({ returnTo })}`);

    await expect(page.getByRole("heading", { name: "Уроки" })).toBeVisible();
    await expect(page.getByText(/Группа: 1 из 5/)).toBeVisible();
    await expect(
      page.getByRole("list", { name: "Выбранные материалы" }).getByText("один / one"),
    ).toBeVisible();
    await expect(page.getByLabel("Выбрать 二: два / two")).toBeHidden();
    await page.getByText("Изменить группу", { exact: true }).click();

    const optionalLesson = page.getByLabel("Выбрать 二: два / two");
    await expect(optionalLesson).not.toBeChecked();
    await optionalLesson.check();
    await expect(page.getByText(/Группа: 2 из 5/)).toBeVisible();
    await expect(page.getByTestId("lesson-selection-summary")).toHaveText("Выбрано 2 / 5");
    const start = (await page
      .getByRole("button", { name: "Начать урок", exact: true })
      .boundingBox())!;
    if (test.info().project.name === "mobile") {
      const nav = (await page.locator(".app-rail").boundingBox())!;
      expect(start.y + start.height).toBeLessThan(nav.y);
    }
    await page.getByRole("button", { name: "Чередовать типы" }).click();
    await expect(page.getByRole("button", { name: "Чередовать типы" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect.poll(savedSettings).toEqual({ lessonOrderMode: "interleaved" });
    await optionalLesson.uncheck();

    await page.getByRole("button", { name: "Начать урок" }).click();

    await expect(page.getByRole("heading", { name: "Изучение" })).toBeVisible();
    await expect(page.locator(".lesson-teaching-layout")).toBeVisible();
    await captureLearnerThemes(page, test.info(), "lesson");
    await expect(page.getByRole("heading", { name: "Объяснение", exact: true })).toHaveCount(0);
    await expect(page.getByText("следующий этап", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "К курсу", exact: true })).toHaveAttribute(
      "href",
      returnTo,
    );
    await expect(page.getByLabel("Режим перевода карточек")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("lesson-study.png"), fullPage: true });
    await expect(page.getByRole("tab", { name: "Значение" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Значения" })).toBeHidden();
    await page.getByText("Допустимые значения", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Значения" })).toBeVisible();
    await page.getByText("Связи и компоненты", { exact: true }).click();
    await expect(page.getByRole("heading", { name: "Связи" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Запомнить" })).toBeVisible();
    await expect(page.getByText("Представьте одну длинную черту.")).toBeVisible();
    await expect(page.getByText("Picture one long horizontal stroke.")).toBeVisible();
    await expect(page.getByText("компонент один")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Чтения" })).not.toBeVisible();
    await expect(page.getByText("Моя личная история про единицу.")).not.toBeVisible();

    await page.getByRole("tab", { name: "Значение", exact: true }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: "Чтение", exact: true })).toBeFocused();

    await expect(page.getByRole("tab", { name: "Чтение" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByRole("heading", { name: "Чтения" })).toBeVisible();
    await expect(page.getByRole("tab", { name: "Значение", exact: true })).toHaveAttribute(
      "data-phase-state",
      "visited",
    );
    const phaseTabs = await page.locator(".lesson-phase-tabs").boundingBox();
    const phaseEnd = await page.getByRole("tab", { name: "Контекст", exact: true }).boundingBox();
    expect(phaseEnd!.x + phaseEnd!.width).toBeLessThanOrEqual(phaseTabs!.x + phaseTabs!.width + 1);
    const readings = page
      .getByRole("heading", { name: "Чтения", exact: true })
      .locator("xpath=ancestor::section[1]")
      .getByRole("listitem");
    await expect(readings).toHaveCount(1);
    await expect(readings).toContainText("いち");
    await expect(page.getByText("Свяжите いち со значением один.")).toBeVisible();
    await page.getByRole("button", { name: "Озвучить чтение" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __spokenJapanese: readonly {
                text: string;
                lang: string;
                rate: number;
                voiceUri: string | null;
              }[];
            }
          ).__spokenJapanese.at(-1),
        ),
      )
      .toEqual({ text: "いち", lang: "ja-JP", rate: 0.8, voiceUri: "voice-ja-a" });
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
    await page.getByText("Подсказки", { exact: true }).click();
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
              __spokenJapanese: readonly {
                text: string;
                lang: string;
                rate: number;
                voiceUri: string | null;
              }[];
            }
          ).__spokenJapanese.at(-1),
        ),
      )
      .toEqual({
        text: "一つください。",
        lang: "ja-JP",
        rate: 0.8,
        voiceUri: "voice-ja-a",
      });

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
    await expect(page.getByRole("navigation", { name: "Основная навигация" })).toBeVisible();
    await expect(page.locator(".lesson-summary .primary-action")).toHaveAttribute("href", returnTo);
  });

  test("applies saved pronunciation aids only to study stages", async ({ page }) => {
    await signIn(page, {
      lessonPronunciationMode: "furigana",
      lessonRomaji: true,
      speechAutoplay: true,
      speechRate: 1.2,
      speechVoiceUri: "voice-ja-b",
    });
    await mockLessonApi(page);

    await page.goto("/lessons");
    await page.getByRole("button", { name: "Начать урок" }).click();
    await expect(page.locator(".lesson-hero ruby")).toHaveCount(0);
    await expect(page.getByText("ichi", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Далее: Чтение" }).click();

    await expect(page.locator(".lesson-hero ruby rt")).toHaveText("いち");
    await expect(page.getByText("ichi", { exact: true })).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (
            window as typeof window & {
              __spokenJapanese: readonly {
                text: string;
                rate: number;
                voiceUri: string | null;
              }[];
            }
          ).__spokenJapanese.at(-1),
        ),
      )
      .toMatchObject({
        text: "いち",
        rate: 1.2,
        voiceUri: "voice-ja-b",
      });

    await page.getByRole("button", { name: "Далее: Контекст" }).click();
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (
              window as typeof window & {
                __spokenJapanese: readonly { text: string }[];
              }
            ).__spokenJapanese.at(-1)?.text,
        ),
      )
      .toBe("一つください。");
    await expect(page.locator(".lesson-example-list ruby rt")).toHaveText("ひとつください。");
    await expect(page.getByText("hitotsukudasai。", { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "Перейти к проверке" }).click();
    await expect(page.locator("ruby")).toHaveCount(0);
    await expect(page.getByText("ichi", { exact: true })).toBeHidden();
    await expect(page.getByText("hitotsukudasai。", { exact: true })).toBeHidden();
  });

  test("starts the existing lesson flow from a saved deck", async ({ page }) => {
    await signIn(page);
    const startBody = await mockDeckLessonApi(page);

    await page.goto("/lessons?deckId=deck-saved");

    await expect(page.getByRole("heading", { name: "Уроки колоды" })).toBeVisible();
    await expect(page.getByText(/Новости на японском\. Группа: 1/)).toBeVisible();
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

async function signIn(
  page: Page,
  audioSettings: {
    readonly lessonPronunciationMode?: "kana" | "furigana";
    readonly lessonRomaji?: boolean;
    readonly speechAutoplay?: boolean;
    readonly speechRate?: number;
    readonly speechVoiceUri?: string | null;
  } = {},
): Promise<void> {
  await page.addInitScript(
    ({ accessToken, audioSettings: storedAudioSettings }) => {
      const speechWindow = window as typeof window & {
        __spokenJapanese: {
          text: string;
          lang: string;
          rate: number;
          voiceUri: string | null;
        }[];
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
          getVoices: () => [
            {
              default: true,
              lang: "ja-JP",
              name: "Test Japanese A",
              voiceURI: "voice-ja-a",
            },
            {
              default: false,
              lang: "ja-JP",
              name: "Test Japanese B",
              voiceURI: "voice-ja-b",
            },
          ],
          removeEventListener: () => undefined,
          speak: (utterance: MockSpeechSynthesisUtterance) => {
            speechWindow.__spokenJapanese.push({
              text: utterance.text,
              lang: utterance.lang,
              rate: utterance.rate,
              voiceUri: utterance.voice?.voiceURI ?? null,
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
            speechVoiceUri: null,
            speechRate: 0.8,
            speechAutoplay: false,
            soundFeedback: false,
            lessonPronunciationMode: "kana",
            lessonRomaji: false,
            ...storedAudioSettings,
          },
        }),
      );
    },
    { accessToken: ACCESS_TOKEN, audioSettings },
  );
}

function queueResponse(items: readonly LessonQueueItem[], deck = false) {
  return {
    items: items.slice(0, 1),
    availableItems: items,
    batchLimit: 5,
    remainingToday: 20,
    orderMode: "course",
    source: deck
      ? { kind: "deck", deckId: "deck-saved", title: "Новости на японском" }
      : { kind: "course" },
  };
}

function largeLessonQueue(): readonly LessonQueueItem[] {
  return Array.from({ length: 50 }, (_, index) => {
    const itemType = index < 2 ? "kanji" : index % 2 ? "component" : "word";
    return {
      ...lessonQueueItem,
      item: {
        ...lessonQueueItem.item,
        id: `large-${index}`,
        japanese: String.fromCodePoint(0x4e00 + index),
        itemType,
        level: (index % 2) + 1,
      },
      cards: lessonQueueItem.cards.map((card) => ({
        ...card,
        id: `card-${index}-${card.id}`,
        learningItemId: `large-${index}`,
        itemType,
      })),
    };
  });
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
      acceptedAnswers: [
        { locale: "ru-RU", text: "いち", isPrimary: true, sourceKind: "curated" },
        { locale: "en-US", text: "イチ", isPrimary: true, sourceKind: "curated" },
      ],
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
