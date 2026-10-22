import { randomUUID } from "node:crypto";

export type RequestTarget = {
  readonly originalUrl?: string;
  readonly url?: string;
};

type RequestContext = {
  readonly requestId: string;
  readonly path: string;
};

type HeaderResponse = {
  setHeader(name: string, value: string): void;
};

const requestContexts = new WeakMap<RequestTarget, RequestContext>();

export function getRequestContext(request: RequestTarget): RequestContext {
  const existing = requestContexts.get(request);
  if (existing !== undefined) return existing;

  const context = {
    requestId: randomUUID(),
    path: safeRequestPath(request.originalUrl ?? request.url),
  };
  requestContexts.set(request, context);
  return context;
}

export function setRequestPrivacyHeaders(response: HeaderResponse, requestId: string): void {
  response.setHeader("X-Request-ID", requestId);
  response.setHeader("Cache-Control", "no-store");
}

export function safeRequestPath(target: string | undefined): string {
  return parseRequestTarget(target)?.pathname ?? "unknown";
}

export function sanitizeReflectedRequestTarget(text: string, request: RequestTarget): string {
  let sanitized = text;
  for (const target of new Set([request.originalUrl, request.url])) {
    if (!target) continue;
    const parsed = parseRequestTarget(target);
    // Nest's route-not-found message can repeat the entire request target.
    const path = parsed?.pathname ?? "unknown";
    if (target !== path) {
      sanitized = sanitized.replaceAll(target, path);
    }
  }
  return sanitized;
}

function parseRequestTarget(target: string | undefined): URL | null {
  if (!target) return null;
  try {
    const parsed = new URL(target, "http://request.invalid");
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}
