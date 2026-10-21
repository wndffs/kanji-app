# Testing

## PostgreSQL 18 Study Integrity

The dedicated `.github/workflows/study-integrity.yml` workflow runs on pull
requests, pushes, and manual dispatch. It provisions an ephemeral `postgres:18`
service, installs with `npm ci`, generates Prisma, applies migrations without
seeding, and runs only `apps/api/test/reviews-postgres.integration.test.ts`.
Superseded runs for the same pull request or branch are cancelled.

For an already provisioned, isolated local PostgreSQL 18 database:

```bash
export INTEGRATION_DATABASE_URL='postgresql://kanji:integration-only@localhost:5432/kanji_integration?schema=public'
export DATABASE_URL="$INTEGRATION_DATABASE_URL"
npm run db:generate
npm run db:migrate:deploy
npm exec -- vitest run apps/api/test/reviews-postgres.integration.test.ts --maxWorkers=1
```

`integration-only` is a disposable test-service password, not an application
credential. No API/web server or seed corpus is needed. The test creates users
with explicitly non-authenticating dummy password hashes.

Without `INTEGRATION_DATABASE_URL`, database tests skip and URL safety tests
still run. The suite never falls back to `DATABASE_URL`. Before connecting, it
requires a PostgreSQL URL with host `localhost`, `127.0.0.1`, or `[::1]`, the exact
database name `kanji_integration`, and no options except optional `schema=public`.
It checks the connected database name and PostgreSQL major version 18 before
creating fixtures. Remote targets, application database names, alternate
schemas, and connection-redirection options are refused.

The tests use real `PrismaService` and `PrismaReviewsRepository` instances on
independent connections. A third connection holds a row lock; the test observes
both writers waiting in `pg_stat_activity` before releasing the lock. Coverage
includes competing same-card scheduling, same-session/no-op duplicates, stale
snapshots, finish-vs-answer races, wrong session modes, owner boundaries, actual
PostgreSQL insert rollback, and practice JSON snapshot comparisons.

Each case creates UUID-scoped fixtures transactionally and deletes only its own
users, learning items, component, and SRS system in `finally`. Related records
cascade from those identities. There is no truncate, migration reset, global
delete, production password service, or runtime dependency addition.
