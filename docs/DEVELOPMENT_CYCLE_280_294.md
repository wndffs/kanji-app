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

| ID  | Scope                           | Acceptance                                                                                            | State    |
| --- | ------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| 280 | Diagnosis and specification     | Record actual baseline, hypotheses and bounded task scope                                             | Complete |
| 281 | Dashboard timing                | Safe Server-Timing for authentication/handler phases; browser-readable, no credentials/content        | Complete |
| 282 | Request-local course resolution | Resolve once for availability, course progress and unlocks; no global user cache                      | Complete |
| 283 | Narrow course projections       | Fetch only dashboard scalar/relation fields; preserve published/user filters and ordering             | Complete |
| 284 | Cancellable dashboard reads     | Abort obsolete GETs, preserve API error semantics, never replay writes                                | Complete |
| 285 | Dashboard account ownership     | Key by account/token; late old requests cannot show data, save or clear a newer session               | Complete |
| 286 | Bounded in-memory snapshots     | Per-account/settings snapshot, no persistent private cache; bounded age and explicit freshness        | Complete |
| 287 | Mutation invalidation           | Confirmed writes/session changes invalidate snapshots; stale in-flight loads cannot repopulate        | Complete |
| 288 | Nonblocking refresh/recovery    | Preserve useful snapshot during GET refresh; visible retry/error and no stale reminders               | Complete |
| 289 | On-demand course selector       | Fetch course list only when needed; preserve empty/current-course/conflict recovery                   | Complete |
| 290 | Honest loading states           | Two-tile skeleton, delayed slow-load feedback, explicit refresh; no invented counters                 | Complete |
| 291 | Dashboard secondary hierarchy   | Default secondary statistics share one optional area; personal widget order/visibility retained       | Complete |
| 292 | Lesson phase keyboard flow      | Roving phase tabs, Arrow/Home/End behavior with pending-write guards and no premature disclosure      | Complete |
| 293 | Performance evidence            | Extend bounded remote measurements with timing breakdown, warm budgets and sanitized aggregate output | Complete |
| 294 | Acceptance and release          | Scoped batches, desktop/phone proof, tag, deploy, exact revision remote smoke and cleanup             | Complete |

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

### Final Network Finding

The production API is cross-origin from Vercel and uses Authorization, so browser
GETs can require an OPTIONS preflight. A bounded check returned 204 in 740 ms,
with the correct allowed origin but no Access-Control-Max-Age. Added a 600-second
preflight permission cache in task 294 acceptance. This caches CORS permission,
not API data or credentials; the allowlist and per-request authentication are
unchanged. It removes repeat preflights within the browser's cache rules, not the
first request or cold-start latency. See
[MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Access-Control-Max-Age).
This separate round trip is one confirmed cost, not retrospective proof of the
user's particular 3+ second request.

## Released Version

All 280-294 complete. Tag: `cycle-280-294-ux`. Verified web and API revision:
`f53eada089f5f8e045436727ef409d0e5ca0e46a`. Next task number: 295.

- [CI 40385319661](https://github.com/wndffs/kanji-app/actions/runs/40385319661):
  Quality passed; full Web smoke passed **339 cases**, with one intentional
  desktop skip for a mobile-only case (340 total, two workers).
- [Study integrity 40385319676](https://github.com/wndffs/kanji-app/actions/runs/40385319676):
  PostgreSQL 18 review/concurrency regressions passed.
- Both public health endpoints independently returned the exact revision above.
- [Remote smoke 40386285328](https://github.com/wndffs/kanji-app/actions/runs/40386285328)
  passed with both expected full SHAs and the already-published finite V4 pilot.
  Only a disposable audit profile was enrolled; no curriculum was published.
- Final OPTIONS response: 204, existing exact frontend origin, and
  `Access-Control-Max-Age: 600` verified on the deployed API.
- An earlier candidate CI was superseded while Ubuntu apt dependency installation
  was stalled, before browser scenarios started. No application failure was
  inferred from that infrastructure wait. The final run completed normally.

### Timing Results And Limits

Post-integration requests from the same development machine/test account:

| Sample | Full HTTP ms | Auth ms | Dashboard handler ms | Bytes |
| ------ | ------------ | ------- | -------------------- | ----- |
| 1      | 640          | 7.8     | 162.8                | 6305  |
| 2      | 935          | 14.0    | 316.9                | 6305  |
| 3      | 815          | 12.8    | 270.6                | 6305  |

These requests exclude the browser's separate CORS preflight. A manual OPTIONS
request before the max-age fix took 740 ms. The cache removes eligible repeat
preflights, not the first preflight. CLI and browser transport paths can differ.

Final cloud audit medians: dashboard 622 ms (auth 8 ms; handler 450 ms), lessons
367 ms, reviews 161 ms, characters 482 ms, item 437 ms. Warm samples stayed under
the existing 2000 ms soft target. The cloud audit uses a different finite-pilot
profile/network, so it is not a controlled comparison with the local account.

The three local samples and the earlier baseline overlap; they do **not** prove
a significant raw HTTP speedup or identify the original 3+ second request.
Confirmed improvements are fewer redundant DB reads, explicit timing phases,
bounded navigation snapshots, honest nonblocking refresh, lazy course loading
and cached preflight permission. Free-tier cold starts and network latency still
exist. No always-on billing or artificial keep-alive was enabled.

Manual IAB inspection confirmed the published panel with 2 real reviews/2
lessons, explicit confirmed freshness and no horizontal overflow. Saved
light/dark desktop/phone captures live outside Git in `cycle-280-294/` under the
task visualization folder; phone checks are local production browser checks,
not a claimed live phone audit. No answer/course/private save was submitted on
the existing account. IAB tabs are closed, owned test servers finished, build
and cycle-specific temporary outputs are removed. Only the app's browser-tool
runtimes were left alone. This final documentation-only commit does not replace
the verified runtime revision or require another application deployment.
