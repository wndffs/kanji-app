import { expect, test } from "@playwright/test";

test("direct desktop destinations and mobile overflow remain keyboard reachable", async ({
  page,
}) => {
  await page.goto("/search");
  const library = page.getByRole("navigation", { name: "Библиотека и настройки", exact: true });
  if (test.info().project.name === "desktop") {
    await expect(library).toBeVisible();
    await expect(library.getByRole("link", { name: "Курсы", exact: true })).toBeVisible();
    await expect(library.getByRole("link", { name: "Колоды", exact: true })).toBeVisible();
  } else {
    await expect(library).toBeHidden();
  }
  await page.setViewportSize({ width: 390, height: 360 });
  const rail = page.locator(".app-rail");
  expect(
    await rail.evaluate(
      (element) => element.clientWidth === Math.round(element.getBoundingClientRect().width),
    ),
  ).toBe(true);
  const trigger = page.getByRole("button", { name: "Другие разделы", exact: true });
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  const menu = page.getByRole("navigation", { name: "Другие разделы", exact: true });
  await expect(menu.getByRole("link", { name: "Кана", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(menu.getByRole("link", { name: "Настройки", exact: true })).toBeFocused();
  await expect(menu.getByRole("link", { name: "Настройки", exact: true })).toBeInViewport({
    ratio: 1,
  });
  await page.keyboard.press("Home");
  await expect(menu.getByRole("link", { name: "Кана", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger).toBeFocused();
  await expect(menu).toBeHidden();
});

test("kana has one visible current destination at each navigation breakpoint", async ({ page }) => {
  await page.goto("/kana");
  await page.setViewportSize({ width: 1280, height: 900 });
  const current = page.locator('.app-rail a[aria-current="page"]:visible');
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("Кана");
  await page.setViewportSize({ width: 390, height: 852 });
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText("Символы");
});

test("uses the width below the navigation on desktop and docks navigation on phones", async ({
  page,
}) => {
  await page.goto("/search");
  const nav = page.getByRole("navigation", { name: "Основная навигация", exact: true });
  const library = page.getByRole("navigation", { name: "Библиотека и настройки", exact: true });
  const main = page.getByRole("main");
  const more = page.getByRole("button", { name: "Другие разделы", exact: true });

  for (const width of [1280, 901]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(nav).toBeVisible();
    await expect(library.getByRole("link", { name: "Курсы", exact: true })).toBeVisible();
    await expect(more).toBeHidden();
    const navBounds = (await nav.boundingBox())!;
    const libraryBounds = (await library.boundingBox())!;
    const mainBounds = (await main.boundingBox())!;
    expect(
      Math.max(navBounds.y + navBounds.height, libraryBounds.y + libraryBounds.height),
    ).toBeLessThan(mainBounds.y);
    expect(mainBounds.width).toBeGreaterThanOrEqual(width - 80);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
  }

  await page.setViewportSize({ width: 320, height: 640 });
  await expect(nav).toBeInViewport({ ratio: 1 });
  await expect(library).toBeHidden();
  await expect(more).toBeVisible();
  const mobileNav = (await nav.boundingBox())!;
  expect(mobileNav.y + mobileNav.height).toBeCloseTo(640, 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});
