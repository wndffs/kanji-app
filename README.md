# Kanji SRS

Personal Russian-localized Japanese kanji and vocabulary SRS web application.

This repository is bootstrapped as an npm TypeScript monorepo. The current state is infrastructure only: workspace wiring, app shells, package shells, local service configuration, and placeholder tests.

## Requirements

- Node.js 20.11 or newer
- npm 10 or newer
- Docker Desktop or another Docker Compose-compatible runtime

## Install

```bash
npm install
```

## Environment

Copy the example files before running local services:

```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
cp packages/db/.env.example packages/db/.env
```

The default local service URLs are:

- Web: `http://localhost:3000`
- API: `http://localhost:3001`
- PostgreSQL: `localhost:5432`
- Redis: `localhost:6379`

## Local Infrastructure

```bash
docker compose up -d
```

This starts PostgreSQL and Redis for later API and importer tasks.

For production-like Docker builds and deployment flow, see
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Database

After copying the env files and starting PostgreSQL:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

The initial seed is tiny, handcrafted project content for local development. It does not include external datasets or WaniKani-derived content.

## Development

```bash
npm run dev
```

The root dev script starts the Next.js web app and NestJS API in parallel.

## Validation

```bash
npm run db:generate
npm run lint
npm run typecheck
npm test
npm run build
npm run test:smoke --workspace @kanji-srs/web
```

CI runs the same npm validation commands. The web smoke command starts a local
Next.js test server and installs/runs Playwright in CI.

## Workspace Layout

- `apps/web`: Next.js web app
- `apps/api`: NestJS API service
- `packages/db`: database and Prisma ownership package
- `packages/srs`: framework-agnostic SRS scheduling package
- `packages/japanese`: Japanese/Russian normalization and answer validation package
- `packages/content-importers`: local-file import pipelines
- `packages/shared`: serializable shared types and constants
- `packages/ui`: reusable React UI components
- `docs`: product, architecture, licensing, and task documentation

## Data And Licensing

No educational content is seeded in this bootstrap. Future data imports must use legally reusable sources, track source/license/import runs, and keep raw imported data separate from curated Russian learning content.
