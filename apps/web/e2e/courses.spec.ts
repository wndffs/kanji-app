import { expect, test, type Page } from "@playwright/test";

const API = "http://localhost:3001";
const ID = "00000000-0000-4000-8000-000000000010";
const NEXT = "00000000-0000-4000-8000-000000000020";
const pilot = {
  id: ID,
  slug: "japanese-foundation-pilot-v1",
  title: "Пилот основ: 40 компонентов, 40 кандзи и 20 слов",
  description: "Отдельный пилот из 5 уровней, не полный курс до N2.",
  targetLevel: "FOUNDATION",
  band: "foundation",
  courseType: "structured",
};

async function signIn(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("kanji-srs.accessToken", "catalog-old-token");
    localStorage.setItem(
      "kanji-srs.user",
      JSON.stringify({
        id: "catalog-user",
        email: "catalog@example.test",
        displayName: "Каталог",
        role: "USER",
        settings: { locale: "ru-RU", translationDisplayMode: "ru-en", timezone: "Europe/Moscow" },
      }),
    );
  });
}

test.describe("published course catalog", () => {
  test("requires a session without making an enrollment request", async ({ page }) => {
    let writes = 0;
    await page.route(`${API}/courses/enroll`, async (route) => {
      writes++;
      await route.fulfill({ json: {} });
    });
    await page.goto("/courses");
    await expect(page.getByText("Нужен вход в аккаунт.", { exact: true })).toBeVisible();
    expect(writes).toBe(0);
  });

  test("keeps a failed enrollment recoverable, retries once and never switches the current course", async ({
    page,
  }) => {
    await signIn(page);
    await page.route(`${API}/courses/available`, async (route) => {
      await route.fulfill({ json: { courses: [pilot], nextCursor: null } });
    });
    const bodies: unknown[] = [];
    let switches = 0;
    await page.route(`${API}/courses/current`, async (route) => {
      switches++;
      await route.fulfill({ json: {} });
    });
    await page.route(`${API}/courses/enroll`, async (route) => {
      expect(route.request().headers().authorization).toBe("Bearer catalog-old-token");
      bodies.push(route.request().postDataJSON());
      await route.fulfill(
        bodies.length === 1
          ? { status: 503, json: { message: "Курс временно недоступен." } }
          : { json: { currentCourseId: "starter", courses: [] } },
      );
    });
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: pilot.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Добавить курс", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Курс временно недоступен.");
    await expect(page.getByRole("heading", { name: pilot.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Добавить курс", exact: true }).click();
    await expect(page.getByRole("status")).toContainText("Текущий курс не изменён.");
    await expect(page.getByRole("heading", { name: pilot.title, exact: true })).toBeHidden();
    expect(bodies).toEqual([{ courseId: ID }, { courseId: ID }]);
    expect(switches).toBe(0);
    await expect(page.getByRole("link", { name: "На панель", exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
      ),
    ).toBe(true);
  });

  test("retains earlier rows while paging and does not call an error an empty catalog", async ({
    page,
  }) => {
    await signIn(page);
    let calls = 0;
    await page.route(`${API}/courses/available**`, async (route) => {
      calls++;
      await route.fulfill(
        calls === 1
          ? { status: 503, json: { message: "Список недоступен." } }
          : {
              json: {
                courses: [
                  {
                    ...pilot,
                    id: calls === 2 ? ID : NEXT,
                    title: calls === 2 ? pilot.title : "Второй опубликованный курс",
                  },
                ],
                nextCursor: calls === 2 ? ID : null,
              },
            },
      );
    });
    await page.goto("/courses");
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Список недоступен.");
    await expect(page.getByText("Новых опубликованных курсов нет.", { exact: true })).toBeHidden();
    await page.getByRole("button", { name: "Обновить", exact: true }).click();
    await expect(page.getByRole("heading", { name: pilot.title, exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ещё курсы", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Второй опубликованный курс", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: pilot.title, exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Ещё курсы", exact: true })).toBeHidden();
  });

  for (const status of [200, 401])
    test(`ignores a late ${status} from the previous account`, async ({ page }) => {
      await signIn(page);
      let release!: () => void;
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      let seen!: () => void;
      const requested = new Promise<void>((resolve) => {
        seen = resolve;
      });
      await page.route(`${API}/courses/available`, async (route) => {
        if (route.request().headers().authorization === "Bearer catalog-old-token") {
          seen();
          await held;
          await route.fulfill(
            status === 401
              ? { status, json: { message: "Old session expired" } }
              : { json: { courses: [pilot], nextCursor: null } },
          );
        } else
          await route.fulfill({
            json: {
              courses: [{ ...pilot, id: NEXT, title: "Курс другого аккаунта" }],
              nextCursor: null,
            },
          });
      });
      await page.goto("/courses");
      await requested;
      await page.evaluate(() => {
        localStorage.setItem("kanji-srs.accessToken", "catalog-new-token");
        const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
        user.id = "new-catalog-user";
        localStorage.setItem("kanji-srs.user", JSON.stringify(user));
        window.dispatchEvent(new Event("kanji-srs.auth-changed"));
      });
      await expect(
        page.getByRole("heading", { name: "Курс другого аккаунта", exact: true }),
      ).toBeVisible();
      const oldResponse = page.waitForResponse(
        (response) =>
          response.url() === `${API}/courses/available` &&
          response.request().headers().authorization === "Bearer catalog-old-token",
      );
      release();
      await (await oldResponse).finished();
      await page.evaluate(
        () =>
          new Promise<void>((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
          ),
      );
      await expect(page.getByRole("heading", { name: pilot.title, exact: true })).toBeHidden();
      await expect(
        page.getByRole("heading", { name: "Курс другого аккаунта", exact: true }),
      ).toBeVisible();
      expect(await page.evaluate(() => localStorage.getItem("kanji-srs.accessToken"))).toBe(
        "catalog-new-token",
      );
    });
});
