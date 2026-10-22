import "reflect-metadata";

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { RequestMethod } from "@nestjs/common";
import { HEADERS_METADATA, METHOD_METADATA, PATH_METADATA } from "@nestjs/common/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HealthController } from "../src/health/health.controller";
import { HealthModule } from "../src/health/health.module";
import { HealthService } from "../src/health/health.service";
import { ReadinessController } from "../src/health/readiness.controller";
import { ReadinessService } from "../src/health/readiness.service";

const READY = { service: "kanji-srs-api", status: "ready", database: "available" };
const UNAVAILABLE = { service: "kanji-srs-api", status: "unavailable", database: "unavailable" };
const PRIVATE_ERROR = "postgresql://example-user:example-password@db.invalid/example?token=private";

describe("database readiness", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("returns HTTP 200 after a bounded transaction-local SELECT 1 without requiring Redis", async () => {
    const { service, transaction, tx } = createHarness();
    const status = vi.fn();
    const controller = new ReadinessController(service);

    await expect(controller.getReadiness({ status })).resolves.toEqual(READY);

    expect(status).toHaveBeenCalledWith(200);
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      timeout: 2_000,
      maxWait: 500,
    });
    expect(tx.$executeRaw.mock.calls[0][0].join("")).toBe("SET LOCAL statement_timeout = '1500ms'");
    expect(tx.$queryRaw.mock.calls[0][0].join("")).toBe("SELECT 1");
    expect(tx.$executeRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.$queryRaw.mock.invocationCallOrder[0],
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    new Error(PRIVATE_ERROR),
    PRIVATE_ERROR,
    { message: PRIVATE_ERROR, code: "driver-error" },
  ])("redacts database failures and returns HTTP 503 %#", async (failure) => {
    const { service, transaction } = createHarness();
    transaction.mockRejectedValueOnce(failure);
    const status = vi.fn();

    const result = await new ReadinessController(service).getReadiness({ status });

    expect(status).toHaveBeenCalledWith(503);
    expect(result).toEqual(UNAVAILABLE);
    expect(JSON.stringify(result)).not.toMatch(
      /postgresql|example-password|token|driver-error|stack/u,
    );
    expect(vi.getTimerCount()).toBe(0);
  });

  it("handles a synchronous Prisma initialization failure without exposing its error", async () => {
    const service = new ReadinessService({
      get db() {
        throw new Error(PRIVATE_ERROR);
      },
    } as never);

    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("shares one underlying query among simultaneous requests", async () => {
    const query = deferred<{ one: number }[]>();
    const { service, transaction, tx } = createHarness();
    tx.$queryRaw.mockReturnValueOnce(query.promise);
    const responses = Array.from({ length: 20 }, () => service.getReadiness());
    await vi.advanceTimersByTimeAsync(0);

    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    query.resolve([{ one: 1 }]);

    expect(await Promise.all(responses)).toEqual(Array.from({ length: 20 }, () => READY));
    expect(vi.getTimerCount()).toBe(0);
  });

  it("caches success for 7.5 seconds before checking the database again", async () => {
    const { service, transaction } = createHarness();

    await expect(service.getReadiness()).resolves.toEqual(READY);
    await vi.advanceTimersByTimeAsync(7_499);
    await expect(service.getReadiness()).resolves.toEqual(READY);
    expect(transaction).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(service.getReadiness()).resolves.toEqual(READY);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("caches failure and recovers after the failure cache expires", async () => {
    const { service, transaction } = createHarness();
    transaction.mockRejectedValueOnce(new Error(PRIVATE_ERROR));

    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    await vi.advanceTimersByTimeAsync(7_499);
    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    expect(transaction).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    await expect(service.getReadiness()).resolves.toEqual(READY);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("bounds connection-startup responses without accumulating probes after cache expiry", async () => {
    const connection = deferred<void>();
    const { service, transaction, tx } = createHarness();
    transaction.mockImplementationOnce(() => connection.promise);
    const status = vi.fn();
    let answered = false;
    const response = new ReadinessController(service).getReadiness({ status }).then((result) => {
      answered = true;
      return result;
    });

    await vi.advanceTimersByTimeAsync(2_999);
    expect(answered).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(response).resolves.toEqual(UNAVAILABLE);
    expect(status).toHaveBeenCalledWith(503);

    await vi.advanceTimersByTimeAsync(30_000);
    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).not.toHaveBeenCalled();

    connection.reject(new Error(PRIVATE_ERROR));
    await vi.advanceTimersByTimeAsync(0);
    await expect(service.getReadiness()).resolves.toEqual(READY);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it("retains single-flight ownership when a transaction rejects before its query callback settles", async () => {
    const outerTransaction = deferred<void>();
    const query = deferred<{ one: number }[]>();
    const { service, transaction, tx } = createHarness();
    tx.$queryRaw.mockReturnValueOnce(query.promise);
    transaction.mockImplementationOnce((callback) => {
      void callback(tx).catch(() => undefined);
      return outerTransaction.promise;
    });

    const response = service.getReadiness();
    await vi.advanceTimersByTimeAsync(0);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    outerTransaction.reject(new Error("transaction execution expired"));
    await vi.advanceTimersByTimeAsync(3_000);
    await expect(response).resolves.toEqual(UNAVAILABLE);

    await vi.advanceTimersByTimeAsync(30_000);
    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    query.reject(new Error(PRIVATE_ERROR));
    await vi.advanceTimersByTimeAsync(0);
    await expect(service.getReadiness()).resolves.toEqual(READY);
    expect(transaction).toHaveBeenCalledTimes(2);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("does not promote a late successful query or extend the timed-out failure cache", async () => {
    const query = deferred<{ one: number }[]>();
    const { service, transaction, tx } = createHarness();
    tx.$queryRaw.mockReturnValueOnce(query.promise);
    const response = service.getReadiness();

    await vi.advanceTimersByTimeAsync(3_000);
    await expect(response).resolves.toEqual(UNAVAILABLE);
    await vi.advanceTimersByTimeAsync(7_499);
    query.resolve([{ one: 1 }]);
    await vi.advanceTimersByTimeAsync(0);

    await expect(service.getReadiness()).resolves.toEqual(UNAVAILABLE);
    expect(transaction).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await expect(service.getReadiness()).resolves.toEqual(READY);
    expect(transaction).toHaveBeenCalledTimes(2);
  });
});

describe("readiness endpoint wiring", () => {
  it("keeps deployment-aware liveness non-cacheable without a database query", () => {
    expect(
      Reflect.getMetadata(HEADERS_METADATA, HealthController.prototype.getHealth),
    ).toContainEqual({
      name: "Cache-Control",
      value: "no-store",
    });
  });

  it("registers a separate GET /ready with non-cacheable HTTP responses", () => {
    const method = ReadinessController.prototype.getReadiness;
    expect(Reflect.getMetadata(PATH_METADATA, method)).toBe("ready");
    expect(Reflect.getMetadata(METHOD_METADATA, method)).toBe(RequestMethod.GET);
    expect(Reflect.getMetadata(HEADERS_METADATA, method)).toContainEqual({
      name: "Cache-Control",
      value: "no-store",
    });
    expect(Reflect.getMetadata("controllers", HealthModule)).toEqual([
      HealthController,
      ReadinessController,
    ]);
    expect(Reflect.getMetadata("providers", HealthModule)).toEqual([
      HealthService,
      ReadinessService,
    ]);
  });

  it("keeps Render on liveness so continuous checks do not keep Neon awake", () => {
    const render = readFileSync(join(__dirname, "../../../render.yaml"), "utf8");
    expect(render).toContain("healthCheckPath: /health");
    expect(render).not.toContain("healthCheckPath: /ready");
  });
});

function createHarness() {
  const tx = {
    $executeRaw: vi.fn(async (_sql: TemplateStringsArray) => 0),
    $queryRaw: vi.fn(async (_sql: TemplateStringsArray) => [{ one: 1 }]),
  };
  const transaction = vi.fn(
    async (
      callback: (client: typeof tx) => Promise<void>,
      _options: { timeout: number; maxWait: number },
    ) => callback(tx),
  );
  const service = new ReadinessService({ db: { $transaction: transaction } } as never);

  return { service, transaction, tx };
}

function deferred<Value>() {
  let resolve!: (value: Value | PromiseLike<Value>) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<Value>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
}
