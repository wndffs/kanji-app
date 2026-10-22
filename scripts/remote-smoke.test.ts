import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { ReadableStream } from "node:stream/web";
import { TextEncoder } from "node:util";
import { pathToFileURL } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  main,
  MAX_BYTES,
  REQUEST_TIMEOUT_MS,
  RUN_TIMEOUT_MS,
  runRemoteSmoke,
  summarize,
  validateBaseUrl,
  writeReport,
} from "./remote-smoke.mjs";

const env = {
  STAGING_WEB_URL: "https://web.example.test",
  STAGING_API_URL: "https://api.example.test",
};
const id = "00000000-0000-4000-8000-000000000001";
const privateText = "PRIVATE-email@example.test-password-token-body";
const json = (value: unknown) => Response.json(value);
type Call = { path: string; init: RequestInit };
function fixture(
  override?: (path: string, init: RequestInit) => Response | Promise<Response> | undefined,
) {
  const calls: Call[] = [];
  const fetchImpl = vi.fn(async (input: string, init: RequestInit) => {
    const path = new URL(input).pathname;
    calls.push({ path, init });
    const replacement = override?.(path, init);
    if (replacement !== undefined) return await replacement;
    const responses: Record<string, unknown> = {
      "/api/health": { ok: true, service: "web" },
      "/health": { status: "ok", service: "kanji-srs-api" },
      "/ready": { service: "kanji-srs-api", status: "ready", database: "available" },
      "/auth/register": { accessToken: privateText },
      "/auth/login": { accessToken: privateText },
      "/auth/me": { settings: { reviewRemindersEnabled: false, reviewReminderHour: 9 } },
      "/users/me/review-reminders/claim": { shouldNotify: false },
      "/courses/available": { courses: [{ id, slug: "pilot" }], nextCursor: null },
      "/courses/enroll": { courses: [{ id, enrollmentStatus: "active" }], currentCourseId: null },
      "/courses/current": { courses: [{ id, enrollmentStatus: "active" }], currentCourseId: id },
      "/dashboard": { currentCourse: { id }, counts: { availableLessons: 1, dueReviews: 0 } },
      "/lessons/queue": { items: [{ item: { id } }] },
      "/reviews/queue": { items: [], orderMode: "shuffled", vacationStartedAt: null },
      "/characters": {
        kana: { hiragana: {}, katakana: {} },
        kanji: { items: [], counts: { total: 1 } },
      },
      [`/items/${id}`]: { id, cards: [], attributions: [] },
    };
    if (!(path in responses)) throw new Error(`Unexpected private URL ${input}`);
    return json(responses[path]);
  });
  return { calls, fetchImpl };
}

const directories: string[] = [];
async function temporary() {
  const directory = await mkdtemp(join(tmpdir(), "kanji-remote-smoke-"));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  for (const directory of directories.splice(0)) await rm(directory, { recursive: true });
});

describe("remote smoke safety", () => {
  it("imports without running the CLI or making requests", () => {
    const moduleUrl = pathToFileURL(resolve("scripts/remote-smoke.mjs")).href;
    const output = execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
      globalThis.fetch = () => { throw new Error("unexpected request"); };
      await import(${JSON.stringify(moduleUrl)});
      console.log("IMPORTED");
    `,
      ],
      { encoding: "utf8", timeout: 5000 },
    );
    expect(output).toBe("IMPORTED\n");
  });

  it.each([
    "https://example.test",
    "https://example.test:444/",
    "http://localhost:3000",
    "http://127.0.0.1",
    "http://[::1]:3001/",
  ])("accepts explicit safe origin %s", (url) => {
    expect(validateBaseUrl(url)).toBe(new URL(url).origin);
  });

  it.each([
    undefined,
    "",
    "http://example.test",
    "ftp://localhost",
    "http://127.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://localhost.evil",
    "http://localhost.",
    "http://127.0.0.2",
    "https://user:password@example.test",
    "https://@example.test",
    "https://example.test?secret",
    "https://example.test#secret",
    "https://example.test/route",
    "https:example.test",
    "https://example.test/..",
    " https://example.test",
    "https://exam\nple.test",
    "https://example.test\\evil",
  ])("rejects unsafe origin without echoing it: %s", (url) => {
    expect(() => validateBaseUrl(url)).toThrow("CONFIG_INVALID");
  });

  it.each([
    { STAGING_SMOKE_EMAIL: "private@example.test" },
    { STAGING_SMOKE_PASSWORD: privateText },
    { STAGING_SMOKE_EMAIL: "", STAGING_SMOKE_PASSWORD: privateText },
    { STAGING_SMOKE_EMAIL: "private@example.test", STAGING_SMOKE_PASSWORD: "" },
    { STAGING_SMOKE_SAMPLES: "4" },
    { STAGING_SMOKE_SAMPLES: "0" },
    { STAGING_SMOKE_SAMPLES: "1.5" },
    { STAGING_SMOKE_COURSE_SLUG: "../secret" },
    {
      STAGING_SMOKE_EMAIL: "private@example.test",
      STAGING_SMOKE_PASSWORD: privateText,
      STAGING_SMOKE_COURSE_SLUG: "pilot",
    },
  ])("fails unsafe configuration before any request", async (extra) => {
    const mock = fixture();
    const report = await runRemoteSmoke({ ...env, ...extra }, mock);
    expect(report.failure).toEqual({ code: "CONFIG_INVALID", step: "config", status: 0 });
    expect(mock.calls).toHaveLength(0);
  });

  it("samples sequentially, sanitizes reports and generates independent random credentials", async () => {
    const first = fixture();
    const report = await runRemoteSmoke(env, first);
    expect(report.ok).toBe(true);
    expect(report.samples).toHaveLength(15);
    expect(report.summary).toHaveLength(5);
    expect(report.samples.map((sample: { step: string }) => sample.step)).toEqual(
      ["dashboard", "lessons", "reviews", "characters", "item"].flatMap((step) => [
        step,
        step,
        step,
      ]),
    );
    for (const call of first.calls) {
      expect(call.init.redirect).toBe("error");
      expect(call.init.cache).toBe("no-store");
      expect(call.init.signal?.aborted).toBe(true);
    }
    const writes = first.calls.filter(({ init }) => init.method !== "GET");
    expect(writes.map(({ path }) => path)).toEqual([
      "/auth/register",
      "/users/me/review-reminders/claim",
    ]);
    const credentials = JSON.parse(writes[0].init.body as string);
    expect(credentials.email).toMatch(/^audit-[a-f0-9]{40}@example\.test$/u);
    expect(credentials.password).toMatch(/^[\w-]{43}$/u);
    expect(credentials).not.toHaveProperty("settings");
    const second = fixture();
    await runRemoteSmoke(env, second);
    expect(second.calls.find(({ path }) => path === "/auth/register")?.init.body).not.toBe(
      writes[0].init.body,
    );
    const serialized = JSON.stringify(report);
    for (const secret of [privateText, id, credentials.email, credentials.password, "example.test"])
      expect(serialized).not.toContain(secret);
    expect(
      report.samples.every(
        (sample: { bytes: number; elapsedMs: number }) => sample.bytes > 0 && sample.elapsedMs >= 0,
      ),
    ).toBe(true);
  });

  it.each(["1", "2"])("permits bounded sample override %s", async (samples) => {
    const report = await runRemoteSmoke({ ...env, STAGING_SMOKE_SAMPLES: samples }, fixture());
    expect(report.ok).toBe(true);
    expect(report.samples).toHaveLength(5 * Number(samples));
  });

  it("uses configured credentials only for login, with no fallback registration or other writes", async () => {
    const mock = fixture();
    const report = await runRemoteSmoke(
      { ...env, STAGING_SMOKE_EMAIL: "private@example.test", STAGING_SMOKE_PASSWORD: privateText },
      mock,
    );
    expect(report.ok).toBe(true);
    expect(mock.calls.filter(({ init }) => init.method !== "GET").map(({ path }) => path)).toEqual([
      "/auth/login",
    ]);
    const rejected = fixture((path) =>
      path === "/auth/login" ? new Response(privateText, { status: 401 }) : undefined,
    );
    const failure = await runRemoteSmoke(
      { ...env, STAGING_SMOKE_EMAIL: "private@example.test", STAGING_SMOKE_PASSWORD: privateText },
      rejected,
    );
    expect(failure.failure).toEqual({ code: "HTTP_ERROR", step: "login", status: 401 });
    expect(rejected.calls.at(-1)?.path).toBe("/auth/login");
  });

  it("never claims a reminder for an existing opted-in account", async () => {
    const mock = fixture((path) =>
      path === "/auth/me"
        ? json({ settings: { reviewRemindersEnabled: true, reviewReminderHour: 23 } })
        : undefined,
    );
    expect(
      (
        await runRemoteSmoke(
          {
            ...env,
            STAGING_SMOKE_EMAIL: "private@example.test",
            STAGING_SMOKE_PASSWORD: privateText,
          },
          mock,
        )
      ).ok,
    ).toBe(true);
    expect(mock.calls.filter(({ init }) => init.method !== "GET").map(({ path }) => path)).toEqual([
      "/auth/login",
    ]);
  });

  it.each([
    { reviewRemindersEnabled: true, reviewReminderHour: 9 },
    { reviewRemindersEnabled: false, reviewReminderHour: 24 },
    {
      reviewRemindersEnabled: false,
      reviewReminderHour: 9,
      reviewReminderLastClaimedAt: privateText,
    },
  ])(
    "rejects unsafe generated-profile reminder defaults without exposing metadata",
    async (settings) => {
      const mock = fixture((path) => (path === "/auth/me" ? json({ settings }) : undefined));
      const report = await runRemoteSmoke(env, mock);
      expect(report.failure).toEqual({
        code: "RESPONSE_INVALID",
        step: "reminder_preferences",
        status: 200,
      });
      expect(mock.calls.at(-1)?.path).toBe("/auth/me");
      expect(JSON.stringify(report)).not.toContain(privateText);
    },
  );

  it.each([{ shouldNotify: true }, { shouldNotify: false, private: privateText }])(
    "rejects a false-positive or nonminimal disabled claim response",
    async (response) => {
      const mock = fixture((path) =>
        path === "/users/me/review-reminders/claim" ? json(response) : undefined,
      );
      const report = await runRemoteSmoke(env, mock);
      expect(report.failure).toEqual({
        code: "RESPONSE_INVALID",
        step: "disabled_reminder_claim",
        status: 200,
      });
      expect(mock.calls.at(-1)?.path).toBe("/users/me/review-reminders/claim");
      expect(JSON.stringify(report)).not.toContain(privateText);
    },
  );

  it("enrolls/selects only an explicitly requested generated-profile course", async () => {
    const mock = fixture();
    expect((await runRemoteSmoke({ ...env, STAGING_SMOKE_COURSE_SLUG: "pilot" }, mock)).ok).toBe(
      true,
    );
    expect(
      mock.calls
        .filter(({ init }) => init.method !== "GET")
        .map(({ path, init }) => [path, init.method]),
    ).toEqual([
      ["/auth/register", "POST"],
      ["/courses/enroll", "POST"],
      ["/courses/current", "PATCH"],
      ["/users/me/review-reminders/claim", "POST"],
    ]);
    for (const { init } of mock.calls.filter(
      ({ path }) => path.startsWith("/courses/") && path !== "/courses/available",
    ))
      expect(JSON.parse(init.body as string)).toEqual({ courseId: id });
  });

  it("uses the validated keyset cursor on a later catalog page", async () => {
    const nextId = "00000000-0000-4000-8000-000000000021";
    let pages = 0;
    const mock = fixture((path) => {
      if (path !== "/courses/available") return;
      pages++;
      const courses =
        pages === 1
          ? Array.from({ length: 20 }, (_, index) => ({
              id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
              slug: "other",
            }))
          : [{ id: nextId, slug: "pilot" }];
      return json({ courses, nextCursor: pages === 1 ? courses.at(-1)!.id : null });
    });
    // Stop after enrollment confirmation; the fixture's generic enrollment has a different ID.
    const report = await runRemoteSmoke({ ...env, STAGING_SMOKE_COURSE_SLUG: "pilot" }, mock);
    expect(pages).toBe(2);
    expect(
      mock.fetchImpl.mock.calls.filter(([url]) => url.includes("/courses/available"))[1][0],
    ).toBe(`${env.STAGING_API_URL}/courses/available?cursor=00000000-0000-4000-8000-000000000020`);
    expect(
      JSON.parse(mock.calls.find(({ path }) => path === "/courses/enroll")!.init.body as string),
    ).toEqual({ courseId: nextId });
    expect(report.failure?.step).toBe("enroll");
  });

  it.each(["/courses/enroll", "/courses/current"])(
    "does not proceed after unconfirmed course write %s",
    async (path) => {
      const mock = fixture((candidate) =>
        candidate === path ? json({ courses: [], currentCourseId: null }) : undefined,
      );
      const report = await runRemoteSmoke({ ...env, STAGING_SMOKE_COURSE_SLUG: "pilot" }, mock);
      expect(report.failure?.code).toBe("RESPONSE_INVALID");
      expect(mock.calls.at(-1)?.path).toBe(path);
      expect(mock.calls.some(({ path }) => path === "/dashboard")).toBe(false);
    },
  );

  it("does not login or retry a failed generated registration", async () => {
    const mock = fixture((path) =>
      path === "/auth/register" ? new Response(privateText, { status: 409 }) : undefined,
    );
    const report = await runRemoteSmoke(env, mock);
    expect(report.failure).toEqual({ code: "HTTP_ERROR", step: "register", status: 409 });
    expect(mock.calls.filter(({ init }) => init.method !== "GET")).toHaveLength(1);
    expect(mock.calls.at(-1)?.path).toBe("/auth/register");
  });

  it("preserves the actual HTTP status for malformed registration confirmation", async () => {
    const mock = fixture((path) =>
      path === "/auth/register"
        ? new Response("{}", { status: 201, headers: { "Content-Type": "application/json" } })
        : undefined,
    );
    expect((await runRemoteSmoke(env, mock)).failure).toEqual({
      code: "RESPONSE_INVALID",
      step: "register",
      status: 201,
    });
  });

  it("bounds keyset lookup to five pages and rejects invalid/looping cursors or oversized catalogs", async () => {
    for (const mode of ["five", "repeat", "invalid", "oversized"]) {
      let pages = 0;
      const mock = fixture((path) => {
        if (path !== "/courses/available") return;
        pages++;
        const courses = Array.from({ length: mode === "oversized" ? 21 : 20 }, (_, index) => ({
          id: `00000000-0000-4000-8000-${String((mode === "repeat" ? 0 : (pages - 1) * 20) + index + 1).padStart(12, "0")}`,
          slug: "other",
        }));
        return json({
          courses,
          nextCursor: mode === "invalid" ? "private-cursor" : courses.at(-1)!.id,
        });
      });
      const report = await runRemoteSmoke({ ...env, STAGING_SMOKE_COURSE_SLUG: "missing" }, mock);
      expect(report.ok).toBe(false);
      expect(pages).toBeLessThanOrEqual(5);
      if (mode === "five") expect(pages).toBe(5);
      expect(mock.calls.filter(({ init }) => init.method !== "GET")).toHaveLength(1);
    }
  });

  it.each([
    "/api/health",
    "/health",
    "/ready",
    "/auth/register",
    "/auth/me",
    "/users/me/review-reminders/claim",
    "/dashboard",
    "/lessons/queue",
    "/reviews/queue",
    "/characters",
    `/items/${id}`,
  ])("rejects invalid essential response at %s", async (path) => {
    const mock = fixture((candidate) => (candidate === path ? json({ privateText }) : undefined));
    const report = await runRemoteSmoke(env, mock);
    expect(report.failure?.code).toBe("RESPONSE_INVALID");
    expect(JSON.stringify(report)).not.toContain(privateText);
    expect(mock.calls.at(-1)?.path).toBe(path);
  });

  it("never constructs an item URL from an unsafe lesson ID", async () => {
    const mock = fixture((path) =>
      path === "/lessons/queue" ? json({ items: [{ item: { id: "../../private" } }] }) : undefined,
    );
    expect((await runRemoteSmoke(env, mock)).failure?.step).toBe("lessons");
    expect(mock.calls.some(({ path }) => path.startsWith("/items/"))).toBe(false);
  });

  it.each([302, 401, 500])(
    "cancels unread error bodies and emits only code/step/status for %s",
    async (status) => {
      const cancel = vi.fn();
      const stream = new ReadableStream({ cancel });
      const mock = fixture(() => new Response(stream as never, { status }));
      const report = await runRemoteSmoke(env, mock);
      expect(report.failure).toEqual({
        code: status === 302 ? "REDIRECT_REJECTED" : "HTTP_ERROR",
        step: "web_health",
        status,
      });
      expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it("rejects a fetch implementation that already followed a redirect", async () => {
    const response = json({ ok: true, service: "web" });
    Object.defineProperty(response, "redirected", { value: true });
    const report = await runRemoteSmoke(
      env,
      fixture(() => response),
    );
    expect(report.failure).toEqual({ code: "REDIRECT_REJECTED", step: "web_health", status: 200 });
  });

  it("retains only completed sanitized samples after a later request fails", async () => {
    let requests = 0;
    const mock = fixture((path) => {
      if (path === "/dashboard" && ++requests === 2) throw new Error(privateText);
    });
    const report = await runRemoteSmoke(env, mock);
    expect(report.samples).toHaveLength(1);
    expect(report.failure).toEqual({ code: "REQUEST_FAILED", step: "dashboard", status: 0 });
    expect(JSON.stringify(report)).not.toContain(privateText);
    expect(mock.calls.at(-1)?.path).toBe("/dashboard");
  });

  it("sanitizes redirect fetch rejection and arbitrary exception messages", async () => {
    const print = vi.spyOn(console, "log").mockImplementation(() => {});
    const mock = {
      fetchImpl: vi.fn(async () => {
        throw new TypeError(privateText);
      }),
    };
    expect(await main(env, mock)).toBe(1);
    expect(print).toHaveBeenCalledExactlyOnceWith("REQUEST_FAILED step=web_health status=0");
  });

  it("prints only fixed measurement fields after a successful run", async () => {
    const print = vi.spyOn(console, "log").mockImplementation(() => {});
    expect(await main(env, fixture())).toBe(0);
    expect(print.mock.calls[0]).toEqual(["REMOTE_SMOKE_OK"]);
    const output = print.mock.calls[1]![0] as string;
    const measurements = JSON.parse(output.replace(/^REMOTE_MEASUREMENTS /u, ""));
    expect(Object.keys(measurements)).toEqual(["samples", "summary"]);
    expect(measurements.samples).toHaveLength(15);
    expect(measurements.summary).toHaveLength(5);
    expect(output).not.toContain(privateText);
    expect(output).not.toContain(id);
    expect(output).not.toContain("example.test");
  });

  it.each(["invalid-json", "wrong-type", "partial", "oversized"])(
    "bounds and cancels body reads: %s",
    async (mode) => {
      const cancel = vi.fn();
      const encoder = new TextEncoder();
      let pulls = 0;
      const stream = new ReadableStream({
        pull(controller) {
          pulls++;
          if (mode === "partial" && pulls > 1) {
            controller.error(new Error(privateText));
            return;
          }
          controller.enqueue(
            mode === "oversized" ? new Uint8Array(MAX_BYTES + 1) : encoder.encode("{private"),
          );
          if (mode !== "partial" && mode !== "oversized") controller.close();
        },
        cancel,
      });
      const mock = fixture(
        () =>
          new Response(stream as never, {
            headers: { "Content-Type": mode === "wrong-type" ? "text/html" : "application/json" },
          }),
      );
      const report = await runRemoteSmoke(env, mock);
      expect(report.failure?.code).toBe(
        mode === "partial"
          ? "REQUEST_FAILED"
          : mode === "oversized"
            ? "BODY_TOO_LARGE"
            : "RESPONSE_INVALID",
      );
      expect(JSON.stringify(report)).not.toContain(privateText);
      expect(stream.locked).toBe(false);
      if (mode === "oversized" || mode === "wrong-type") expect(cancel).toHaveBeenCalledOnce();
    },
  );

  it("accepts a complete JSON body exactly at the byte limit", async () => {
    const base = JSON.stringify({ ok: true, service: "web", pad: "" });
    const body = base.replace('"pad":""', `"pad":"${"x".repeat(MAX_BYTES - base.length)}"`);
    const mock = fixture((path) =>
      path === "/api/health"
        ? new Response(body, { headers: { "Content-Type": "application/json" } })
        : undefined,
    );
    expect((await runRemoteSmoke(env, mock)).ok).toBe(true);
  });

  it.each(["headers", "body"])(
    "enforces 75s deadline through %s and clears timers",
    async (mode) => {
      vi.useFakeTimers();
      const cancel = vi.fn();
      const stream = new ReadableStream({ cancel });
      const mock = fixture(() =>
        mode === "headers"
          ? new Promise<Response>(() => {})
          : new Response(stream as never, { headers: { "Content-Type": "application/json" } }),
      );
      const pending = runRemoteSmoke(env, mock);
      await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
      const report = await pending;
      expect(report.failure).toEqual({
        code: "REQUEST_TIMEOUT",
        step: "web_health",
        status: mode === "headers" ? 0 : 200,
      });
      expect(vi.getTimerCount()).toBe(0);
      expect(mock.calls[0].init.signal?.aborted).toBe(true);
      if (mode === "body") {
        expect(cancel).toHaveBeenCalledOnce();
        expect(stream.locked).toBe(false);
      }
    },
  );

  it("enforces the whole-run deadline across individually valid slow requests", async () => {
    vi.useFakeTimers();
    const mock = fixture();
    const pending = runRemoteSmoke(env, {
      fetchImpl: async (...args: Parameters<typeof mock.fetchImpl>) => {
        await new Promise((done) => setTimeout(done, 70_000));
        return mock.fetchImpl(...args);
      },
    });
    await vi.advanceTimersByTimeAsync(RUN_TIMEOUT_MS);
    const report = await pending;
    expect(report.failure?.code).toBe("RUN_DEADLINE");
    // The deliberately abort-ignoring fake has one outstanding delay, not a runner timer.
    await vi.runAllTimersAsync();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a late response even when a fetch implementation ignores abort", async () => {
    vi.useFakeTimers();
    const cancel = vi.fn();
    const stream = new ReadableStream({ cancel });
    const mock = fixture(
      () =>
        new Promise<Response>((done) =>
          setTimeout(() => done(new Response(stream as never)), REQUEST_TIMEOUT_MS + 1),
        ),
    );
    const pending = runRemoteSmoke(env, mock);
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect((await pending).failure?.code).toBe("REQUEST_TIMEOUT");
    await vi.advanceTimersByTimeAsync(1);
    expect(cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears all runner timers on an ordinary successful run", async () => {
    vi.useFakeTimers();
    expect((await runRemoteSmoke(env, fixture())).ok).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("reports warm excess without relabeling the first sample cold or fabricating p95", () => {
    const summary = summarize(
      [30_000, 3_000, 1_000].map((elapsedMs, index) => ({
        step: "dashboard",
        elapsedMs,
        index: index + 1,
        bytes: 10,
      })),
    );
    expect(summary).toEqual([
      {
        step: "dashboard",
        minMs: 1000,
        medianMs: 3000,
        maxMs: 30000,
        warmTargetMs: 2000,
        warmExceeded: true,
        warmSamples: 2,
      },
    ]);
    expect(summarize([{ step: "item", elapsedMs: 90000 }])[0].warmExceeded).toBe(false);
  });

  it("writes exclusively outside the repository and never replaces existing reports", async () => {
    const directory = await temporary();
    const path = join(directory, "report.json");
    const report = await runRemoteSmoke(env, fixture());
    await writeReport(path, report);
    expect(JSON.parse(await readFile(path, "utf8"))).toEqual(report);
    await expect(writeReport(path, report)).rejects.toThrow("REPORT_WRITE_FAILED");
    await expect(writeReport(resolve("forbidden-report.json"), report)).rejects.toThrow(
      "REPORT_WRITE_FAILED",
    );
    await expect(writeReport("relative.json", report)).rejects.toThrow("REPORT_WRITE_FAILED");
  });

  it("signals only the report written by this invocation, including sanitized failed runs", async () => {
    const directory = await temporary();
    const output = join(directory, "output");
    const reportPath = join(directory, "report.json");
    await writeFile(output, "");
    vi.spyOn(console, "log").mockImplementation(() => {});
    const config = { ...env, STAGING_SMOKE_REPORT_PATH: reportPath, GITHUB_OUTPUT: output };
    const mock = fixture(() => new Response(privateText, { status: 503 }));
    expect(await main(config, mock)).toBe(1);
    expect(await readFile(output, "utf8")).toBe("report_ready=true\n");
    expect(await readFile(reportPath, "utf8")).not.toContain(privateText);
    await writeFile(output, "");
    expect(await main(config, mock)).toBe(1);
    expect(await readFile(output, "utf8")).toBe("");
  });

  it("rejects an output directory symlink pointing back inside the repository", async () => {
    const directory = await temporary();
    const link = join(directory, "repository");
    await symlink(resolve("."), link, process.platform === "win32" ? "junction" : "dir");
    await expect(writeReport(join(link, "forbidden-report.json"), { ok: true })).rejects.toThrow(
      "REPORT_WRITE_FAILED",
    );
  });

  it("keeps manual workflow targets and exact report gating fixed", async () => {
    const workflow = await readFile(resolve(".github/workflows/remote-study-smoke.yml"), "utf8");
    expect(workflow).toContain("workflow_dispatch:");
    expect(workflow).not.toMatch(/schedule:|pull_request:|push:|secrets\.|npm ci|\*\.json/u);
    expect(workflow).toContain("timeout-minutes: 10");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("https://kanji-app-rho.vercel.app");
    expect(workflow).toContain("https://kanji-srs-api.onrender.com");
    expect(workflow).toContain("japanese-foundation-pilot-v1");
    expect(workflow).toContain("japanese-foundation-pilot-v2");
    expect(workflow).toContain("default: v1");
    expect(workflow).toContain("Unsupported pilot version.");
    expect(workflow).toContain("steps.audit.outputs.report_ready == 'true'");
    expect(workflow).toContain("path: ${{ runner.temp }}/remote-study-smoke.json");
  });
});
