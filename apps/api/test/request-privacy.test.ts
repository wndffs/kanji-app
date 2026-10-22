import "reflect-metadata";

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";

import {
  BadRequestException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  type ArgumentsHost,
} from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ApiExceptionFilter } from "../src/http/api-exception.filter";
import { type ApiLogger } from "../src/logging/api-logger.service";
import { RequestLoggerMiddleware } from "../src/logging/request-logger.middleware";
import { safeRequestPath } from "../src/logging/request-privacy";

vi.mock("node:crypto", async (importOriginal) => {
  const original = await importOriginal<{ randomUUID: typeof randomUUID }>();
  return { ...original, randomUUID: vi.fn(original.randomUUID) };
});

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const PRIVATE_TARGET =
  "/api/decks/preview?text=日本語の秘密&token=token-secret&answer=answer-secret#fragment-secret";

beforeEach(() => vi.clearAllMocks());

describe("safe request paths", () => {
  it.each([
    [PRIVATE_TARGET, "/api/decks/preview"],
    ["https://user:password@proxy.invalid:8443/api/search?text=secret#private", "/api/search"],
    ["//proxy.invalid/api/items?answer=secret", "/api/items"],
    ["/api/items/%E5%B1%B1?answer=さん", "/api/items/%E5%B1%B1"],
    ["/api/items/\u0000\u001b?token=secret#private", "/api/items/%00%1B"],
    ["?text=secret#private", "/"],
    ["/api/health", "/api/health"],
    ["http://[?token=secret", "unknown"],
    ["javascript:secret?token=secret", "unknown"],
    ["", "unknown"],
    [undefined, "unknown"],
  ])("retains only a parsed pathname for %s", (target, expected) => {
    expect(safeRequestPath(target)).toBe(expected);
  });
});

describe("request correlation and privacy", () => {
  it("ignores malicious incoming IDs and generates one UUID shared by the header, logs and error body", () => {
    const maliciousId = "attacker\r\nX-Forged: token-secret\u0000\u001b";
    const request = {
      method: "GET",
      originalUrl: PRIVATE_TARGET,
      url: "/preview?answer=other-secret",
      headers: { "x-request-id": maliciousId, authorization: "Bearer auth-secret" },
      requestId: maliciousId,
      body: { password: "password-secret" },
    };
    const fixture = harness(request);
    fixture.middleware.use(request, fixture.response, fixture.next);
    const requestId = fixture.response.headers.get("x-request-id");
    expect(requestId).toMatch(UUID_V4);
    expect(requestId).not.toBe(maliciousId);
    expect(fixture.response.headers.get("cache-control")).toBe("no-store");
    expect(fixture.next).toHaveBeenCalledOnce();
    fixture.filter.catch(new Error(`Failed: ${PRIVATE_TARGET}`), fixture.host);
    fixture.response.emit("finish");
    fixture.response.emit("finish");

    expect(randomUUID).toHaveBeenCalledOnce();
    expect(fixture.logger.log).toHaveBeenCalledOnce();
    expect(fixture.logger.error).toHaveBeenCalledOnce();
    expect(fixture.logger.log).toHaveBeenCalledWith(expect.any(String), "RequestLogger");
    expect(JSON.parse(fixture.logger.log.mock.calls[0]![0])).toEqual({
      event: "http.request",
      requestId,
      method: "GET",
      path: "/api/decks/preview",
      statusCode: 500,
      durationMs: expect.any(Number),
    });
    expect(JSON.parse(fixture.logger.error.mock.calls[0]![0])).toEqual({
      event: "api.error",
      requestId,
      path: "/api/decks/preview",
      statusCode: 500,
      message: "Внутренняя ошибка сервера.",
    });
    expect(fixture.response.body).toEqual({
      statusCode: 500,
      message: "Внутренняя ошибка сервера.",
      error: "InternalServerError",
      timestamp: expect.any(String),
      path: "/api/decks/preview",
      requestId,
    });
    expect(fixture.response.headers.get("x-request-id")).toBe(requestId);
    expect(
      JSON.stringify([
        fixture.logger.log.mock.calls,
        fixture.logger.error.mock.calls,
        fixture.response.body,
        [...fixture.response.headers],
      ]),
    ).not.toMatch(
      /日本語の秘密|token-secret|answer-secret|other-secret|fragment-secret|attacker|auth-secret|password-secret|X-Forged/u,
    );
  });

  it("does not reuse a valid-looking incoming UUID across separate requests", () => {
    const incomingId = "11111111-1111-4111-8111-111111111111";
    const ids = [1, 2].map(() => {
      const request = { url: "/api/items?token=secret", headers: { "x-request-id": incomingId } };
      const fixture = harness(request);
      fixture.middleware.use(request, fixture.response, fixture.next);
      fixture.response.emit("finish");
      return fixture.response.headers.get("x-request-id");
    });
    expect(ids.every((id) => id !== incomingId && UUID_V4.test(id!))).toBe(true);
    expect(new Set(ids).size).toBe(2);
    expect(randomUUID).toHaveBeenCalledTimes(2);
  });

  it("captures the original safe path before a router changes request.url", () => {
    const request = { method: "GET", url: "/api/items?text=secret" };
    const fixture = harness(request);
    fixture.middleware.use(request, fixture.response, fixture.next);
    request.url = "/mounted?token=another-secret";
    fixture.filter.catch(
      new InternalServerErrorException("Сервис временно недоступен."),
      fixture.host,
    );
    fixture.response.emit("finish");
    expect(fixture.response.body?.path).toBe("/api/items");
    expect(JSON.parse(fixture.logger.log.mock.calls[0]![0]).path).toBe("/api/items");
    expect(JSON.parse(fixture.logger.error.mock.calls[0]![0]).path).toBe("/api/items");
    expect(fixture.response.body?.message).toBe("Сервис временно недоступен.");
    expect(randomUUID).toHaveBeenCalledOnce();
  });

  it.each([
    PRIVATE_TARGET,
    "https://user:password@proxy.invalid/api/missing?token=token-secret#fragment-secret",
    "http://[?token=token-secret",
  ])("does not reflect a raw route-not-found target: %s", (target) => {
    const request = { method: "GET", originalUrl: target, url: target };
    const fixture = harness(request);
    fixture.middleware.use(request, fixture.response, fixture.next);
    fixture.filter.catch(new NotFoundException(`Cannot GET ${target}`), fixture.host);
    fixture.response.emit("finish");
    const path = safeRequestPath(target);
    expect(fixture.response.body).toMatchObject({
      statusCode: 404,
      error: "Not Found",
      path,
      message: `Cannot GET ${path}`,
    });
    expect(fixture.logger.error).not.toHaveBeenCalled();
    expect(JSON.stringify([fixture.logger.log.mock.calls, fixture.response.body])).not.toMatch(
      /token-secret|fragment-secret|日本語の秘密|answer-secret|password|proxy\.invalid/u,
    );
  });

  it("preserves HTTP status and Russian validation arrays, adding only the request ID", () => {
    const request = { url: PRIVATE_TARGET };
    const fixture = harness(request);
    const message = ["Укажите ответ.", "Чтение должно быть записано каной."];
    fixture.filter.catch(
      new BadRequestException({ message, error: "Проверка запроса" }),
      fixture.host,
    );
    expect(fixture.response.body).toEqual({
      statusCode: 400,
      message,
      error: "Проверка запроса",
      timestamp: expect.any(String),
      path: "/api/decks/preview",
      requestId: expect.stringMatching(UUID_V4),
    });
    expect(fixture.logger.error).not.toHaveBeenCalled();
    expect(fixture.response.headers.get("x-request-id")).toBe(fixture.response.body?.requestId);
    expect(fixture.response.headers.get("cache-control")).toBe("no-store");
  });

  it("sanitizes reflected targets in string arrays and error labels without logging exception text", () => {
    const request = { originalUrl: PRIVATE_TARGET, url: "/preview?token=other-secret" };
    const fixture = harness(request);
    fixture.filter.catch(
      new HttpException(
        {
          message: [`Не удалось открыть ${PRIVATE_TARGET}`, `Недоступно: ${request.url}`],
          error: PRIVATE_TARGET,
          internal: "body-secret",
        },
        503,
      ),
      fixture.host,
    );
    expect(fixture.response.body).toMatchObject({
      statusCode: 503,
      message: ["Не удалось открыть /api/decks/preview", "Недоступно: /preview"],
      error: "/api/decks/preview",
    });
    expect(JSON.stringify([fixture.logger.error.mock.calls, fixture.response.body])).not.toMatch(
      /token-secret|other-secret|body-secret|日本語の秘密/u,
    );
  });

  it.each([
    new Error(`Database connection failed ${PRIVATE_TARGET}`),
    PRIVATE_TARGET,
    { message: PRIVATE_TARGET, stack: "stack-secret" },
    null,
  ])(
    "uses private-safe fallback feedback for unknown errors %# even without middleware",
    (exception) => {
      const request = { url: PRIVATE_TARGET };
      const fixture = harness(request);
      fixture.filter.catch(exception, fixture.host);
      expect(fixture.response.statusCode).toBe(500);
      expect(fixture.response.body).toMatchObject({
        message: "Внутренняя ошибка сервера.",
        error: "InternalServerError",
        path: "/api/decks/preview",
        requestId: expect.stringMatching(UUID_V4),
      });
      expect(fixture.response.body?.requestId).toBe(fixture.response.headers.get("x-request-id"));
      expect(JSON.stringify([fixture.logger.error.mock.calls, fixture.response.body])).not.toMatch(
        /token-secret|answer-secret|stack-secret|日本語の秘密/u,
      );
      expect(randomUUID).toHaveBeenCalledOnce();
    },
  );

  it.each([
    [new HttpException("Доступ запрещён.", 403), "Доступ запрещён.", "HttpException"],
    [
      new HttpException({ message: 123, error: null }, 400),
      "Не удалось обработать запрос.",
      "HttpException",
    ],
  ])("retains existing exception normalization %#", (exception, message, error) => {
    const fixture = harness({});
    fixture.filter.catch(exception, fixture.host);
    expect(fixture.response.body).toMatchObject({
      statusCode: exception.getStatus(),
      message,
      error,
      path: "unknown",
    });
    expect(fixture.logger.error).not.toHaveBeenCalled();
  });
});

type ErrorBody = {
  statusCode: number;
  message: string | readonly string[];
  error: string;
  timestamp: string;
  path: string;
  requestId: string;
};

class ResponseFixture extends EventEmitter {
  statusCode = 200;
  readonly headers = new Map<string, string>();
  body?: ErrorBody;

  setHeader(name: string, value: string): void {
    this.headers.set(name.toLowerCase(), value);
  }

  status(statusCode: number) {
    this.statusCode = statusCode;
    return {
      json: (body: ErrorBody) => {
        this.body = body;
      },
    };
  }
}

function harness(request: { originalUrl?: string; url?: string }) {
  const response = new ResponseFixture();
  const logger = {
    log: vi.fn<(message: string, context?: string) => void>(),
    error: vi.fn<(message: string) => void>(),
  };
  const apiLogger = logger as unknown as ApiLogger;
  const host = {
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as ArgumentsHost;
  return {
    response,
    logger,
    host,
    next: vi.fn(),
    middleware: new RequestLoggerMiddleware(apiLogger),
    filter: new ApiExceptionFilter(apiLogger),
  };
}
