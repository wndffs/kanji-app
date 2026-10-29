# Kanji SRS

Personal Russian-localized Japanese kanji and vocabulary SRS web application.

This repository is an npm TypeScript monorepo with a tiny project-authored starter course for local development and smoke testing. The seed is deliberately small and is not copied from WaniKani or external decks.

## Current Roadmap

The current numbered backlog is [400-499](docs/ROADMAP_400_499.md), with the
latest released [445-459 batch](docs/DEVELOPMENT_CYCLE_445_459.md). It prioritizes
reviewed content and truthful scope reporting over further visual-only cycles.
Later reserved tasks are not completed work or a promise of full JLPT coverage.
Next reserved batch: 460-474. Published V6 contains 112 kanji, 160 word pairs
and 632 core cards across twelve levels, including the first bounded verb and
adjective wave. Retention now includes bilingual reading guidance, visual
contrasts, rotating missed-card practice, private rehearsal history and a
one-word licensed recorded-pronunciation pilot. Older finite courses and
existing learning progress remain.

See [the revalidated roadmap](docs/REVALIDATION_2026_10_21.md) for current execution
order, shipped functionality and remaining acceptance gates. Task numbers are
stable identifiers, not execution order. [Publication status](docs/TASK_118_PUBLICATION_STATUS.md)
distinguishes raw dictionary capacity, curated main-course content and the
separately published finite pilot; none should be reported as a complete course.

## Requirements

- Node.js 22.12 or newer (supported even-numbered Node releases)
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

The initial seed is tiny, handcrafted project content for local development. It does not include external datasets, WaniKani-derived content, or community deck content.

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

The repository may contain only tiny fixtures and project-authored starter content. Full-size raw source dumps belong outside git, or in ignored local paths such as `data/raw/` while running local imports.

Future data imports must use legally reusable sources, track source/license/checksum/import runs, and keep raw imported data separate from curated Russian and English learning content. See [`docs/DATA_SOURCES_AND_LICENSING.md`](docs/DATA_SOURCES_AND_LICENSING.md) and [`docs/IMPORT_OPERATIONS.md`](docs/IMPORT_OPERATIONS.md).
