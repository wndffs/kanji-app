# apps/api/AGENTS.md

This app is the NestJS API service.

## Responsibilities

- Auth, users, course enrollment, lessons, reviews, items, decks, search, user overrides, and admin APIs.
- Orchestrate domain packages without duplicating their logic.
- Expose stable DTOs from `packages/shared`.

## Boundaries

- SRS calculations belong in `packages/srs`.
- Answer normalization/validation belongs in `packages/japanese`.
- DB schema and Prisma client belong in `packages/db`.
- Importer parsing belongs in `packages/content-importers`.

## API behavior

- Validate inputs with DTO schemas.
- Return Russian-friendly error messages where user-facing, and expose learning-card translations according to the user's Russian/English display mode.
- Keep administrative endpoints role-protected.
- Log import runs, review submissions, and scheduling decisions enough to debug but never log passwords or secrets.
