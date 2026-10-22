import { expect, type Page, test } from "@playwright/test";

test.describe("public offline shell", () => {
  test.skip(process.env.WEB_SMOKE_PRODUCTION !== "1", "Offline worker is production-only.");

  async function waitForWorker(page: Page) {
    await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
    await expect
      .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? null))
      .toMatch(/\/sw\.js$/u);
  }

  test("caches only two public files and recovers fresh navigation without replaying writes", async ({
    page,
    context,
    request,
  }, testInfo) => {
    const worker = await request.get("/sw.js");
    expect(worker.ok()).toBe(true);
    expect(worker.headers()["cache-control"]).toBe("no-store");
    expect(worker.headers()["x-content-type-options"]).toBe("nosniff");
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Вход", exact: true })).toBeVisible();
    await waitForWorker(page);
    await page.evaluate(async () => {
      localStorage.setItem("offline-audit-private", "private-audit-value");
      for (const method of ["GET", "POST"]) {
        const response = await fetch("/api/health", {
          method,
          headers: { Authorization: "Bearer private-audit-token" },
          cache: "no-store",
        });
        await response.text();
      }
    });
    const cached = await page.evaluate(async () => {
      const names = (await caches.keys()).filter((name) =>
        name.startsWith("kanji-srs-public-offline-"),
      );
      const entries = [];
      for (const name of names) {
        const cache = await caches.open(name);
        for (const key of await cache.keys()) {
          entries.push({
            path: new URL(key.url).pathname,
            search: new URL(key.url).search,
            authorization: key.headers.get("Authorization"),
          });
        }
      }
      return { names, entries };
    });
    expect(cached.names).toHaveLength(1);
    expect(cached.entries.sort((a, b) => a.path.localeCompare(b.path))).toEqual([
      { path: "/icons/app-192.png", search: "", authorization: null },
      { path: "/offline.html", search: "", authorization: null },
    ]);
    let writes = 0;
    page.on("request", (outgoing) => {
      if (outgoing.method() !== "GET") writes++;
    });
    await context.setOffline(true);
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: "Нет соединения", exact: true })).toBeVisible();
    await expect(
      page.getByText("Учебные данные сейчас недоступны.", { exact: false }),
    ).toBeVisible();
    await expect(page.locator("script, form")).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("private-audit-value");
    await expect
      .poll(() => page.locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBe(192);
    expect(new URL(page.url()).pathname).toBe("/dashboard");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
    expect(overflow).toBe(false);
    await page.screenshot({ path: testInfo.outputPath("offline-shell.png") });
    expect(writes).toBe(0);
    await context.setOffline(false);
    await page.getByRole("link", { name: "Повторить подключение", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Панель", exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Нет соединения", exact: true })).toBeHidden();
    expect(writes).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem("offline-audit-private"))).toBe(
      "private-audit-value",
    );
  });

  test("worker registration failure leaves online sign-in usable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.serviceWorker, "register", {
        value: () => {
          document.documentElement.dataset.offlineRegistrationFailed = "true";
          return Promise.reject(new DOMException("Registration unavailable", "SecurityError"));
        },
      });
    });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-offline-registration-failed", "true");
    await expect(page.getByRole("heading", { name: "Вход", exact: true })).toBeVisible();
    await expect(page.getByLabel("Почта", { exact: true })).toBeEditable();
    expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
  });

  test("unsupported worker registration leaves online sign-in usable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "serviceWorker", { configurable: true, value: undefined });
    });
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Вход", exact: true })).toBeVisible();
    await expect(page.getByLabel("Почта", { exact: true })).toBeEditable();
    await expect(page.locator(".form-error")).toBeHidden();
  });

  test("blocked worker storage leaves online sign-in usable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        get: () => {
          document.documentElement.dataset.offlineStorageBlocked = "true";
          throw new DOMException("Storage unavailable", "SecurityError");
        },
      });
    });
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("data-offline-storage-blocked", "true");
    await expect(page.getByRole("heading", { name: "Вход", exact: true })).toBeVisible();
    await expect(page.getByLabel("Почта", { exact: true })).toBeEditable();
    await expect(page.locator(".form-error")).toBeHidden();
  });
});
