import { expect, type Page, test } from "@playwright/test";

import {
  type AdminApproveImportedTranslationRequest,
  type AdminCurriculumCandidatePlanResponse,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurriculumScaleReadinessDto,
  type AdminCurationItemDto,
  type AdminImportRunListResponse,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateListResponse,
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
    await expect(page.getByTestId("admin-scale-readiness")).toContainText(/2.?300/);
    const candidatePlan = page.getByTestId("admin-candidate-plan");
    await expect(candidatePlan).toContainText("一");
    await candidatePlan.getByRole("button", { name: "Слова" }).click();
    await expect(candidatePlan).toContainText("水");
    await expect(page.getByTestId("admin-imported-candidates")).toContainText("#1 · 100");
    await page.getByTestId("admin-imported-candidates").getByRole("button").click();
    await expect(page.getByLabel("Target ID")).toHaveValue("target-imported-word");
    await expect(page.getByLabel("Curated title")).toHaveValue("Слово 水");
    await page.getByTestId("admin-accepted-en").fill("single line");
    await page.getByTestId("admin-save-card").click();

    await expect(page.getByText("Ответы карточки сохранены.")).toBeVisible();
    await expect(page.getByTestId("admin-accepted-en")).toHaveValue("single line");
  });

  test("admin can approve the next bilingual imported translation", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const review = page.getByTestId("admin-translation-review");
    await expect(review).toContainText("Импорт RU");
    await expect(review).toContainText("Import EN");
    await expect(page.getByTestId("translation-meaning-ru")).toHaveValue("вода");
    await expect(page.getByTestId("translation-meaning-en")).toHaveValue("water");
    await page.getByTestId("translation-accepted-ru").fill("вода\nводы");
    await page.getByRole("button", { name: "Подтвердить перевод" }).click();

    await expect(
      page.getByText("Перевод подтверждён и добавлен в кураторскую очередь."),
    ).toBeVisible();
    await expect(review).toContainText("Кандидатов с русским и английским переводом пока нет.");
  });

  test("admin can curate a candidate selected from the full curriculum plan", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const candidatePlan = page.getByTestId("admin-candidate-plan");
    await candidatePlan.getByRole("button", { name: "Проверить 一" }).click();

    const review = page.getByTestId("admin-translation-review");
    await expect(review.getByRole("heading", { name: "一" })).toBeVisible();
    await expect(page.getByTestId("translation-meaning-ru")).toHaveValue("");
    await expect(page.getByTestId("translation-meaning-en")).toHaveValue("one");
    await expect(page.getByTestId("translation-accepted-en")).toHaveValue("one");
    await expect(page.getByTestId("admin-translation-provenance")).toContainText("KANJIDIC2");
    await expect(page.getByTestId("admin-translation-provenance")).toContainText("он: イチ");
    await expect(page.getByTestId("admin-translation-provenance")).toContainText(
      "sha256-kanjidic2",
    );

    await page.getByTestId("translation-meaning-ru").fill("один");
    await page.getByTestId("translation-accepted-ru").fill("один\nединица");
    await review.getByRole("button", { name: "Подтвердить перевод" }).click();

    await expect(
      page.getByText("Перевод подтверждён и добавлен в кураторскую очередь."),
    ).toBeVisible();
    await expect(candidatePlan.getByRole("button", { name: "Проверить 一" })).toHaveCount(0);
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
  const approvedPlanTargets = new Set<string>();
  let importedCandidates: AdminImportedCandidateListResponse["candidates"] = [
    {
      rank: 1,
      score: 100,
      targetId: "target-imported-word",
      itemType: "word",
      japanese: "水",
      reading: "みず",
      meanings: { ru: ["вода"], en: ["water"] },
      jlptLevel: null,
      sourcePriority: 1_000,
      sourceName: "JMdict",
      suggestedBand: "n5",
      suggestedTitle: "Слово 水",
      reasons: [
        { code: "source-priority", points: 55 },
        { code: "ru-coverage", points: 15 },
        { code: "en-coverage", points: 15 },
        { code: "reading", points: 10 },
        { code: "kanji-orthography", points: 5 },
      ],
    },
  ];

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

  await page.route(`${API_BASE_URL}/admin/curriculum/scale-readiness`, async (route) => {
    const response: AdminCurriculumScaleReadinessDto = {
      generatedAt: "2026-07-13T12:00:00.000Z",
      items: [
        {
          itemType: "kanji",
          targetItems: 2_300,
          publishedItems: 2,
          inCurationItems: 1,
          importedCandidates: 12_000,
          remainingToPublish: 2_298,
          candidatesNeeded: 2_297,
          fillableCandidateSlots: 2_297,
          capacityShortfall: 0,
          candidateCoverage: {
            withReading: 11_900,
            withRussianMeaning: 12,
            withEnglishMeaning: 12_000,
            withBilingualMeanings: 12,
            withStrokeData: 11_800,
          },
        },
        {
          itemType: "word",
          targetItems: 8_000,
          publishedItems: 4,
          inCurationItems: 2,
          importedCandidates: 150_000,
          remainingToPublish: 7_996,
          candidatesNeeded: 7_994,
          fillableCandidateSlots: 7_994,
          capacityShortfall: 0,
          candidateCoverage: {
            withReading: 150_000,
            withRussianMeaning: 140_000,
            withEnglishMeaning: 150_000,
            withBilingualMeanings: 140_000,
            withStrokeData: null,
          },
        },
      ],
    };

    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/admin/curriculum/candidate-plan**`, async (route) => {
    const url = new URL(route.request().url());
    const itemType = url.searchParams.get("itemType") === "word" ? "word" : "kanji";

    if (itemType === "word" && url.searchParams.get("planVersion") !== "plan-version-one") {
      await route.fulfill({ status: 409, json: { message: "Candidate plan data changed." } });
      return;
    }

    const targetId = itemType === "kanji" ? "plan-kanji-one" : "plan-word-water";
    const candidateApproved = approvedPlanTargets.has(`${itemType}:${targetId}`);
    const response: AdminCurriculumCandidatePlanResponse = {
      planVersion: "plan-version-one",
      generatedAt: "2026-07-13T12:01:00.000Z",
      summary: {
        policyVersion: "independent-frequency-prerequisites-v1",
        targetItems: { kanji: 2_300, word: 8_000 },
        existingItems: { kanji: 2, word: 4 },
        candidateSlots: { kanji: 2_298, word: 7_996 },
        candidatePool: { kanji: 5_000, word: 40_000 },
        poolTruncated: { kanji: true, word: true },
        selectedItems: { kanji: 2_298, word: 7_996 },
        unfilledSlots: { kanji: 0, word: 0 },
        excludedWordsMissingKanji: 120,
        bands: [
          { band: "foundation", kanjiItems: 80, wordItems: 200 },
          { band: "n5", kanjiItems: 120, wordItems: 1_500 },
          { band: "n4", kanjiItems: 300, wordItems: 2_000 },
          { band: "n3", kanjiItems: 700, wordItems: 2_500 },
          { band: "n2", kanjiItems: 1_098, wordItems: 1_796 },
        ],
      },
      page: {
        itemType,
        offset: 0,
        limit: 20,
        total: candidateApproved ? 0 : itemType === "kanji" ? 2_298 : 7_996,
        hasMore: !candidateApproved,
      },
      candidates: [
        {
          selectionRank: 1,
          targetId,
          itemType,
          japanese: itemType === "kanji" ? "一" : "水",
          reading: itemType === "kanji" ? "いち" : "みず",
          score: 100,
          sourcePriority: 1,
          sourceName: itemType === "kanji" ? "KANJIDIC2" : "JMdict",
          suggestedBand: "n5",
          prerequisiteKanji: itemType === "kanji" ? [] : ["水"],
          coverage: {
            russianMeaning: itemType === "word",
            englishMeaning: true,
            reading: true,
            strokeData: itemType === "kanji" ? true : null,
          },
        } satisfies AdminCurriculumCandidatePlanResponse["candidates"][number],
      ].filter(() => !candidateApproved),
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

  await page.route(`${API_BASE_URL}/admin/imported-candidates`, async (route) => {
    const response: AdminImportedCandidateListResponse = {
      candidates: importedCandidates,
    };

    await route.fulfill({ json: response });
  });

  await page.route(
    `${API_BASE_URL}/admin/imported-candidates/kanji/plan-kanji-one`,
    async (route) => {
      const response: AdminImportedCandidateDetailsDto = {
        targetId: "plan-kanji-one",
        itemType: "kanji",
        japanese: "一",
        reading: "イチ",
        readings: [
          { text: "イチ", type: "on" },
          { text: "ひと.つ", type: "kun" },
        ],
        meanings: { ru: [], en: ["one"] },
        jlptLevel: "N5",
        sourcePriority: 1,
        schoolGrade: 1,
        strokeCount: 1,
        hasStrokeData: true,
        source: {
          name: "KANJIDIC2",
          sourceRecordId: "4e00",
          sourceUrl: "https://www.edrdg.org/wiki/index.php/KANJIDIC_Project",
          licenseName: "EDRDG License",
          attributionText: "KANJIDIC2 data from the Electronic Dictionary Research Group.",
          importRunId: "import-run-kanjidic2",
          sourceVersion: "2026-07",
          sourceFileName: "kanjidic2.xml.gz",
          checksumSha256: "sha256-kanjidic2",
        },
      };

      await route.fulfill({ json: response });
    },
  );

  await page.route(
    `${API_BASE_URL}/admin/imported-candidates/approve-translation`,
    async (route) => {
      const body = route.request().postDataJSON() as AdminApproveImportedTranslationRequest;
      const meaningCardId = "card-imported-word-meaning";

      item = {
        ...item,
        id: "item-imported-word",
        itemType: body.targetType,
        band: body.band,
        title: body.title,
        japanese: "水",
        reading: "みず",
        level: body.level ?? null,
        jlptLevel: null,
        meanings: body.meanings,
        cards: [
          {
            id: meaningCardId,
            promptType: "meaning",
            answerType: "meaning",
            locale: "ru-RU",
            sortOrder: 1,
            updatedAt: "2026-06-22T09:40:00.000Z",
            acceptedAnswers: [
              ...body.acceptedAnswers.ru.map((text, index) => ({
                id: `answer-ru-${index}`,
                cardId: meaningCardId,
                locale: "ru-RU" as const,
                text,
                normalizedText: text,
                answerKind: "meaning" as const,
                isPrimary: index === 0,
              })),
              ...body.acceptedAnswers.en.map((text, index) => ({
                id: `answer-en-${index}`,
                cardId: meaningCardId,
                locale: "en-US" as const,
                text,
                normalizedText: text,
                answerKind: "meaning" as const,
                isPrimary: index === 0,
              })),
            ],
            blockedAnswers: [],
          },
        ],
        updatedAt: "2026-06-22T09:40:00.000Z",
      };
      approvedPlanTargets.add(`${body.targetType}:${body.targetId}`);
      importedCandidates = [];

      await route.fulfill({ json: item });
    },
  );

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
