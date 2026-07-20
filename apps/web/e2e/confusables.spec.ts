import { expect, type Page, test } from "@playwright/test";

import {
  type ConfusableComparisonDto,
  type ConfusablePairSummaryDto,
  type ConfusablePracticeSessionDto,
  type ReviewQueueCardDto,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const PAIR_ID = "pair-one-two";
const SESSION_ID = "confusable-session-1";

test.describe("confusable kanji practice", () => {
  test("recalls before revealing a side-by-side comparison", async ({ page }) => {
    await signIn(page);
    await mockApi(page);

    await page.goto("/practice/confusables");

    await expect(page.getByRole("heading", { name: "Похожие кандзи" })).toBeVisible();
    await expect(page.getByText("Похожи внешне")).toBeVisible();
    await expect(page.getByText("Недавних ошибок: 4")).toBeVisible();
    await page.getByRole("link", { name: "Сравнить" }).click();
    await page.getByRole("button", { name: "Начать сравнение" }).click();

    await expect(page.getByText("один", { exact: true })).toHaveCount(0);
    await expect(page.getByText("いち", { exact: true })).toHaveCount(0);
    await page.getByLabel("Введите значение").fill("один");
    await page.keyboard.press("Enter");

    await expect(page.getByRole("heading", { name: "Чем отличаются" })).toBeVisible();
    await expect(page.getByText("один / one", { exact: true })).toBeVisible();
    await expect(page.getByText("いち", { exact: true })).toBeVisible();
    await expect(page.getByText("горизонтальная черта / horizontal stroke")).toBeVisible();
    await expect(page.getByText("一つ", { exact: true })).toBeVisible();
    await expect(page.getByText("Без изменений", { exact: true })).toBeVisible();
  });
});

async function signIn(page: Page): Promise<void> {
  await page.addInitScript(() => {
    window.localStorage.setItem("kanji-srs.accessToken", "test-token");
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
  });
}

async function mockApi(page: Page): Promise<void> {
  let session: ConfusablePracticeSessionDto | null = null;

  await page.route(`${API_BASE_URL}/confusables`, async (route) => {
    await route.fulfill({ json: { pairs: [pair] } });
  });
  await page.route(`${API_BASE_URL}/confusables/${PAIR_ID}/session`, async (route) => {
    if (route.request().method() === "POST") {
      session = {
        id: SESSION_ID,
        pairId: PAIR_ID,
        startedAt: "2026-07-20T12:00:00.000Z",
        currentIndex: 0,
        totalItems: 1,
        progress: { answered: 0, accepted: 0, missed: 0 },
      };
    }

    await route.fulfill({ json: { pair, session, cards: [card] } });
  });
  await page.route(`${API_BASE_URL}/confusables/sessions/${SESSION_ID}/answer`, async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      cardId: card.id,
      answer: "один",
      answerType: "meaning",
    });
    session = {
      ...session!,
      currentIndex: 1,
      progress: { answered: 1, accepted: 1, missed: 0 },
    };
    await route.fulfill({
      json: {
        answer: {
          cardId: card.id,
          accepted: true,
          result: "correct",
          normalizedAnswer: "один",
          matchedAnswer: "один",
          retry: false,
          feedback: {
            message: "Ответ принят.",
            expected: [{ locale: "ru-RU", text: "один", isPrimary: true }],
            blockedReason: null,
            diagnostic: null,
          },
        },
        session,
        comparison,
      },
    });
  });
}

const pair: ConfusablePairSummaryDto = {
  id: PAIR_ID,
  kinds: ["visual"],
  strength: 70,
  recentWrongCount: 4,
  kanji: [
    { itemId: "item-one", character: "一", level: 1, jlptLevel: "N5" },
    { itemId: "item-two", character: "二", level: 1, jlptLevel: "N5" },
  ],
};

const card: ReviewQueueCardDto = {
  id: "card-one-meaning",
  learningItemId: "item-one",
  itemType: "kanji",
  cardType: "review",
  promptType: "meaning",
  answerType: "meaning",
  prompt: { japanese: "一", reading: null },
  sortOrder: 1,
};

const translation = (ru: string, en: string) => ({
  ru: [{ locale: "ru-RU" as const, text: ru, sourceKind: "curated" as const }],
  en: [{ locale: "en-US" as const, text: en, sourceKind: "curated" as const }],
  displayMode: "ru-en" as const,
  primaryRu: ru,
  primaryEn: en,
});

const comparison: ConfusableComparisonDto = {
  pairId: PAIR_ID,
  kinds: ["visual"],
  explanation: translation("У второго знака две черты.", "The second sign has two strokes."),
  kanji: [
    {
      ...pair.kanji[0],
      meanings: translation("один", "one"),
      readings: ["いち"],
      components: [
        {
          id: "component-one",
          japanese: "一",
          reading: null,
          translations: translation("горизонтальная черта", "horizontal stroke"),
        },
      ],
      vocabulary: [
        {
          id: "word-one",
          japanese: "一つ",
          reading: "ひとつ",
          translations: translation("одна вещь", "one thing"),
        },
      ],
    },
    {
      ...pair.kanji[1],
      meanings: translation("два", "two"),
      readings: ["に"],
      components: [],
      vocabulary: [],
    },
  ],
  source: { sourceKind: "curated", sourceNote: "Project-authored distinction." },
};
