# Database Restore Rehearsal

This bounded Task124 exercise compares counts and content fingerprints from a
read-only snapshot of the app's `public` schema against a fresh, isolated
PostgreSQL 18 service. Version 2 reports use `schemaVersion: 2` and scope
`public-table-content-rehearsal`. No live version-2 run has been verified yet.
It is **not** production
disaster-recovery approval, a retained backup, a full release gate or a promise
that every row, index, constraint or application workflow is correct.

## Manual Operation

After the parent reviews and commits the implementation, manually dispatch
**Database restore rehearsal** (`.github/workflows/verify-database-restore.yml`).
There is no push, pull-request or scheduled trigger, no polling and no additional
paid service. The job has a 20-minute limit and shares `staging-database`
concurrency without cancelling an in-progress run. This avoids overlapping our
migration/curation jobs; learner writes may continue, so a shared snapshot is
still required.

The workflow generates Prisma, runs only the restore guardrail tests and invokes:

```sh
npm run db:restore:verify
```

The CLI accepts no arguments and requires a GitHub Actions Linux environment.
It never falls back to `DATABASE_URL`. No migration, seed, reset, source write,
`DROP`, truncate, restore `--clean` or restore `--create` operation is performed.
Do not bypass an occupied-target failure; start a fresh manual job instead.

## Connection Boundaries

- `SOURCE_DATABASE_URL` is populated only in the rehearsal step from the existing
  `STAGING_DATABASE_URL` repository secret. It must be a direct, unpooled Neon
  PostgreSQL URL, port 5432, with explicit `sslmode=require` or `verify-full`.
- The only restore target is `INTEGRATION_RESTORE_DATABASE_URL`, fixed by the
  workflow to numeric loopback `127.0.0.1:5432/kanji_restore`. Other hosts, ports,
  databases, all query parameters and fragments are rejected. Source and target
  cannot identify the same database.
- Source routing overrides, duplicate/unknown query parameters, fragments and
  pooler endpoints are rejected. Only known SSL/channel-binding and bounded
  Prisma connection/schema settings are accepted. Prisma receives its own
  connection/pool limits; libpq receives separately constructed environment
  fields, never ORM-only `schema` or pool parameters. Requested SSL and channel
  binding are preserved, not downgraded.
- `RESTORE_POSTGRES_CONTAINER_ID` comes from `job.services.postgres.id`, must be
  exactly 64 lowercase hexadecimal characters, and is inspected before use. The
  service must be running `postgres:18` and publish port 5432 to runner loopback.
  Docker commands use only the fixed local Unix socket, not inherited Docker
  contexts or remote-daemon environment variables.
- Credentials are passed to PostgreSQL tools only through the child environment,
  never arguments or logs. Other inherited PostgreSQL/service variables and the
  original source URL are not forwarded to Docker commands.

Neon documents that `pg_dump` needs a
[direct connection](https://github.com/neondatabase/website/blob/main/content/docs/manage/backup-pg-dump.md).
The supplied staging secret is expected to satisfy this; no pooler URL is
silently rewritten.

## Consistency And Restore

1. Inspect the disposable service. Connect only to the guarded target, verify
   PostgreSQL 18/database identity and reject any existing public relation,
   function or type, not just nonempty tables.
2. Check that both in-container client tools are PostgreSQL 18. The source server
   must be PostgreSQL 14–18; newer sources fail rather than using an older dumper.
3. Open one Prisma `RepeatableRead` source transaction, explicitly execute
   `SET TRANSACTION READ ONLY`, set bounded statement/idle timeouts and export
   `pg_export_snapshot()`. Verify that the transaction is actually read-only.
4. From that same transaction/snapshot, enumerate **all public tables**, count
   every row and fingerprint all columns, including null/private values, inside
   PostgreSQL. Only generated Prisma model table names and `_prisma_migrations`
   are accepted as quoted identifiers. Unknown tables, foreign/partitioned tables
   and materialized views fail closed rather than disappearing from the report.
5. While the exporting transaction remains open, run custom-format
   `pg_dump --schema=public --snapshot=...`. Its session is also read-only.
   Stream stdout directly into a private, exclusive temporary archive; no whole
   database is retained in Node memory. Only after dump completion may the source
   transaction end.
6. Verify the custom archive header, size and streaming SHA-256. Recheck the
   target's empty public schema immediately before restore. Stream the owned
   archive into `pg_restore --schema=public --exit-on-error --single-transaction
--no-owner --no-acl`, explicitly targeting `kanji_restore`, never the source.
7. Read the restored inventory/counts/fingerprints in a read-only transaction and
   require exact table-list, decimal row-count and aggregate SHA-256 equality.
   Missing/malformed hashes, invalid counts and out-of-scope inventories fail.
   Remove the owned archive and its
   unique empty temporary directory in `finally`, on success or failure.

[Exported snapshots](https://www.postgresql.org/docs/18/functions-admin.html#FUNCTIONS-SNAPSHOT-SYNCHRONIZATION)
are importable only while their exporting transaction remains open;
[`pg_dump --snapshot`](https://www.postgresql.org/docs/18/app-pgdump.html)
imports that snapshot. Counts and hashes are not taken from a separate later source read.
If export/import, source permissions, idle settings or the tool environment do
not support this flow, the rehearsal fails. `SOURCE_SNAPSHOT_UNAVAILABLE` is a
sanitized diagnostic for export failure; there is no inconsistent-dump fallback.

The source is the project's trusted database: PostgreSQL warns that restoration
can execute source-defined schema code. This is not an arbitrary/untrusted dump
import service. The local target is exclusive to this job, has no application
clients and is discarded with the GitHub service.

## Version-2 Fingerprint Definition

For each table, PostgreSQL SHA-256 hashes the UTF-8 text serialization of
`to_jsonb(row)` for every complete row. It sorts the resulting 64-character
lowercase hex digests under `COLLATE pg_catalog."C"`, concatenates them **without
DISTINCT**, then SHA-256 hashes the UTF-8 concatenation. Fixed-length row digests
retain multiplicity without ambiguous separators. Physical insertion/scan order
does not matter; a same-count field change changes the fingerprint, subject to
the usual cryptographic collision assumption. Empty tables hash the empty string
and produce `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`.

Both source and restored reader transactions set local `TimeZone=UTC`,
`DateStyle=ISO`, `IntervalStyle=postgres`, `extra_float_digits=3` and
`bytea_output=hex` before counts/hashes. These normalize relevant textual type
representations without changing read-only isolation or the exported snapshot.
Fingerprint functions are `pg_catalog` qualified, table identifiers pass the
existing strict public-table allowlist/quoting helper, and output table names
are bound parameters. The implementation uses built-in
[`sha256(bytea)`, `encode` and `convert_to`](https://www.postgresql.org/docs/18/functions-binarystring.html),
not pgcrypto or any new extension/dependency.

Only one table query is in flight: count, validate the row cap, hash, then move to
the next table. At more than **1,000,000 rows per table**, it fails with
`ROW_LIMIT_EXCEEDED` before that table's hash aggregation. This caps each
concatenation at 64,000,000 digest bytes, not raw table size; existing SQL/job
deadlines still bound expensive rows and sorts. Raw rows, JSON serialization and
individual row digests never leave PostgreSQL. Node receives only each table's
count and aggregate hex digest. Reports contain `sourceSha256` and
`restoredSha256` alongside counts, never a row-hash list.

## Bounds And Privacy

- At most 128 public tables and 1,000,000 rows per table; identifiers must match
  the app allowlist before count/hash SQL is built. Counts and fingerprints are
  aggregated by PostgreSQL, not fetched rows. Table queries are sequential.
- Archive limit: 512 MiB. Backpressure and byte accounting apply before writing
  each chunk. Temporary directory/file permissions are 0700/0600 under a unique
  `RUNNER_TEMP` directory outside the repository.
- Each tool process is limited to 10 minutes, with an in-container `timeout`
  guard as well as a Node deadline. Orchestration aborts after 15 minutes; SQL
  statements have separate finite timeouts and the job hard limit is 20 minutes.
- Captured tool stdout is capped at 4 KiB; stderr is drained without retaining
  diagnostic content and capped at 64 KiB. Failures expose only fixed error codes.
  The disposable service uses no Docker log storage, and the restore session
  suppresses SQL/error-detail logging so rejected COPY rows cannot reach service
  logs. These session settings apply only to the local superuser-owned service,
  never to Neon.
- A failed/cancelled subprocess is killed and reaped, and the inspected disposable
  service is stopped to terminate its in-container child. Cleanup failure is a
  failed rehearsal, never a successful report. The remote timeout and GitHub
  service teardown remain safeguards if the Docker daemon becomes unavailable
  or the runner is forcibly terminated.
- The **only uploaded artifact** is the exact `database-restore-report.json`
  path, retained for 14 days: status/error code, safe numeric versions, known table
  names/counts/table-aggregate SHA-256 values and archive byte count/SHA-256.
  The archive, SQL, rows, passwords,
  users, connection URLs, snapshot identifiers and arbitrary tool stderr are never
  uploaded. No wildcard artifact path or raw-output log file is used.
  Upload additionally requires the current CLI invocation's `report_ready`
  output, set only after an exclusive write of its sanitized report succeeds;
  a pre-existing file is never accepted as this run's artifact.

All app data is treated as private even when declared test data. The temporary
archive is deleted, not preserved as a backup. Version-2 table fingerprints
detect same-count content changes, but do not independently validate constraints,
indexes, schema definitions, sequence state, provider/system schemas, global
roles/ACLs, production recovery timing or application-level recovery. They are
not full disaster-recovery signoff. The archive checksum identifies this dump
and is separate from the per-table content comparison.

## Legacy Version-1 Live Evidence

The evidence below belongs to `schemaVersion: 1`, scope
`public-table-count-rehearsal`. It is not a content-fingerprint proof and must not
be relabeled or upgraded by inference. A parent-reviewed manual run of the
existing workflow is still required for any live version-2 verification claim.

The first manual run
[39796378083](https://github.com/wndffs/kanji-app/actions/runs/39796378083)
succeeded on 2026-10-22 at commit `a7ea9b4`, job `119886926195`. Both source and
restored PostgreSQL reported 18.6; `pg_dump` and `pg_restore` were 18.6. All **45
public table inventories/counts matched**, including private/progress tables.
The temporary custom archive was **21,457,424 bytes**, SHA-256
`5372d53d46eda0e19caecf2c663dd4ae87af7dd55ae052f6df397cd678ec8433`.
The owned archive was removed before success, and the service teardown succeeded.

The [only uploaded artifact](https://github.com/wndffs/kanji-app/actions/runs/39796378083/artifacts/12432979321)
contains the sanitized report, not the archive or user rows. The workflow's 59
guardrail tests passed before the actual restore. This verifies this bounded
snapshot/count flow, not retained-backup policy, row fingerprints, application
recovery, roles/ACLs, provider schemas or full Task124 approval.

## Focused Local Checks

Only pure guardrails and mocked subprocess/Prisma interleavings run locally:

```sh
npm exec -- vitest run packages/db/test/database-restore.test.ts --no-cache --no-fsModuleCache --configLoader runner --maxWorkers=1
npm exec -- tsc -p packages/db/tsconfig.json --noEmit --incremental false
```

Tests cover routing and command boundaries, source snapshot lifetime, empty-target
checks before restore, archive/process limits, cleanup, sequential hashing,
canonical sessions, row limits, malformed inventory/hash rejection, same-count
digest mismatch and sanitized version-2 reporting.
One additional case in the existing PostgreSQL integration describe checks the
actual public Word fingerprint SQL: empty-table digest, identical IDs/timestamps
reinserted in reverse order, and a same-count single-field mutation. It creates
synthetic rows in the isolated integration database and deletes only its exact
IDs. This new real-SQL case has not been run locally; the parent's isolated GHA
integration run is required. No existing integration cases were changed.
Actual PostgreSQL/Neon snapshot and restore proof belongs to the parent's manual
cloud run; local passing tests do not establish that proof.
