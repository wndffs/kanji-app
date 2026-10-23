import { expect, type Page, test } from "@playwright/test";
import { changeAccount } from "./support/change-account";

import {
  type CharacterHubKanaSectionDto,
  type CharacterHubKanjiItemDto,
  type CharacterHubResponseDto,
  type KanaScript,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";

test.describe("character hub", () => {
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
        const old = page.waitForResponse(
          (response) =>
            response.url().endsWith("/characters") &&
            response.request().headers().authorization === "Bearer character-hub-token",
        );
        release();
        await (await old).finished();
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
    await page
      .getByRole("navigation", { name: "Страницы кандзи" })
      .getByRole("button", { name: "Далее" })
      .click();
    await expect(page.locator(".character-hub-kanji-grid")).toContainText("字60");
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
      "/kanji/%E4%B8%80",
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
        order: 1,
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
