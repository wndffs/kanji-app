import { expect, test } from "@playwright/test";

if (process.env.WEB_SMOKE_PRODUCTION === "1") {
  test("does not publish the design reference in production", async ({ page }) => {
    const response = await page.goto("/design-reference");
    expect(response?.status()).toBe(404);
    await expect(page.locator(".ref-root")).toHaveCount(0);
  });
} else {
  for (const theme of ["light", "dark"] as const) {
    test(`${theme}: reference compositions fit desktop and phone`, async ({ page }) => {
      await page.goto("/design-reference");
      await expect(page.getByText("Демонстрационные данные", { exact: true })).toBeVisible();
      if (theme === "dark")
        await page.getByRole("button", { name: "Тёмный эталон", exact: true }).click();
      const tabs = page.getByRole("tablist", { name: "Эталонные экраны", exact: true });
      for (const [id, label] of [
        ["dashboard", "Панель"],
        ["lesson", "Урок"],
        ["review", "Повторение"],
      ] as const) {
        await tabs.getByRole("tab", { name: label, exact: true }).click();
        await expect(page.locator(".ref-root")).toHaveAttribute("data-reference-view", id);
        await expect(page.locator(".ref-root")).toHaveAttribute("data-theme", theme);
        if (id === "lesson") {
          await expect(page.locator(".ref-primary-reading")).toHaveCount(0);
          await page.getByRole("button", { name: "Далее: чтение", exact: true }).click();
          await expect(page.locator(".ref-primary-reading")).toHaveText("にち");
          await expect(
            page.getByRole("button", { name: "Завершить предпросмотр", exact: true }),
          ).toBeInViewport({ ratio: 1 });
        }
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const controls = page.locator(
          ".ref-root button:visible, .ref-root select:visible, .ref-root input:visible",
        );
        expect(
          await controls.evaluateAll((elements) =>
            elements.every((element) => element.scrollWidth <= element.clientWidth + 1),
          ),
        ).toBe(true);
        if (id === "review") {
          await expect(page.getByRole("button", { name: "Проверить", exact: true })).toBeInViewport(
            { ratio: 1 },
          );
        }
        await page.screenshot({
          path: test.info().outputPath(`reference-${id}-${theme}.png`),
          fullPage: true,
        });
      }
    });
  }

  test("reference feedback is keyboard and IME safe without API or storage writes", async ({
    page,
  }) => {
    const remote: string[] = [];
    page.on("request", (request) => {
      if (
        new URL(request.url()).origin !==
        new URL(test.info().project.use.baseURL ?? "http://127.0.0.1:3100").origin
      )
        remote.push(request.url());
    });
    await page.addInitScript(() => {
      const writes: string[] = [];
      Object.assign(window, { __referenceWrites: writes });
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        writes.push(key);
        original.call(this, key, value);
      };
    });
    await page.goto("/design-reference");
    const tabs = page.getByRole("tablist", { name: "Эталонные экраны", exact: true });
    await tabs.getByRole("tab", { name: "Панель", exact: true }).focus();
    await page.keyboard.press("End");
    await expect(tabs.getByRole("tab", { name: "Повторение", exact: true })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await page
      .getByRole("combobox", { name: "Перевод эталона", exact: true })
      .selectOption("ru-en");
    const input = page.locator("#reference-answer");
    await expect(page.getByRole("button", { name: "Проверить", exact: true })).toBeDisabled();
    await input.fill("wood");
    await input.press("Enter");
    await expect(page.locator(".ref-answer-result")).toHaveAttribute("data-result", "wrong");
    await expect(page.getByRole("button", { name: "Продолжить", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toBeFocused();
    await input.dispatchEvent("compositionstart");
    await input.fill("ミズ");
    await input.dispatchEvent("keydown", {
      key: "Enter",
      isComposing: true,
      keyCode: 229,
      bubbles: true,
      cancelable: true,
    });
    await expect(page.locator(".ref-answer-result")).toHaveCount(0);
    await input.dispatchEvent("compositionend");
    await input.press("Enter");
    await expect(page.locator(".ref-answer-result")).toHaveAttribute("data-result", "correct");
    await expect(page.locator(".ref-review-bottom > span")).toContainText("1");
    await page.keyboard.press("Enter");
    await page.getByRole("button", { name: "Показать ответ", exact: true }).click();
    await expect(page.locator(".ref-answer-result")).toHaveAttribute("data-result", "revealed");
    await expect(page.locator(".ref-review-bottom > span")).toContainText("1");
    await page.keyboard.press("Enter");
    await expect(page.locator(".ref-review-bottom > span")).toContainText("1");
    await page.getByRole("button", { name: "На панель", exact: true }).click();
    await page.locator(".ref-action-lessons").click();
    await page.getByRole("combobox", { name: "Перевод эталона", exact: true }).selectOption("en");
    await expect(page.locator(".ref-memory-note")).toContainText("bright day");
    await expect(page.locator(".ref-memory-note")).not.toContainText("Прямоугольник");
    expect(remote).toEqual([]);
    expect(
      await page.evaluate(
        () => (window as typeof window & { __referenceWrites: string[] }).__referenceWrites,
      ),
    ).toEqual([]);
  });
}
