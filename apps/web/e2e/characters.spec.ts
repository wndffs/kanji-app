import { expect, type Page, test } from "@playwright/test";
import { changeAccount } from "./support/change-account";
import { captureLearnerThemes } from "./support/capture-learner-themes";
import { listKana } from "@kanji-srs/japanese";

import {
  type CharacterHubKanaSectionDto,
  type CharacterHubKanjiItemDto,
  type CharacterHubResponseDto,
  type KanaScript,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";

test.describe("character hub", () => {
  test("searches after submission, respects IME and combines real course scopes without extra reads", async ({
    page,
  }) => {
    await signIn(page);
    let reads = 0;
    await page.route(`${API_BASE_URL}/characters`, (route) => {
      reads++;
      return route.fulfill({ json: buildHub() });
    });
    await page.goto("/characters?tab=kanji");
    const input = page.getByRole("searchbox", { name: "Поиск кандзи", exact: true });
    const rows = page.locator(".character-hub-kanji-grid > li");
    await expect(rows).toHaveCount(3);
    await input.dispatchEvent("compositionstart");
    await input.fill("ichi");
    await input.press("Enter");
    await expect(rows).toHaveCount(3);
    expect(new URL(page.url()).searchParams.has("q")).toBe(false);
    await input.dispatchEvent("compositionend");
    await page.getByRole("button", { name: "Найти кандзи", exact: true }).click();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("一");
    await page.getByRole("button", { name: "Очистить поиск кандзи", exact: true }).click();
    await expect(rows).toHaveCount(3);
    await page.getByRole("button", { name: "Фильтры кандзи", exact: true }).click();
    await page.getByRole("checkbox", { name: "Текущий уровень", exact: true }).click();
    await expect(
      page.getByRole("checkbox", { name: "Текущий уровень", exact: true }),
    ).toBeChecked();
    await expect(rows).toHaveCount(1);
    await expect(rows).toContainText("語");
    await page.getByRole("checkbox", { name: "Только слабые", exact: true }).click();
    await expect(page.getByRole("checkbox", { name: "Только слабые", exact: true })).toBeChecked();
    await expect(
      page.getByText("По выбранным фильтрам кандзи не найдены.", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
    await expect(rows).toHaveCount(3);
    expect(reads).toBe(1);
  });

  test("keeps list pages across reload, Back and safe material return", async ({ page }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({ json: buildLargeHub() }),
    );
    await page.route(`${API_BASE_URL}/kanji/**`, (route) =>
      route.fulfill({ status: 404, json: { message: "Материал не найден" } }),
    );
    await page.goto("/characters?tab=kanji&page=2&view=list");
    const rows = page.locator(".character-hub-kanji-grid > li");
    const first = String.fromCodePoint(0x4e00 + 60);
    await expect(rows.first()).toContainText(first);
    await expect(rows).toHaveCount(60);
    await page.reload();
    await expect(rows.first()).toContainText(first);
    await page
      .getByRole("navigation", { name: "Страницы кандзи" })
      .getByRole("button", { name: "Далее", exact: true })
      .click();
    await expect(rows).toHaveCount(5);
    await page.goBack();
    await expect(rows.first()).toContainText(first);
    await rows.first().getByRole("link").click();
    const back = page.getByRole("link", { name: "К каталогу кандзи", exact: true });
    await expect(back).toHaveAttribute("href", "/characters?tab=kanji&page=2&view=list");
    await back.click();
    await expect(rows.first()).toContainText(first);
    await expect(page.getByRole("button", { name: "Список кандзи", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("clamps large pages and resets pagination on search or ordering", async ({ page }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({ json: buildLargeHub() }),
    );
    await page.goto("/characters?tab=kanji&page=9999");
    const rows = page.locator(".character-hub-kanji-grid > li");
    await expect(rows).toHaveCount(5);
    await expect(page).toHaveURL("/characters?tab=kanji&page=3");
    await page.getByLabel("Порядок кандзи").selectOption("weakness");
    await expect(rows).toHaveCount(60);
    await expect(rows.first()).toContainText("一");
    expect(new URL(page.url()).searchParams.has("page")).toBe(false);
    await page.getByRole("searchbox", { name: "Поиск кандзи", exact: true }).fill("zzzzmissing");
    await page.getByRole("button", { name: "Найти кандзи", exact: true }).click();
    await expect(rows).toHaveCount(0);
    await page.getByRole("button", { name: "Убрать поисковый запрос", exact: true }).click();
    await expect(rows).toHaveCount(60);
    await expect(page.getByLabel("Порядок кандзи")).toHaveValue("weakness");
  });

  test("reveals and copies only requested readings outside navigation links", async ({ page }) => {
    await signIn(page);
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as typeof window & { __copiedReading: string }).__copiedReading = text;
          },
        },
      });
    });
    let writes = 0;
    page.on("request", (request) => {
      if (request.method() === "POST" || request.method() === "PUT") writes++;
    });
    await page.route(`${API_BASE_URL}/characters`, (route) => route.fulfill({ json: buildHub() }));
    await page.goto("/characters?tab=kanji&view=list&readings=hidden");
    const row = page.locator(".character-hub-kanji-grid > li").first();
    await expect(row.getByRole("link")).not.toContainText("いち");
    await expect(row.getByRole("button", { name: "Копировать чтение", exact: true })).toHaveCount(
      0,
    );
    await row.getByRole("button", { name: "Показать чтение 一", exact: true }).click();
    await expect(row.getByRole("link")).toContainText("いち");
    await row.getByRole("button", { name: "Копировать чтение", exact: true }).click();
    await expect(row.getByLabel("Копирование чтения", { exact: true })).toHaveText("Скопировано");
    expect(
      await page.evaluate(
        () => (window as typeof window & { __copiedReading: string }).__copiedReading,
      ),
    ).toBe("いち");
    await row.getByRole("button", { name: "Скрыть чтение 一", exact: true }).click();
    await expect(row.getByRole("link")).not.toContainText("いち");
    await expect(page).toHaveURL("/characters?tab=kanji&view=list&readings=hidden");
    expect(writes).toBe(0);
    expect(
      await row.evaluate((item) => {
        const body = item.querySelector("a")!.getBoundingClientRect();
        const tools = item.querySelector(".catalogue-reading-actions")!.getBoundingClientRect();
        return body.bottom <= tools.top + 1;
      }),
    ).toBe(true);
    if (test.info().project.name === "desktop") {
      const meaning = await row.locator(".character-hub-kanji-copy").boundingBox();
      const metadata = await row.locator(".character-hub-kanji-meta").boundingBox();
      expect(metadata!.x).toBeGreaterThan(meaning!.x + meaning!.width - 1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await captureLearnerThemes(page, test.info(), "kanji-list-hidden-readings");
  });

  test("labels selected translation rows and reports missing content without fallback", async ({
    page,
  }) => {
    await signIn(page);
    const hub = buildHub();
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({
        json: {
          ...hub,
          kanji: { ...hub.kanji, items: [{ ...hub.kanji.items[0]!, meaningRu: null }] },
        },
      }),
    );
    await page.route(`${API_BASE_URL}/users/settings`, async (route) => {
      const user = await page.evaluate(() => JSON.parse(localStorage.getItem("kanji-srs.user")!));
      await route.fulfill({
        json: { ...user, settings: { ...user.settings, ...route.request().postDataJSON() } },
      });
    });
    await page.goto("/characters?tab=kanji");
    const meanings = page.locator(".character-hub-meaning-rows");
    await expect(meanings).toContainText("Перевод не добавлен");
    await expect(meanings).toContainText("one");
    await page.getByLabel("Режим перевода карточек", { exact: true }).selectOption("en");
    await expect(meanings.locator(":scope > span")).toHaveCount(1);
    await expect(meanings).not.toContainText("Перевод не добавлен");
    await page.getByLabel("Режим перевода карточек", { exact: true }).selectOption("ru");
    await expect(meanings).toContainText("Перевод не добавлен");
    await expect(meanings).not.toContainText("one");
    await captureLearnerThemes(page, test.info(), "kanji-grid-missing-meaning");
  });

  test("offers course selection when no course is active", async ({ page }) => {
    await signIn(page);
    const hub = buildHub();
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({ json: { ...hub, kanji: { ...hub.kanji, currentCourse: null, items: [] } } }),
    );
    await page.goto("/characters?tab=kanji");
    await expect(page.getByRole("link", { name: "Выбрать курс", exact: true })).toHaveAttribute(
      "href",
      "/courses",
    );
    await expect(page.getByRole("searchbox", { name: "Поиск кандзи", exact: true })).toHaveCount(0);
    await expect(page.getByRole("checkbox", { name: "Текущий уровень", exact: true })).toHaveCount(
      0,
    );
  });
  test("separates alphabet signs from exercises and restores combined URL filters", async ({
    page,
  }) => {
    await signIn(page);
    const hub = buildHub();
    const kana = { ...hub.kana };
    for (const script of ["hiragana", "katakana"] as const) {
      const section = kana[script];
      const items = listKana(script).map((item) => ({
        ...buildKanaItem(script, item.character, item.romaji, item.variant === "basic"),
        ...item,
      }));
      kana[script] = {
        ...section,
        totalCount: items.length,
        masteredCount: 46,
        attemptedCount: items.length,
        units: [{ ...section.units[0]!, totalCount: items.length, masteredCount: 46, items }],
      };
    }
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({ json: { ...hub, kana } }),
    );
    await page.goto("/characters?tab=hiragana");
    const summary = page.getByLabel("Состав учебного набора");
    await expect(
      summary.locator("div").filter({ has: page.getByText("Основные знаки", { exact: true }) }),
    ).toContainText("46");
    await expect(
      summary.locator("div").filter({ has: page.getByText("Сочетания", { exact: true }) }),
    ).toContainText("33");
    await expect(
      summary.locator("div").filter({ has: page.getByText("Упражнения", { exact: true }) }),
    ).toContainText("11");
    // Change both controls before the router can acknowledge the first navigation.
    await page.evaluate(() => {
      const [group, state] = Array.from(
        document.querySelectorAll(".kana-map-controls select"),
      ) as HTMLSelectElement[];
      group!.value = "handakuten";
      group!.dispatchEvent(new Event("change", { bubbles: true }));
      state!.value = "mastered";
      state!.dispatchEvent(new Event("change", { bubbles: true }));
    });
    await expect(page).toHaveURL(/group=handakuten&kanaState=mastered/);
    await expect(page.getByText("Нет уроков с таким состоянием.", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Прогресс выбранной группы")).toHaveText(
      "Освоено 0 из 5 · Начато 5",
    );
    await page.reload();
    await expect(page.getByLabel("Группа знаков")).toHaveValue("handakuten");
    await expect(page.getByRole("combobox", { name: /^Состояние уроков/ })).toHaveValue("mastered");
    await page.getByRole("tab", { name: "Катакана", exact: true }).click();
    await expect(page.getByLabel("Группа знаков")).toHaveValue("handakuten");
    await expect(
      summary.locator("div").filter({ has: page.getByText("Упражнения", { exact: true }) }),
    ).toContainText("9");
    await page.getByRole("button", { name: "Сбросить состояние уроков", exact: true }).click();
    await expect(page.locator(".character-hub-kana-units > li")).toHaveCount(1);
    await page.goBack();
    await expect(page.getByRole("combobox", { name: /^Состояние уроков/ })).toHaveValue("mastered");
  });
  test("keeps kana unit insets and stable lesson numbers across groups and themes", async ({
    page,
  }) => {
    await signIn(page);
    const hub = buildHub();
    const first = hub.kana.hiragana.units[0]!;
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({
        json: {
          ...hub,
          kana: {
            ...hub.kana,
            hiragana: {
              ...hub.kana.hiragana,
              totalCount: 8,
              units: [
                first,
                {
                  ...first,
                  id: "hiragana-k",
                  title: "Ряд K и дополнительные упражнения",
                  order: 1,
                  unlocked: false,
                  masteredCount: 0,
                  totalCount: 5,
                  items: ["か", "き", "く", "け", "こ"].map((character, index) =>
                    buildKanaItem(
                      "hiragana",
                      character,
                      ["ka", "ki", "ku", "ke", "ko"][index]!,
                      false,
                    ),
                  ),
                },
                {
                  ...first,
                  id: "hiragana-handakuten",
                  title: "Хандакутэн",
                  order: 12,
                  unlocked: false,
                  masteredCount: 0,
                  totalCount: 1,
                  items: [
                    { ...buildKanaItem("hiragana", "ぱ", "pa", false), variant: "handakuten" },
                  ],
                },
              ],
            },
          },
        },
      }),
    );
    await page.goto("/characters?tab=hiragana");
    const units = page.locator(".character-hub-kana-units > li");
    await expect(units).toHaveCount(2);
    await expect(units.first().getByText("Урок 1", { exact: true })).toBeVisible();
    await expect(units.last().getByText("Урок 2", { exact: true })).toBeVisible();
    await expect(units.first().getByRole("link").first()).toHaveAttribute(
      "href",
      "/kana?script=hiragana&mode=lessons&unit=hiragana-vowels&character=%E3%81%82",
    );
    await expect(units.last().getByRole("link")).toHaveCount(0);
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.interfaceTheme = value;
      }, theme);
      expect(
        await units.evaluateAll((items) =>
          items.every((item) => {
            const style = getComputedStyle(item);
            const bounds = item.getBoundingClientRect();
            const content = [
              ...item.querySelectorAll("header, h3, strong, .character-hub-kana-chart > *"),
            ];
            return (
              parseFloat(style.paddingLeft) >= 16 &&
              parseFloat(style.paddingRight) >= 16 &&
              item.scrollWidth <= item.clientWidth &&
              content.every((child) => {
                const rect = child.getBoundingClientRect();
                return rect.left >= bounds.left + 16 && rect.right <= bounds.right - 16;
              })
            );
          }),
        ),
      ).toBe(true);
    }
    await captureLearnerThemes(page, test.info(), "kana-unit-layout");
    await page.getByLabel("Группа знаков").selectOption("handakuten");
    await expect(units).toHaveCount(1);
    await expect(units.getByText("Урок 3", { exact: true })).toBeVisible();
    await expect(units).toContainText("ぱ");
    await page.getByLabel("Группа знаков").selectOption("all");
    await expect(units).toHaveCount(3);
    await expect(units.last().getByText("Урок 3", { exact: true })).toBeVisible();
  });
  test("recovers a failed hub load and keeps modified kana separate", async ({ page }) => {
    await signIn(page);
    let attempts = 0;
    await page.route(`${API_BASE_URL}/characters`, (route) => {
      attempts++;
      return route.fulfill(
        attempts === 1
          ? { status: 503, json: { message: "Hub unavailable" } }
          : { json: buildHub() },
      );
    });
    await page.goto("/characters");
    await expect(page.getByText("Hub unavailable", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
    await expect(page.getByRole("list", { name: "Все уроки: Хирагана" })).toContainText("あ");
    await page.getByLabel("Группа знаков").selectOption("dakuten");
    await expect(page.getByText("В этой группе знаков нет.", { exact: true })).toBeVisible();
    await page.getByLabel("Группа знаков").selectOption("basic");
    await expect(page.getByRole("list", { name: "Все уроки: Хирагана" })).toContainText("あ");
    expect(attempts).toBe(2);
  });
  for (const status of [200, 401])
    test(`isolates progress after account change and late ${status}`, async ({ page }) => {
      await signIn(page);
      let release!: () => void;
      let started!: () => void;
      let delivered!: () => void;
      const settled = new Promise<void>((resolve) => {
        delivered = resolve;
      });
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const pending = new Promise<void>((resolve) => {
        started = resolve;
      });
      await page.route(`${API_BASE_URL}/characters`, async (route) => {
        if (route.request().headers().authorization === "Bearer character-hub-token") {
          started();
          await held;
          await route
            .fulfill({
              status,
              json: status === 200 ? buildHub() : { message: "Old account expired" },
            })
            .catch(() => undefined);
          delivered();
        } else {
          const hub = buildHub();
          await route.fulfill({
            json: {
              ...hub,
              kanji: {
                ...hub.kanji,
                currentCourse: { ...hub.kanji.currentCourse!, title: "Новый курс" },
              },
            },
          });
        }
      });
      try {
        await page.goto("/characters?tab=kanji");
        await pending;
        await changeAccount(page);
        await expect(page.getByRole("heading", { name: "Новый курс", exact: true })).toBeVisible();
        release();
        await settled;
        await expect(page.getByRole("heading", { name: "Основной курс", exact: true })).toHaveCount(
          0,
        );
        expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
          "new-owner-token",
        );
      } finally {
        release();
      }
    });

  test("bounds kanji pages, resets on filtering and retains keyboard script filters", async ({
    page,
  }) => {
    await signIn(page);
    const hub = buildHub();
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({
        json: {
          ...hub,
          kanji: {
            ...hub.kanji,
            items: Array.from({ length: 125 }, (_, n) => ({
              ...hub.kanji.items[0]!,
              id: `kanji-${n}`,
              level: (n % 2) + 1,
              character: `字${n}`,
            })),
          },
        },
      }),
    );
    await page.goto("/characters?tab=kanji");
    await expect(page.locator(".character-hub-kanji-grid > li")).toHaveCount(60);
    const counters = await page.locator(".character-hub-kanji-stats").boundingBox();
    expect(counters!.height).toBeLessThanOrEqual(80);
    await expect(page.locator(".character-hub-kanji-grid > li").first()).toBeInViewport({
      ratio: 0.1,
    });
    await page
      .getByRole("navigation", { name: "Страницы кандзи" })
      .getByRole("button", { name: "Далее" })
      .click();
    await expect(page.locator(".character-hub-kanji-grid")).toContainText("字60");
    await page.getByRole("button", { name: "Фильтры кандзи", exact: true }).click();
    await page.getByLabel("Уровень", { exact: true }).selectOption("2");
    await expect(page.getByRole("navigation", { name: "Страницы кандзи" })).toContainText("1 / 2");
    await page.getByRole("tab", { name: "Кандзи", exact: true }).press("Home");
    await expect(page.getByRole("tab", { name: "Хирагана", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.getByRole("tab", { name: "Хирагана", exact: true }).press("End");
    await expect(page.getByLabel("Уровень", { exact: true })).toHaveValue("2");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath("character-catalog.png") });
    await page.getByRole("button", { name: "Убрать фильтр: Уровень 2", exact: true }).click();
    await expect(page.getByLabel("Уровень", { exact: true })).toHaveValue("");
    await expect(page.getByRole("tab", { name: "Кандзи", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page.goBack();
    await expect(page.getByLabel("Уровень", { exact: true })).toHaveValue("2");
  });
  test("shows the legacy JLPT edition without adding a modern filter level", async ({ page }) => {
    await signIn(page);
    const hub = buildHub();
    await page.route(`${API_BASE_URL}/characters`, (route) =>
      route.fulfill({
        json: {
          ...hub,
          kanji: {
            ...hub.kanji,
            filters: { ...hub.kanji.filters, jlptLevels: ["n5"] },
            items: [{ ...hub.kanji.items[0], jlptLevel: null, legacyJlptLevel: 4 }],
          },
        },
      }),
    );
    await page.goto("/characters?tab=kanji");
    await expect(page.getByText("JLPT до 2010: 4", { exact: true })).toBeVisible();
    await expect(
      page.getByLabel("JLPT").getByRole("option", { name: "N4", exact: true }),
    ).toHaveCount(0);
  });

  test("keeps kana mastery and kanji SRS navigation distinct", async ({ page }) => {
    await signIn(page);
    await page.route(`${API_BASE_URL}/characters`, async (route) => {
      await route.fulfill({ json: buildHub() });
    });

    await page.goto("/characters?tab=kanji&band=n5");

    await expect(page.getByRole("tab", { name: "Кандзи" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(page.getByText("Основной курс", { exact: true })).toBeVisible();
    await expect(page.getByText("Прогресс кандзи: учебные карточки SRS")).toBeVisible();
    await expect(page.getByRole("link", { name: /一/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /語/ })).toHaveCount(0);

    await page.getByLabel("Состояние").selectOption("weak");
    await expect(page).toHaveURL(/tab=kanji.*band=n5.*state=weak/);
    await expect(page.getByRole("link", { name: /一/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /二/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /一/ })).toHaveAttribute(
      "href",
      /^\/kanji\/%E4%B8%80\?catalogue=/,
    );

    await page.reload();
    await expect(page.getByLabel("Состояние")).toHaveValue("weak");
    await expect(page.getByRole("link", { name: /一/ })).toBeVisible();

    await page.getByRole("tab", { name: "Хирагана" }).click();
    await expect(page).toHaveURL("/characters?tab=hiragana&band=n5&state=weak");
    await expect(page.getByText("Прогресс каны: освоение в уроках, не SRS")).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Освоено 50%" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Все уроки: Хирагана" })).toContainText("あ");
    await expect(page.getByRole("link", { name: "Адаптивная практика" })).toHaveAttribute(
      "href",
      "/kana?script=hiragana&mode=practice",
    );

    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("kanji-srs.accessToken", "character-hub-token");
    window.localStorage.setItem("kanji-srs.translationDisplayMode", "ru-en");
    window.localStorage.setItem(
      "kanji-srs.user",
      JSON.stringify({
        id: "user-1",
        email: "learner@example.test",
        displayName: "Ученик",
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
  });
}

function buildLargeHub(): CharacterHubResponseDto {
  const hub = buildHub();
  return {
    ...hub,
    kanji: {
      ...hub.kanji,
      counts: { ...hub.kanji.counts, total: 125 },
      filters: { ...hub.kanji.filters, levels: [1, 2, 3] },
      items: Array.from({ length: 125 }, (_, index) => ({
        ...buildKanji(
          String.fromCodePoint(0x4e00 + index),
          Math.floor(index / 60) + 1,
          "n5",
          "n5",
          index === 0 ? "learning" : index === 1 ? "passed" : "not-started",
          index === 0,
        ),
        id: `kanji-${index}`,
      })),
    },
  };
}

function buildHub(): CharacterHubResponseDto {
  return {
    kana: {
      hiragana: buildKanaSection("hiragana", "あ", "い"),
      katakana: buildKanaSection("katakana", "ア", "イ"),
    },
    kanji: {
      progressModel: "srs",
      currentCourse: {
        id: "course-main",
        title: "Основной курс",
        currentLevel: 2,
      },
      counts: { total: 3, learned: 2, passed: 1, burned: 0, weak: 1 },
      filters: {
        levels: [1, 2],
        bands: ["n5", "n4"],
        jlptLevels: ["n5", "n4"],
      },
      items: [
        buildKanji("一", 1, "n5", "n5", "learning", true),
        buildKanji("二", 1, "n5", "n5", "passed", false),
        buildKanji("語", 2, "n4", "n4", "not-started", false),
      ],
    },
  };
}

function buildKanaSection(
  script: KanaScript,
  firstCharacter: string,
  secondCharacter: string,
): CharacterHubKanaSectionDto {
  return {
    progressModel: "mastery",
    script,
    totalCount: 2,
    attemptedCount: 1,
    masteredCount: 1,
    weakSymbols: [
      {
        character: secondCharacter,
        script,
        romaji: "i",
        currentStreak: 0,
        recentAccuracy: 0.5,
        lastPracticedAt: "2026-07-27T12:00:00.000Z",
        weaknessScore: 8,
      },
    ],
    actions: {
      lessonsHref: `/kana?script=${script}&mode=lessons`,
      assessmentHref: `/kana?script=${script}&mode=assessment`,
      practiceHref: `/kana?script=${script}&mode=practice`,
    },
    units: [
      {
        id: `${script}-vowels`,
        script,
        title: "Гласные",
        order: 0,
        unlocked: true,
        complete: false,
        masteredCount: 1,
        totalCount: 2,
        items: [
          buildKanaItem(script, firstCharacter, "a", true),
          buildKanaItem(script, secondCharacter, "i", false),
        ],
      },
    ],
  };
}

function buildKanaItem(script: KanaScript, character: string, romaji: string, mastered: boolean) {
  return {
    character,
    script,
    row: "vowels",
    order: romaji === "a" ? 1 : 2,
    variant: "basic" as const,
    baseCharacter: character,
    attemptCount: mastered ? 3 : 1,
    correctCount: mastered ? 3 : 0,
    currentStreak: mastered ? 3 : 0,
    mastered,
    lastAnsweredAt: "2026-07-27T12:00:00.000Z",
    romaji,
  };
}

function buildKanji(
  character: string,
  level: number,
  band: CharacterHubKanjiItemDto["band"],
  jlptLevel: CharacterHubKanjiItemDto["jlptLevel"],
  studyState: CharacterHubKanjiItemDto["studyState"],
  weak: boolean,
): CharacterHubKanjiItemDto {
  return {
    id: `item-${character}`,
    character,
    reading: character === "一" ? "いち" : "ご",
    meaningRu: character === "一" ? "один" : "язык",
    meaningEn: character === "一" ? "one" : "language",
    level,
    band,
    jlptLevel,
    studyState,
    stageIndex: studyState === "not-started" ? null : 3,
    stageName: studyState === "not-started" ? null : "Apprentice 4",
    weaknessScore: weak ? 12 : 0,
    weak,
    href: `/kanji/${encodeURIComponent(character)}`,
  };
}
