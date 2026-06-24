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
  readonly authTokenSecret: string;
  readonly authSessionTtlMinutes: number;
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

export type PublicApiConfigSnapshot = Omit<ApiConfigSnapshot, "authTokenSecret"> & {
  readonly authTokenSecret: "[redacted]";
};

const DEFAULT_PORT = 3001;
const DEFAULT_DATABASE_URL = "postgresql://kanji:kanji@localhost:5432/kanji_srs?schema=public";
const DEFAULT_AUTH_TOKEN_SECRET = "dev-only-change-me";
const DEFAULT_AUTH_SESSION_TTL_MINUTES = 43_200;
const MIN_PRODUCTION_AUTH_TOKEN_SECRET_LENGTH = 32;

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

  get authTokenSecret(): string {
    return this.snapshot.authTokenSecret;
  }

  get authSessionTtlMinutes(): number {
    return this.snapshot.authSessionTtlMinutes;
  }

  get devUser(): ApiConfigSnapshot["devUser"] {
    return this.snapshot.devUser;
  }

  toJSON(): PublicApiConfigSnapshot {
    return {
      ...this.snapshot,
      authTokenSecret: "[redacted]",
    };
  }
}

export function buildConfigSnapshot(env: NodeJS.ProcessEnv): ApiConfigSnapshot {
  const environment = parseEnvironment(env.NODE_ENV);
  const databaseUrl = env.DATABASE_URL ?? DEFAULT_DATABASE_URL;
  const authMode = parseAuthMode(env.AUTH_MODE);
  const authTokenSecret = env.AUTH_TOKEN_SECRET ?? DEFAULT_AUTH_TOKEN_SECRET;

  if (environment === "production" && env.DATABASE_URL === undefined) {
    throw new Error("DATABASE_URL is required in production.");
  }

  if (environment === "production" && authMode === "dev") {
    throw new Error("AUTH_MODE=dev is not allowed in production.");
  }

  if (environment === "production") {
    assertProductionAuthTokenSecret(authTokenSecret);
  }

  return {
    environment,
    port: parsePort(env.PORT),
    webOrigin: env.WEB_ORIGIN ?? "http://localhost:3000",
    databaseUrl,
    redisUrl: env.REDIS_URL ?? null,
    authMode,
    authTokenSecret,
    authSessionTtlMinutes: parsePositiveInteger(
      env.AUTH_SESSION_TTL_MINUTES,
      DEFAULT_AUTH_SESSION_TTL_MINUTES,
      "AUTH_SESSION_TTL_MINUTES",
    ),
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

function parsePositiveInteger(
  value: string | undefined,
  defaultValue: number,
  name: string,
): number {
  if (value === undefined || value.trim() === "") {
    return defaultValue;
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return parsed;
}

function parseAuthMode(value: string | undefined): AuthMode {
  if (value === "dev") {
    return "dev";
  }

  return "local";
}

function assertProductionAuthTokenSecret(secret: string): void {
  if (secret === DEFAULT_AUTH_TOKEN_SECRET) {
    throw new Error("AUTH_TOKEN_SECRET must be configured in production.");
  }

  if (secret.length < MIN_PRODUCTION_AUTH_TOKEN_SECRET_LENGTH) {
    throw new Error(
      `AUTH_TOKEN_SECRET must be at least ${MIN_PRODUCTION_AUTH_TOKEN_SECRET_LENGTH} characters in production.`,
    );
  }

  if (/^(.)\1+$/.test(secret)) {
    throw new Error("AUTH_TOKEN_SECRET must not be a repeated character in production.");
  }
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
