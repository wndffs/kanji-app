import { EventEmitter } from "node:events";
import type { ChildProcessWithoutNullStreams, SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readdir, rmdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { Prisma, PrismaClient } from "@prisma/client";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  buildRestoreCommand,
  compareRestoreInventories,
  configureRestoreFingerprintReader,
  DatabaseRestoreError,
  executeRestoreCommand,
  quoteRestoreTable,
  readRestoreEnvironment,
  readRestoreTableFingerprint,
  RESTORE_LIMITS,
  RestoreArchiveSink,
  restoreFailureReport,
  runDatabaseRestore,
  validateRestoreConnections,
  validateRestoreTempRoot,
  type ProcessOptions,
  type RestoreCommand,
} from "../src/database-restore";

const SOURCE =
  "postgresql://reader:synthetic-source-password@ep-fixture.eu-central-1.aws.neon.tech/neondb?sslmode=require";
const TARGET = "postgresql://kanji_restore:synthetic-local-password@127.0.0.1:5432/kanji_restore";
const CONTAINER = "a".repeat(64);
const SNAPSHOT = "00000003-0000001B-1";
const TABLE_SHA256 = "a".repeat(64);
const CONFIG = () => validateRestoreConnections(SOURCE, TARGET, CONTAINER);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("restore connection and command boundaries", () => {
  it("accepts only the fixed isolated target and direct SSL Neon source", () => {
    expect(CONFIG().target.host).toBe("127.0.0.1");
    expect(() => validateRestoreConnections(TARGET, TARGET, CONTAINER)).toThrow("INVALID_TARGET");
    expect(() => validateRestoreConnections(SOURCE, SOURCE, CONTAINER)).toThrow("INVALID_TARGET");
  });
  it.each([
    TARGET.replace("127.0.0.1", "localhost"),
    TARGET.replace("127.0.0.1", "127.0.0.2"),
    TARGET.replace("127.0.0.1", "remote.example"),
    TARGET.replace("5432", "5433"),
    TARGET.replace("5432/kanji_restore", "5432/neondb"),
    `${TARGET}?schema=public`,
    `${TARGET}?host=remote.example`,
    `${TARGET}?hostaddr=1.2.3.4`,
    `${TARGET}?service=remote`,
    `${TARGET}?options=-csearch_path=other`,
    `${TARGET}#fragment`,
    `${TARGET}#`,
    TARGET.replace("127.0.0.1", "[::1]"),
  ])("rejects target routing ambiguity: %s", (target) => {
    expect(() => validateRestoreConnections(SOURCE, target, CONTAINER)).toThrow();
  });
  it.each([
    SOURCE.replace("ep-fixture.", "ep-fixture-pooler."),
    SOURCE.replace("neon.tech", "neon.tech.evil.example"),
    SOURCE.replace("sslmode=require", "sslmode=disable"),
    SOURCE.replace("?sslmode=require", ""),
    `${SOURCE}&host=remote`,
    `${SOURCE}&dbname=other`,
    `${SOURCE}&options=-crole=other`,
    `${SOURCE}&sslmode=verify-full`,
    `${SOURCE}&schema=private`,
    `${SOURCE}&pgbouncer=true`,
  ])("rejects unsafe source routes and SSL settings: %s", (source) => {
    expect(() => validateRestoreConnections(source, TARGET, CONTAINER)).toThrow();
  });
  it.each(["", "a".repeat(12), "A".repeat(64), `${CONTAINER};whoami`, `--${CONTAINER}`])(
    "rejects an invalid service container identifier",
    (container) => {
      expect(() => validateRestoreConnections(SOURCE, TARGET, container)).toThrow(
        "INVALID_CONTAINER",
      );
    },
  );
  it("does not feed Prisma pool/schema parameters or any URL/credential into tool arguments", () => {
    const config = validateRestoreConnections(
      `${SOURCE}&schema=public&pool_timeout=15&connection_limit=2&channel_binding=require`,
      TARGET,
      CONTAINER,
    );
    const dump = buildRestoreCommand(config, "dump", SNAPSHOT);
    const restore = buildRestoreCommand(config, "restore");
    expect(dump.env.PGDATABASE).toBe("neondb");
    expect(dump.env.PGSSLMODE).toBe("require");
    expect(dump.env.PGCHANNELBINDING).toBe("require");
    expect(dump.env.PGOPTIONS).toContain("default_transaction_read_only=on");
    expect(restore.env.PGHOST).toBe("127.0.0.1");
    expect(restore.env.PGDATABASE).toBe("kanji_restore");
    expect(restore.env.PGOPTIONS).toContain("log_min_messages=panic");
    expect(restore.env.PGOPTIONS).toContain("log_min_error_statement=panic");
    expect(dump.env.PGOPTIONS).not.toContain("log_min_messages");
    for (const command of [dump, restore]) {
      expect(command.args).toContain("--schema=public");
      expect(command.args).not.toContain("--clean");
      expect(command.args).not.toContain("--create");
      expect(command.args.join(" ")).not.toMatch(
        /postgresql:|synthetic-source-password|synthetic-local-password|neon\.tech|pool_timeout|\?schema=/u,
      );
      expect(Object.keys(command.env).every((key) => key.startsWith("PG"))).toBe(true);
    }
    expect(dump.args).toContain(`--snapshot=${SNAPSHOT}`);
    expect(restore.args).toContain("--exit-on-error");
    expect(restore.args).toContain("--single-transaction");
    expect(restore.args).toContain("--dbname=kanji_restore");
  });
  it.each(["", "one;two", `${SNAPSHOT}\n--clean`, "00000003-0000001B-0"])(
    "rejects a malformed exported snapshot",
    (snapshot) => {
      expect(() => buildRestoreCommand(CONFIG(), "dump", snapshot)).toThrow("INVALID_SNAPSHOT");
    },
  );
  it("requires GHA Linux and explicit source/target variables, never DATABASE_URL fallback", () => {
    const env = {
      GITHUB_ACTIONS: "true",
      RUNNER_OS: "Linux",
      SOURCE_DATABASE_URL: SOURCE,
      INTEGRATION_RESTORE_DATABASE_URL: TARGET,
      RESTORE_POSTGRES_CONTAINER_ID: CONTAINER,
      RUNNER_TEMP: tmpdir(),
      GITHUB_WORKSPACE: process.cwd(),
    };
    expect(readRestoreEnvironment(env).config.containerId).toBe(CONTAINER);
    expect(() =>
      readRestoreEnvironment({ ...env, SOURCE_DATABASE_URL: "", DATABASE_URL: SOURCE }),
    ).toThrow("INVALID_CONFIGURATION");
    expect(() => readRestoreEnvironment({ ...env, RUNNER_OS: "Windows" })).toThrow(
      "INVALID_CONFIGURATION",
    );
    expect(() => readRestoreEnvironment({ ...env, GITHUB_ACTIONS: "false" })).toThrow(
      "INVALID_CONFIGURATION",
    );
  });
  it("rejects repository-local scratch directories", async () => {
    await expect(validateRestoreTempRoot(process.cwd(), process.cwd())).rejects.toThrow(
      "UNSAFE_TEMP_DIRECTORY",
    );
  });
  it("quotes only generated app model tables and the migration ledger", () => {
    expect(quoteRestoreTable("UserSrsState")).toBe('"public"."UserSrsState"');
    expect(quoteRestoreTable("_prisma_migrations")).toBe('"public"."_prisma_migrations"');
    for (const name of ["pg_authid", "unknown", 'User";DROP TABLE "User', "other.User", "User\n"])
      expect(() => quoteRestoreTable(name)).toThrow("UNSUPPORTED_TABLE");
  });
  it("emits only allowlisted failure codes, never arbitrary diagnostics or object fields", () => {
    expect(restoreFailureReport(new Error(`${SOURCE} password secret row-data`))).toEqual({
      schemaVersion: 2,
      scope: "public-table-content-rehearsal",
      status: "failed",
      code: "REHEARSAL_FAILED",
    });
    const known = new DatabaseRestoreError("PROCESS_FAILED");
    known.message = SOURCE;
    expect(JSON.stringify(restoreFailureReport(known))).not.toContain("reader");
    Object.assign(known, { code: SOURCE });
    expect(restoreFailureReport(known).code).toBe("REHEARSAL_FAILED");
  });
  it("compares the complete table inventory, decimal counts and content digests without comparing server versions", () => {
    const source = {
      version: 170000,
      tables: [{ name: "User", rows: "10", sha256: TABLE_SHA256 }],
    };
    expect(() => compareRestoreInventories(source, { ...source, version: 180000 })).not.toThrow();
    expect(() => compareRestoreInventories(source, { ...source, tables: [] })).toThrow(
      "INVALID_INVENTORY",
    );
    expect(() =>
      compareRestoreInventories(source, {
        ...source,
        tables: [{ name: "User", rows: "9", sha256: TABLE_SHA256 }],
      }),
    ).toThrow("INVENTORY_MISMATCH");
    expect(() =>
      compareRestoreInventories(source, {
        ...source,
        tables: [{ ...source.tables[0], sha256: "b".repeat(64) }],
      }),
    ).toThrow("INVENTORY_MISMATCH");
  });
});

describe("database-only content fingerprints", () => {
  const reader = (
    counts: unknown,
    fingerprints: unknown = [{ name: "User", sha256: TABLE_SHA256 }],
  ) => ({
    $executeRaw: vi.fn(async () => 0),
    $queryRaw: vi.fn().mockResolvedValueOnce(counts).mockResolvedValueOnce(fingerprints),
  });
  it("counts first, hashes all columns in PostgreSQL and exports only the aggregate", async () => {
    const db = reader([{ name: "User", rows: "1000000" }]);
    const result = await readRestoreTableFingerprint(db as never, "User");
    expect(result).toEqual({ name: "User", rows: "1000000", sha256: TABLE_SHA256 });
    const countQuery = db.$queryRaw.mock.calls[0][0] as Prisma.Sql;
    const hashQuery = db.$queryRaw.mock.calls[1][0] as Prisma.Sql;
    expect(countQuery.sql).toContain("pg_catalog.count(*)");
    expect(countQuery.sql).not.toContain("sha256");
    expect(hashQuery.sql).toContain('FROM "public"."User" AS row_value');
    expect(hashQuery.sql).toContain("pg_catalog.to_jsonb(row_value)::text");
    expect(hashQuery.sql).toContain('ORDER BY row_digest COLLATE pg_catalog."C"');
    expect(hashQuery.sql).toContain("pg_catalog.string_agg(row_digest, ''");
    expect(hashQuery.sql.match(/pg_catalog.sha256\(/gu)).toHaveLength(2);
    expect(hashQuery.sql.match(/pg_catalog.convert_to\(/gu)).toHaveLength(2);
    expect(hashQuery.sql).not.toMatch(/DISTINCT|md5|digest\(|json_agg/u);
    expect(hashQuery.values).toEqual(["User"]);
    expect(hashQuery.sql).toContain("COALESCE(");
    expect(JSON.stringify(result)).not.toContain("row_digest");
  });
  it.each([
    undefined,
    null,
    [],
    [{}],
    [{ name: "other", rows: "1" }],
    [{ name: "User", rows: undefined }],
    ...["-1", "01", "1.0", "private-value", "999999999999999999999", 1, null].map((rows) => [
      { name: "User", rows },
    ]),
    [
      { name: "User", rows: "1" },
      { name: "User", rows: "1" },
    ],
  ])("rejects malformed count results before any hash query %#", async (counts) => {
    const db = reader(counts);
    await expect(readRestoreTableFingerprint(db as never, "User")).rejects.toThrow(
      "INVALID_INVENTORY",
    );
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
  });
  it.each(["1000001", "99999999999999999999"])(
    "rejects over-cap count %s before aggregation",
    async (rows) => {
      const db = reader([{ name: "User", rows }]);
      await expect(readRestoreTableFingerprint(db as never, "User")).rejects.toThrow(
        "ROW_LIMIT_EXCEEDED",
      );
      expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    undefined,
    null,
    [],
    [{}],
    [{ name: "other", sha256: TABLE_SHA256 }],
    ...[
      undefined,
      "",
      "a".repeat(63),
      "a".repeat(65),
      "g".repeat(64),
      "A".repeat(64),
      SOURCE,
      [TABLE_SHA256],
    ].map((sha256) => [{ name: "User", sha256 }]),
    [
      { name: "User", sha256: TABLE_SHA256 },
      { name: "User", sha256: TABLE_SHA256 },
    ],
  ])("rejects missing, per-row-list or malformed aggregate results %#", async (fingerprints) => {
    const db = reader([{ name: "User", rows: "0" }], fingerprints);
    // Explicit undefined must remain a malformed mocked database response.
    db.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ name: "User", rows: "0" }])
      .mockResolvedValueOnce(fingerprints);
    await expect(readRestoreTableFingerprint(db as never, "User")).rejects.toThrow(
      "INVALID_INVENTORY",
    );
  });
  it("uses deterministic empty aggregate and does not query unsupported identifiers", async () => {
    const empty = createHash("sha256").update("").digest("hex");
    const db = reader([{ name: "User", rows: "0" }], [{ name: "User", sha256: empty }]);
    expect((await readRestoreTableFingerprint(db as never, "User")).sha256).toBe(empty);
    db.$queryRaw.mockClear();
    await expect(readRestoreTableFingerprint(db as never, 'User"; private')).rejects.toThrow(
      "UNSUPPORTED_TABLE",
    );
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });
  it("configures the same canonical settings without changing read-only or search_path", async () => {
    const db = { $executeRaw: vi.fn(async (_query: Prisma.Sql) => 0) };
    await configureRestoreFingerprintReader(db as never);
    expect(db.$executeRaw.mock.calls.map(([query]) => query.sql)).toEqual([
      "SET LOCAL TimeZone = 'UTC'",
      "SET LOCAL DateStyle = 'ISO'",
      "SET LOCAL IntervalStyle = 'postgres'",
      "SET LOCAL extra_float_digits = 3",
      "SET LOCAL bytea_output = 'hex'",
    ]);
  });
  it.each([
    {},
    { version: 180000, tables: [] },
    { version: 180000, tables: [{ name: "User", rows: "1" }] },
    { version: 180000, tables: [{ name: "User", rows: "-1", sha256: TABLE_SHA256 }] },
    { version: 180000, tables: [{ name: "User", rows: "1", sha256: "private" }] },
    {
      version: 180000,
      tables: Array.from({ length: 2 }, () => ({ name: "User", rows: "1", sha256: TABLE_SHA256 })),
    },
  ])("does not accept malformed inventories even if both sides match %#", (inventory) => {
    expect(() => compareRestoreInventories(inventory as never, inventory as never)).toThrow(
      "INVALID_INVENTORY",
    );
  });
  it("rejects out-of-scope inventories and missing tables, not merely matching totals", () => {
    const valid = { version: 180000, tables: [{ name: "User", rows: "1", sha256: TABLE_SHA256 }] };
    const unknown = {
      version: 180000,
      tables: [{ name: "secret", rows: "1", sha256: TABLE_SHA256 }],
    };
    expect(() => compareRestoreInventories(unknown, unknown)).toThrow("UNSUPPORTED_TABLE");
    expect(() =>
      compareRestoreInventories(valid, {
        ...valid,
        tables: [{ name: "Word", rows: "1", sha256: TABLE_SHA256 }],
      }),
    ).toThrow("INVENTORY_MISMATCH");
  });
});

describe("bounded private archive streaming", () => {
  it("hashes streamed custom-format bytes with backpressure", async () => {
    const chunks: Buffer[] = [];
    const sink = new RestoreArchiveSink(async (chunk) => {
      chunks.push(Buffer.from(chunk));
    });
    await pipeline(Readable.from([Buffer.from("PG"), Buffer.from("DMP-fixture")]), sink);
    expect(sink.summary()).toEqual({
      bytes: 13,
      sha256: createHash("sha256").update("PGDMP-fixture").digest("hex"),
    });
    expect(Buffer.concat(chunks).toString()).toBe("PGDMP-fixture");
  });
  it("refuses oversized bytes before writing them", async () => {
    let written = 0;
    const sink = new RestoreArchiveSink(async (chunk) => {
      written += chunk.length;
    }, 8);
    await expect(
      pipeline(Readable.from([Buffer.from("PGDMP"), Buffer.from("more")]), sink),
    ).rejects.toThrow("ARCHIVE_TOO_LARGE");
    expect(written).toBe(5);
  });
  it.each(["", "PG", "not-custom"])(
    "rejects missing or incorrect archive headers",
    async (value) => {
      const sink = new RestoreArchiveSink(async () => {});
      await pipeline(Readable.from([Buffer.from(value)]), sink);
      expect(() => sink.summary()).toThrow("INVALID_ARCHIVE");
    },
  );
});

describe("subprocess bounds and sanitized failure", () => {
  it("uses no shell, leaks no inherited credentials and drains successful output", async () => {
    vi.stubEnv("SOURCE_DATABASE_URL", SOURCE);
    vi.stubEnv("PGSERVICE", "wrong-route");
    const child = fakeChild("pg_dump (PostgreSQL) 18.3\n");
    const output = await executeRestoreCommand(
      { args: ["safe"], env: { PGHOST: "127.0.0.1" } },
      { spawnDocker: child.spawn },
    );
    expect(output).toContain("18.3");
    expect(child.spawn.mock.calls[0]?.[1]).toMatchObject({ shell: false, windowsHide: true });
    expect(child.spawn.mock.calls[0]?.[1]?.env).not.toHaveProperty("SOURCE_DATABASE_URL");
    expect(child.spawn.mock.calls[0]?.[1]?.env).not.toHaveProperty("PGSERVICE");
  });
  it("kills its host child and disposable service after failure without exposing stderr", async () => {
    const child = fakeChild("", `${SOURCE} private-row-token`, 1);
    const cleanup = vi.fn(async () => {});
    const error = await executeRestoreCommand(
      { args: [], env: {} },
      { spawnDocker: child.spawn, onFailure: cleanup },
    ).catch((error: unknown) => error);
    expect(error).toMatchObject({ code: "PROCESS_FAILED", message: "PROCESS_FAILED" });
    expect(child.kill).toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(restoreFailureReport(error))).not.toContain("private-row-token");
  });
  it.each(["stdout", "stderr"])("caps buffered %s and cleans up the child", async (stream) => {
    const child = fakeChild(
      stream === "stdout" ? "x".repeat(RESTORE_LIMITS.outputBytes + 1) : "",
      stream === "stderr" ? "x".repeat(RESTORE_LIMITS.stderrBytes + 1) : "",
    );
    const cleanup = vi.fn(async () => {});
    await expect(
      executeRestoreCommand(
        { args: [], env: {} },
        { spawnDocker: child.spawn, onFailure: cleanup },
      ),
    ).rejects.toThrow("PROCESS_OUTPUT_LIMIT");
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it("enforces the process deadline and reaps its child", async () => {
    vi.useFakeTimers();
    const child = fakeChild(undefined);
    const cleanup = vi.fn(async () => {});
    const assertion = expect(
      executeRestoreCommand(
        { args: [], env: {} },
        { spawnDocker: child.spawn, onFailure: cleanup, timeoutMs: 10 },
      ),
    ).rejects.toThrow("PROCESS_TIMEOUT");
    await vi.advanceTimersByTimeAsync(10);
    await assertion;
    expect(child.kill).toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it("does not start a child after cancellation and reaps one cancelled while running", async () => {
    const before = new AbortController();
    before.abort();
    const unused = fakeChild(undefined);
    await expect(
      executeRestoreCommand(
        { args: [], env: {} },
        { signal: before.signal, spawnDocker: unused.spawn },
      ),
    ).rejects.toThrow("CANCELLED");
    expect(unused.spawn).not.toHaveBeenCalled();
    const running = new AbortController();
    const child = fakeChild(undefined);
    const cleanup = vi.fn(async () => {});
    const assertion = expect(
      executeRestoreCommand(
        { args: [], env: {} },
        { signal: running.signal, spawnDocker: child.spawn, onFailure: cleanup },
      ),
    ).rejects.toThrow("CANCELLED");
    running.abort();
    await assertion;
    expect(child.kill).toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
  it("reports service cleanup failure without skipping host child cleanup", async () => {
    const child = fakeChild("", "private-error", 1);
    const cleanup = vi.fn(async () => {
      throw new Error(SOURCE);
    });
    await expect(
      executeRestoreCommand(
        { args: [], env: {} },
        { spawnDocker: child.spawn, onFailure: cleanup },
      ),
    ).rejects.toThrow("SERVICE_CLEANUP_FAILED");
    expect(child.kill).toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });
});

describe("mocked snapshot and isolated restore orchestration", () => {
  it("reads count then fingerprint sequentially with only one query in flight across tables", async () => {
    await withHarness(async (h) => {
      h.condition = "multiple tables";
      const report = await runDatabaseRestore(h.input);
      expect(report.tableCount).toBe(3);
      expect(h.maxInFlight()).toBe(1);
      expect(h.tableQueries.filter((entry) => entry.startsWith("source:"))).toEqual([
        "source:count:Word",
        "source:hash:Word",
        "source:count:User",
        "source:hash:User",
        "source:count:UserSrsState",
        "source:hash:UserSrsState",
      ]);
    });
  });
  it("holds the read-only exporting transaction through dump, compares same-snapshot content and removes its own archive", async () => {
    await withHarness(async (h) => {
      const report = await runDatabaseRestore(h.input);
      expect(report.status).toBe("verified");
      expect(report.schemaVersion).toBe(2);
      expect(report.scope).toBe("public-table-content-rehearsal");
      expect(report.tables).toEqual([
        {
          table: "UserSrsState",
          sourceRows: "7",
          restoredRows: "7",
          sourceSha256: TABLE_SHA256,
          restoredSha256: TABLE_SHA256,
        },
      ]);
      expect(h.events.indexOf("source:SET TRANSACTION READ ONLY")).toBeLessThan(
        h.events.indexOf("snapshot"),
      );
      expect(h.events.indexOf("snapshot")).toBeLessThan(h.events.indexOf("source:counts"));
      expect(h.events.indexOf("source:counts")).toBeLessThan(h.events.indexOf("dump"));
      expect(h.events.indexOf("source:counts")).toBeLessThan(
        h.events.indexOf("source:fingerprint"),
      );
      expect(h.events.indexOf("source:fingerprint")).toBeLessThan(h.events.indexOf("dump"));
      expect(h.events.indexOf("dump")).toBeLessThan(h.events.indexOf("source:end"));
      expect(h.events.indexOf("source:end")).toBeLessThan(h.events.indexOf("restore"));
      expect(h.source.$transaction.mock.calls[0]?.[1]).toMatchObject({
        isolationLevel: "RepeatableRead",
      });
      expect(h.emptyChecks()).toBe(2);
      for (const prefix of ["source", "target"]) {
        for (const command of [
          "TimeZone = 'UTC'",
          "DateStyle = 'ISO'",
          "IntervalStyle = 'postgres'",
          "extra_float_digits = 3",
          "bytea_output = 'hex'",
        ]) {
          const configured = h.events.indexOf(`${prefix}:SET LOCAL ${command}`);
          expect(configured).toBeGreaterThan(
            h.events.indexOf(`${prefix}:SET TRANSACTION READ ONLY`),
          );
          expect(configured).toBeLessThan(h.events.indexOf(`${prefix}:counts`));
        }
      }
      expect(JSON.stringify(report)).not.toMatch(/password|neon\.tech|snapshot|private-fixture/u);
    });
  });
  it.each([
    "initial nonempty",
    "late nonempty",
    "snapshot unsupported",
    "readonly off",
    "unknown table",
    "count mismatch",
    "content mismatch",
    "row limit",
    "bad digest",
    "wrong service",
  ])("fails closed on %s and always removes its own private file", async (condition) => {
    await withHarness(async (h) => {
      h.condition = condition;
      const error = await runDatabaseRestore(h.input).catch((error: unknown) => error);
      expect(restoreFailureReport(error).status).toBe("failed");
      if (!["count mismatch", "content mismatch"].includes(condition))
        expect(h.events).not.toContain("restore");
      if (["initial nonempty", "wrong service"].includes(condition))
        expect(h.source.$transaction).not.toHaveBeenCalled();
      if (condition === "late nonempty") expect(h.events).toContain("dump");
      if (condition === "snapshot unsupported")
        expect(restoreFailureReport(error).code).toBe("SOURCE_SNAPSHOT_UNAVAILABLE");
      if (condition === "row limit") {
        expect(restoreFailureReport(error).code).toBe("ROW_LIMIT_EXCEEDED");
        expect(h.events).not.toContain("source:fingerprint");
      }
      if (condition === "content mismatch")
        expect(restoreFailureReport(error).code).toBe("INVENTORY_MISMATCH");
      expect(JSON.stringify(restoreFailureReport(error))).not.toContain(SOURCE);
    });
  });
});

function fakeChild(stdout?: string, stderr = "", code = 0) {
  const emitter = new EventEmitter();
  const stdin = new PassThrough();
  stdin.resume();
  const out = new PassThrough();
  const err = new PassThrough();
  let closed = false;
  const close = (value: number) => {
    if (!closed) {
      closed = true;
      emitter.emit("close", value);
    }
  };
  const kill = vi.fn(() => {
    stdin.destroy();
    out.destroy();
    err.destroy();
    queueMicrotask(() => close(137));
    return true;
  });
  const child = Object.assign(emitter, {
    stdin,
    stdout: out,
    stderr: err,
    kill,
  }) as unknown as ChildProcessWithoutNullStreams;
  const spawn = vi.fn((_args: readonly string[], options: SpawnOptions) => {
    options.signal?.addEventListener("abort", () => kill(), { once: true });
    if (stdout !== undefined)
      queueMicrotask(() => {
        out.end(stdout);
        err.end(stderr);
        setImmediate(() => close(code));
      });
    return child;
  });
  return { spawn, kill };
}

async function withHarness(test: (h: ReturnType<typeof orchestrationHarness>) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), "kanji-restore-unit-"));
  try {
    await test(orchestrationHarness(directory));
    expect(await readdir(directory)).toEqual([]);
  } finally {
    await rmdir(directory);
  }
}
function orchestrationHarness(tempRoot: string) {
  const events: string[] = [];
  let sourceActive = false;
  let checks = 0;
  let inFlight = 0;
  let maximum = 0;
  const tableQueries: string[] = [];
  const h = {
    condition: "",
    events,
    tableQueries,
    maxInFlight: () => maximum,
    emptyChecks: () => checks,
  };
  const reader = (source: boolean) => ({
    $executeRaw: vi.fn(async (query: Prisma.Sql) => {
      events.push(`${source ? "source" : "target"}:${query.sql.trim()}`);
      return 0;
    }),
    $queryRaw: vi.fn(async (query: Prisma.Sql) => {
      inFlight++;
      maximum = Math.max(maximum, inFlight);
      try {
        await Promise.resolve();
        if (query.sql.includes("current_database()"))
          return [
            {
              database: source ? "neondb" : "kanji_restore",
              version: source ? "170005" : "180003",
            },
          ];
        if (query.sql.includes("pg_export_snapshot")) {
          events.push("snapshot");
          if (h.condition === "snapshot unsupported") throw new Error(SOURCE);
          return [{ snapshot: SNAPSHOT, readonly: h.condition === "readonly off" ? "off" : "on" }];
        }
        if (query.sql.includes("AS count")) {
          checks++;
          return [
            {
              count:
                h.condition === "initial nonempty" ||
                (h.condition === "late nonempty" && checks === 2)
                  ? "1"
                  : "0",
            },
          ];
        }
        if (query.sql.includes("c.relname AS name"))
          return h.condition === "multiple tables"
            ? ["Word", "User", "UserSrsState"].map((name) => ({ name, kind: "r" }))
            : [{ name: h.condition === "unknown table" ? "unknown" : "UserSrsState", kind: "r" }];
        if (query.sql.includes("AS sha256")) {
          events.push(`${source ? "source" : "target"}:fingerprint`);
          tableQueries.push(`${source ? "source" : "target"}:hash:${query.values[0]}`);
          return [
            {
              name: query.values[0],
              sha256:
                h.condition === "bad digest"
                  ? SOURCE
                  : !source && h.condition === "content mismatch"
                    ? "b".repeat(64)
                    : TABLE_SHA256,
            },
          ];
        }
        events.push(`${source ? "source" : "target"}:counts`);
        tableQueries.push(`${source ? "source" : "target"}:count:${query.values[0]}`);
        return [
          {
            name: query.values[0],
            rows:
              h.condition === "row limit"
                ? "1000001"
                : !source && h.condition === "count mismatch"
                  ? "8"
                  : "7",
          },
        ];
      } finally {
        inFlight--;
      }
    }),
  });
  const source = {
    $transaction: vi.fn(
      async (callback: (db: ReturnType<typeof reader>) => Promise<unknown>, _options?: unknown) => {
        sourceActive = true;
        events.push("source:begin");
        try {
          return await callback(reader(true));
        } finally {
          sourceActive = false;
          events.push("source:end");
        }
      },
    ),
  };
  const target = {
    $transaction: vi.fn(async (callback: (db: ReturnType<typeof reader>) => Promise<unknown>) =>
      callback(reader(false)),
    ),
  };
  const execute = vi.fn(async (command: RestoreCommand, options?: ProcessOptions) => {
    if (command.args.includes("inspect"))
      return `postgres:18\ntrue\n{"5432/tcp":[{"HostIp":"0.0.0.0","HostPort":"${h.condition === "wrong service" ? "5433" : "5432"}"}]}\n`;
    if (command.args.includes("--version"))
      return `${command.args.includes("pg_dump") ? "pg_dump" : "pg_restore"} (PostgreSQL) 18.3\n`;
    if (command.args.includes("pg_dump")) {
      expect(sourceActive).toBe(true);
      events.push("dump");
      await pipeline(Readable.from([Buffer.from("PGDMP-private-fixture")]), options!.output!);
    }
    if (command.args.includes("pg_restore")) {
      expect(sourceActive).toBe(false);
      events.push("restore");
      for await (const _chunk of options!.input!) {
        /* Consume only the synthetic private fixture. */
      }
    }
    return "";
  });
  return Object.assign(h, {
    source,
    target,
    input: {
      source: source as unknown as PrismaClient,
      target: target as unknown as PrismaClient,
      sourceUrl: SOURCE,
      targetUrl: TARGET,
      containerId: CONTAINER,
      tempRoot,
      workspace: process.cwd(),
      execute,
    },
  });
}
