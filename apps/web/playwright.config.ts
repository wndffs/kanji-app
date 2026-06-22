import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.WEB_SMOKE_PORT ?? 3100);
const hostname = process.env.WEB_SMOKE_HOST ?? "127.0.0.1";
const baseURL = `http://${hostname}:${port}`;
const usesExternalServer = process.env.WEB_SMOKE_EXTERNAL_SERVER === "1";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 30_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    ...(process.platform === "win32" ? { channel: "msedge" } : {}),
  },
  webServer: usesExternalServer
    ? undefined
    : {
        command: `npx next dev --port ${port} --hostname ${hostname}`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 900 },
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
      },
    },
  ],
});
