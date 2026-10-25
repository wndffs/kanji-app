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
