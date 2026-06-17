# Architecture

## High-level layers

1. Data/source layer: raw imports, licenses, attribution, checksums, import runs.
2. Linguistic graph layer: components, kanji, words, senses, sentences, relations.
3. Pedagogical content layer: curated Russian and English meanings, mnemonics, hints, accepted/blocked answers.
4. Curriculum layer: structured levels, goal courses, dynamic text decks.
5. SRS layer: card scheduling, review history, forecast, leech detection.
6. Application API layer: auth, user progress, lessons, reviews, search, admin.
7. Web UI layer: responsive Next.js interface.
8. Admin/ops layer: content curation, import status, data-source visibility, QA.

## Core concept

The application is not a dictionary with SRS bolted on. It is a learning graph:

component -> kanji -> vocabulary -> sentence -> course/deck -> user progress

Raw dictionary records are not directly reviewed. Curated `LearningCard` records define what a learner sees and how the answer is checked. Cards must support Russian-only, English-only, and Russian-plus-English translation display modes.

## Recommended apps and packages

- `apps/web`: user and admin UI.
- `apps/api`: NestJS REST API.
- `packages/db`: Prisma schema and migrations.
- `packages/srs`: scheduling logic.
- `packages/japanese`: normalization and answer validation.
- `packages/content-importers`: importers and source normalization.
- `packages/shared`: shared DTOs and types.
- `packages/ui`: optional UI component library.

## Important non-goals

- Do not build a WaniKani clone visually.
- Do not copy WaniKani content or level order.
- Do not implement public community content in MVP.
- Do not build a native mobile application in MVP.
- Do not overbuild ML/AI content generation before the basic learning loop works.
