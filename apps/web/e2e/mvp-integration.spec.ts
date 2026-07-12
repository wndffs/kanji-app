import { expect, type Page, type Route, test } from "@playwright/test";

import {
  type CompleteLessonItemResponse,
  type DashboardDto,
  type ItemDetails,
  type ItemSummary,
  type LessonQueueItem,
  type ReviewAnswerResponse,
  type ReviewQueueItem,
  type SearchResponseDto,
  type UserOverrideDto,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "mvp-integration-token";
const USER_ID = "mvp-user-1";
const USER_EMAIL = "mvp-learner@example.test";
const USER_PASSWORD = "secure-password";
const USER_DISPLAY_NAME = "MVP learner";
const LESSON_SESSION_ID = "mvp-lesson-session-1";
const REVIEW_SESSION_ID = "mvp-review-session-1";

type AuthSessionDto = {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string | null;
    readonly role: "USER";
    readonly settings: {
      readonly locale: "ru-RU";
      readonly translationDisplayMode: "ru-en";
      readonly timezone: string;
      readonly dailyLessonLimit: number;
      readonly reviewBudget: number;
      readonly strictMode: boolean;
    };
  };
  readonly accessToken: string;
  readonly tokenType: "Bearer";
  readonly expiresAt: string;
};

type MvpApiState = {
  registered: boolean;
  loggedIn: boolean;
  lessonCompleted: boolean;
  reviewAnswered: boolean;
  privateOverrides: UserOverrideDto[];
};

test.describe("final MVP integration path", () => {
  test("registers, studies, reviews, saves a private answer, and opens the item page", async ({
    page,
  }) => {
    await mockMvpApi(page);

    await test.step("Register user and land in the starter course dashboard", async () => {
      await page.goto("/register");
      await page.getByLabel("Почта").fill(USER_EMAIL);
      await page.getByLabel("Имя").fill(USER_DISPLAY_NAME);
      await page.getByLabel("Пароль").fill(USER_PASSWORD);
      await page.getByRole("button", { name: "Создать" }).click();

      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Панель" })).toBeVisible();
      await expect(page.getByText("Стартовый MVP-курс")).toBeVisible();
      await expect(
        page.locator(".metric-card").filter({ hasText: "Доступно уроков" }),
      ).toContainText("1");
    });

    await test.step("Log in with the registered user", async () => {
      await page.evaluate(() => window.localStorage.clear());
      await page.goto("/login");
      await page.getByLabel("Почта").fill(USER_EMAIL);
      await page.getByLabel("Пароль").fill(USER_PASSWORD);
      await page.getByRole("button", { name: "Войти" }).click();

      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByText("Стартовый MVP-курс")).toBeVisible();
    });

    await test.step("Complete one starter lesson item", async () => {
      await page.getByRole("link", { name: "Уроки" }).click();
      await expect(page.getByText(/Выбрано: 1 из максимум 5/)).toBeVisible();
      await expect(page.getByText("один / one")).toBeVisible();

      await page.getByRole("button", { name: "Начать урок" }).click();
      await expect(page.getByRole("heading", { name: "Изучение" })).toBeVisible();
      await page.getByRole("button", { name: "Далее: Чтение" }).click();
      await page.getByRole("button", { name: "Перейти к проверке" }).click();
      await page.getByLabel("Ваше значение").fill("один");
      await page.keyboard.press("Enter");

      await expect(
        page.getByText("Сессия завершена. Новые карточки добавлены в систему повторений."),
      ).toBeVisible();
      await expect(page.getByText("Карточек повторения")).toBeVisible();
    });

    await test.step("See the learned card become reviewable", async () => {
      await page.goto("/dashboard");
      await expect(page.locator(".metric-card").filter({ hasText: "К повторению" })).toContainText(
        "1",
      );
      await expect(
        page.locator(".metric-card").filter({ hasText: "Доступно уроков" }),
      ).toContainText("0");
    });

    await test.step("Answer the review correctly and save a private accepted answer", async () => {
      await page.getByRole("link", { name: "Повторения" }).click();
      await expect(page.getByText("Готово карточек: 1")).toBeVisible();
      await page.getByRole("button", { name: "Начать повторение" }).click();

      await expect(page.getByRole("heading", { name: "Повторение" })).toBeVisible();
      await page.getByLabel("Ответ значением").fill("один");
      await page.keyboard.press("Enter");

      await expect(page.getByRole("region", { name: "Результат ответа" })).toBeVisible();
      await expect(page.getByText("Верно")).toBeVisible();
      await page.getByLabel("Приватный правильный вариант").fill("единица");
      await page.getByRole("button", { name: "Сохранить вариант" }).click();
      await expect(page.getByText("Приватный вариант сохранён.")).toBeVisible();

      await page.getByRole("button", { name: "Дальше" }).click();
      await expect(page.getByText("Сессия завершена.")).toBeVisible();
    });

    await test.step("Search for the item and open its item page", async () => {
      await page.getByRole("link", { name: "Поиск" }).click();
      await page.getByLabel("Запрос").fill("один");
      await page.getByRole("button", { name: "Искать" }).click();

      await expect(page.getByRole("region", { name: "Результаты поиска" })).toBeVisible();
      await expect(page.getByText("一", { exact: true })).toBeVisible();
      await expect(page.getByText("один / one")).toBeVisible();
      await page.getByRole("link", { name: /一/ }).click();

      await expect(page).toHaveURL(/\/items\/item-kanji-one$/);
      await expect(page.getByRole("heading", { name: "一" })).toBeVisible();
      await expect(page.getByText("единица")).toBeVisible();
      await expect(page.getByText("Добавлено из сессии повторения.")).toBeVisible();
    });
  });
});

async function mockMvpApi(page: Page): Promise<void> {
  const state: MvpApiState = {
    registered: false,
    loggedIn: false,
    lessonCompleted: false,
    reviewAnswered: false,
    privateOverrides: [],
  };

  await page.route(`${API_BASE_URL}/auth/register`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly displayName?: string | null;
      readonly email?: string;
      readonly password?: string;
    };

    expect(body).toMatchObject({
      displayName: USER_DISPLAY_NAME,
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });

    state.registered = true;
    state.loggedIn = true;

    await route.fulfill({ json: buildAuthSession() });
  });

  await page.route(`${API_BASE_URL}/auth/login`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly email?: string;
      readonly password?: string;
    };

    expect(state.registered).toBe(true);
    expect(body).toMatchObject({
      email: USER_EMAIL,
      password: USER_PASSWORD,
    });

    state.loggedIn = true;

    await route.fulfill({ json: buildAuthSession() });
  });

  await page.route(`${API_BASE_URL}/dashboard`, async (route) => {
    expectAuthorized(route);
    expect(state.loggedIn).toBe(true);

    await route.fulfill({ json: buildDashboard(state) });
  });

  await page.route(`${API_BASE_URL}/lessons/active`, async (route) => {
    expectAuthorized(route);
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

  await page.route(`${API_BASE_URL}/lessons/queue`, async (route) => {
    expectAuthorized(route);

    await route.fulfill({
      json: {
        items: state.lessonCompleted ? [] : [starterLessonQueueItem],
        availableItems: state.lessonCompleted ? [] : [starterLessonQueueItem],
        batchLimit: 5,
        remainingToday: state.lessonCompleted ? 19 : 20,
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/start`, async (route) => {
    expectAuthorized(route);
    expect(route.request().postDataJSON()).toEqual({ itemIds: [starterItemId] });

    await route.fulfill({
      json: {
        session: buildStarterLessonSession("meaning"),
      },
    });
  });

  await page.route(`${API_BASE_URL}/lessons/${LESSON_SESSION_ID}/progress`, async (route) => {
    expectAuthorized(route);
    const body = route.request().postDataJSON() as {
      readonly currentItemId: string;
      readonly phase: "meaning" | "reading" | "context" | "quiz";
    };
    expect(body.currentItemId).toBe(starterItemId);
    await route.fulfill({ json: { session: buildStarterLessonSession(body.phase) } });
  });

  await page.route(`${API_BASE_URL}/lessons/${LESSON_SESSION_ID}/complete-item`, async (route) => {
    expectAuthorized(route);
    const body = route.request().postDataJSON() as {
      readonly itemId?: string;
      readonly answers?: readonly {
        readonly cardId: string;
        readonly answerType: string;
        readonly answer: string;
      }[];
    };

    expect(body.itemId).toBe(starterItemId);
    expect(body.answers).toEqual([
      {
        cardId: starterMeaningCardId,
        answerType: "meaning",
        answer: "один",
      },
    ]);
    state.lessonCompleted = true;

    await route.fulfill({ json: completeStarterLessonItemResponse });
  });

  await page.route(`${API_BASE_URL}/lessons/${LESSON_SESSION_ID}/finish`, async (route) => {
    expectAuthorized(route);

    await route.fulfill({
      json: {
        session: {
          ...buildStarterLessonSession("quiz"),
          finishedAt: "2026-06-22T08:04:00.000Z",
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/queue`, async (route) => {
    expectAuthorized(route);

    await route.fulfill({
      json: {
        items: state.lessonCompleted && !state.reviewAnswered ? [starterReviewQueueItem] : [],
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/start`, async (route) => {
    expectAuthorized(route);

    await route.fulfill({
      json: {
        session: {
          id: REVIEW_SESSION_ID,
          startedAt: "2026-06-22T12:00:00.000Z",
          mode: "review",
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/reviews/${REVIEW_SESSION_ID}/answer`, async (route) => {
    expectAuthorized(route);
    const body = route.request().postDataJSON() as {
      readonly answer?: string;
      readonly answerType?: string;
      readonly cardId?: string;
    };

    expect(body).toMatchObject({
      answer: "один",
      answerType: "meaning",
      cardId: starterMeaningCardId,
    });

    state.reviewAnswered = true;

    await route.fulfill({ json: buildCorrectReviewAnswer(body.answer ?? "") });
  });

  await page.route(`${API_BASE_URL}/reviews/${REVIEW_SESSION_ID}/finish`, async (route) => {
    expectAuthorized(route);

    await route.fulfill({
      json: {
        session: {
          id: REVIEW_SESSION_ID,
          startedAt: "2026-06-22T12:00:00.000Z",
          finishedAt: "2026-06-22T12:01:00.000Z",
          mode: "review",
        },
      },
    });
  });

  await page.route(`${API_BASE_URL}/cards/*/overrides`, async (route) => {
    expectAuthorized(route);
    const body = route.request().postDataJSON() as {
      readonly locale?: UserOverrideDto["locale"];
      readonly note?: string | null;
      readonly text?: string;
    };
    const override = buildPrivateOverride(body.text ?? "", body.locale ?? "ru-RU", body.note);

    state.privateOverrides = [override];

    await route.fulfill({ json: override });
  });

  await page.route(`${API_BASE_URL}/search?*`, async (route) => {
    const url = new URL(route.request().url());
    const query = url.searchParams.get("q") ?? "";

    await route.fulfill({ json: buildSearchResponse(query, state) });
  });

  await page.route(`${API_BASE_URL}/items/${starterItemId}`, async (route) => {
    expectAuthorized(route);

    await route.fulfill({ json: buildStarterItemDetails(state) });
  });
}

function buildStarterLessonSession(phase: "meaning" | "reading" | "context" | "quiz") {
  return {
    id: LESSON_SESSION_ID,
    startedAt: "2026-06-22T08:00:00.000Z",
    finishedAt: null,
    mode: "lesson" as const,
    deckId: null,
    itemIds: [starterItemId],
    currentItemId: starterItemId,
    phase,
  };
}

function expectAuthorized(route: Route): void {
  expect(route.request().headers().authorization).toBe(`Bearer ${ACCESS_TOKEN}`);
}

function buildAuthSession(): AuthSessionDto {
  return {
    user: {
      id: USER_ID,
      email: USER_EMAIL,
      displayName: USER_DISPLAY_NAME,
      role: "USER",
      settings: {
        locale: "ru-RU",
        translationDisplayMode: "ru-en",
        timezone: "Europe/Moscow",
        dailyLessonLimit: 20,
        reviewBudget: 100,
        strictMode: false,
      },
    },
    accessToken: ACCESS_TOKEN,
    tokenType: "Bearer",
    expiresAt: "2026-06-23T08:00:00.000Z",
  };
}

function buildDashboard(state: MvpApiState): DashboardDto {
  const dueReviews = state.lessonCompleted && !state.reviewAnswered ? 1 : 0;
  const availableLessons = state.lessonCompleted ? 0 : 1;

  return {
    user: {
      id: USER_ID,
      displayName: USER_DISPLAY_NAME,
      locale: "ru-RU",
      translationDisplayMode: "ru-en",
      timezone: "Europe/Moscow",
    },
    counts: {
      dueReviews,
      availableLessons,
      burnedCards: 0,
      leechCandidates: 0,
    },
    currentCourse: {
      id: "starter-course",
      title: "Стартовый MVP-курс",
      currentLevel: 1,
      levelProgress: {
        level: 1,
        completedItems: state.lessonCompleted ? 1 : 0,
        totalItems: 1,
        completedCards: state.lessonCompleted ? 1 : 0,
        totalCards: 1,
        percent: state.lessonCompleted ? 100 : 0,
        cardPercent: state.lessonCompleted ? 100 : 0,
      },
    },
    workload: {
      reviews: {
        dueNow: dueReviews,
        next24Hours: 0,
        laterThisWeek: 0,
        budget: 100,
        pressurePercent: dueReviews,
      },
      lessons: {
        completedToday: state.lessonCompleted ? 1 : 0,
        remainingToday: state.lessonCompleted ? 19 : 20,
        dailyLimit: 20,
        percent: state.lessonCompleted ? 5 : 0,
      },
    },
    reviewForecast:
      dueReviews === 0
        ? []
        : [
            {
              bucketKey: "2026-06-22T12:00",
              localDate: "2026-06-22",
              localHour: 12,
              dueCount: 1,
            },
          ],
    leechCandidates: [],
    recentReviewStats: {
      since: "2026-06-15T00:00:00.000Z",
      total: state.reviewAnswered ? 1 : 0,
      correct: state.reviewAnswered ? 1 : 0,
      wrong: 0,
      typo: 0,
      reveal: 0,
      manualIgnore: 0,
      resurrect: 0,
      accuracy: state.reviewAnswered ? 1 : null,
    },
    recentItems: state.lessonCompleted ? [buildStarterItemSummary(state)] : [],
  };
}

function buildSearchResponse(query: string, state: MvpApiState): SearchResponseDto {
  const normalized = query.trim().toLowerCase();
  const matchesStarterItem = ["一", "いち", "один", "one", "единица"].includes(normalized);
  const items = matchesStarterItem ? [buildStarterItemSummary(state)] : [];

  return {
    query,
    items,
    pagination: {
      page: 1,
      limit: 20,
      total: items.length,
      hasNextPage: false,
    },
  };
}

function buildStarterItemDetails(state: MvpApiState): ItemDetails {
  return {
    ...buildStarterItemSummary(state),
    componentDetails: null,
    cards: [starterMeaningCard],
    relations: [{ item: starterComponentSummary, relationType: "component" }],
    mnemonics: {
      ru: [
        {
          locale: "ru-RU",
          text: "Одна горизонтальная черта задаёт идею единицы.",
          isPrimary: true,
          sourceKind: "curated",
        },
      ],
      en: [
        {
          locale: "en-US",
          text: "One horizontal stroke marks the idea of one.",
          isPrimary: true,
          sourceKind: "curated",
        },
      ],
    },
    hints: {
      ru: [
        {
          locale: "ru-RU",
          text: "Сначала проверьте значение, затем чтение いち.",
          isPrimary: true,
          sourceKind: "curated",
        },
      ],
      en: [
        {
          locale: "en-US",
          text: "Check the meaning first, then the reading いち.",
          isPrimary: true,
          sourceKind: "curated",
        },
      ],
    },
    exampleSentences: [],
    attributions: [
      {
        sourceName: "Project-authored MVP fixture",
        licenseName: "Project internal",
        attributionText: "Deterministic Playwright seed data for task 33.",
        sourceUrl: null,
      },
    ],
    userOverrides: state.privateOverrides,
    strokeGraphic: null,
  };
}

function buildStarterItemSummary(state: MvpApiState): ItemSummary {
  return {
    id: starterItemId,
    itemType: "kanji",
    slug: "kanji:一",
    japanese: "一",
    reading: "いち",
    translations: starterTranslations,
    level: 1,
    jlptLevel: "N5",
    srs:
      state.lessonCompleted || state.reviewAnswered
        ? {
            stageIndex: state.reviewAnswered ? 2 : 1,
            stageName: state.reviewAnswered ? "Apprentice 2" : "Apprentice 1",
            availableAt: state.reviewAnswered
              ? "2026-06-22T20:00:00.000Z"
              : "2026-06-22T12:00:00.000Z",
            burnedAt: null,
            wrongCount: 0,
            correctStreak: state.reviewAnswered ? 1 : 0,
          }
        : null,
  };
}

function buildCorrectReviewAnswer(answer: string): ReviewAnswerResponse {
  return {
    cardId: starterMeaningCardId,
    accepted: true,
    result: "correct",
    normalizedAnswer: answer,
    matchedAnswer: answer,
    feedback: {
      message: "Ответ принят.",
      expected: starterMeaningCard.acceptedAnswers,
      blockedReason: null,
    },
    previousSrs: starterReviewQueueItem.srs,
    nextSrs: {
      stageIndex: 2,
      stageName: "Apprentice 2",
      availableAt: "2026-06-22T20:00:00.000Z",
      burnedAt: null,
      wrongCount: 0,
      correctStreak: 1,
    },
  };
}

function buildPrivateOverride(
  text: string,
  locale: UserOverrideDto["locale"],
  note?: string | null,
): UserOverrideDto {
  return {
    id: "override-mvp-one",
    learningCardId: starterMeaningCardId,
    kind: "accepted-answer",
    locale,
    text,
    normalizedText: text.toLowerCase(),
    note: note ?? "Saved from the final MVP integration test.",
    createdAt: "2026-06-22T12:00:30.000Z",
    updatedAt: "2026-06-22T12:00:30.000Z",
  };
}

const starterItemId = "item-kanji-one";
const starterMeaningCardId = "card-kanji-one-meaning";

const starterTranslations = {
  displayMode: "ru-en",
  primaryRu: "один",
  primaryEn: "one",
  ru: [{ locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" }],
  en: [{ locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" }],
} satisfies ItemSummary["translations"];

const starterMeaningCard = {
  id: starterMeaningCardId,
  learningItemId: starterItemId,
  itemType: "kanji",
  cardType: "lesson",
  promptType: "meaning",
  answerType: "meaning",
  translationDisplayMode: "ru-en",
  prompt: {
    japanese: "一",
    reading: "いち",
  },
  translations: starterTranslations,
  acceptedAnswers: [
    { locale: "ru-RU", text: "один", isPrimary: true, sourceKind: "curated" },
    { locale: "en-US", text: "one", isPrimary: true, sourceKind: "curated" },
  ],
  blockedAnswers: [],
  sortOrder: 1,
} satisfies LessonQueueItem["cards"][number];

const starterComponentSummary: ItemSummary = {
  id: "item-component-one",
  itemType: "component",
  slug: "component:one-stroke",
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
};

const starterLessonQueueItem: LessonQueueItem = {
  item: {
    id: starterItemId,
    itemType: "kanji",
    slug: "kanji:一",
    japanese: "一",
    reading: "いち",
    translations: starterTranslations,
    level: 1,
    jlptLevel: "N5",
    srs: null,
  },
  cards: [starterMeaningCard],
  unlockedBy: [starterComponentSummary],
  mnemonics: [],
  hints: [],
  exampleSentences: [],
};

const completeStarterLessonItemResponse: CompleteLessonItemResponse = {
  itemId: starterItemId,
  passed: true,
  createdSrsStateCount: 1,
  answers: [
    {
      cardId: starterMeaningCardId,
      answerType: "meaning",
      accepted: true,
      result: "correct",
      normalizedAnswer: "один",
      expected: starterMeaningCard.acceptedAnswers,
    },
  ],
  cards: [
    {
      cardId: starterMeaningCardId,
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

const starterReviewQueueItem: ReviewQueueItem = {
  card: {
    id: starterMeaningCardId,
    learningItemId: starterItemId,
    itemType: "kanji",
    cardType: "review",
    promptType: "meaning",
    answerType: "meaning",
    prompt: {
      japanese: "一",
      reading: "いち",
    },
    sortOrder: 1,
  },
  item: {
    id: starterItemId,
    itemType: "kanji",
    slug: "kanji:一",
    japanese: "一",
    reading: "いち",
    level: 1,
    jlptLevel: "N5",
  },
  dueAt: "2026-06-22T12:00:00.000Z",
  srs: {
    stageIndex: 1,
    stageName: "Apprentice 1",
    availableAt: "2026-06-22T12:00:00.000Z",
    burnedAt: null,
    wrongCount: 0,
    correctStreak: 0,
  },
};
