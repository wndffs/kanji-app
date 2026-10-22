import { expect, test } from "@playwright/test";

test("public manifest and home-screen icons are served without an account", async ({
  page,
  request,
}) => {
  await page.goto("/login");
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    "href",
    /\/apple-icon\.png\?/u,
  );
  const response = await request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  expect(response.headers()["content-type"]).toContain("application/manifest+json");
  const manifest = await response.json();
  expect(manifest).toMatchObject({ id: "/", start_url: "/dashboard", display: "standalone" });
  expect(manifest.icons).toHaveLength(4);
  for (const size of [192, 512]) {
    const icon = await request.get(`/icons/app-${size}.png`);
    expect(icon.ok()).toBe(true);
    expect(icon.headers()["content-type"]).toContain("image/png");
    const bytes = await icon.body();
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
  await expect(page.getByRole("heading", { name: "Вход", exact: true })).toBeVisible();
});
