import { spawn, type ChildProcessWithoutNullStreams, type SpawnOptions } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdtemp, open, realpath, rmdir, unlink } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import { Writable, type Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { Prisma, type PrismaClient } from "@prisma/client";

export const RESTORE_LIMITS = {
  archiveBytes: 512 * 1024 * 1024,
  processMs: 10 * 60 * 1000,
  totalMs: 15 * 60 * 1000,
  outputBytes: 4096,
  stderrBytes: 65536,
  tables: 128,
} as const;
const DOCKER_SOCKET = "--host=unix:///var/run/docker.sock";
const TABLES = new Set([
  ...Prisma.dmmf.datamodel.models.map((model) => model.dbName ?? model.name),
  "_prisma_migrations",
]);
const ERROR_CODES = [
  "INVALID_CONFIGURATION",
  "INVALID_TARGET",
  "INVALID_SOURCE",
  "INVALID_CONTAINER",
  "INVALID_SNAPSHOT",
  "UNSAFE_TEMP_DIRECTORY",
  "TARGET_NOT_EMPTY",
  "UNSUPPORTED_TABLE",
  "INVALID_INVENTORY",
  "INVENTORY_MISMATCH",
  "UNSUPPORTED_VERSION",
  "ARCHIVE_TOO_LARGE",
  "INVALID_ARCHIVE",
  "ARCHIVE_IO_FAILED",
  "ARCHIVE_CLEANUP_FAILED",
  "PROCESS_FAILED",
  "PROCESS_TIMEOUT",
  "PROCESS_OUTPUT_LIMIT",
  "CANCELLED",
  "SERVICE_CLEANUP_FAILED",
  "SOURCE_SNAPSHOT_UNAVAILABLE",
  "REHEARSAL_FAILED",
] as const;
type ErrorCode = (typeof ERROR_CODES)[number];
export class DatabaseRestoreError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = "DatabaseRestoreError";
  }
}
function fail(code: ErrorCode): never {
  throw new DatabaseRestoreError(code);
}

type Connection = {
  url: string;
  host: string;
  port: string;
  database: string;
  user: string;
  password: string;
};
export type RestoreConnections = { source: Connection; target: Connection; containerId: string };
function parseConnection(value: string): Connection & { parsed: URL } {
  try {
    const parsed = new URL(value);
    if (!["postgres:", "postgresql:"].includes(parsed.protocol) || value.includes("#"))
      fail("INVALID_CONFIGURATION");
    const user = decodeURIComponent(parsed.username);
    const password = decodeURIComponent(parsed.password);
    const database = decodeURIComponent(parsed.pathname.slice(1));
    if (
      !user ||
      !password ||
      Array.from(user + password).some(
        (character) => character.codePointAt(0)! <= 32 || character.codePointAt(0) === 127,
      ) ||
      !/^[A-Za-z0-9_-]{1,63}$/u.test(database)
    )
      fail("INVALID_CONFIGURATION");
    return {
      parsed,
      url: value,
      host: parsed.hostname,
      port: parsed.port || "5432",
      database,
      user,
      password,
    };
  } catch {
    return fail("INVALID_CONFIGURATION");
  }
}

export function validateRestoreConnections(
  sourceUrl: string,
  targetUrl: string,
  containerId: string,
): RestoreConnections {
  if (!/^[a-f0-9]{64}$/u.test(containerId)) fail("INVALID_CONTAINER");
  const source = parseConnection(sourceUrl);
  const target = parseConnection(targetUrl);
  if (
    source.host === target.host &&
    source.port === target.port &&
    source.database === target.database
  )
    fail("INVALID_TARGET");
  if (
    target.host !== "127.0.0.1" ||
    target.port !== "5432" ||
    target.database !== "kanji_restore" ||
    targetUrl.includes("?")
  )
    fail("INVALID_TARGET");
  if (
    !/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.neon\.tech$/u.test(source.host) ||
    source.host.includes("-pooler.") ||
    source.port !== "5432"
  )
    fail("INVALID_SOURCE");
  const allowed = new Set([
    "sslmode",
    "channel_binding",
    "connect_timeout",
    "pool_timeout",
    "connection_limit",
    "schema",
  ]);
  const seen = new Set<string>();
  for (const [key, value] of source.parsed.searchParams) {
    if (!allowed.has(key) || seen.has(key)) fail("INVALID_SOURCE");
    seen.add(key);
    if (key === "sslmode" && !["require", "verify-full"].includes(value)) fail("INVALID_SOURCE");
    if (key === "channel_binding" && !["require", "prefer", "disable"].includes(value))
      fail("INVALID_SOURCE");
    if (key === "schema" && value !== "public") fail("INVALID_SOURCE");
    if (
      ["connect_timeout", "pool_timeout", "connection_limit"].includes(key) &&
      !/^[1-9][0-9]{0,2}$/u.test(value)
    )
      fail("INVALID_SOURCE");
  }
  if (!seen.has("sslmode")) fail("INVALID_SOURCE");
  const prismaUrl = new URL(source.url);
  prismaUrl.searchParams.set("connection_limit", "1");
  prismaUrl.searchParams.set("connect_timeout", "15");
  prismaUrl.searchParams.set("pool_timeout", "15");
  return {
    source: { ...source, url: prismaUrl.toString() },
    target: { ...target },
    containerId,
  };
}

export type RestoreCommand = {
  readonly args: readonly string[];
  readonly env: Readonly<Record<string, string>>;
};
const PG_ENV_KEYS = [
  "PGHOST",
  "PGPORT",
  "PGDATABASE",
  "PGUSER",
  "PGPASSWORD",
  "PGSSLMODE",
  "PGCHANNELBINDING",
  "PGCONNECT_TIMEOUT",
  "PGOPTIONS",
  "PGAPPNAME",
];
export function buildRestoreCommand(
  config: RestoreConnections,
  mode: "dump" | "restore",
  snapshot?: string,
): RestoreCommand {
  config = validateRestoreConnections(config.source.url, config.target.url, config.containerId);
  if (mode === "dump" && !/^[0-9a-f]{8}-[0-9a-f]{8}-[1-9][0-9]*$/iu.test(snapshot ?? ""))
    fail("INVALID_SNAPSHOT");
  const connection = mode === "dump" ? config.source : config.target;
  const sourceParams = new URL(config.source.url).searchParams;
  const env = {
    PGHOST: connection.host,
    PGPORT: connection.port,
    PGDATABASE: connection.database,
    PGUSER: connection.user,
    PGPASSWORD: connection.password,
    PGSSLMODE: mode === "dump" ? sourceParams.get("sslmode")! : "disable",
    PGCHANNELBINDING:
      mode === "dump" ? (sourceParams.get("channel_binding") ?? "prefer") : "disable",
    PGCONNECT_TIMEOUT: "15",
    PGAPPNAME: "kanji_restore_rehearsal",
    PGOPTIONS: `-c statement_timeout=540000 -c lock_timeout=10000${
      mode === "dump"
        ? " -c default_transaction_read_only=on"
        : " -c log_min_messages=panic -c log_min_error_statement=panic -c log_error_verbosity=terse -c log_statement=none -c log_parameter_max_length_on_error=0"
    }`,
  };
  return {
    env,
    args: [
      DOCKER_SOCKET,
      "exec",
      "-i",
      ...PG_ENV_KEYS.flatMap((key) => ["--env", key]),
      config.containerId,
      "timeout",
      "--signal=KILL",
      "600s",
      mode === "dump" ? "pg_dump" : "pg_restore",
      ...(mode === "dump"
        ? [
            "--format=custom",
            "--schema=public",
            "--strict-names",
            `--snapshot=${snapshot}`,
            "--lock-wait-timeout=10s",
          ]
        : ["--dbname=kanji_restore", "--schema=public", "--exit-on-error", "--single-transaction"]),
      "--no-owner",
      "--no-acl",
      "--no-comments",
      "--no-security-labels",
      "--no-password",
    ],
  };
}

type SpawnDocker = (
  args: readonly string[],
  options: SpawnOptions,
) => ChildProcessWithoutNullStreams;
export type ProcessOptions = {
  readonly input?: Readable;
  readonly output?: Writable;
  readonly signal?: AbortSignal;
  readonly timeoutMs?: number;
  readonly onFailure?: () => Promise<void>;
  readonly spawnDocker?: SpawnDocker;
};
export async function executeRestoreCommand(
  command: RestoreCommand,
  options: ProcessOptions = {},
): Promise<string> {
  const timeoutMs = options.timeoutMs ?? RESTORE_LIMITS.processMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > RESTORE_LIMITS.processMs)
    fail("INVALID_CONFIGURATION");
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  options.signal?.addEventListener("abort", abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  let child: ChildProcessWithoutNullStreams | undefined;
  let closed: Promise<void> | undefined;
  try {
    if (controller.signal.aborted) fail("CANCELLED");
    const start =
      options.spawnDocker ??
      ((args, settings) => spawn("docker", [...args], { ...settings, stdio: "pipe" }));
    child = start(command.args, {
      env: { PATH: process.env.PATH ?? "", ...command.env },
      shell: false,
      windowsHide: true,
      signal: controller.signal,
      killSignal: "SIGKILL",
    });
    const processChild = child;
    closed = new Promise<void>((resolve) => processChild.once("close", () => resolve()));
    const exit = new Promise<void>((resolve, reject) => {
      processChild.once("error", () => reject(new DatabaseRestoreError("PROCESS_FAILED")));
      processChild.once("close", (code) =>
        code === 0 ? resolve() : reject(new DatabaseRestoreError("PROCESS_FAILED")),
      );
    });
    const chunks: Buffer[] = [];
    const stdout = options.output
      ? pipeline(processChild.stdout, options.output, { signal: controller.signal })
      : (async () => {
          let size = 0;
          for await (const chunk of processChild.stdout) {
            const data = Buffer.from(chunk);
            size += data.length;
            if (size > RESTORE_LIMITS.outputBytes) fail("PROCESS_OUTPUT_LIMIT");
            chunks.push(data);
          }
        })();
    const stderr = (async () => {
      let size = 0;
      for await (const chunk of processChild.stderr) {
        size += Buffer.byteLength(chunk);
        if (size > RESTORE_LIMITS.stderrBytes) fail("PROCESS_OUTPUT_LIMIT");
      }
    })();
    processChild.stdin.on("error", () => {});
    const stdin = options.input
      ? pipeline(options.input, processChild.stdin, { signal: controller.signal })
      : Promise.resolve(processChild.stdin.end());
    await Promise.all([exit, stdout, stderr, stdin]);
    return Buffer.concat(chunks).toString("utf8");
  } catch (error) {
    controller.abort();
    child?.kill("SIGKILL");
    options.input?.destroy();
    options.output?.destroy();
    // Killing the docker CLI alone does not stop its in-container process.
    let cleanupFailed = false;
    try {
      if (child !== undefined) await options.onFailure?.();
    } catch {
      cleanupFailed = true;
    }
    if (closed !== undefined) {
      let closeTimer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        closed,
        new Promise<void>((resolve) => {
          closeTimer = setTimeout(resolve, 5000);
        }),
      ]);
      clearTimeout(closeTimer);
    }
    if (cleanupFailed) return fail("SERVICE_CLEANUP_FAILED");
    if (timedOut) fail("PROCESS_TIMEOUT");
    if (options.signal?.aborted) fail("CANCELLED");
    if (error instanceof DatabaseRestoreError) throw error;
    return fail("PROCESS_FAILED");
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", abort);
  }
}

export class RestoreArchiveSink extends Writable {
  private readonly hash = createHash("sha256");
  private header = Buffer.alloc(0);
  private bytes = 0;
  constructor(
    private readonly writeChunk: (data: Buffer) => Promise<void>,
    private readonly maxBytes: number = RESTORE_LIMITS.archiveBytes,
  ) {
    super();
    if (!Number.isInteger(maxBytes) || maxBytes < 5 || maxBytes > RESTORE_LIMITS.archiveBytes)
      fail("INVALID_CONFIGURATION");
  }
  override _write(
    data: Buffer,
    _encoding: BufferEncoding,
    done: (error?: Error | null) => void,
  ): void {
    if (this.bytes + data.length > this.maxBytes) {
      done(new DatabaseRestoreError("ARCHIVE_TOO_LARGE"));
      return;
    }
    this.bytes += data.length;
    this.hash.update(data);
    if (this.header.length < 5)
      this.header = Buffer.concat([this.header, data.subarray(0, 5 - this.header.length)]);
    this.writeChunk(data).then(
      () => done(),
      () => done(new DatabaseRestoreError("ARCHIVE_IO_FAILED")),
    );
  }
  summary(): { bytes: number; sha256: string } {
    if (!this.writableFinished || this.header.toString("ascii") !== "PGDMP")
      fail("INVALID_ARCHIVE");
    return { bytes: this.bytes, sha256: this.hash.digest("hex") };
  }
}

export function quoteRestoreTable(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]{0,62}$/u.test(name) || !TABLES.has(name)) fail("UNSUPPORTED_TABLE");
  return `"public"."${name}"`;
}
type Inventory = { version: number; tables: { name: string; rows: string }[] };
type Database = Pick<PrismaClient, "$transaction">;
type Reader = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;
async function readIdentity(db: Reader, target: boolean): Promise<number> {
  const [identity] = await db.$queryRaw<{ database: string; version: string }[]>(Prisma.sql`
    SELECT pg_catalog.current_database() AS database, pg_catalog.current_setting('server_version_num') AS version
  `);
  const version = Number(identity?.version);
  if (target && identity?.database !== "kanji_restore") fail("INVALID_TARGET");
  if (
    !Number.isInteger(version) ||
    version < 140000 ||
    version >= 190000 ||
    (target && version < 180000)
  )
    fail("UNSUPPORTED_VERSION");
  return version;
}
async function readInventory(db: Reader, version: number): Promise<Inventory> {
  const tables = await db.$queryRaw<{ name: string; kind: string }[]>(Prisma.sql`
    SELECT c.relname AS name, c.relkind::text AS kind FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'f', 'm') ORDER BY c.relname LIMIT ${RESTORE_LIMITS.tables + 1}
  `);
  if (
    !tables.length ||
    tables.length > RESTORE_LIMITS.tables ||
    new Set(tables.map((table) => table.name)).size !== tables.length
  )
    fail("INVALID_INVENTORY");
  for (const table of tables) {
    quoteRestoreTable(table.name);
    if (table.kind !== "r") fail("UNSUPPORTED_TABLE");
  }
  const counts = await db.$queryRaw<{ name: string; rows: string }[]>(
    Prisma.join(
      tables.map(
        ({ name }) => Prisma.sql`
    SELECT ${name}::text AS name, pg_catalog.count(*)::text AS rows FROM ${Prisma.raw(quoteRestoreTable(name))}
  `,
      ),
      " UNION ALL ",
    ),
  );
  if (
    counts.length !== tables.length ||
    new Set(counts.map((row) => row.name)).size !== tables.length ||
    counts.some(
      (row) =>
        !tables.some((table) => table.name === row.name) ||
        !/^(0|[1-9][0-9]{0,19})$/u.test(row.rows),
    )
  )
    fail("INVALID_INVENTORY");
  return {
    version,
    tables: counts.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)),
  };
}
async function assertEmptyTarget(target: Database): Promise<void> {
  await target.$transaction(
    async (db) => {
      await db.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
      await db.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '30s'`);
      await readIdentity(db, true);
      const [objects] = await db.$queryRaw<{ count: string }[]>(Prisma.sql`
      SELECT ((SELECT count(*) FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public')
        + (SELECT count(*) FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public')
        + (SELECT count(*) FROM pg_catalog.pg_type t JOIN pg_catalog.pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public'))::text AS count
    `);
      if (objects?.count !== "0") fail("TARGET_NOT_EMPTY");
    },
    { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 45000 },
  );
}
export function compareRestoreInventories(source: Inventory, target: Inventory): void {
  if (JSON.stringify(source.tables) !== JSON.stringify(target.tables)) fail("INVENTORY_MISMATCH");
}
export function restoreFailureReport(error: unknown) {
  const code =
    error instanceof DatabaseRestoreError && ERROR_CODES.includes(error.code)
      ? error.code
      : "REHEARSAL_FAILED";
  return {
    schemaVersion: 1,
    scope: "public-table-count-rehearsal",
    status: "failed",
    code,
  } as const;
}
function parseToolVersion(value: string, tool: string): string {
  const match = new RegExp(
    `^${tool} \\(PostgreSQL\\) (18(?:\\.[0-9]+){0,2})(?:[ \\n]|$)`,
    "u",
  ).exec(value.trim());
  if (!match) fail("UNSUPPORTED_VERSION");
  return match[1]!;
}
async function removeOwnArchive(path: string, directory: string) {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") fail("ARCHIVE_CLEANUP_FAILED");
  }
  try {
    await rmdir(directory);
  } catch {
    fail("ARCHIVE_CLEANUP_FAILED");
  }
}

export async function validateRestoreTempRoot(
  tempRoot: string,
  workspacePath: string,
): Promise<string> {
  if (!isAbsolute(tempRoot) || !isAbsolute(workspacePath)) fail("UNSAFE_TEMP_DIRECTORY");
  const root = await realpath(tempRoot);
  const workspace = await realpath(workspacePath);
  const inside = relative(workspace, root);
  if (!inside || (!inside.startsWith(`..${sep}`) && inside !== ".." && !isAbsolute(inside)))
    fail("UNSAFE_TEMP_DIRECTORY");
  return root;
}

export function readRestoreEnvironment(env: NodeJS.ProcessEnv) {
  if (
    env.GITHUB_ACTIONS !== "true" ||
    env.RUNNER_OS !== "Linux" ||
    !env.SOURCE_DATABASE_URL ||
    !env.INTEGRATION_RESTORE_DATABASE_URL ||
    !env.RESTORE_POSTGRES_CONTAINER_ID ||
    !env.RUNNER_TEMP ||
    !env.GITHUB_WORKSPACE
  )
    fail("INVALID_CONFIGURATION");
  const config = validateRestoreConnections(
    env.SOURCE_DATABASE_URL,
    env.INTEGRATION_RESTORE_DATABASE_URL,
    env.RESTORE_POSTGRES_CONTAINER_ID,
  );
  return { config, tempRoot: env.RUNNER_TEMP, workspace: env.GITHUB_WORKSPACE };
}

export async function runDatabaseRestore(input: {
  readonly source: Database;
  readonly target: Database;
  readonly sourceUrl: string;
  readonly targetUrl: string;
  readonly containerId: string;
  readonly tempRoot: string;
  readonly workspace: string;
  readonly signal?: AbortSignal;
  readonly execute?: typeof executeRestoreCommand;
}) {
  const config = validateRestoreConnections(input.sourceUrl, input.targetUrl, input.containerId);
  const root = await validateRestoreTempRoot(input.tempRoot, input.workspace);
  const execute = input.execute ?? executeRestoreCommand;
  const controller = new AbortController();
  const abort = () => controller.abort();
  input.signal?.addEventListener("abort", abort, { once: true });
  if (input.signal?.aborted) controller.abort();
  const timer = setTimeout(abort, RESTORE_LIMITS.totalMs);
  const checkAbort = () => {
    if (controller.signal.aborted) fail("CANCELLED");
  };
  let directory: string | undefined;
  let dumpPath: string | undefined;
  let containerApproved = false;
  const stopService = async () => {
    if (!containerApproved) return;
    try {
      await execute(
        { args: [DOCKER_SOCKET, "kill", config.containerId], env: {} },
        { timeoutMs: 10000 },
      );
    } catch {
      fail("SERVICE_CLEANUP_FAILED");
    }
  };
  const options = () => ({ signal: controller.signal, onFailure: stopService });
  try {
    checkAbort();
    const inspect = await execute(
      {
        args: [
          DOCKER_SOCKET,
          "inspect",
          "--format",
          "{{.Config.Image}}\n{{.State.Running}}\n{{json .NetworkSettings.Ports}}",
          config.containerId,
        ],
        env: {},
      },
      { signal: controller.signal, timeoutMs: 10000 },
    );
    const [image, running, bindings] = inspect.trim().split("\n");
    let ports: Record<string, { HostIp: string; HostPort: string }[]>;
    try {
      ports = JSON.parse(bindings!);
    } catch {
      return fail("INVALID_CONTAINER");
    }
    if (
      image !== "postgres:18" ||
      running !== "true" ||
      !ports["5432/tcp"]?.some(
        (port) => ["127.0.0.1", "0.0.0.0"].includes(port.HostIp) && port.HostPort === "5432",
      )
    )
      fail("INVALID_CONTAINER");
    containerApproved = true;
    await assertEmptyTarget(input.target);
    checkAbort();
    const version = async (tool: "pg_dump" | "pg_restore") =>
      parseToolVersion(
        await execute(
          { args: [DOCKER_SOCKET, "exec", config.containerId, tool, "--version"], env: {} },
          { ...options(), timeoutMs: 10000 },
        ),
        tool,
      );
    const pgDump = await version("pg_dump");
    const pgRestore = await version("pg_restore");
    directory = await mkdtemp(join(root, "kanji-restore-"));
    dumpPath = join(directory, "snapshot.dump");
    const handle = await open(dumpPath, "wx", 0o600);
    let archive: { bytes: number; sha256: string };
    let source: Inventory;
    try {
      const sink = new RestoreArchiveSink((data) => handle.writeFile(data));
      source = await input.source.$transaction(
        async (db) => {
          await db.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
          await db.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '90s'`);
          await db.$executeRaw(Prisma.sql`SET LOCAL idle_in_transaction_session_timeout = '11min'`);
          const sourceVersion = await readIdentity(db, false);
          let snapshot: { snapshot: string; readonly: string } | undefined;
          try {
            [snapshot] = await db.$queryRaw<{ snapshot: string; readonly: string }[]>(Prisma.sql`
            SELECT pg_catalog.pg_export_snapshot() AS snapshot, pg_catalog.current_setting('transaction_read_only') AS readonly
          `);
          } catch {
            return fail("SOURCE_SNAPSHOT_UNAVAILABLE");
          }
          if (snapshot?.readonly !== "on") fail("INVALID_SNAPSHOT");
          const command = buildRestoreCommand(config, "dump", snapshot?.snapshot);
          const inventory = await readInventory(db, sourceVersion);
          checkAbort();
          await execute(command, { ...options(), output: sink });
          checkAbort();
          return inventory;
        },
        {
          isolationLevel: "RepeatableRead",
          maxWait: 15000,
          timeout: RESTORE_LIMITS.totalMs + 30000,
        },
      );
      archive = sink.summary();
    } finally {
      await handle.close();
    }
    checkAbort();
    await assertEmptyTarget(input.target);
    checkAbort();
    await execute(buildRestoreCommand(config, "restore"), {
      ...options(),
      input: createReadStream(dumpPath),
    });
    checkAbort();
    const target = await input.target.$transaction(
      async (db) => {
        await db.$executeRaw(Prisma.sql`SET TRANSACTION READ ONLY`);
        await db.$executeRaw(Prisma.sql`SET LOCAL statement_timeout = '90s'`);
        return readInventory(db, await readIdentity(db, true));
      },
      { isolationLevel: "RepeatableRead", maxWait: 15000, timeout: 120000 },
    );
    checkAbort();
    compareRestoreInventories(source, target);
    return {
      schemaVersion: 1,
      scope: "public-table-count-rehearsal",
      status: "verified",
      versions: {
        sourcePostgres: source.version,
        restoredPostgres: target.version,
        pgDump,
        pgRestore,
      },
      archive,
      tableCount: source.tables.length,
      tables: source.tables.map((table, index) => ({
        table: table.name,
        sourceRows: table.rows,
        restoredRows: target.tables[index]!.rows,
      })),
    } as const;
  } catch (error) {
    if (error instanceof DatabaseRestoreError) throw error;
    fail("REHEARSAL_FAILED");
  } finally {
    clearTimeout(timer);
    input.signal?.removeEventListener("abort", abort);
    if (dumpPath !== undefined && directory !== undefined)
      await removeOwnArchive(dumpPath, directory);
  }
}
