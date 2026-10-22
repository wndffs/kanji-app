import { randomBytes } from "node:crypto";
import { appendFile, open, realpath } from "node:fs/promises";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance } from "node:perf_hooks";
import { TextDecoder } from "node:util";

/* global AbortController */
export const MAX_BYTES = 2 * 1024 * 1024;
export const REQUEST_TIMEOUT_MS = 75_000;
export const RUN_TIMEOUT_MS = 300_000;
export const WARM_TARGET_MS = 2_000;
const repository = fileURLToPath(new URL("../", import.meta.url));
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/iu.test(value);
const record = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const count = (value) => Number.isSafeInteger(value) && value >= 0;

class SmokeFailure extends Error {
  constructor(code, step, status = 0) {
    super(code);
    this.failure = { code, step, status };
  }
}

function requireShape(condition, step, status = 200) {
  if (!condition) throw new SmokeFailure("RESPONSE_INVALID", step, status);
}

export function validateBaseUrl(value) {
  try {
    if (typeof value !== "string" || /[\s\\?#@]/u.test(value)) throw new Error();
    const url = new URL(value);
    const authority = value.match(/^https?:\/\/([^/]+)\/?$/u)?.[1];
    if (!authority) throw new Error();
    // URL normalizes alternate IPv4 spellings; check the original authority too.
    const loopback = /^(localhost|127\.0\.0\.1|\[::1\])(?::[0-9]+)?$/u.test(authority ?? "");
    if (
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new SmokeFailure("CONFIG_INVALID", "config");
  }
}

function configuration(env) {
  const web = validateBaseUrl(env.STAGING_WEB_URL);
  const api = validateBaseUrl(env.STAGING_API_URL);
  const email = env.STAGING_SMOKE_EMAIL;
  const password = env.STAGING_SMOKE_PASSWORD;
  const generated = email === undefined && password === undefined;
  const slug = env.STAGING_SMOKE_COURSE_SLUG;
  const samples = Number(env.STAGING_SMOKE_SAMPLES ?? 3);
  if (
    (!generated &&
      (typeof email !== "string" ||
        !email.trim() ||
        typeof password !== "string" ||
        !password.trim())) ||
    (slug !== undefined && (!generated || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(slug))) ||
    !Number.isInteger(samples) ||
    samples < 1 ||
    samples > 3
  )
    throw new SmokeFailure("CONFIG_INVALID", "config");
  return {
    web,
    api,
    generated,
    slug,
    samples,
    email: generated ? `audit-${randomBytes(20).toString("hex")}@example.test` : email,
    password: generated ? randomBytes(32).toString("base64url") : password,
  };
}

export function summarize(samples) {
  return [...new Set(samples.map(({ step }) => step))].map((step) => {
    const entries = samples.filter((sample) => sample.step === step);
    const sorted = entries.map(({ elapsedMs }) => elapsedMs).sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return {
      step,
      minMs: sorted[0],
      medianMs: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
      maxMs: sorted.at(-1),
      warmTargetMs: WARM_TARGET_MS,
      warmExceeded: entries.slice(1).some(({ elapsedMs }) => elapsedMs > WARM_TARGET_MS),
      warmSamples: Math.max(0, entries.length - 1),
    };
  });
}

export async function runRemoteSmoke(env, { fetchImpl = fetch } = {}) {
  const samples = [];
  let failure;
  let step = "config";
  const run = new AbortController();
  const runTimer = globalThis.setTimeout(() => run.abort(), RUN_TIMEOUT_MS);
  try {
    const config = configuration(env);
    let token;
    let selectedCourseId;
    async function request(label, path, { method = "GET", body, web = false } = {}) {
      step = label;
      if (run.signal.aborted) throw new SmokeFailure("RUN_DEADLINE", step);
      const controller = new AbortController();
      const abortRun = () => controller.abort();
      run.signal.addEventListener("abort", abortRun, { once: true });
      const timer = globalThis.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      let reader;
      let response;
      let complete = false;
      let status = 0;
      let rejectAbort;
      const aborted = new Promise((_, reject) => {
        rejectAbort = () =>
          reject(
            new SmokeFailure(
              run.signal.aborted ? "RUN_DEADLINE" : "REQUEST_TIMEOUT",
              label,
              status,
            ),
          );
        controller.signal.addEventListener("abort", rejectAbort, { once: true });
      });
      const started = performance.now();
      try {
        const pendingResponse = Promise.resolve(
          fetchImpl(`${web ? config.web : config.api}${path}`, {
            method,
            headers: {
              Accept: "application/json",
              ...(body === undefined ? {} : { "Content-Type": "application/json" }),
              ...(token && !web ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            cache: "no-store",
            redirect: "error",
            signal: controller.signal,
          }),
        ).then((incoming) => {
          if (controller.signal.aborted) {
            if (incoming.body) void incoming.body.cancel().catch(() => {});
            throw new SmokeFailure(run.signal.aborted ? "RUN_DEADLINE" : "REQUEST_TIMEOUT", label);
          }
          return incoming;
        });
        response = await Promise.race([pendingResponse, aborted]);
        status = response.status;
        if (response.redirected || (status >= 300 && status < 400))
          throw new SmokeFailure("REDIRECT_REJECTED", label, status);
        if (!response.ok) throw new SmokeFailure("HTTP_ERROR", label, status);
        if (
          response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
          "application/json"
        )
          throw new SmokeFailure("RESPONSE_INVALID", label, status);
        reader = response.body?.getReader();
        if (!reader) throw new SmokeFailure("RESPONSE_INVALID", label, status);
        const decoder = new TextDecoder("utf-8", { fatal: true });
        let text = "";
        let bytes = 0;
        for (;;) {
          const chunk = await Promise.race([reader.read(), aborted]);
          if (chunk.done) break;
          bytes += chunk.value.byteLength;
          if (bytes > MAX_BYTES) throw new SmokeFailure("BODY_TOO_LARGE", label, status);
          text += decoder.decode(chunk.value, { stream: true });
        }
        text += decoder.decode();
        let value;
        try {
          value = JSON.parse(text);
        } catch {
          throw new SmokeFailure("RESPONSE_INVALID", label, status);
        }
        complete = true;
        return { value, status, elapsedMs: Math.round(performance.now() - started), bytes };
      } catch (error) {
        if (error instanceof SmokeFailure) throw error;
        throw new SmokeFailure("REQUEST_FAILED", label, status);
      } finally {
        globalThis.clearTimeout(timer);
        run.signal.removeEventListener("abort", abortRun);
        controller.signal.removeEventListener("abort", rejectAbort);
        controller.abort();
        // Never wait indefinitely for cancellation of a broken stream.
        if (!complete) {
          if (reader) void reader.cancel().catch(() => {});
          else if (response?.body) void response.body.cancel().catch(() => {});
        }
        if (reader) {
          try {
            reader.releaseLock();
          } catch {
            /* Timed-out read still settling. */
          }
        }
      }
    }
    const webHealth = (await request("web_health", "/api/health", { web: true })).value;
    requireShape(webHealth?.ok === true && webHealth.service === "web", step);
    const health = (await request("api_health", "/health")).value;
    requireShape(health?.status === "ok" && health.service === "kanji-srs-api", step);
    const ready = (await request("api_ready", "/ready")).value;
    requireShape(
      ready?.status === "ready" &&
        ready.database === "available" &&
        ready.service === "kanji-srs-api",
      step,
    );
    const authentication = await request(
      config.generated ? "register" : "login",
      config.generated ? "/auth/register" : "/auth/login",
      {
        method: "POST",
        body: {
          email: config.email,
          password: config.password,
          ...(config.generated ? { displayName: "Remote audit" } : {}),
        },
      },
    );
    const session = authentication.value;
    requireShape(
      typeof session?.accessToken === "string" && session.accessToken.length > 0,
      step,
      authentication.status,
    );
    token = session.accessToken;
    if (config.slug !== undefined) {
      let cursor;
      let courseId;
      const seen = new Set();
      for (let page = 0; page < 5; page++) {
        const catalog = (
          await request("catalog", `/courses/available${cursor ? `?cursor=${cursor}` : ""}`)
        ).value;
        requireShape(
          Array.isArray(catalog?.courses) &&
            catalog.courses.length <= 20 &&
            catalog.courses.every(
              (course) => uuid(course?.id) && typeof course.slug === "string",
            ) &&
            (catalog.nextCursor === null || uuid(catalog.nextCursor)),
          step,
        );
        let previous = cursor;
        for (const course of catalog.courses) {
          requireShape(
            previous === undefined || course.id.toLowerCase() > previous.toLowerCase(),
            step,
          );
          previous = course.id;
        }
        requireShape(
          catalog.nextCursor === null ||
            (catalog.courses.length === 20 && catalog.nextCursor === previous),
          step,
        );
        const match = catalog.courses.find((course) => course.slug === config.slug);
        if (match) {
          courseId = match.id;
          break;
        }
        if (catalog.nextCursor === null) break;
        requireShape(!seen.has(catalog.nextCursor), step);
        seen.add(catalog.nextCursor);
        cursor = catalog.nextCursor;
      }
      if (!courseId) throw new SmokeFailure("COURSE_NOT_FOUND", "catalog");
      for (const [label, path, method] of [
        ["enroll", "/courses/enroll", "POST"],
        ["select_course", "/courses/current", "PATCH"],
      ]) {
        const selection = await request(label, path, { method, body: { courseId } });
        const selected = selection.value;
        requireShape(
          Array.isArray(selected?.courses) &&
            selected.courses.some(
              (course) => course?.id === courseId && course.enrollmentStatus === "active",
            ) &&
            (label !== "select_course" || selected.currentCourseId === courseId),
          step,
          selection.status,
        );
      }
      selectedCourseId = courseId;
    }
    async function measure(label, path, validate) {
      let first;
      for (let index = 1; index <= config.samples; index++) {
        const { value, status, elapsedMs, bytes } = await request(label, path);
        requireShape(validate(value), label, status);
        samples.push({ step: label, index, elapsedMs, bytes });
        if (index === 1) first = value;
      }
      return first;
    }
    await measure(
      "dashboard",
      "/dashboard",
      (value) =>
        uuid(value?.currentCourse?.id) &&
        (selectedCourseId === undefined || value.currentCourse.id === selectedCourseId) &&
        count(value?.counts?.availableLessons) &&
        count(value?.counts?.dueReviews) &&
        (!config.generated || value.counts.dueReviews === 0),
    );
    const lessons = await measure(
      "lessons",
      "/lessons/queue",
      (value) =>
        Array.isArray(value?.items) &&
        value.items.length > 0 &&
        value.items.every((entry) => uuid(entry?.item?.id)),
    );
    await measure(
      "reviews",
      "/reviews/queue",
      (value) =>
        Array.isArray(value?.items) &&
        (!config.generated || value.items.length === 0) &&
        ["shuffled", "oldest-first", "lower-levels-first"].includes(value?.orderMode) &&
        (value.vacationStartedAt === null || typeof value.vacationStartedAt === "string"),
    );
    await measure(
      "characters",
      "/characters",
      (value) =>
        record(value?.kana?.hiragana) &&
        record(value?.kana?.katakana) &&
        Array.isArray(value?.kanji?.items) &&
        count(value?.kanji?.counts?.total),
    );
    const itemId = lessons.items[0].item.id;
    await measure(
      "item",
      `/items/${itemId}`,
      (value) =>
        value?.id === itemId && Array.isArray(value?.cards) && Array.isArray(value?.attributions),
    );
  } catch (error) {
    failure =
      error instanceof SmokeFailure ? error.failure : { code: "RUN_FAILED", step, status: 0 };
  } finally {
    globalThis.clearTimeout(runTimer);
    run.abort();
  }
  return {
    ok: failure === undefined,
    ...(failure ? { failure } : {}),
    samples,
    summary: summarize(samples),
  };
}

export async function writeReport(path, report) {
  try {
    if (typeof path !== "string" || !isAbsolute(path)) throw new Error();
    const parent = await realpath(dirname(path));
    const root = await realpath(repository);
    const target = resolve(parent, path.split(/[\\/]/u).at(-1));
    const inside = relative(root, target);
    if (!inside || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside)))
      throw new Error();
    const file = await open(target, "wx", 0o600);
    try {
      await file.writeFile(`${JSON.stringify(report, null, 2)}\n`);
    } finally {
      await file.close();
    }
  } catch {
    throw new SmokeFailure("REPORT_WRITE_FAILED", "report");
  }
}

export async function main(env = process.env, options = {}) {
  let report;
  try {
    report = await runRemoteSmoke(env, options);
    if (env.STAGING_SMOKE_REPORT_PATH !== undefined) {
      await writeReport(env.STAGING_SMOKE_REPORT_PATH, report);
      if (env.GITHUB_OUTPUT) await appendFile(env.GITHUB_OUTPUT, "report_ready=true\n");
    }
  } catch {
    report = { ok: false, failure: { code: "REPORT_WRITE_FAILED", step: "report", status: 0 } };
  }
  if (report.ok) {
    console.log("REMOTE_SMOKE_OK");
    console.log(
      `REMOTE_MEASUREMENTS ${JSON.stringify({ samples: report.samples, summary: report.summary })}`,
    );
  } else
    console.log(
      `${report.failure.code} step=${report.failure.step} status=${report.failure.status}`,
    );
  return report.ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.exitCode = await main();
}
