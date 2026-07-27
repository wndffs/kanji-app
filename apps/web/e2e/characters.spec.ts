import { expect, type Page, test } from "@playwright/test";

import {
  type CharacterHubKanaSectionDto,
  type CharacterHubKanjiItemDto,
  type CharacterHubResponseDto,
  type KanaScript,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";

test.describe("character hub", () => {
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
    await expect(page).toHaveURL("/characters?tab=hiragana");
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

function buildKanaItem(
  script: KanaScript,
  character: string,
  romaji: string,
  mastered: boolean,
) {
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
