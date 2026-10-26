# Responsive Study Workspace 280-294

Baseline: `84822e6`. Continue the approved original learner design while fixing
the reported dashboard wait. Commit tasks separately; batch relevant checks;
deploy and verify exact web/API revisions after the cycle. Next unused ID: 295.

## Measured Problem

Three authenticated dashboard requests from the development machine measured
923/781/761 ms, 6305 bytes each. Login was 1011 ms. No server timing header was
available. These warm samples do not reproduce or disprove the reported 3+ s.
The previous cloud audit median was 575 ms from a different network/profile.

Current handler waits for 13 repository operations and then four hydration
operations, including secondary statistics. Current-course resolution repeats
three times, and the frontend eagerly fetches all courses. It discards the panel
on every navigation and has no explicit dashboard retry or account ownership
guard. The deployed Render plan is Free (Frankfurt); Render can sleep after
15 minutes and Neon compute after 5 minutes. Do not claim cold start explains a
particular request without timing evidence, disable scale-to-zero, change billing,
or add keep-alive traffic to hide a platform limit.

## Tasks

| ID  | Scope                           | Acceptance                                                                                            | State     |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | --------- |
| 280 | Diagnosis and specification     | Record actual baseline, hypotheses and bounded task scope                                             | Complete  |
| 281 | Dashboard timing                | Safe Server-Timing for authentication/handler phases; browser-readable, no credentials/content        | Complete  |
| 282 | Request-local course resolution | Resolve once for availability, course progress and unlocks; no global user cache                      | Complete  |
| 283 | Narrow course projections       | Fetch only dashboard scalar/relation fields; preserve published/user filters and ordering             | Complete  |
| 284 | Cancellable dashboard reads     | Abort obsolete GETs, preserve API error semantics, never replay writes                                | Complete  |
| 285 | Dashboard account ownership     | Key by account/token; late old requests cannot show data, save or clear a newer session               | Complete  |
| 286 | Bounded in-memory snapshots     | Per-account/settings snapshot, no persistent private cache; bounded age and explicit freshness        | Complete  |
| 287 | Mutation invalidation           | Confirmed writes/session changes invalidate snapshots; stale in-flight loads cannot repopulate        | Complete  |
| 288 | Nonblocking refresh/recovery    | Preserve useful snapshot during GET refresh; visible retry/error and no stale reminders               | Complete  |
| 289 | On-demand course selector       | Fetch course list only when needed; preserve empty/current-course/conflict recovery                   | Complete  |
| 290 | Honest loading states           | Two-tile skeleton, delayed slow-load feedback, explicit refresh; no invented counters                 | Complete  |
| 291 | Dashboard secondary hierarchy   | Default secondary statistics share one optional area; personal widget order/visibility retained       | Complete  |
| 292 | Lesson phase keyboard flow      | Roving phase tabs, Arrow/Home/End behavior with pending-write guards and no premature disclosure      | Complete  |
| 293 | Performance evidence            | Extend bounded remote measurements with timing breakdown, warm budgets and sanitized aggregate output | Complete  |
| 294 | Acceptance and release          | Scoped batches, desktop/phone proof, tag, deploy, exact revision remote smoke and cleanup             | Verifying |

## Boundaries

Keep server responses authoritative for counts, accepted answers, SRS and
completion. A browser snapshot is labelled and is never grading evidence or a
review reminder confirmation. Do not add a server-wide stale dashboard cache.
No new dependency, copied WaniKani content/UI, curriculum publication, seed,
migration, account reset, paid hosting change or SRS interval change. Kana
remains separate from SRS. RU/EN/RU+EN and private content ownership remain.

Only intentional code/tests/docs belong in Git. Captures, logs and transient
outputs stay outside the repository. Close used IAB tabs and owned servers.

## Verification Plan

Batch dashboard repository/service/HTTP tests, web snapshot/API tests and relevant
dashboard/lesson/navigation browser scenarios. Build/typecheck touched workspaces,
lint/format touched files, then use cloud CI for the full suite. Test account
replacement, abort, rejection/retry, invalidation during pending reads, mutation
failure, expiry, hidden widgets, course conflicts and pending lesson navigation.
Compare warm server handler time with whole-request elapsed time; publish only
aggregate measurements, never credentials, tokens, account data or source pairs.

## Local Acceptance

Implemented 280-293. Dashboard timings expose only numeric `auth`, `primary`,
`hydrate` and `dashboard` durations. `primary` and `hydrate` are parts of the
dashboard total, not additional durations to sum. Network, proxy queuing, cold
start and JSON transfer remain outside the handler measurement.

Current-course resolution now runs once per dashboard call, not three times.
The two course queries select only required fields. Browser snapshots retain
one exact account/token/settings response in memory for navigation restoration,
up to 30 seconds; nothing is persisted. Returning to a visible stale panel can
refresh it, without background keep-alive traffic. Confirmed learning/settings
writes and session changes invalidate snapshots. Notification claims do not:
their server-side deduplication write must not create a panel refresh loop.

Course selection is lazy, automatically opened/loaded only for an absent current
course. Existing personal widget order/visibility is retained; only the untouched
default groups statistics/history. Lesson tabs preserve async phase writes and
restore keyboard focus only after the server-confirmed phase transition.

Checks:

- API typecheck and 120 scoped dashboard/authentication unit cases passed.
- Relevant web state/study/navigation tests passed; the focused final snapshot,
  request and notification batch passed 58 cases. Remote-script safety/timing
  tests passed 115 cases.
- Final web production build and typecheck passed. Changed-file lint and format
  checks passed. No full local monorepo test/build loop was run.
- Initial scoped browser batch: 131 passed, one intended desktop skip, four
  failures in two new locators on both viewports. Corrected the overly exact
  course-field locator and scoped the feedback alert away from Next's announcer.
  Eight focused repair/loading cases then passed on desktop/phone.
- Existing lesson quizzes, review correction/IME, kana ownership, settings drafts,
  notification claims, course conflicts and widget persistence remain covered.
  Light/dark desktop/phone screenshots are kept outside Git.

No data import/publication, migration, account reset, dependency or hosting-plan
change was performed. Release/deployment evidence follows after cloud acceptance.
