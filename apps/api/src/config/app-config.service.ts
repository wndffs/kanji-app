import { Inject, Injectable, Optional } from "@nestjs/common";

import {
  DEFAULT_TRANSLATION_DISPLAY_MODE,
  type AppLocale,
  type TranslationDisplayMode,
  isTranslationDisplayMode,
} from "@kanji-srs/shared";

export type ApiEnvironment = "development" | "test" | "production";
export type AuthMode = "dev" | "local";
export type UserRole = "USER" | "ADMIN";

export const APP_ENV = Symbol("APP_ENV");

export type ApiConfigSnapshot = {
  readonly environment: ApiEnvironment;
  readonly port: number;
  readonly webOrigin: string;
  readonly databaseUrl: string;
  readonly redisUrl: string | null;
  readonly authMode: AuthMode;
  readonly devUser: {
    readonly id: string;
    readonly email: string;
    readonly displayName: string;
    readonly role: UserRole;
    readonly locale: AppLocale;
    readonly translationDisplayMode: TranslationDisplayMode;
    readonly timezone: string;
  };
};

const DEFAULT_PORT = 3001;
const DEFAULT_DATABASE_URL = "postgresql://kanji:kanji@localhost:5432/kanji_srs?schema=public";

@Injectable()
export class AppConfigService {
  private readonly snapshot: ApiConfigSnapshot;

  constructor(@Optional() @Inject(APP_ENV) env?: NodeJS.ProcessEnv) {
    this.snapshot = buildConfigSnapshot(env ?? process.env);
  }

  get environment(): ApiEnvironment {
    return this.snapshot.environment;
  }

  get port(): number {
    return this.snapshot.port;
  }

  get webOrigin(): string {
    return this.snapshot.webOrigin;
  }

  get databaseUrl(): string {
    return this.snapshot.databaseUrl;
  }

  get redisUrl(): string | null {
    return this.snapshot.redisUrl;
  }

  get authMode(): AuthMode {
    return this.snapshot.authMode;
  }

  get devUser(): ApiConfigSnapshot["devUser"] {
    return this.snapshot.devUser;
  }

  toJSON(): ApiConfigSnapshot {
    return this.snapshot;
  }
}

export function buildConfigSnapshot(env: NodeJS.ProcessEnv): ApiConfigSnapshot {
  const environment = parseEnvironment(env.NODE_ENV);
  const databaseUrl = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const authMode = parseAuthMode(env.AUTH_MODE);

  if (environment === "production" && env.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is required in production.");
  }

  if (environment === "production" && authMode === "dev") {
    throw new Error("AUTH_MODE=dev is not allowed in production.");
  }

  return {
    environment,
    port: parsePort(env.PORT),
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
    databaseUrl,
    redisUrl: env.REDIS_URL ?? null,
    authMode,
    devUser: {
      id: env.DEV_USER_ID ?? "00000000-0000-4000-8000-000000000001",
      email: env.DEV_USER_EMAIL ?? "demo@example.local",
      displayName: env.DEV_USER_DISPLAY_NAME ?? "Demo User",
      role: parseRole(env.DEV_USER_ROLE),
      locale: "ru-RU",
      translationDisplayMode: parseTranslationDisplayMode(env.DEV_TRANSLATION_DISPLAY_MODE),
      timezone: env.DEV_USER_TIMEZONE ?? "Europe/Moscow",
    },
  };
}

function parseEnvironment(value: string | undefined): ApiEnvironment {
  if (value === "production" || value === "test") {
    return value;
  }

  return "development";
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value.trim() === "") {
    return DEFAULT_PORT;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535.");
  }

  return port;
}

function parseAuthMode(value: string | undefined): AuthMode {
  if (value === "local") {
    return "local";
  }

  return "dev";
}

function parseRole(value: string | undefined): UserRole {
  return value === "ADMIN" ? "ADMIN" : "USER";
}

function parseTranslationDisplayMode(value: string | undefined): TranslationDisplayMode {
  if (value !== undefined && isTranslationDisplayMode(value)) {
    return value;
  }

  return DEFAULT_TRANSLATION_DISPLAY_MODE;
}
