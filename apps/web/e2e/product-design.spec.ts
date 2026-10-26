import { expect, test } from "@playwright/test";

test.describe("original learner visual system", () => {
  for (const width of [360, 390, 768, 1280]) {
    for (const theme of ["light", "dark"]) {
      test(`${width}px ${theme}: settings preview and navigation fit`, async ({ page }) => {
        await page.setViewportSize({ width, height: 900 });
        await page.goto("/settings");
        await page.getByLabel("Тема", { exact: true }).selectOption(theme);
        await expect(page.locator("html")).toHaveAttribute("data-interface-theme", theme);
        await page.getByLabel("Перевод карточек", { exact: true }).selectOption("ru-en");
        await page.getByLabel("Плотность интерфейса", { exact: true }).selectOption("compact");
        await page
          .getByLabel("Размер японского текста", { exact: true })
          .selectOption("extra-large");
        await expect(page.locator("html")).toHaveAttribute("data-interface-density", "compact");
        await expect(page.locator("html")).toHaveAttribute("data-study-text-size", "extra-large");
        const preview = page.locator(".appearance-preview");
        await expect(preview).toHaveAttribute("data-preview-theme", theme);
        await expect(preview).toHaveAttribute("data-preview-density", "compact");
        await expect(preview.locator('[lang="ru"]')).toHaveText("день");
        await expect(preview.locator('[lang="en"]')).toHaveText("day");
        await expect(preview.locator(".appearance-preview-glyph")).toHaveText("日");
        await expect(
          page.getByRole("navigation", { name: "Основная навигация", exact: true }),
        ).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
          true,
        );
        const nav = await page
          .getByRole("navigation", { name: "Основная навигация", exact: true })
          .boundingBox();
        expect(nav).not.toBeNull();
        if (width <= 900) expect(nav!.y).toBeGreaterThan(780);
        else expect(nav!.x).toBeLessThan(224);
        await page.screenshot({
          path: test.info().outputPath(`settings-${width}-${theme}.png`),
          fullPage: true,
        });
      });
    }
  }
  test("skips navigation with the keyboard and keeps reduced motion explicit", async ({ page }) => {
    await page.goto("/settings");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "К содержимому", exact: true })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("main")).toBeFocused();
    await page.getByLabel("Анимация", { exact: true }).selectOption("reduced");
    await expect(page.locator("html")).toHaveAttribute("data-interface-motion", "reduced");
    await page.getByRole("tab", { name: "Обучение", exact: true }).click();
    await expect(page.locator(".appearance-preview")).toBeHidden();
    await page.getByRole("tab", { name: "Внешний вид", exact: true }).click();
    await expect(page.locator(".appearance-preview")).toBeVisible();
    await page.getByLabel("Тема", { exact: true }).selectOption("dark");
    await page
      .getByRole("navigation", { name: "Основная навигация", exact: true })
      .getByRole("link", { name: "Поиск", exact: true })
      .click();
    await expect(page.locator("html")).toHaveAttribute("data-interface-theme", "system");
  });
});
