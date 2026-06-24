import { describe, expect, it } from "vitest";

import { buildConfigSnapshot } from "../src/config/app-config.service";

describe("buildConfigSnapshot", () => {
  it("uses safe local defaults", () => {
    expect(buildConfigSnapshot({})).toMatchObject({
      environment: "development",
      port: 3001,
      webOrigin: "http://localhost:3000",
      authMode: "local",
      authTokenSecret: "dev-only-change-me",
      authSessionTtlMinutes: 43200,
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
        AUTH_TOKEN_SECRET: "test-secret",
        AUTH_SESSION_TTL_MINUTES: "60",
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
      authTokenSecret: "test-secret",
      authSessionTtlMinutes: 60,
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

  it("rejects invalid session ttl", () => {
    expect(() => buildConfigSnapshot({ AUTH_SESSION_TTL_MINUTES: "0" })).toThrow(
      "AUTH_SESSION_TTL_MINUTES must be a positive integer.",
    );
  });

  it("rejects dev auth in production", () => {
    expect(() =>
      buildConfigSnapshot({
        NODE_ENV: "production",
        AUTH_MODE: "dev",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      }),
    ).toThrow("AUTH_MODE=dev is not allowed in production.");
  });

  it("requires a production token secret", () => {
    expect(() =>
      buildConfigSnapshot({
        NODE_ENV: "production",
        AUTH_MODE: "local",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
      }),
    ).toThrow("AUTH_TOKEN_SECRET must be configured in production.");
  });

  it("rejects short production token secrets", () => {
    expect(() =>
      buildConfigSnapshot({
        NODE_ENV: "production",
        AUTH_MODE: "local",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        AUTH_TOKEN_SECRET: "short-secret",
      }),
    ).toThrow("AUTH_TOKEN_SECRET must be at least 32 characters in production.");
  });

  it("rejects repeated-character production token secrets", () => {
    expect(() =>
      buildConfigSnapshot({
        NODE_ENV: "production",
        AUTH_MODE: "local",
        DATABASE_URL: "postgresql://user:pass@localhost:5432/app",
        AUTH_TOKEN_SECRET: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    ).toThrow("AUTH_TOKEN_SECRET must not be a repeated character in production.");
  });
});
