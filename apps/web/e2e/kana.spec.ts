import { expect, type Page, test } from "@playwright/test";

import {
  type KanaAssessmentAnswerRequest,
  type KanaAssessmentAnswerResponse,
  type KanaAssessmentItemDto,
  type KanaAssessmentProgressDto,
  type KanaScript,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "kana-token";

test.describe("kana onboarding", () => {
  test("checks hiragana and switches to katakana", async ({ page }) => {
    await signIn(page);
    await mockKanaApi(page);

    await page.goto("/kana");

    const practice = page.getByTestId("kana-practice");
    await expect(page.getByRole("heading", { name: "Кана" })).toBeVisible();
    await expect(practice).toContainText("あ");
    await page.getByLabel("Ромадзи").fill("a");
    await page.getByRole("button", { name: "Проверить" }).click();

    await expect(practice.getByText("Верно")).toBeVisible();
    await expect(practice.getByText("a", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Следующий" }).click();
    await expect(practice).toContainText("い");

    await page.getByRole("button", { name: "Катакана" }).click();
    await expect(practice).toContainText("ア");
    await expect(page.getByText("0/3", { exact: true })).toBeVisible();
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
    ["hiragana", buildProgress("hiragana", ["あ", "い", "う"])],
    ["katakana", buildProgress("katakana", ["ア", "イ", "ウ"])],
  ]);

  await page.route(`${API_BASE_URL}/kana/assessment?script=*`, async (route) => {
    const script = new URL(route.request().url()).searchParams.get("script") as KanaScript;
    await route.fulfill({ json: progressByScript.get(script) });
  });

  await page.route(`${API_BASE_URL}/kana/assessment/answer`, async (route) => {
    const body = route.request().postDataJSON() as KanaAssessmentAnswerRequest;
    const script: KanaScript = body.character === "あ" ? "hiragana" : "katakana";
    const progress = progressByScript.get(script)!;
    const current = progress.items.find((item) => item.character === body.character)!;
    const updated: KanaAssessmentItemDto = {
      ...current,
      attemptCount: current.attemptCount + 1,
      correctCount: current.correctCount + 1,
      currentStreak: current.currentStreak + 1,
      lastAnsweredAt: "2026-07-11T18:00:00.000Z",
    };
    progressByScript.set(script, {
      ...progress,
      attemptedCount: 1,
      items: progress.items.map((item) => (item.character === updated.character ? updated : item)),
    });
    const response: KanaAssessmentAnswerResponse = {
      correct: true,
      normalizedAnswer: body.answer,
      expectedRomaji: "a",
      item: updated,
      attemptedCount: 1,
      masteredCount: 0,
    };

    await route.fulfill({ json: response });
  });
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
    items: characters.map((character, order) => ({
      character,
      script,
      row: "vowels",
      order,
      attemptCount: 0,
      correctCount: 0,
      currentStreak: 0,
      mastered: false,
      lastAnsweredAt: null,
    })),
  };
}
