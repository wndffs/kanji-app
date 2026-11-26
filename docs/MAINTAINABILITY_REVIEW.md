# Maintainability review

## Learner experience

The main study loop is the priority: pick up today's work, learn a material in
meaning/reading/context order, answer without distractions, and see progress
toward the next level. References: [WaniKani level progress](https://knowledge.wanikani.com/widgets/level-progress/),
[lessons](https://knowledge.wanikani.com/getting-started/unlocking-kanji/) and
[reviews](https://knowledge.wanikani.com/getting-started/first-reviews/).
These are interaction references, not sources of assets, CSS, wording, course order, or data.

This pass makes teaching a single reading column, unifies the question and answer
layout in lessons and reviews, and puts level progress into comparable subject rows.
It leaves keyboard flow, listening, recovery, display modes, and separate kana lessons in place.

## Completed simplifications

- [Lesson persistence](../apps/api/src/lessons/lessons.repository.ts): removed the
  unused whole-course and whole-deck material loaders. Eligibility stays a light
  query; only selected IDs go through the existing bounded material loader.
  The example, target, and PostgreSQL tests now exercise that same loader.
- [Lesson budget](../apps/api/src/lessons/lesson-budget.ts): Dashboard and Lessons
  use one rule for local-day limits, counting each material once regardless of
  card count. Dashboard reuses the result for both its count and workload widget;
  the calculation creates one date formatter for the scan.
- [Lesson availability](../apps/api/src/dashboard/dashboard.service.ts):
  Dashboard and Lessons use the same prerequisite check. Dashboard fetches
  published card IDs in bounded batches for external prerequisites and validates
  listening eligibility only where needed. A single completed card is not enough
  when a second eligible card still falls short of the required stage.

## Next refactors

| Priority | Area                                                                                                                                                                                                    | Change and regression check                                                                                                                                                                                                                                                                                                                            |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 2        | [Lessons client](../apps/web/src/app/lessons/LessonsClient.tsx), [Reviews client](../apps/web/src/app/reviews/ReviewsClient.tsx), [Dashboard client](../apps/web/src/app/dashboard/DashboardClient.tsx) | Extract lesson phase presentation, review feedback, and Dashboard widgets along their existing props. Keep state transitions and request identity in their owning session; do not create a generic lesson/review state machine. Exercise resume, retry, skipping, IME, listening, feedback focus, and RU/EN/RU+EN before moving state.                 |
| 3        | [Global CSS](../apps/web/src/app/globals.css) and [product CSS](../apps/web/src/app/product.css)                                                                                                        | The root loads both files on every route, with over 10,000 lines combined and several successive overrides for the same controls. Keep theme tokens and the shell global. Migrate one route or shared component at a time, deleting the old rules in the same change; check mobile/desktop, short viewports, dark/light and compact/standard settings. |
| 4        | [Database package entry point](../packages/db/src/index.ts)                                                                                                                                             | The same entry point exports Prisma and the editorial registry. Profile cold startup before attributing latency to it. If material, split runtime helpers from seed and editorial subpaths, and measure API startup and build size before/after. Preserve source attribution and publication checks.                                                   |
| 5        | [Admin repository](../apps/api/src/admin/admin.repository.ts) and [API client](../apps/web/src/lib/api-client.ts)                                                                                       | Split the admin repository by curation, planning, and publication after dependency mapping. Keep the transaction/locking boundary intact for apply, publish, and rollout. Split HTTP endpoints by domain only where it helps navigation or bundle size; continue to use one shared transport for auth, errors and cancellation.                        |

The SRS and Japanese packages already have useful boundaries. Keep scheduling
and answer normalization there, keep kana outside SRS, and avoid a rewrite of
the schema, tests, or curriculum data. Use the existing Dashboard server timing
and authenticated smoke checks before claiming a production latency improvement.
