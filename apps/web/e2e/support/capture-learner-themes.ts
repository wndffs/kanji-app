import { expect, type Page, type TestInfo } from "@playwright/test";

export async function captureLearnerThemes(page: Page, info: TestInfo, screen: string) {
  const original = await page.locator("html").getAttribute("data-interface-theme");
  try {
    for (const theme of ["light", "dark"]) {
      await page.evaluate((value) => {
        document.documentElement.dataset.interfaceTheme = value;
      }, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: info.outputPath(`${screen}-${theme}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  } finally {
    await page.evaluate((value) => {
      if (value === null) delete document.documentElement.dataset.interfaceTheme;
      else document.documentElement.dataset.interfaceTheme = value;
    }, original);
  }
}
