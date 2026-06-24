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
