import { expect, type Page, test } from "@playwright/test";

import {
  type AdminCurriculumCompletenessReportDto,
  type AdminCurationItemDto,
  type AdminImportRunListResponse,
  type AdminReviewQueueResponse,
} from "@kanji-srs/shared";

const API_BASE_URL = "http://localhost:3001";
const ACCESS_TOKEN = "admin-token";
const ITEM_ID = "item-kanji-one";
const CARD_ID = "card-kanji-one-meaning";

test.describe("admin curation", () => {
  test("normal user cannot access admin", async ({ page }) => {
    await signIn(page, "USER");

    await page.goto("/admin");

    await expect(page.getByRole("heading", { name: "Админка" })).toBeVisible();
    await expect(page.getByText("Недостаточно прав")).toBeVisible();
    await expect(page.getByText("Обычный пользователь не может открыть")).toBeVisible();
  });

  test("admin can edit accepted answers", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    await expect(page.getByText("Сводка: Project authored")).toBeVisible();
    await expect(page.locator(".admin-side-grid").getByText("seed.ts")).toBeVisible();
    await expect(page.getByTestId("admin-import-runs")).toContainText("Project authored");
    await expect(page.getByTestId("admin-import-runs")).toContainText("sha256-test");
    await expect(page.getByTestId("admin-import-runs")).toContainText("items: 1");
    await expect(page.getByTestId("admin-import-runs")).toContainText("Parser failed.");
    await page.getByTestId("admin-accepted-en").fill("single line");
    await page.getByTestId("admin-save-card").click();

    await expect(page.getByText("Ответы карточки сохранены.")).toBeVisible();
    await expect(page.getByTestId("admin-accepted-en")).toHaveValue("single line");
  });
});

async function signIn(page: Page, role: "USER" | "ADMIN"): Promise<void> {
  await page.addInitScript(
    ({ accessToken, userRole }) => {
      window.localStorage.setItem("kanji-srs.accessToken", accessToken);
      window.localStorage.setItem("kanji-srs.translationDisplayMode", "ru-en");
      window.localStorage.setItem(
        "kanji-srs.user",
        JSON.stringify({
          id: userRole === "ADMIN" ? "admin-1" : "user-1",
          email: userRole === "ADMIN" ? "admin@example.test" : "learner@example.test",
          displayName: userRole === "ADMIN" ? "Администратор" : "Ученик",
          role: userRole,
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
    { accessToken: ACCESS_TOKEN, userRole: role },
  );
}

async function mockAdminApi(page: Page): Promise<void> {
  let item = buildAdminItem();

  await page.route(`${API_BASE_URL}/admin/items/review-queue**`, async (route) => {
    const response: AdminReviewQueueResponse = {
      items: [
        {
          id: item.id,
          itemType: item.itemType,
          band: item.band,
          title: item.title,
          japanese: item.japanese,
          reading: item.reading,
          level: item.level,
          jlptLevel: item.jlptLevel,
          status: item.status,
          updatedAt: item.updatedAt,
          sourceNames: item.attributions.map((source) => source.sourceName),
          qualityIssues: item.qualityIssues,
        },
      ],
    };

    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/admin/curriculum/completeness`, async (route) => {
    const emptyBand = {
      totalItems: 0,
      publishedItems: 0,
      draftItems: 0,
      needsReviewItems: 0,
      archivedItems: 0,
      importDerivedCandidates: 0,
      missingAcceptedAnswers: 0,
      missingMnemonics: 0,
      missingLocaleCoverage: 0,
      missingAttribution: 0,
      invalidDependencies: 0,
    };
    const response: AdminCurriculumCompletenessReportDto = {
      generatedAt: "2026-06-22T09:00:00.000Z",
      bands: [
        {
          band: "foundation",
          ...emptyBand,
          totalItems: 1,
          needsReviewItems: 1,
          missingMnemonics: 1,
        },
        { band: "n5", ...emptyBand },
        { band: "n4", ...emptyBand },
        { band: "n3", ...emptyBand },
        { band: "n2", ...emptyBand },
      ],
    };

    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/admin/import-runs`, async (route) => {
    const response: AdminImportRunListResponse = {
      importRuns: [
        ...item.importRuns,
        {
          id: "import-run-failed",
          dataSourceName: "JMdict",
          licenseName: "EDRDG License",
          sourceVersion: "2026-06",
          sourceFileName: "JMdict_e.gz",
          checksumSha256: "sha256-failed",
          status: "failed",
          startedAt: "2026-06-23T07:00:00.000Z",
          finishedAt: "2026-06-23T07:00:30.000Z",
          recordCount: 0,
          stats: { entries: 0 },
          errorText: "Parser failed.",
        },
      ],
    };

    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/admin/items/${ITEM_ID}`, async (route) => {
    await route.fulfill({ json: item });
  });

  await page.route(`${API_BASE_URL}/admin/cards/${CARD_ID}/answers`, async (route) => {
    const body = route.request().postDataJSON() as {
      readonly acceptedAnswers: readonly {
        readonly locale: "ru-RU" | "en-US";
        readonly text: string;
        readonly answerKind: "meaning" | "reading";
        readonly isPrimary?: boolean;
      }[];
      readonly blockedAnswers: readonly {
        readonly text: string;
        readonly reason?: string | null;
      }[];
    };

    item = {
      ...item,
      updatedAt: "2026-06-22T09:30:00.000Z",
      cards: item.cards.map((card) =>
        card.id === CARD_ID
          ? {
              ...card,
              updatedAt: "2026-06-22T09:30:00.000Z",
              acceptedAnswers: body.acceptedAnswers.map((answer, index) => ({
                id: `answer-${index + 1}`,
                cardId: CARD_ID,
                locale: answer.locale,
                text: answer.text,
                normalizedText: answer.text,
                answerKind: answer.answerKind,
                isPrimary: answer.isPrimary === true,
              })),
              blockedAnswers: body.blockedAnswers.map((answer, index) => ({
                id: `blocked-${index + 1}`,
                cardId: CARD_ID,
                text: answer.text,
                normalizedText: answer.text,
                reason: answer.reason ?? null,
              })),
            }
          : card,
      ),
    };

    await route.fulfill({ json: item });
  });
}

function buildAdminItem(): AdminCurationItemDto {
  return {
    id: ITEM_ID,
    itemType: "kanji",
    band: "foundation",
    title: "Кандзи 一",
    japanese: "一",
    reading: "いち",
    level: 1,
    jlptLevel: "N5",
    status: "needs-review",
    updatedAt: "2026-06-22T08:00:00.000Z",
    meanings: { ru: "один", en: "one" },
    cards: [
      {
        id: CARD_ID,
        promptType: "meaning",
        answerType: "meaning",
        locale: "ru-RU",
        sortOrder: 1,
        updatedAt: "2026-06-22T08:00:00.000Z",
        acceptedAnswers: [
          {
            id: "answer-1",
            cardId: CARD_ID,
            locale: "ru-RU",
            text: "один",
            normalizedText: "один",
            answerKind: "meaning",
            isPrimary: true,
          },
          {
            id: "answer-2",
            cardId: CARD_ID,
            locale: "en-US",
            text: "one",
            normalizedText: "one",
            answerKind: "meaning",
            isPrimary: true,
          },
        ],
        blockedAnswers: [
          {
            id: "blocked-1",
            cardId: CARD_ID,
            text: "линия",
            normalizedText: "линия",
            reason: "Слишком общее значение.",
          },
        ],
      },
    ],
    hints: [
      {
        id: "hint-1",
        locale: "ru-RU",
        type: "meaning",
        body: "Подсказка.",
        sourceKind: "curated",
        version: 1,
        updatedAt: "2026-06-22T08:00:00.000Z",
      },
    ],
    mnemonics: [
      {
        id: "mnemonic-1",
        locale: "ru-RU",
        type: "story",
        body: "Одна линия.",
        sourceKind: "curated",
        version: 1,
        updatedAt: "2026-06-22T08:00:00.000Z",
      },
    ],
    dependencies: [
      {
        id: "dependency-1",
        prerequisiteItemId: "item-component-one",
        prerequisiteTitle: "Component one",
        prerequisiteStatus: "published",
        dependencyType: "prerequisite",
        requiredStage: 1,
      },
    ],
    attributions: [
      {
        sourceName: "Project authored",
        licenseName: "Project content",
        attributionText: "Project-authored sample data.",
        sourceUrl: null,
      },
    ],
    importRuns: [
      {
        id: "import-run-1",
        dataSourceName: "Project authored",
        licenseName: "Project content",
        sourceVersion: "bootstrap-1",
        sourceFileName: "seed.ts",
        checksumSha256: "sha256-test",
        status: "success",
        startedAt: "2026-06-22T07:00:00.000Z",
        finishedAt: "2026-06-22T07:01:00.000Z",
        recordCount: 1,
        stats: { items: 1 },
        errorText: null,
      },
    ],
    qualityIssues: [
      {
        code: "missing-en-mnemonic",
        message: "Missing English mnemonic.",
        cardId: null,
        dependencyItemId: null,
      },
    ],
  };
}
