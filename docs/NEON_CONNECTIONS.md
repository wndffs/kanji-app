# Neon Connection Timeouts

The deployment audit reproduced a `P1001` after Neon was idle. The same
GitHub migration succeeded after a read-only SQL query woke the compute, with
no password, VPN, or schema reset. This supports a cold-start diagnosis for
that attempt, not a claim that every earlier timeout had the same cause.

Prisma 6 defaults to a five-second connection timeout. Its
[official Neon guide](https://docs.prisma.io/docs/orm/v6/overview/databases/neon)
recommends increasing connection/pool timeouts when a sleeping compute cannot
wake within that window.

`withNeonConnectionDefaults` adds `connect_timeout=15` and `pool_timeout=15`
only for PostgreSQL URLs on a `.neon.tech` host. API configuration and the
Prisma CLI both use it. Explicit settings, SSL/channel-binding options,
credentials, and non-Neon connections remain unchanged. There is no perpetual
keepalive, unlimited retry, disabled TLS, or disabled migration locking.

A `P1002` mentioning `pg_advisory_lock` is different: inspect concurrent
migration jobs and database locks. Do not disable advisory locking or retry a
failed/partially applied migration blindly. A `P3009` requires inspecting and
repairing the failed migration before resolving it. Never reset staging or
production merely to get past an error.

Verified forward deployment: [database run 39614884231, attempt 2](https://github.com/wndffs/kanji-app/actions/runs/39614884231/attempts/2).
It applies the committed migration and seeds idempotently. The first attempt
failed before applying a migration; no failed migration was marked rolled back.
