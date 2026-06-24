import { HttpException, HttpStatus, Injectable } from "@nestjs/common";

export type RateLimitPolicyName =
  | "auth-login-ip"
  | "auth-login-email"
  | "auth-register-ip"
  | "auth-register-email"
  | "review-answer-user";

export type RequestRateLimitSource = {
  readonly headers?: Record<string, string | readonly string[] | undefined>;
  readonly ip?: string;
  readonly socket?: {
    readonly remoteAddress?: string | null;
  };
};

type RateLimitPolicy = {
  readonly max: number;
  readonly windowMs: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

const ONE_MINUTE_MS = 60_000;

export const RATE_LIMIT_POLICIES: Record<RateLimitPolicyName, RateLimitPolicy> = {
  "auth-login-ip": { max: 20, windowMs: 5 * ONE_MINUTE_MS },
  "auth-login-email": { max: 10, windowMs: 5 * ONE_MINUTE_MS },
  "auth-register-ip": { max: 10, windowMs: 60 * ONE_MINUTE_MS },
  "auth-register-email": { max: 3, windowMs: 60 * ONE_MINUTE_MS },
  "review-answer-user": { max: 120, windowMs: ONE_MINUTE_MS },
};

@Injectable()
export class RateLimitService {
  private readonly buckets = new Map<string, RateLimitBucket>();

  assertAllowed(policyName: RateLimitPolicyName, key: string, now = Date.now()): void {
    const policy = RATE_LIMIT_POLICIES[policyName];
    const bucketKey = `${policyName}:${normalizeLimitKey(key)}`;
    const existingBucket = this.buckets.get(bucketKey);
    const bucket =
      existingBucket === undefined || existingBucket.resetAt <= now
        ? { count: 0, resetAt: now + policy.windowMs }
        : existingBucket;

    bucket.count += 1;
    this.buckets.set(bucketKey, bucket);

    if (bucket.count > policy.max) {
      throw new HttpException("Too many requests.", HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  reset(): void {
    this.buckets.clear();
  }
}

export function getClientRateLimitKey(request: RequestRateLimitSource): string {
  const forwardedFor = readHeader(request.headers, "x-forwarded-for");
  const forwardedClient = forwardedFor?.split(",")[0]?.trim();

  return (
    normalizeOptionalKey(request.ip) ??
    normalizeOptionalKey(request.socket?.remoteAddress) ??
    normalizeOptionalKey(readHeader(request.headers, "x-real-ip")) ??
    normalizeOptionalKey(forwardedClient) ??
    "unknown-client"
  );
}

export function getEmailRateLimitKey(body: unknown): string | null {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return null;
  }

  const email = (body as { readonly email?: unknown }).email;

  if (typeof email !== "string") {
    return null;
  }

  const normalized = email.trim().toLowerCase();

  return normalized.length === 0 ? null : normalized;
}

function readHeader(headers: RequestRateLimitSource["headers"], name: string): string | null {
  const value = headers?.[name] ?? headers?.[name.toLowerCase()];

  if (typeof value === "string") {
    return value;
  }

  return value?.[0] ?? null;
}

function normalizeOptionalKey(value: string | null | undefined): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = value.trim();

  return normalized.length === 0 ? null : normalized;
}

function normalizeLimitKey(value: string): string {
  const normalized = value.trim().toLowerCase();

  return normalized.length === 0 ? "unknown" : normalized.slice(0, 256);
}
