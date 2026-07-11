import { expect, type Page, type Route, test } from "@playwright/test";

import {
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaLessonPathDto,
  type KanaScript,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "kana-token";

test.describe("kana lessons", () => {
  test("rotates kana exercises and switches to katakana", async ({ page }) => {
    await signIn(page);
    await mockKanaApi(page);

    await page.goto("/kana");

    const practice = page.getByTestId("kana-practice");
    await expect(page.getByRole("heading", { name: "Кана" })).toBeVisible();
    await expect(practice).toContainText("あ");
    await expect(practice).toContainText("a");
    const yoonTile = page.getByTestId("kana-unit-list").getByText("きゃ", { exact: true });
    await expect(yoonTile).toBeVisible();
    expect(await yoonTile.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    const sokuonTile = page.getByTestId("kana-unit-list").getByText("っか", { exact: true });
    const longVowelTile = page.getByTestId("kana-unit-list").getByText("おう", { exact: true });
    await expect(sokuonTile).toBeVisible();
    await expect(longVowelTile).toBeVisible();
    expect(await sokuonTile.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(
      await longVowelTile.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.getByRole("tab", { name: "Проверка" }).click();
    const assessmentYoon = page.getByRole("button", { name: "きゃ: прогресс 0 из 3" });
    await expect(assessmentYoon).toBeVisible();
    expect(
      await assessmentYoon.evaluate((element) => element.scrollWidth <= element.clientWidth),
    ).toBe(true);
    await page.getByRole("tab", { name: "Уроки" }).click();
    await page.getByRole("button", { name: "Проверить чтение" }).click();
    await page.getByLabel("Ромадзи").fill("a");
    await page.getByRole("button", { name: "Проверить" }).click();

    await expect(practice.getByText("Верно")).toBeVisible();
    await expect(practice.getByText("a", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();
    await expect(practice).toContainText("い");

    await page.getByRole("button", { name: "Проверить чтение" }).click();
    await expect(practice.getByText("Выберите чтение", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "i", exact: true }).click();
    await expect(practice.getByText("Верно")).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();
    await expect(practice).toContainText("う");

    await page.getByRole("button", { name: "Проверить чтение" }).click();
    await expect(practice.getByText("Выберите знак", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "う", exact: true }).click();
    await expect(practice.getByText("Верно")).toBeVisible();

    await page.getByRole("tab", { name: "Проверка" }).click();
    await page.getByRole("button", { name: "っか: прогресс 0 из 3" }).click();
    await expect(practice.getByText("Аудирование", { exact: true })).toBeVisible();
    await practice.getByRole("button", { name: "Воспроизвести произношение" }).click();
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as typeof window & { __spokenKana: readonly string[] }).__spokenKana.at(-1),
        ),
      )
      .toBe("かっか");
    await practice.getByRole("button", { name: "っか", exact: true }).click();
    await expect(practice.getByText("Верно")).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();

    await page.getByRole("button", { name: "きゃ: прогресс 0 из 3" }).click();
    await expect(practice.getByText("Сопоставление", { exact: true })).toBeVisible();
    for (const [character, romaji] of [
      ["きゃ", "kya"],
      ["う", "u"],
      ["っか", "kka"],
    ] as const) {
      await practice.getByRole("button", { name: character, exact: true }).click();
      await practice.getByRole("button", { name: romaji, exact: true }).click();
    }
    await expect(practice.getByText("Все пары собраны", { exact: true })).toBeVisible();

    await page.getByRole("tab", { name: "Уроки" }).click();
    await page.getByRole("button", { name: "Катакана" }).click();
    await expect(practice).toContainText("ア");
    await expect(
      page.getByTestId("kana-unit-list").getByText("キャ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("kana-unit-list").getByText("ッカ", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByTestId("kana-unit-list").getByText("オー", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("progressbar", { name: "Освоено 0%" })).toBeVisible();
  });
});

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(
    ({ accessToken }) => {
      const speechWindow = window as typeof window & { __spokenKana: string[] };
      speechWindow.__spokenKana = [];
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
          getVoices: () => [{ default: true, lang: "ja-JP", name: "Test Japanese" }],
          removeEventListener: () => undefined,
          speak: (utterance: MockSpeechSynthesisUtterance) => {
            speechWindow.__spokenKana.push(utterance.text);
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
    },
    { accessToken: ACCESS_TOKEN },
  );
}

async function mockKanaApi(page: Page): Promise<void> {
  const progressByScript = new Map<KanaScript, KanaAssessmentProgressDto>([
    ["hiragana", buildProgress("hiragana", ["あ", "い", "う", "きゃ", "っか", "おう"])],
    ["katakana", buildProgress("katakana", ["ア", "イ", "ウ", "キャ", "ッカ", "オー"])],
  ]);

  await page.route(`${API_BASE_URL}/kana/assessment?script=*`, async (route) => {
    const script = new URL(route.request().url()).searchParams.get("script") as KanaScript;
    await route.fulfill({ json: progressByScript.get(script) });
  });

  await page.route(`${API_BASE_URL}/kana/lessons?script=*`, async (route) => {
    const script = new URL(route.request().url()).searchParams.get("script") as KanaScript;
    await route.fulfill({ json: buildLessonPath(progressByScript.get(script)!) });
  });

  await page.route(`${API_BASE_URL}/kana/assessment/answer`, async (route) => {
    await answerKanaRoute(route, progressByScript);
  });

  await page.route(`${API_BASE_URL}/kana/lessons/answer`, async (route) => {
    await answerKanaRoute(route, progressByScript);
  });
}

async function answerKanaRoute(
  route: Route,
  progressByScript: Map<KanaScript, KanaAssessmentProgressDto>,
): Promise<void> {
  const body = route.request().postDataJSON() as KanaAssessmentAnswerRequest;
  const script = [...progressByScript.entries()].find(([, candidate]) =>
    candidate.items.some((item) => item.character === body.character),
  )?.[0];

  if (script === undefined) {
    throw new Error(`Unknown mocked kana ${body.character}.`);
  }

  const progress = progressByScript.get(script)!;
  const current = progress.items.find((item) => item.character === body.character)!;
  const expectedRomaji = getMockRomaji(body.character);
  const correct = body.answer === expectedRomaji;
  const updated: KanaAssessmentItemDto = {
    ...current,
    attemptCount: current.attemptCount + 1,
    correctCount: current.correctCount + (correct ? 1 : 0),
    currentStreak: correct ? current.currentStreak + 1 : 0,
    lastAnsweredAt: "2026-07-11T18:00:00.000Z",
  };
  progressByScript.set(script, {
    ...progress,
    attemptedCount: 1,
    items: progress.items.map((item) => (item.character === updated.character ? updated : item)),
  });
  const response: KanaAssessmentAnswerResponse = {
    correct,
    normalizedAnswer: body.answer,
    expectedRomaji,
    item: updated,
    attemptedCount: 1,
    masteredCount: 0,
  };

  await route.fulfill({ json: response });
}

function buildProgress(
  script: KanaScript,
  characters: readonly string[],
): KanaAssessmentProgressDto {
  return {
    script,
    masteryThreshold: 3,
    totalCount: characters.length,
    attemptedCount: 0,
    masteredCount: 0,
    items: characters.map((character, order) => {
      const metadata = getMockKanaMetadata(character);

      return {
        character,
        script,
        row: metadata.row,
        order,
        variant: metadata.variant,
        baseCharacter: metadata.baseCharacter,
        attemptCount: 0,
        correctCount: 0,
        currentStreak: 0,
        mastered: false,
        lastAnsweredAt: null,
      };
    }),
  };
}

function buildLessonPath(progress: KanaAssessmentProgressDto): KanaLessonPathDto {
  const vowels = progress.items.filter((item) => item.row === "vowels");
  const yoon = progress.items.filter((item) => item.row === "ky");
  const sokuon = progress.items.filter((item) => item.row === "sokuon");
  const longVowels = progress.items.filter((item) => item.row === "long-vowel");

  return {
    script: progress.script,
    masteryThreshold: progress.masteryThreshold,
    masteredCount: progress.masteredCount,
    totalCount: progress.totalCount,
    units: [
      {
        id: `${progress.script}-vowels`,
        script: progress.script,
        title: "Гласные",
        order: 0,
        unlocked: true,
        complete: false,
        masteredCount: 0,
        totalCount: vowels.length,
        items: vowels.map((item, index) => ({
          ...item,
          romaji: ["a", "i", "u"][index] ?? "a",
        })),
      },
      {
        id: `${progress.script}-ky`,
        script: progress.script,
        title: "Ёон: KY",
        order: 1,
        unlocked: false,
        complete: false,
        masteredCount: 0,
        totalCount: yoon.length,
        items: yoon.map((item) => ({ ...item, romaji: "kya" })),
      },
      {
        id: `${progress.script}-sokuon`,
        script: progress.script,
        title: "Малая っ: удвоение",
        order: 2,
        unlocked: false,
        complete: false,
        masteredCount: 0,
        totalCount: sokuon.length,
        items: sokuon.map((item) => ({ ...item, romaji: "kka" })),
      },
      {
        id: `${progress.script}-long-vowels`,
        script: progress.script,
        title: "Долгие гласные",
        order: 3,
        unlocked: false,
        complete: false,
        masteredCount: 0,
        totalCount: longVowels.length,
        items: longVowels.map((item) => ({
          ...item,
          romaji: item.character === "おう" ? "ou" : "oo",
        })),
      },
    ],
  };
}

function getMockKanaMetadata(
  character: string,
): Pick<KanaAssessmentItemDto, "row" | "variant" | "baseCharacter"> {
  if (character === "きゃ" || character === "キャ") {
    return { row: "ky", variant: "yoon", baseCharacter: character[0] ?? character };
  }

  if (character === "っか" || character === "ッカ") {
    return { row: "sokuon", variant: "sokuon", baseCharacter: character[0] ?? character };
  }

  if (character === "おう" || character === "オー") {
    return { row: "long-vowel", variant: "long-vowel", baseCharacter: character[0] ?? character };
  }

  return { row: "vowels", variant: "basic", baseCharacter: character };
}

function getMockRomaji(character: string): string {
  const romaji = new Map([
    ["あ", "a"],
    ["い", "i"],
    ["う", "u"],
    ["きゃ", "kya"],
    ["っか", "kka"],
    ["おう", "ou"],
    ["ア", "a"],
    ["イ", "i"],
    ["ウ", "u"],
    ["キャ", "kya"],
    ["ッカ", "kka"],
    ["オー", "oo"],
  ]).get(character);

  if (romaji === undefined) {
    throw new Error(`Unknown mocked kana ${character}.`);
  }

  return romaji;
}
