import { expect, test, type Page } from "@playwright/test";
import {
  buildCourseCoverage,
  type CourseProgressCardDto,
  type CourseMaterialDto,
} from "@kanji-srs/shared";
import { captureLearnerThemes } from "./support/capture-learner-themes";
import { changeAccount } from "./support/change-account";

const API = "http://localhost:3001";
const ID = "00000000-0000-4000-8000-000000000010";
const outline = {
  id: ID,
  title: "Основа японского: компоненты, кандзи и повседневная лексика",
  description: null,
  levels: [
    { levelNumber: 1, title: "Компоненты", band: "foundation", publishedItemCount: 32 },
    { levelNumber: 2, title: "Кандзи", band: "foundation", publishedItemCount: 2 },
  ],
};
async function signIn(
  page: Page,
  progressCards: readonly CourseProgressCardDto[] = [],
  extras: Partial<CourseMaterialDto> = {},
) {
  await page.route(`${API}/courses/${ID}/levels/*/items*`, (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get("page") ?? 1);
    return route.fulfill({
      json: {
        courseId: ID,
        levelNumber: 1,
        page: pageNumber,
        pageSize: 30,
        total: 32,
        summary: {
          total: 32,
          newCount: 30,
          learningCount: 1,
          burnedCount: 1,
          dueItemCount: 1,
          byKind: { component: 0, kanji: 32, word: 0, sentence: 0 },
        },
        items:
          pageNumber > 2
            ? []
            : [
                {
                  id: `material-${pageNumber}`,
                  itemType: "kanji",
                  japanese: pageNumber === 1 ? "一" : "二",
                  title: "Число",
                  reading: "いち",
                  meaningRu: "один",
                  meaningEn: "one",
                  studyState: "not-started",
                  cardCount: 2,
                  startedCardCount: 0,
                  burnedCardCount: 0,
                  dueCardCount: 0,
                  scheduledCardCount: 0,
                  nextReviewAt: null,
                  progressCards,
                  ...extras,
                },
              ],
      },
    });
  });
  await page.addInitScript(() => {
    localStorage.setItem("kanji-srs.translationDisplayMode", "ru-en");
    localStorage.setItem("kanji-srs.accessToken", "explorer-token");
    localStorage.setItem(
      "kanji-srs.user",
      JSON.stringify({
        id: "explorer-user",
        email: "explorer@example.test",
        displayName: "Тест",
        role: "USER",
        settings: { translationDisplayMode: "ru-en", timezone: "Europe/Moscow" },
      }),
    );
  });
}
test.describe("published course explorer", () => {
  test("reconciles a lost global mode response with one GET and no write replay", async ({
    page,
  }, info) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    let writes = 0;
    let reads = 0;
    await page.route(`${API}/users/settings`, async (route) => {
      writes++;
      await route.abort("failed");
    });
    await page.route(`${API}/auth/me`, (route) => {
      reads++;
      return route.fulfill({
        json: {
          id: "explorer-user",
          email: "explorer@example.test",
          role: "USER",
          settings: { translationDisplayMode: "en", timezone: "Europe/Moscow" },
        },
      });
    });
    await page.goto(`/courses/${ID}`);
    const select = page.getByRole("combobox", { name: "Режим перевода карточек", exact: true });
    await select.focus();
    await select.selectOption("en");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Сохранение режима не подтверждено",
    );
    await expect(select).toBeDisabled();
    const retry = page.getByRole("button", { name: "Сверить режим", exact: true });
    await expect(retry).toBeFocused();
    await captureLearnerThemes(page, info, "journey-mode-recovery");
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    expect(writes).toBe(1);
    expect(reads).toBe(0);
    await retry.press("Enter");
    await expect(select).toBeEnabled();
    await expect(select).toHaveValue("en");
    await expect(select).toBeFocused();
    expect(reads).toBe(1);
    expect(writes).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
  for (const status of [200, 401]) {
    test(`ignores replaced-owner global mode response (${status}) and same-turn duplicates`, async ({
      page,
    }) => {
      await signIn(page);
      await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
      let release!: () => void;
      let seen!: () => void;
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      const started = new Promise<void>((resolve) => {
        seen = resolve;
      });
      let writes = 0;
      await page.route(`${API}/users/settings`, async (route) => {
        writes++;
        seen();
        await gate;
        await route.fulfill({
          status,
          json: { id: "explorer-user", settings: { translationDisplayMode: "en" } },
        });
      });
      await page.goto(`/courses/${ID}`);
      await page.getByRole("combobox", { name: "Режим перевода карточек", exact: true }).waitFor();
      await page.evaluate(() => {
        const select = document.querySelector<HTMLSelectElement>(".mode-control select")!;
        for (const value of ["en", "ru"]) {
          select.value = value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
      });
      await started;
      await changeAccount(page);
      const finished = page.waitForResponse(
        (response) => response.url() === `${API}/users/settings` && response.status() === status,
      );
      release();
      await finished;
      await expect(
        page.getByRole("heading", { name: "Материалы уровня 1", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("combobox", { name: "Режим перевода карточек", exact: true }),
      ).toBeEnabled();
      expect(writes).toBe(1);
      expect(
        await page.evaluate(() => JSON.parse(localStorage.getItem("kanji-srs.user")!).id),
      ).toBe("new-owner");
      await expect(page.getByRole("button", { name: "Сверить режим", exact: true })).toHaveCount(0);
    });
  }
  test("syncs cross-tab reading preferences without extra material reads", async ({
    page,
  }, info) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    let reads = 0;
    page.on("request", (request) => {
      if (request.url().includes("/levels/")) reads++;
    });
    await page.goto(`/courses/${ID}`);
    const materials = page.locator(".course-material-grid");
    await expect(materials.locator("rt")).toHaveCount(0);
    await expect(materials.locator(".course-material-reading")).toContainText("いち");
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
      Object.assign(user.settings, {
        lessonPronunciationMode: "furigana",
        lessonRomaji: true,
        translationDisplayMode: "en",
      });
      localStorage.setItem("kanji-srs.user", JSON.stringify(user));
      localStorage.setItem("kanji-srs.translationDisplayMode", "en");
      window.dispatchEvent(new StorageEvent("storage", { key: "kanji-srs.user" }));
    });
    await expect(materials.locator("rt")).toHaveText("いち");
    await expect(materials.locator(".course-material-romaji")).toHaveText("ichi");
    await expect(materials.locator('[lang="ru"]')).toHaveCount(0);
    expect(reads).toBe(1);
    await page.getByRole("button", { name: "Список материалов", exact: true }).click();
    const romaji = await materials.locator(".course-material-romaji").boundingBox();
    const kind = await materials.locator(".course-material-kind").boundingBox();
    expect(romaji!.y + romaji!.height).toBeLessThanOrEqual(kind!.y + 1);
    await captureLearnerThemes(page, info, "journey-reading-list");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
  test("loads aggregate coverage on demand and groups it without more reads or writes", async ({
    page,
  }, info) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    const report = buildCourseCoverage(
      ID,
      [
        {
          id: "kanji",
          kind: "kanji",
          level: 2,
          band: "foundation",
          jlpt: "N5",
          cardIds: ["m", "r"],
          cardAnswerTypes: ["meaning", "reading"],
          hasRu: true,
          hasEn: true,
          hasReading: true,
        },
        {
          id: "component",
          kind: "component",
          level: 1,
          band: "foundation",
          jlpt: null,
          cardIds: ["c"],
          hasRu: true,
          hasEn: false,
          hasReading: false,
        },
      ],
      "2026-10-28T00:00:00Z",
    );
    let reads = 0;
    let writes = 0;
    page.on("request", (request) => {
      if (request.url().startsWith(API) && request.method() !== "GET") writes++;
    });
    await page.route(`${API}/courses/${ID}/coverage`, (route) => {
      reads++;
      return route.fulfill({ json: report });
    });
    await page.goto(`/courses/${ID}`);
    await expect(
      page.getByRole("heading", { name: "Материалы уровня 1", exact: true }),
    ).toBeVisible();
    expect(reads).toBe(0);
    await page.getByRole("button", { name: "Наполнение курса", exact: true }).click();
    const table = page.getByRole("table", {
      name: "Наполнение и пробелы учебных ответов",
      exact: true,
    });
    await expect(table).toContainText("Уровень 2");
    const scope = page.getByLabel("Учебные аспекты и метаданные", { exact: true });
    await expect(scope).toContainText("1 / 1");
    await expect(scope).toContainText("Не подтверждено");
    await expect(page.getByRole("link", { name: "Требования JLPT", exact: true })).toHaveAttribute(
      "href",
      "https://www.jlpt.jp/e/about/levelsummary.html",
    );
    await page
      .getByRole("combobox", { name: "Группировка наполнения", exact: true })
      .selectOption("jlpt");
    await expect(table).toContainText("N5");
    await expect(table).toContainText("Без JLPT");
    await page
      .getByRole("combobox", { name: "Группировка наполнения", exact: true })
      .selectOption("bands");
    await expect(table).toContainText("Основы");
    expect(reads).toBe(1);
    expect(writes).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await captureLearnerThemes(page, info, "course-path-coverage");
    await page.screenshot({
      path: info.outputPath("course-path-coverage-viewport.png"),
      animations: "disabled",
    });
  });
  for (const current of [true, false]) {
    test(`checks the next step without switching course (current: ${current})`, async ({
      page,
    }) => {
      await signIn(page);
      await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
      await page.route(`${API}/courses`, (route) =>
        route.fulfill({ json: { currentCourseId: current ? ID : "other", courses: [] } }),
      );
      let reads = 0;
      let writes = 0;
      page.on("request", (request) => {
        if (request.url().startsWith(API) && request.method() !== "GET") writes++;
      });
      await page.route(`${API}/lessons/queue`, (route) => {
        reads++;
        return route.fulfill({
          json: {
            items: [{ item: { japanese: "日" }, unlockedBy: [{ japanese: "口" }] }],
            availableItems: [],
            source: { kind: "course" },
            remainingToday: 5,
          },
        });
      });
      await page.goto(`/courses/${ID}`);
      await page.getByRole("button", { name: "Проверить следующий шаг", exact: true }).click();
      if (current) {
        await expect(page.getByLabel("Следующий шаг курса")).toContainText("Доступен материал: 日");
        await expect(page.getByRole("link", { name: "К урокам", exact: true })).toHaveAttribute(
          "href",
          `/lessons?${new URLSearchParams({ returnTo: `/courses/${ID}` })}`,
        );
      } else
        await expect(
          page.getByText("Этот курс не выбран текущим.", { exact: false }),
        ).toBeVisible();
      expect(reads).toBe(current ? 1 : 0);
      expect(writes).toBe(0);
    });
  }
  test("retries coverage explicitly after failure without discarding the course", async ({
    page,
  }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    let reads = 0;
    await page.route(`${API}/courses/${ID}/coverage`, (route) =>
      route.fulfill(
        ++reads === 1
          ? { status: 503, json: { message: "Coverage unavailable" } }
          : { json: buildCourseCoverage(ID, [], "2026-10-28T00:00:00Z") },
      ),
    );
    await page.goto(`/courses/${ID}`);
    await page.getByRole("button", { name: "Наполнение курса", exact: true }).click();
    await expect(page.getByText("Coverage unavailable", { exact: true })).toBeVisible();
    expect(reads).toBe(1);
    await expect(page.getByRole("heading", { name: "Материалы курса", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Повторить проверку наполнения", exact: true }).click();
    await expect(page.getByRole("table")).toBeVisible();
    expect(reads).toBe(2);
  });
  test("links the first unmet prerequisite and labels learning versus fallback fields", async ({
    page,
  }) => {
    await signIn(page, [], {
      readingSource: "card",
      meaningEn: null,
      meaningSources: { ru: "card", en: "missing" },
      prerequisites: {
        total: 2,
        unmet: 1,
        firstUnmet: {
          itemId: "support",
          title: "Опорный компонент",
          requiredStage: 4,
          minimumStage: 2,
        },
      },
    });
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}?level=1`);
    await expect(page.getByText("Учебное чтение", { exact: true })).toBeVisible();
    await expect(page.getByText("Нет значения EN", { exact: true })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Сначала: Опорный компонент", exact: true }),
    ).toHaveAttribute("href", `/items/support?level=1&courseId=${ID}`);
    await expect(page.getByText("Требуемая ступень SRS: 4", { exact: true })).toBeVisible();
  });
  test("ignores a late old-owner coverage 401", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    let release!: () => void;
    let started!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const pending = new Promise<void>((resolve) => {
      started = resolve;
    });
    await page.route(`${API}/courses/${ID}/coverage`, async (route) => {
      started();
      await gate;
      await route
        .fulfill({ status: 401, json: { message: "Old coverage expired" } })
        .catch(() => undefined);
    });
    try {
      await page.goto(`/courses/${ID}`);
      await page.getByRole("button", { name: "Наполнение курса", exact: true }).click();
      await pending;
      await changeAccount(page);
      release();
      await expect(
        page.getByRole("heading", { name: "Материалы курса", exact: true }),
      ).toBeVisible();
      await expect(page.getByText("Old coverage expired", { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
        "new-owner-token",
      );
    } finally {
      release();
    }
  });
  test("submits search and sort explicitly and restores them through history", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}?level=1&page=2`);
    await page.locator(".course-material-options > summary").click();
    await page.getByRole("searchbox", { name: "Поиск в уровне" }).fill("  ＯＮＥ  ");
    await page.getByRole("button", { name: "Найти в уровне" }).click();
    await expect(page).toHaveURL(/level=1&q=ONE$/u);
    const request = page.waitForRequest(
      (request) =>
        request.url().includes("/levels/1/items") &&
        new URL(request.url()).searchParams.get("sort") === "review-time",
    );
    await page.getByLabel("Порядок материалов", { exact: true }).selectOption("review-time");
    expect(new URL((await request).url()).searchParams.get("q")).toBe("ONE");
    await expect(page.locator(".course-material-grid a")).toHaveAttribute(
      "href",
      /q=ONE&sort=review-time&courseId=/u,
    );
    await page.reload();
    await expect(page.getByRole("searchbox", { name: "Поиск в уровне" })).toHaveValue("ONE");
    await expect(page.getByLabel("Порядок материалов", { exact: true })).toHaveValue("review-time");
    await page.getByRole("button", { name: "Очистить поиск" }).click();
    await expect(page).not.toHaveURL(/q=/u);
    await page.goBack();
    await expect(page.getByRole("searchbox", { name: "Поиск в уровне" })).toHaveValue("ONE");
  });
  test("inspects meaning and reading cards separately without opening an item", async ({
    page,
  }) => {
    await signIn(page, [
      {
        id: "meaning",
        promptType: "meaning",
        started: true,
        burned: true,
        stageIndex: 9,
        availableAt: null,
      },
      {
        id: "reading",
        promptType: "reading",
        started: true,
        burned: false,
        stageIndex: 2,
        availableAt: "2026-10-25T10:00:00Z",
      },
    ]);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}`);
    await page.getByLabel("Карточки 一", { exact: true }).click();
    const progress = page.locator(".course-card-progress");
    await expect(progress.getByRole("listitem").filter({ hasText: "Значение" })).toContainText(
      "Выучена",
    );
    await expect(progress.getByRole("listitem").filter({ hasText: "Чтение" })).toContainText(
      "Ступень SRS: 2",
    );
    await expect(progress.locator("time")).toHaveAttribute("datetime", "2026-10-25T10:00:00Z");
    await expect(page).toHaveURL(`/courses/${ID}`);
  });
  test("remembers the list only for its owner and keeps bilingual kana visible", async ({
    page,
  }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}`);
    await page.getByRole("button", { name: "Список материалов", exact: true }).click();
    await expect(page.locator(".course-material-grid")).toHaveAttribute("data-view", "list");
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Список материалов", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator(".course-material-grid a")).toContainText("いち");
    await expect(page.locator(".course-material-grid a")).toContainText("one");
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.evaluate(() => {
      const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
      localStorage.setItem("kanji-srs.accessToken", "next-view-owner");
      localStorage.setItem("kanji-srs.user", JSON.stringify({ ...user, id: "next-view-owner" }));
      window.dispatchEvent(new Event("kanji-srs.auth-changed"));
    });
    await expect(
      page.getByRole("button", { name: "Сетка материалов", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  });
  test("recovers an excessive page and resets filters without losing the level", async ({
    page,
  }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}?level=2&page=99&q=one&itemType=kanji`);
    await expect(page.getByText("Такой страницы больше нет.")).toBeVisible();
    await page.getByRole("button", { name: "К первой странице", exact: true }).click();
    await expect(page).toHaveURL(/level=2&itemType=kanji&q=one$/u);
    await expect(page.locator(".course-material-grid a")).toBeVisible();
    await page.getByRole("button", { name: "Сбросить фильтры", exact: true }).click();
    await expect(page).toHaveURL(`/courses/${ID}?level=2`);
    await expect(page.locator(".course-material-options")).not.toHaveAttribute("open");
    await page.goto(`/courses/${ID}?level=60`);
    await page.getByRole("button", { name: "К первому уровню", exact: true }).click();
    await expect(page).toHaveURL(`/courses/${ID}?level=1`);
  });
  for (const status of [200, 401]) {
    test(`cancels stale level data after account replacement (${status})`, async ({ page }) => {
      await signIn(page);
      await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
      let release = () => {};
      let requested = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const seen = new Promise<void>((resolve) => {
        requested = resolve;
      });
      await page.route(`${API}/courses/${ID}/levels/*/items*`, async (route) => {
        const older = route.request().headers().authorization === "Bearer explorer-token";
        if (older) {
          requested();
          await held;
        }
        await route.fulfill({
          status: older ? status : 200,
          json:
            older && status === 401
              ? { message: "Old session" }
              : { courseId: ID, levelNumber: 1, page: 1, pageSize: 30, total: 0, items: [] },
        });
      });
      await page.goto(`/courses/${ID}`);
      await seen;
      const cancelled = page.waitForEvent(
        "requestfailed",
        (request) =>
          request.url().includes("/levels/") &&
          request.headers().authorization === "Bearer explorer-token",
      );
      await page.evaluate(() => {
        const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
        localStorage.setItem("kanji-srs.accessToken", "explorer-next-token");
        localStorage.setItem(
          "kanji-srs.user",
          JSON.stringify({ ...user, id: "explorer-next-user" }),
        );
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(page.getByText("Найдено: 0", { exact: true })).toBeVisible();
      await cancelled;
      release();
      await expect(page.getByText("Найдено: 0", { exact: true })).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
        "explorer-next-token",
      );
    });
  }
  test("pages level materials without enrollment or scheduling writes", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) =>
      route.fulfill({
        json: { ...outline, title: "Пилот основ: 79 компонентов, 101 кандзи и 120 слов" },
      }),
    );
    await page.goto(`/courses/${ID}`);
    const materials = page.getByRole("region", { name: "Материалы уровня", exact: true });
    await expect(materials.getByRole("link")).toContainText("一");
    await expect(materials.getByRole("link")).toContainText("いち");
    await expect(materials.getByRole("link")).toContainText("один");
    await expect(materials.getByRole("link")).toContainText("one");
    await expect(materials.getByRole("link")).toBeInViewport({ ratio: 0.5 });
    if (test.info().project.name === "mobile") {
      const material = (await materials.getByRole("link").boundingBox())!;
      const navigation = (await page.locator(".app-rail").boundingBox())!;
      expect(material.y + material.height).toBeLessThan(navigation.y);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await materials.getByRole("button", { name: "Следующая страница материалов" }).click();
    await expect(materials.getByRole("link")).toContainText("二");
    await expect(materials.getByRole("link")).toHaveAttribute(
      "href",
      new RegExp(`/items/material-2\\?level=1&page=2&courseId=${ID}$`, "u"),
    );
    await page.locator(".course-material-options > summary").click();
    await materials.getByLabel("Тип материала", { exact: true }).selectOption("word");
    await expect(materials.getByText("Страница 1 из 2")).toBeVisible();
    await expect(page).toHaveURL(/itemType=word/u);
    await page.reload();
    await expect(materials.getByLabel("Тип материала", { exact: true })).toHaveValue("word");
    await page.goBack();
    await expect(materials.getByText("Страница 2 из 2")).toBeVisible();
  });
  test("shows a read-only syllabus and retries a failed outline", async ({ page }) => {
    await signIn(page);
    let reads = 0;
    await page.route(`${API}/courses/${ID}/outline`, (route) => {
      expect(route.request().method()).toBe("GET");
      return route.fulfill(
        ++reads === 1
          ? { status: 503, json: { message: "Временно недоступно" } }
          : { json: outline },
      );
    });
    await page.goto(`/courses/${ID}`);
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Временно недоступно");
    await page.getByRole("button", { name: "Повторить загрузку" }).click();
    await expect(page.getByRole("heading", { name: "Материалы курса", exact: true })).toBeVisible();
    await expect(page.locator(".course-identity")).toHaveText(outline.title);
    await page.getByRole("button", { name: "Все уровни", exact: true }).click();
    await expect(page.getByRole("list", { name: "Уровни курса" })).toContainText("32 материалов");
    await page
      .getByRole("list", { name: "Уровни курса" })
      .getByRole("link", { name: /Уровень 2:/u })
      .click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ID}\\?level=2$`, "u"));
    await expect(page.getByLabel("Уровень курса", { exact: true })).toHaveValue("2");
  });
  test("moves between existing levels while resetting only the page", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    await page.goto(`/courses/${ID}?level=1&page=2&itemType=word`);
    await page.getByRole("button", { name: "Следующий уровень", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/courses/${ID}\\?level=2&itemType=word$`, "u"));
    await expect(
      page.getByRole("button", { name: "Следующий уровень", exact: true }),
    ).toBeDisabled();
    await expect(page.getByLabel("Тип материала", { exact: true })).toHaveValue("word");
  });
  test("requires login and does not fetch a private progress view as a guest", async ({ page }) => {
    await page.goto(`/courses/${ID}`);
    await expect(page.getByText("Для просмотра курса нужен вход.")).toBeVisible();
  });
  test("opens whole-level progress counts without scheduling writes", async ({ page }) => {
    await signIn(page);
    await page.route(`${API}/courses/${ID}/outline`, (route) => route.fulfill({ json: outline }));
    const writes: string[] = [];
    page.on("request", (request) => {
      if (
        request.url().startsWith(API) &&
        request.method() !== "GET" &&
        request.method() !== "OPTIONS"
      )
        writes.push(request.url());
    });
    await page.goto(`/courses/${ID}?itemType=kanji&page=2`);
    await page
      .getByRole("navigation", { name: "Прогресс уровня" })
      .getByRole("button", { name: "Срок наступил: 1", exact: true })
      .click();
    await expect(page).toHaveURL(/reviewState=due/u);
    await expect(page.getByLabel("Срок повторения", { exact: true })).toHaveValue("due");
    await expect(page.getByText("Страница 1 из 2")).toBeVisible();
    expect(writes).toEqual([]);
  });
});
