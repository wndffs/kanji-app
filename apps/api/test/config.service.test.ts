import { describe, expect, it } from "vitest";

import { buildConfigSnapshot } from "../src/config/app-config.service";

describe("buildConfigSnapshot", () => {
  it("uses safe local defaults", () => {
    expect(buildConfigSnapshot({})).toMatchObject({
      environment: "development",
      port: 3001,
      webOrigin: "http://localhost:3000",
      authMode: "dev",
      redisUrl: null,
      devUser: {
        email: "demo@example.local",
        role: "USER",
        translationDisplayMode: "ru",
        timezone: "Europe/Moscow",
      },
    });
  });

  it("parses configured API settings", () => {
    expect(
      buildConfigSnapshot({
        NODE_ENV: "test",
        PORT: "4010",
        WEB_ORIGIN: "http://localhost:3005",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        REDIS_URL: "redis://localhost:6379",
        AUTH_MODE: "local",
        DEV_USER_EMAIL: "learner@example.test",
        DEV_USER_ROLE: "ADMIN",
        DEV_TRANSLATION_DISPLAY_MODE: "ru-en",
      }),
    ).toMatchObject({
      environment: "test",
      port: 4010,
      webOrigin: "http://localhost:3005",
      databaseUrl: "postgresql://user:pass@localhost:5432/app",
      redisUrl: "redis://localhost:6379",
      authMode: "local",
      devUser: {
        email: "learner@example.test",
        role: "ADMIN",
        translationDisplayMode: "ru-en",
      },
    });
  });

  it("rejects invalid ports", () => {
    expect(() => buildConfigSnapshot({ PORT: "70000" })).toThrow(
      "PORT must be an integer between 1 and 65535.",
    );
  });

  it("rejects dev auth in production", () => {
    expect(() =>
      buildConfigSnapshot({
        NODE_ENV: "production",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      }),
    ).toThrow("AUTH_MODE=dev is not allowed in production.");

    expect(() =>
      buildConfigSnapshot({
        NODE_ENV: "production",
        AUTH_MODE: "dev",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      }),
    ).toThrow("AUTH_MODE=dev is not allowed in production.");
  });
});
