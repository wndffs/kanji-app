# Product Roadmap 340-399

Baseline: `f57802f`. The next 60 task numbers are reserved below. The current
request authorizes implementation of **385-399 only**, with one task commit,
batched checks, checkpoint push, deployment and server acceptance. Future
batches are plans, not claims of completed work. Revalidate each against the
then-current application before implementation; replace already-solved gaps
within that batch without silently changing its objective or numbering.

## 340-354: Lesson Workspace

Detailed acceptance: `DEVELOPMENT_CYCLE_340_354.md`.

Checkpoint: **340-354 complete and released** as `cycle-340-354-lessons`.
Runtime/server/CI evidence lives in the cycle document. The live profile had an
unfinished lesson, so acceptance verified safe resume without changing progress
rather than destroying it to expose the lobby. The review batch follows below.

| ID  | Planned Outcome                                                            |
| --- | -------------------------------------------------------------------------- |
| 340 | Validate gaps, reserve this roadmap and specify the current batch          |
| 341 | Isolate lesson UI by account and requested course/deck source              |
| 342 | Cancel obsolete queue/active reads and reject stale-owner results          |
| 343 | Expose an unfinished lesson from another source without abandoning it      |
| 344 | Explicit bounded search of eligible materials, including kana/romaji/RU/EN |
| 345 | Bookmarkable kind/level/selected filters, without changing eligibility     |
| 346 | Bounded picker pages with useful empty/reset states                        |
| 347 | Ordered selected-batch preview and individual removal, even across filters |
| 348 | Small-batch size presets, constrained by actual server limits              |
| 349 | Honest material/card totals and pending-start/settings guards              |
| 350 | Clear source identity and actionable empty/error navigation                |
| 351 | Distinct teaching-phase and quiz progress, without implying SRS creation   |
| 352 | Return to a previous teaching material through confirmed progress writes   |
| 353 | Batched scoped acceptance and responsive screenshots                       |
| 354 | Version, push, deploy, exact revision and real lesson-entry inspection     |

## 355-369: Review Workspace

Checkpoint: **355-369 complete and released**. Evidence and the test-only patch
tag `cycle-355-369-reviews.1` are in `DEVELOPMENT_CYCLE_355_369.md`. Runtime
`b97f57b` was verified on web/API and through real read-only queue browsing;
the patch does not change runtime code. CI 40710885018 passed 453 browser cases
with one skip. The course-path batch's checkpoint follows below.

| ID  | Planned Outcome                                                            |
| --- | -------------------------------------------------------------------------- |
| 355 | Audit the real review journey and refine this batch's acceptance           |
| 356 | Verify account/source isolation for queue and session reads                |
| 357 | Recover queue load failures locally with bounded explicit retries          |
| 358 | Simplify the review lobby around due work and the primary next action      |
| 359 | Distinguish scheduled cards, distinct materials and unfinished corrections |
| 360 | Add or refine usable due-queue filters based only on loaded real data      |
| 361 | Make scheduled-time previews readable in the user's timezone               |
| 362 | Tighten meaning/reading/listening prompt hierarchy and reading concealment |
| 363 | Clarify wrong/typo/reveal/manual-ignore feedback without changing grading  |
| 364 | Preserve answer text and recover ambiguous failed writes without replay    |
| 365 | Complete keyboard/focus behavior across answer, feedback and correction    |
| 366 | Refine phone answer/feedback controls above navigation and keyboards       |
| 367 | Make confirmed session completion and the next useful route unambiguous    |
| 368 | Batch review regression tests and both-theme viewport acceptance           |
| 369 | Release and verify real queue/review entry without altering user progress  |

## 370-384: Course Path And Content

Checkpoint: **370-384 complete and released**. Specification and evidence:
`DEVELOPMENT_CYCLE_370_384.md`. Final tag `cycle-370-384-course-path.1`, runtime
`d9614dd` verified on web/API. CI 40721147665 passed 469 browser cases with one
skip. V4 live coverage is 79 components, 101 kanji, 120 words and 521 cards.
Draft07 remains unpublished, without exact-source or independent editorial
approval. The next checkpoint below covers **385-399**.

| ID  | Planned Outcome                                                                  |
| --- | -------------------------------------------------------------------------------- |
| 370 | Audit published course coverage separately from imported dictionary volume       |
| 371 | Report actual kanji/word/card and RU/EN/reading gaps by level and JLPT band      |
| 372 | Improve the next-learning-path entry using real prerequisites                    |
| 373 | Make locked material reasons and the first required predecessor actionable       |
| 374 | Strengthen component-to-kanji navigation without conflating shape and meaning    |
| 375 | Strengthen kanji-to-vocabulary reinforcement and taught-reading evidence         |
| 376 | Show selected versus dictionary meanings/readings consistently in course views   |
| 377 | Define the next bounded content wave from existing legal local source snapshots  |
| 378 | Prepare independently authored/reviewed Russian learning meanings for that wave  |
| 379 | Prepare matching English learning meanings and explicit missing-content gates    |
| 380 | Validate primary taught readings and accepted alternatives for that wave         |
| 381 | Validate independent placement order, prerequisites and source provenance        |
| 382 | Produce an aggregate publication/readiness report with exact counts and blockers |
| 383 | Batch content/route regressions, license and pedagogical spot checks             |
| 384 | Release code; publish course content only with separate explicit authorization   |

The content wave's exact volume is set after task 371, not invented in advance.
N2 is the intended ceiling of the learning programme, not a claim of current
coverage. The long-term target remains 2,300 placed kanji and 8,000 vocabulary
expression-reading pairs with reviewed RU/EN content. Finishing UI tasks does
not satisfy that target, and imported rows are not published course items.

## 385-399: Cohesion And Performance

Checkpoint: **385-399 complete and released**. Specification and evidence:
`DEVELOPMENT_CYCLE_385_399.md`. Final tag `cycle-385-399-journeys.2`, runtime
`1fdd9b0` verified on web/API. CI 40734207974 passed 479 browser cases with
one skip. Live acceptance repaired the published-demo catalogue boundary and
a real rapid-filter race without publishing new content or changing progress.
This closes the reserved 340-399 cycles, not the full product vision: V4 remains
101 kanji/120 word pairs, draft07 still needs source evidence and independent
approval, and stable full-size performance remains unproven. At that checkpoint,
no 400+ work had been authorized or started. The subsequent user request reserves
400-499 and authorizes 400-414; see `ROADMAP_400_499.md` for the new active scope.

| ID  | Planned Outcome                                                                   |
| --- | --------------------------------------------------------------------------------- |
| 385 | Audit full learner journeys and reserve measurable acceptance thresholds          |
| 386 | Make course/catalogue/material/lesson return navigation consistent                |
| 387 | Consolidate duplicate or competing primary actions on learner screens             |
| 388 | Make loading, stale, empty, offline and retry states consistent and honest        |
| 389 | Verify RU/EN/RU+EN and pronunciation settings across all learning routes          |
| 390 | Verify theme/density preferences and long-text fit across desktop/phone           |
| 391 | Measure dashboard/lesson/review latency and identify network versus query cost    |
| 392 | Remove evidenced redundant sequential reads without weakening owner checks        |
| 393 | Optimize evidenced expensive database queries with scoped regression coverage     |
| 394 | Refine account-scoped transient caching only where measured and justified         |
| 395 | Verify writes remain recoverable across reconnect/navigation/account changes      |
| 396 | Align keyboard, touch, focus and reduced-motion behavior on core journeys         |
| 397 | Complete the visual consistency pass against original design conventions          |
| 398 | Batch end-to-end beginner and continuing-learner acceptance plus regression audit |
| 399 | Release, verify deployment and report actual feature/content gaps that remain     |

## Boundaries

Original UI and independent educational wording, no competitor scraper/assets.
Kana remains separate from SRS. No silent grading/scheduling changes, private
answer leakage or false progress. npm only; no new dependencies without need.
No automatic paid hosting changes, keepalive polling, database reset or bulk
Neon publication. Reports in Git contain only aggregate counts, never detailed
Neon exports, credentials or private account/progress content. Tests are scoped
locally and batched; cloud CI supplies broad regressions. Each batch closes its
temporary browser tabs and owned servers and removes temporary build/test files.
