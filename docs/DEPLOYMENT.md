# Production-like Docker deployment

## Scope

This setup is for a production-like local run and small self-hosted deployment
testing. It does not include managed secret storage, TLS termination, backups,
or observability.

Use the root repository as Docker build context:

```bash
docker build -f apps/api/Dockerfile .
docker build -f apps/web/Dockerfile .
```

## Required Environment

Keep deployment values in an untracked env file such as `.env.production.local`.
Do not commit real secrets.

```bash
POSTGRES_DB=kanji_srs
POSTGRES_USER=kanji
POSTGRES_PASSWORD=<set-a-local-password>
AUTH_TOKEN_SECRET=<set-a-long-random-secret>
WEB_ORIGIN=http://localhost:3000
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
```

Optional variables:

- `POSTGRES_PORT`: host port for PostgreSQL, default `5432`.
- `REDIS_PORT`: host port for Redis, default `6379`.
- `API_PORT`: host port for the API, default `3001`.
- `WEB_PORT`: host port for the web app, default `3000`.
- `AUTH_SESSION_TTL_MINUTES`: local auth token lifetime, default `43200`.
- `NEXT_PUBLIC_DEV_AUTH_EMAIL` and `NEXT_PUBLIC_DEV_AUTH_PASSWORD`: optional
  demo-login hints for non-production test builds.

API runtime variables:

- `NODE_ENV=production`
- `PORT=3001`
- `WEB_ORIGIN`
- `DATABASE_URL`
- `REDIS_URL`
- `AUTH_MODE=local`
- `AUTH_TOKEN_SECRET`
- `AUTH_SESSION_TTL_MINUTES`

Web runtime/build variables:

- `NODE_ENV=production`
- `HOSTNAME=0.0.0.0`
- `PORT=3000`
- `NEXT_PUBLIC_API_BASE_URL` at image build time

## Build

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml build
```

## Migrate

Run non-interactive Prisma migrations before starting application services:

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml --profile ops run --rm migrate
```

This uses `npm run db:migrate:deploy`, which maps to
`prisma migrate deploy`. Do not use `prisma migrate dev` in production.

## Seed

Seed project-authored starter content after migrations:

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml --profile ops run --rm seed
```

When `NODE_ENV=production`, the seed keeps the project-authored starter content
but skips the development demo user.

## Start

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml up -d api web
```

The compose file also starts PostgreSQL and Redis because the app services
depend on them.

## Health Checks

- API: `GET http://localhost:3001/health`
- Web: `GET http://localhost:3000/api/health`

The Dockerfiles and compose services use these endpoints for container
healthchecks.

## Stop

```bash
docker compose --env-file .env.production.local -f docker-compose.prod.yml down
```

Add `-v` only when you deliberately want to delete local database and Redis
volumes.

## Free staging stack

The recommended public staging setup is:

- Web: Vercel, deployed from the monorepo root with `vercel.json`.
- API: Render free web service, deployed from `render.yaml` and `apps/api/Dockerfile`.
- Postgres: Neon.
- Redis: not provisioned yet. The current API treats Redis as optional, and no
  background job runtime uses it.

Do not enable Neon Auth. Authentication is handled by the API and stored in the
project tables.

## Staging Environment Variables

Copy `.env.staging.example` locally when running deploy checks, but keep real
secret values out of git.

Generate the API token secret locally:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Render API variables:

```bash
NODE_ENV=production
PORT=3001
AUTH_MODE=local
AUTH_TOKEN_SECRET=<generated-secret>
AUTH_SESSION_TTL_MINUTES=43200
WEB_ORIGIN=https://<your-vercel-project>.vercel.app
DATABASE_URL=<neon-postgres-url-with-sslmode-require>
```

`REDIS_URL` can remain unset until background jobs are implemented. Upstash is
the intended free staging provider when Redis becomes necessary.

Vercel web variables:

```bash
NEXT_PUBLIC_API_BASE_URL=https://<your-render-service>.onrender.com
```

Remote smoke variables for local checks:

```bash
STAGING_WEB_URL=https://<your-vercel-project>.vercel.app
STAGING_API_URL=https://<your-render-service>.onrender.com
```

## First Staging Deploy

1. Create a Neon project.
   - Use Neon only as Postgres.
   - For local migration/seed commands, prefer the direct connection string.
   - For the Render API runtime, the pooled connection string is acceptable.

2. Add the direct Neon connection string as the GitHub repository secret
   `STAGING_DATABASE_URL`. Do not use the pooled URL for this secret.

3. Open GitHub Actions, select `Deploy staging database`, and run the workflow
   from the `main` branch. The workflow applies all Prisma migrations and runs
   the production seed from a GitHub-hosted runner, avoiding local VPN and
   database-route dependencies. Leave `rolled_back_migration` empty during a
   normal deploy. Set it only when Prisma reports a failed migration that must
   be marked as rolled back before retrying.

After the database deploy succeeds, use the separate `Import staging content`
workflow to load a checksummed full JMdict/KANJIDIC2/KanjiVG snapshot. Detailed
inputs, provenance behavior, and retry rules are documented in
`docs/IMPORT_OPERATIONS.md`. This import is intentionally not part of every
deployment because the source data is large and changes independently of the
application schema.

The workflow verifies full-corpus minimums after import and uploads both a
source manifest and a database count report. Treat the run as successful only
when the report distinguishes a complete raw dictionary from the much smaller
published course without failing its minimum checks.

For a local fallback, apply the same migrations and seed from a trusted machine:

```bash
$env:DATABASE_URL = "<neon-direct-postgres-url-with-sslmode-require>"
$env:NODE_ENV = "production"
npm run db:migrate:deploy
npm run db:seed
Remove-Item Env:DATABASE_URL
Remove-Item Env:NODE_ENV
```

The production seed creates project-authored starter content, SRS stages, and
the starter course. It intentionally does not create a demo user.

4. Create the Render API service from `render.yaml`.
   - The blueprint pins the service to Frankfurt to match the Neon region.
   - Set `DATABASE_URL` and `WEB_ORIGIN` in the Render dashboard.
   - `AUTH_TOKEN_SECRET` can be generated by Render from the blueprint or set
     manually.
   - Health check path: `/health`.

5. Create the Vercel web project from the same GitHub repository.
   - Use the repository root.
   - `vercel.json` supplies the Next.js framework, install, build, and output
     settings.
   - Set `NEXT_PUBLIC_API_BASE_URL` to the Render API URL.

6. If either generated URL differs from the planned value, update the paired
   environment variable and redeploy:
   - Update Render `WEB_ORIGIN` when the Vercel URL changes.
   - Update Vercel `NEXT_PUBLIC_API_BASE_URL` when the Render API URL changes.

## Remote Smoke

After both services are deployed and the database has been migrated/seeded:

```bash
$env:STAGING_WEB_URL = "https://<your-vercel-project>.vercel.app"
$env:STAGING_API_URL = "https://<your-render-service>.onrender.com"
npm run smoke:remote
Remove-Item Env:STAGING_WEB_URL
Remove-Item Env:STAGING_API_URL
```

The remote smoke script checks:

- Web health endpoint `/api/health`.
- API health endpoint `/health`.
- Register/login path against the real API.
- Starter-course auto-enrollment for a new user.
- Non-empty starter lesson queue.

If you want the smoke script to reuse a stable staging user instead of creating
a throwaway user each run, also set:

```bash
$env:STAGING_SMOKE_EMAIL = "staging-smoke@example.test"
$env:STAGING_SMOKE_PASSWORD = "<strong-password>"
```

Render free services may spin down after inactivity, so the first remote smoke
run can be slower while the API wakes up.
