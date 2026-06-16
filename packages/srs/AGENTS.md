# packages/srs/AGENTS.md

This package owns all SRS scheduling logic.

## Requirements

- Framework-agnostic TypeScript.
- Deterministic pure functions where possible.
- Configurable stage system.
- Strong unit tests.

## Public API direction

Expose functions similar to:

- `calculateNextReview(input): ReviewSchedulingResult`
- `getDueCards(input): DueCard[]`
- `buildReviewForecast(input): ReviewForecastBucket[]`
- `resurrectCard(input): UserSrsState`

Do not import Prisma, NestJS, Next.js, React, or browser APIs.
