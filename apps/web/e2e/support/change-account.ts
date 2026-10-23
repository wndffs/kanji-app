import { type Page } from "@playwright/test";

export async function changeAccount(page: Page, token = "new-owner-token") {
  await page.evaluate((token) => {
    const user = JSON.parse(localStorage.getItem("kanji-srs.user")!);
    user.id = "new-owner";
    localStorage.setItem("kanji-srs.user", JSON.stringify(user));
    localStorage.setItem("kanji-srs.accessToken", token);
    window.dispatchEvent(new Event("kanji-srs.auth-changed"));
  }, token);
}
