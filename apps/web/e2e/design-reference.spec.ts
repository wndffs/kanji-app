import { expect, test } from "@playwright/test";

test("retired design prototype is not a learner route", async ({ page }) => {
  const response = await page.goto("/design-reference");
  expect(response?.status()).toBe(404);
  await expect(page.locator(".ref-root")).toHaveCount(0);
});
