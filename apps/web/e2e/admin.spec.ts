import { expect, type Page, test } from "@playwright/test";

import {
  type AdminApproveImportedTranslationRequest,
  type AdminCoursePlacementListResponse,
  type AdminCurriculumCandidatePlanResponse,
  type AdminCurriculumCompletenessReportDto,
  type AdminCurriculumScaleReadinessDto,
  type AdminCurationItemDto,
  type AdminEnqueueCandidatePlanRequest,
  type AdminEnqueueCandidatePlanResponse,
  type AdminImportRunListResponse,
  type AdminImportedCandidateDetailsDto,
  type AdminImportedCandidateListResponse,
  type AdminImportedCandidateRejectionListResponse,
  type AdminPrerequisiteCandidateListResponse,
  type AdminRejectImportedCandidateRequest,
  type AdminReviewQueueResponse,
  type AdminUpdateItemRequest,
  type AdminUpdateCoursePlacementsRequest,
  type AdminUpdatePrerequisitesRequest,
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

  test("admin replaces inferred prerequisite links", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const editor = page.getByTestId("admin-prerequisite-editor");
    const componentOne = editor.getByRole("checkbox", { name: "Связать Компонент один" });
    const componentLine = editor.getByRole("checkbox", { name: "Связать Компонент линия" });

    await expect(componentOne).toBeChecked();
    await expect(componentLine).not.toBeChecked();
    await componentOne.uncheck();
    await componentLine.check();
    await editor.getByRole("spinbutton", { name: "Порог SRS для Компонент линия" }).fill("2");
    await editor.getByRole("button", { name: "Сохранить связи" }).click();

    await expect(page.getByText("Предварительные связи сохранены.")).toBeVisible();
    await expect(
      editor.getByRole("checkbox", { name: "Связать Компонент один" }),
    ).not.toBeChecked();
    await expect(editor.getByRole("checkbox", { name: "Связать Компонент линия" })).toBeChecked();
    await expect(
      editor.getByRole("spinbutton", { name: "Порог SRS для Компонент линия" }),
    ).toHaveValue("2");
  });

  test("admin places a published item in one level per course", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page, { publishedItem: true });

    await page.goto("/admin");
    await page
      .getByRole("region", { name: "Фильтры учебной программы" })
      .getByLabel("Статус")
      .selectOption("published");

    const editor = page.getByTestId("admin-course-placement");
    const level = editor.getByRole("combobox", { name: "Уровень курса Основной курс" });

    await expect(level).toHaveValue("course-level-1");
    await level.selectOption("course-level-2");
    await editor.getByRole("button", { name: "Сохранить размещение" }).click();

    await expect(page.getByText("Размещение в курсе сохранено.")).toBeVisible();
    await expect(level).toHaveValue("course-level-2");
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
    await expect(page.getByTestId("translation-accepted-readings")).toHaveValue("みず");
    await page.getByTestId("translation-accepted-ru").fill("вода\nводы");
    await page.getByRole("button", { name: "Подтвердить перевод" }).click();

    await expect(
      page.getByText("Перевод подтверждён и добавлен в кураторскую очередь."),
    ).toBeVisible();
    await expect(review).toContainText("Кандидатов с русским и английским переводом пока нет.");
  });

  test("admin can reject and restore an imported candidate", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const review = page.getByTestId("admin-translation-review");
    const decisions = page.getByTestId("admin-candidate-decisions");
    await decisions.getByRole("button", { name: "Отклонить кандидата" }).click();

    const dialog = page.getByRole("dialog", { name: "Отклонить кандидата?" });
    await expect(dialog).toContainText("水 · みず");
    await expect(dialog.getByRole("button", { name: "Отмена" })).toBeFocused();
    await dialog.getByLabel("Причина").selectOption("data-quality");
    await dialog.getByLabel(/Заметка/).fill("Проверить русский перевод.");
    await dialog.getByRole("button", { name: "Отклонить", exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(review).toContainText("Кандидатов с русским и английским переводом пока нет.");
    await expect(decisions).toContainText("Проблема исходных данных");
    await expect(decisions).toContainText("Проверить русский перевод.");
    await expect(decisions).toContainText("水");

    await decisions.getByRole("button", { name: "Восстановить" }).click();

    await expect(decisions).toContainText("Отклонённых кандидатов нет.");
    await expect(review).toContainText("Импорт RU");
    await expect(review).toContainText("вода");
  });

  test("admin pages through the review queue without duplicate items", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const queue = page.locator(".admin-queue");
    const pagination = page.getByTestId("admin-review-queue-pagination");

    await expect(queue).toContainText("Кандзи 一");
    await pagination.getByRole("button", { name: "Далее" }).click();
    await expect(queue).toContainText("Кандзи 二");
    await expect(queue).not.toContainText("Кандзи 一");
    await expect(pagination).toContainText("Страница 2");

    await pagination.getByRole("button", { name: "Назад" }).click();
    await expect(queue).toContainText("Кандзи 一");
    await expect(pagination).toContainText("Страница 1");
  });

  test("admin advances after publishing the current review item", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const queue = page.locator(".admin-queue");
    const itemHeader = page.locator(".admin-item-header");
    const pagination = page.getByTestId("admin-review-queue-pagination");

    await expect(itemHeader).toContainText("Кандзи 一");
    await page.getByRole("button", { name: "Опубликовать" }).click();

    await expect(page.getByText("Материал сохранён. Открыт следующий материал.")).toBeVisible();
    await expect(queue).toContainText("Кандзи 二");
    await expect(queue).not.toContainText("Кандзи 一");
    await expect(itemHeader).toContainText("Кандзи 二");
    await expect(pagination).toContainText("Страница 1");
    await expect(pagination.getByRole("button", { name: "Назад" })).toBeDisabled();
  });

  test("admin distinguishes a failed queue refresh from a successful save", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page, { failQueueRefreshAfterItemSave: true });

    await page.goto("/admin");
    await page.getByRole("button", { name: "Опубликовать" }).click();

    await expect(page.getByText("Материал сохранён.", { exact: true })).toBeVisible();
    await expect(page.getByText(/Изменения сохранены, но очередь не обновилась/u)).toBeVisible();
    await expect(page.locator(".admin-item-header")).toContainText("опубликовано");
  });

  test("admin searches the full candidate plan across item types", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const candidatePlan = page.getByTestId("admin-candidate-plan");
    const search = candidatePlan.getByLabel("Поиск в плане");
    await search.fill("水");
    await candidatePlan.getByRole("button", { name: "Применить" }).click();
    await expect(candidatePlan).toContainText("По запросу «水» кандидаты не найдены.");

    await candidatePlan.getByRole("button", { name: "Слова" }).click();
    await expect(search).toHaveValue("水");
    await expect(candidatePlan.getByRole("button", { name: "Проверить 水" })).toBeVisible();

    await candidatePlan.getByRole("button", { name: "Сбросить" }).click();
    await expect(search).toHaveValue("");
    await expect(candidatePlan).toContainText(/1–1 из 7.?996/u);
  });

  test("admin filters the full candidate plan by band and data coverage", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page);

    await page.goto("/admin");

    const candidatePlan = page.getByTestId("admin-candidate-plan");
    const band = candidatePlan.getByLabel("Диапазон курса");
    const coverage = candidatePlan.getByLabel("Покрытие данных");
    await band.selectOption("n5");
    await coverage.selectOption("missing-russian");
    await candidatePlan.getByRole("button", { name: "Применить" }).click();
    await expect(candidatePlan.getByRole("button", { name: "Проверить 一" })).toBeVisible();

    await candidatePlan.getByRole("button", { name: "Слова" }).click();
    await expect(band).toHaveValue("n5");
    await expect(coverage).toHaveValue("missing-russian");
    await expect(candidatePlan).toContainText("По выбранным фильтрам кандидаты не найдены.");

    await coverage.selectOption("bilingual");
    await candidatePlan.getByRole("button", { name: "Применить" }).click();
    await expect(candidatePlan.getByRole("button", { name: "Проверить 水" })).toBeVisible();

    await candidatePlan.getByRole("button", { name: "Сбросить" }).click();
    await expect(band).toHaveValue("");
    await expect(coverage).toHaveValue("");
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
    await expect(page.getByTestId("admin-translation-provenance")).toContainText("кун: ひと.つ");
    await expect(page.getByTestId("translation-accepted-readings")).toHaveValue("イチ");
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

  test("admin confirms and retries staging the current candidate page", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page, { enqueueConflictOnce: true });

    await page.goto("/admin");

    const candidatePlan = page.getByTestId("admin-candidate-plan");
    const enqueuePage = page.getByTestId("admin-plan-enqueue-page");

    await enqueuePage.click();
    const confirmation = page.getByRole("dialog", { name: "Добавить выбранное в очередь?" });
    await expect(confirmation).toContainText("Выбрано кандидатов: 1");
    await expect(confirmation).toContainText("карточки и переводы автоматически не создаются");
    const cancelEnqueue = confirmation.getByRole("button", { name: "Отмена" });
    await expect(cancelEnqueue).toBeFocused();
    await cancelEnqueue.click();
    await expect(confirmation).toHaveCount(0);

    await enqueuePage.click();
    await confirmation.getByRole("button", { name: "Добавить в очередь", exact: true }).click();
    await expect(page.getByTestId("admin-plan-enqueue-error")).toContainText("План изменился");
    await expect(candidatePlan).toContainText("一");

    await enqueuePage.click();
    await confirmation.getByRole("button", { name: "Добавить в очередь", exact: true }).click();
    await expect(page.getByTestId("admin-plan-enqueue-success")).toHaveText(
      "Добавлено в очередь: 1. Уже находились в очереди: 0.",
    );
    await expect(candidatePlan).toContainText("На этой странице кандидатов нет.");
    await expect(enqueuePage).toHaveCount(0);
  });

  test("admin stages only selected candidates from the current plan page", async ({ page }) => {
    await signIn(page, "ADMIN");
    await mockAdminApi(page, { multiplePlanCandidates: true });

    await page.goto("/admin");

    const candidatePlan = page.getByTestId("admin-candidate-plan");
    const firstCandidate = candidatePlan.getByRole("checkbox", { name: "Выбрать 一" });
    const secondCandidate = candidatePlan.getByRole("checkbox", { name: "Выбрать 二" });
    const selectPage = candidatePlan.getByRole("checkbox", { name: "Выбрать всю страницу" });

    await expect(firstCandidate).toBeChecked();
    await expect(secondCandidate).toBeChecked();
    await expect(selectPage).toBeChecked();

    await selectPage.uncheck();
    await expect(firstCandidate).not.toBeChecked();
    await expect(secondCandidate).not.toBeChecked();
    await expect(candidatePlan.getByTestId("admin-plan-enqueue-page")).toBeDisabled();

    await selectPage.check();
    await expect(firstCandidate).toBeChecked();
    await expect(secondCandidate).toBeChecked();

    await secondCandidate.uncheck();
    await expect(selectPage).not.toBeChecked();
    await expect(candidatePlan).toContainText("Выбрано 1 из 2");

    await candidatePlan.getByTestId("admin-plan-enqueue-page").click();
    const confirmation = page.getByRole("dialog", { name: "Добавить выбранное в очередь?" });
    await expect(confirmation).toContainText("Выбрано кандидатов: 1");
    await confirmation.getByRole("button", { name: "Добавить в очередь", exact: true }).click();

    await expect(page.getByTestId("admin-plan-enqueue-success")).toContainText(
      "Добавлено в очередь: 1",
    );
    await expect(firstCandidate).toHaveCount(0);
    await expect(candidatePlan.getByRole("checkbox", { name: "Выбрать 二" })).toBeChecked();
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

async function mockAdminApi(
  page: Page,
  options: {
    readonly enqueueConflictOnce?: boolean;
    readonly failQueueRefreshAfterItemSave?: boolean;
    readonly multiplePlanCandidates?: boolean;
    readonly publishedItem?: boolean;
  } = {},
): Promise<void> {
  let item: AdminCurationItemDto = {
    ...buildAdminItem(),
    ...(options.publishedItem === true ? { status: "published" } : {}),
  };
  let itemWasSaved = false;
  let coursePlacementLevelId = "course-level-1";
  const secondItem = buildSecondAdminItem();
  const assignedPlanTargets = new Set<string>();
  let remainingEnqueueConflicts = options.enqueueConflictOnce === true ? 1 : 0;
  const importedCandidate: AdminImportedCandidateListResponse["candidates"][number] = {
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
  };
  let importedCandidates: AdminImportedCandidateListResponse["candidates"] = [importedCandidate];
  let candidateRejections: AdminImportedCandidateRejectionListResponse["rejections"] = [];

  await page.route(`${API_BASE_URL}/admin/items/review-queue**`, async (route) => {
    if (options.failQueueRefreshAfterItemSave === true && itemWasSaved) {
      await route.fulfill({ status: 503, json: { message: "Review queue unavailable." } });
      return;
    }

    const url = new URL(route.request().url());
    const cursor = url.searchParams.get("cursor");
    const requestedStatus = url.searchParams.get("status") ?? "needs-review";
    const matchingItems = [item, secondItem].filter(
      (queueItem) => queueItem.status === requestedStatus,
    );
    const queueItem = matchingItems[cursor === null ? 0 : 1];
    const response: AdminReviewQueueResponse = {
      items:
        queueItem === undefined
          ? []
          : [
              {
                id: queueItem.id,
                itemType: queueItem.itemType,
                band: queueItem.band,
                title: queueItem.title,
                japanese: queueItem.japanese,
                reading: queueItem.reading,
                level: queueItem.level,
                jlptLevel: queueItem.jlptLevel,
                status: queueItem.status,
                updatedAt: queueItem.updatedAt,
                sourceNames: queueItem.attributions.map((source) => source.sourceName),
                qualityIssues: queueItem.qualityIssues,
              },
            ],
      pagination: {
        limit: Number(url.searchParams.get("limit") ?? 20),
        nextCursor: cursor === null && matchingItems.length > 1 ? "review-page-two" : null,
      },
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

    if (route.request().method() === "POST" && url.pathname.endsWith("/enqueue")) {
      if (remainingEnqueueConflicts > 0) {
        remainingEnqueueConflicts -= 1;
        await route.fulfill({ status: 409, json: { message: "Candidate plan data changed." } });
        return;
      }

      const body = route.request().postDataJSON() as AdminEnqueueCandidatePlanRequest;
      let enqueuedCount = 0;
      let alreadyQueuedCount = 0;

      for (const candidate of body.candidates) {
        const targetKey = `${candidate.itemType}:${candidate.targetId}`;

        if (assignedPlanTargets.has(targetKey)) {
          alreadyQueuedCount += 1;
        } else {
          assignedPlanTargets.add(targetKey);
          enqueuedCount += 1;
        }
      }

      const response: AdminEnqueueCandidatePlanResponse = {
        planVersion: body.planVersion,
        requestedCount: body.candidates.length,
        enqueuedCount,
        alreadyQueuedCount,
        items: body.candidates.map((candidate) => ({
          learningItemId: `item-${candidate.targetId}`,
          targetId: candidate.targetId,
          itemType: candidate.itemType,
          status: "needs-review",
        })),
      };

      await route.fulfill({ json: response });
      return;
    }

    const itemType = url.searchParams.get("itemType") === "word" ? "word" : "kanji";
    const search = url.searchParams.get("search")?.trim() || null;
    const band =
      (url.searchParams.get("band") as AdminCurriculumCandidatePlanResponse["page"]["band"]) ??
      null;
    const coverage =
      (url.searchParams.get(
        "coverage",
      ) as AdminCurriculumCandidatePlanResponse["page"]["coverage"]) ?? null;

    if (itemType === "word" && url.searchParams.get("planVersion") !== "plan-version-one") {
      await route.fulfill({ status: 409, json: { message: "Candidate plan data changed." } });
      return;
    }

    const candidate: AdminCurriculumCandidatePlanResponse["candidates"][number] = {
      selectionRank: 1,
      targetId: itemType === "kanji" ? "plan-kanji-one" : "plan-word-water",
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
    };
    const candidates = [
      candidate,
      ...(itemType === "kanji" && options.multiplePlanCandidates === true
        ? [
            {
              ...candidate,
              selectionRank: 2,
              targetId: "plan-kanji-two",
              japanese: "二",
              reading: "に",
              score: 99,
            },
          ]
        : []),
    ];
    const candidateFiltersActive = search !== null || band !== null || coverage !== null;
    const visibleCandidates = candidates.filter(
      (currentCandidate) =>
        !assignedPlanTargets.has(`${currentCandidate.itemType}:${currentCandidate.targetId}`) &&
        (search === null ||
          currentCandidate.japanese.includes(search) ||
          currentCandidate.reading?.includes(search) === true ||
          currentCandidate.targetId === search) &&
        (band === null || currentCandidate.suggestedBand === band) &&
        matchesCandidatePlanCoverage(currentCandidate, coverage),
    );
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
        search,
        band,
        coverage,
        offset: 0,
        limit: 20,
        total:
          visibleCandidates.length > 0
            ? candidateFiltersActive
              ? visibleCandidates.length
              : itemType === "kanji"
                ? 2_298
                : 7_996
            : 0,
        hasMore: !candidateFiltersActive && visibleCandidates.length > 0,
      },
      candidates: visibleCandidates,
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

  await page.route(`${API_BASE_URL}/admin/imported-candidates/rejections`, async (route) => {
    const response: AdminImportedCandidateRejectionListResponse = {
      rejections: candidateRejections,
    };

    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/admin/imported-candidates/**/rejection`, async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.split("/");
    const targetType = path.at(-3) === "kanji" ? "kanji" : "word";
    const targetId = path.at(-2) ?? "";

    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as AdminRejectImportedCandidateRequest;
      const now = "2026-07-14T08:00:00.000Z";
      const source = importedCandidates.find(
        (candidate) => candidate.itemType === targetType && candidate.targetId === targetId,
      );

      candidateRejections = [
        {
          id: `rejection-${targetId}`,
          targetType,
          targetId,
          japanese: source?.japanese ?? null,
          reading: source?.reading ?? null,
          reason: body.reason,
          note: body.note ?? null,
          rejectedByUserId: "admin-1",
          createdAt: now,
          updatedAt: now,
        },
      ];
      importedCandidates = importedCandidates.filter(
        (candidate) => candidate.itemType !== targetType || candidate.targetId !== targetId,
      );

      const saved = candidateRejections[0]!;
      await route.fulfill({
        json: {
          id: saved.id,
          targetType: saved.targetType,
          targetId: saved.targetId,
          reason: saved.reason,
          note: saved.note,
          rejectedByUserId: saved.rejectedByUserId,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        },
      });
      return;
    }

    candidateRejections = candidateRejections.filter(
      (rejection) => rejection.targetType !== targetType || rejection.targetId !== targetId,
    );

    if (
      !importedCandidates.some((candidate) => candidate.targetId === importedCandidate.targetId)
    ) {
      importedCandidates = [importedCandidate, ...importedCandidates];
    }

    await route.fulfill({ json: { targetType, targetId, restored: true } });
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
      const readingCardId = "card-imported-word-reading";

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
          {
            id: readingCardId,
            promptType: "reading",
            answerType: "reading",
            locale: "ru-RU",
            sortOrder: 2,
            updatedAt: "2026-06-22T09:40:00.000Z",
            acceptedAnswers: body.acceptedReadings.map((text, index) => ({
              id: `answer-reading-${index}`,
              cardId: readingCardId,
              locale: "ru-RU" as const,
              text,
              normalizedText: text,
              answerKind: "reading" as const,
              isPrimary: index === 0,
            })),
            blockedAnswers: [],
          },
        ],
        updatedAt: "2026-06-22T09:40:00.000Z",
      };
      assignedPlanTargets.add(`${body.targetType}:${body.targetId}`);
      importedCandidates = [];

      await route.fulfill({ json: item });
    },
  );

  await page.route(`${API_BASE_URL}/admin/items/*/prerequisite-candidates`, async (route) => {
    const path = new URL(route.request().url()).pathname.split("/");
    const itemId = decodeURIComponent(path.at(-2) ?? "");
    const activeItem = itemId === item.id ? item : itemId === secondItem.id ? secondItem : null;

    if (activeItem === null) {
      await route.fulfill({ status: 404, json: { message: "Learning item not found." } });
      return;
    }

    const candidates: AdminPrerequisiteCandidateListResponse["candidates"] =
      activeItem.id === ITEM_ID
        ? [
            {
              prerequisiteItemId: "item-component-one",
              prerequisiteTitle: "Компонент один",
              prerequisiteItemType: "component",
              prerequisiteStatus: "published",
              selected: activeItem.dependencies.some(
                (dependency) => dependency.prerequisiteItemId === "item-component-one",
              ),
              requiredStage:
                activeItem.dependencies.find(
                  (dependency) => dependency.prerequisiteItemId === "item-component-one",
                )?.requiredStage ?? null,
              suggestionReason: "component",
            },
            {
              prerequisiteItemId: "item-component-line",
              prerequisiteTitle: "Компонент линия",
              prerequisiteItemType: "component",
              prerequisiteStatus: "published",
              selected: activeItem.dependencies.some(
                (dependency) => dependency.prerequisiteItemId === "item-component-line",
              ),
              requiredStage:
                activeItem.dependencies.find(
                  (dependency) => dependency.prerequisiteItemId === "item-component-line",
                )?.requiredStage ?? null,
              suggestionReason: "component",
            },
          ]
        : [];

    await route.fulfill({ json: { itemId, candidates } });
  });

  await page.route(`${API_BASE_URL}/admin/items/*/prerequisites`, async (route) => {
    const path = new URL(route.request().url()).pathname.split("/");
    const itemId = decodeURIComponent(path.at(-2) ?? "");

    if (itemId !== item.id || route.request().method() !== "PUT") {
      await route.fulfill({ status: 404, json: { message: "Learning item not found." } });
      return;
    }

    const body = route.request().postDataJSON() as AdminUpdatePrerequisitesRequest;
    const prerequisiteTitles = new Map([
      ["item-component-one", "Компонент один"],
      ["item-component-line", "Компонент линия"],
    ]);
    item = {
      ...item,
      dependencies: body.prerequisites.map((prerequisite, index) => ({
        id: `dependency-${index}`,
        prerequisiteItemId: prerequisite.prerequisiteItemId,
        prerequisiteTitle:
          prerequisiteTitles.get(prerequisite.prerequisiteItemId) ?? "Неизвестный prerequisite",
        prerequisiteStatus: "published",
        dependencyType: "prerequisite",
        requiredStage: prerequisite.requiredStage ?? null,
      })),
      updatedAt: "2026-07-15T08:00:00.000Z",
    };

    await route.fulfill({ json: item });
  });

  await page.route(`${API_BASE_URL}/admin/items/*/course-placements`, async (route) => {
    const path = new URL(route.request().url()).pathname.split("/");
    const itemId = decodeURIComponent(path.at(-2) ?? "");

    if (itemId !== item.id) {
      await route.fulfill({ status: 404, json: { message: "Learning item not found." } });
      return;
    }

    if (route.request().method() === "PUT") {
      const body = route.request().postDataJSON() as AdminUpdateCoursePlacementsRequest;
      coursePlacementLevelId = body.courseLevelIds[0] ?? "";
    }

    const response: AdminCoursePlacementListResponse = {
      itemId,
      levels: [
        {
          courseId: "course-main",
          courseTitle: "Основной курс",
          courseStatus: "published",
          courseType: "structured",
          courseLevelId: "course-level-1",
          levelNumber: 1,
          levelTitle: "Основа",
          band: "foundation",
          selected: coursePlacementLevelId === "course-level-1",
          sortOrder: coursePlacementLevelId === "course-level-1" ? 5 : null,
        },
        {
          courseId: "course-main",
          courseTitle: "Основной курс",
          courseStatus: "published",
          courseType: "structured",
          courseLevelId: "course-level-2",
          levelNumber: 2,
          levelTitle: "Первые кандзи",
          band: "foundation",
          selected: coursePlacementLevelId === "course-level-2",
          sortOrder: coursePlacementLevelId === "course-level-2" ? 8 : null,
        },
      ],
    };

    await route.fulfill({ json: response });
  });

  await page.route(`${API_BASE_URL}/admin/items/${ITEM_ID}`, async (route) => {
    if (route.request().method() === "PATCH") {
      const body = route.request().postDataJSON() as AdminUpdateItemRequest;

      item = {
        ...item,
        ...(body.status === undefined ? {} : { status: body.status }),
        ...(body.band === undefined ? {} : { band: body.band }),
        meanings: {
          ru: body.meanings?.ru ?? item.meanings.ru,
          en: body.meanings?.en ?? item.meanings.en,
        },
        updatedAt: "2026-06-22T09:45:00.000Z",
      };
      itemWasSaved = true;
    }

    await route.fulfill({ json: item });
  });

  await page.route(`${API_BASE_URL}/admin/items/${secondItem.id}`, async (route) => {
    await route.fulfill({ json: secondItem });
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

function matchesCandidatePlanCoverage(
  candidate: AdminCurriculumCandidatePlanResponse["candidates"][number],
  coverage: AdminCurriculumCandidatePlanResponse["page"]["coverage"],
): boolean {
  switch (coverage) {
    case null:
      return true;
    case "bilingual":
      return candidate.coverage.russianMeaning && candidate.coverage.englishMeaning;
    case "missing-russian":
      return !candidate.coverage.russianMeaning;
    case "missing-english":
      return !candidate.coverage.englishMeaning;
    case "missing-reading":
      return !candidate.coverage.reading;
    case "missing-stroke-data":
      return candidate.coverage.strokeData === false;
  }
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

function buildSecondAdminItem(): AdminCurationItemDto {
  return {
    ...buildAdminItem(),
    id: "item-kanji-two",
    title: "Кандзи 二",
    japanese: "二",
    reading: "に",
    updatedAt: "2026-06-22T07:00:00.000Z",
    cards: [],
  };
}
