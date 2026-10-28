# Journey Cohesion And Performance 385-399

Baseline: `ae2c4a2`. Implements 385-399 only, one task commit per number,
batched local checks, release push and read-only live acceptance.

## Validated Gaps

Course-to-item return context exists, but course-to-lesson navigation loses it.
Lesson focus and completion always return to the dashboard. Catalogue reads
reject late results but do not abort obsolete requests. The global translation
selector can save/roll back a late result over a newer login and has no explicit
lost-write reconciliation. Preference hooks miss cross-tab storage events.
Course cards do not apply the existing pronunciation preference.

Dashboard already has safe Server-Timing and a 30-second owner-scoped snapshot;
do not rebuild them. Two independent recent-activity reads wait for primary
data, and available/journey materials are hydrated twice with overlapping IDs.
Measure total HTTP and handler timing before/after; structural request-count
reductions are not automatically a latency or full-N2 scalability claim.

| Task | Deliverable                                                                                   | State      |
| ---- | --------------------------------------------------------------------------------------------- | ---------- |
| 385  | Audit, measurable scope and boundaries                                                        | Complete   |
| 386  | Validated course/level return through lesson filtering and study focus                        | Complete   |
| 387  | One coherent completion/empty-state return action for the originating course                  | Complete   |
| 388  | Abort obsolete outline/material reads; retain confirmed catalogue content on same-query retry | Complete   |
| 389  | Single-flight, owner-guarded RU/EN selector and cross-tab preference synchronization          | Complete   |
| 390  | Course kana/furigana/romaji and translation modes obey stored settings with long-text fit     | Complete   |
| 391  | Bounded baseline measurement and numeric queue-handler timing without data leakage            | Complete   |
| 392  | Overlap evidenced independent dashboard activity reads with primary reads                     | Complete   |
| 393  | Coalesce overlapping dashboard target hydration, preserving IDs/order/limits                  | Complete   |
| 394  | Bounded owner-scoped confirmed-outline cache, explicit invalidation, no due/progress caching  | Complete   |
| 395  | Explicit GET reconciliation of unconfirmed translation-setting writes, never automatic replay | Complete   |
| 396  | Keyboard/focus recovery and reduced-motion behavior for affected controls                     | Complete   |
| 397  | Original visual-cohesion pass for return links, mode status, narrow tables and long settings  | Complete   |
| 398  | Scoped unit/browser matrix, account/race/failure checks, themes/viewports, types/build/lint   | Complete   |
| 399  | Release, CI, exact runtime, finite remote measurements and real learner-route inspection      | In release |

## Acceptance

Return URLs accept only validated internal course catalogue context; never
external origins, tokens, arbitrary paths, private drafts or answers. No extra
request on local filters. Same-turn duplicate writes are blocked; old-owner
200/401 results cannot mutate a new login. Failed writes do not imply unsaved
server state, and online events do not replay them.

The outline cache is memory-only, one bounded entry, maximum 30 seconds and
keyed by owner token/course. Mutations and authentication changes invalidate it;
late pre-invalidation results cannot refill it. It never supplies eligibility,
SRS, queue, active-session or accepted-answer state.

Use the existing finite remote smoke against an existing test account without
course slug/registration/enrollment/learning writes. Maximum three samples per
route; warm target remains 2000ms, not an invented guarantee. Only aggregate
numeric timings may be saved. Compare HTTP elapsed versus server phases without
calling the remainder pure network time. Cloud CI supplies broad regressions;
local tests cover changed modules only. Inspect desktop/phone light/dark layout,
focus, table/document overflow, return routes and concealed readings.

No new dependencies, schema/migration/seed/import, Neon content publication,
competitor assets/wording, billing/keepalive or grading/scheduling changes.
Kana remains outside SRS. V4 remains 101 kanji/120 word pairs; draft07 and the
larger 2300/8000 target are not completed by UI work. Close owned tabs/processes
and remove task-generated build/test output after preserving screenshots outside
Git. This closes the reserved 340-399 roadmap, not every product/content gap.

## Finite Baseline (2026-10-28)

Exact web/API revision: `d9614dd0c8ddb2ee7386cc598a23b01ccf804438`.
Three samples per route, existing test account, no course switch or learning writes.
HTTP milliseconds: dashboard `[991,412,387]`, lessons `[310,193,196]`,
reviews `[133,137,122]`, characters `[156,195,173]`, item `[557,461,388]`.
Dashboard handler `[892.8,298.9,290.7]`; phase medians: auth 9,
primary 206.1, hydrate 105.9 ms. Phase medians are not additive.
All warm samples met the existing 2000ms budget. This small starter-account
sample is not a full-N2 load benchmark; HTTP minus handler is not pure network.

## Local Acceptance

47 affected web units, 181 affected API units and 115 remote-smoke safety tests
passed. API/web types, changed-file lint/format and production web build passed.
48 scoped desktop/phone browser cases passed across the initial run and focused
rechecks. Six initial failures were test-contract issues: the generic alert
selector matched Next's announcer, and superseded reads now abort rather than
producing the response an old test awaited. These assertions were corrected,
not skipped or relaxed. The focused recheck passed all six.

Screenshot inspection found an actual mobile list defect: a new romaji grid
area conflicted with the product stylesheet. Romaji now belongs to the reading
group. Rebuilt production and four affected desktop/phone cases passed, with a
geometry assertion placing romaji before the material kind. Light/dark images
are outside Git in the cycle visualization directory. Existing reduced-motion
CSS already suppresses animations/transitions; no duplicate override was added.

Dashboard independent mistake/burned reads now belong to `primary`; `hydrate`
contains the one stable-union target read. Compare total handler/HTTP timing,
not isolated before/after phase medians. No query eligibility, limits, ordering,
SRS or grading semantics changed.

## Release Checkpoint

Release tag: `cycle-385-399-journeys`. Push the 15 numbered task commits together;
cloud CI provides broad regressions. Completion requires green CI, exact web/API
runtime checks, the same finite existing-account measurement and read-only live
inspection. Record those results below, not as presumed successes.

Remaining product gaps are distinct from the finished reserved UI roadmap:
independent approval/source evidence for draft07, separately authorized content
publication, expansion beyond 101 published kanji/120 word pairs, sparse JLPT
metadata and representative full-size course measurement. No 400+ tasks are
authorized or started by this batch.

## Live-Journey Repair

The real dashboard's published starter DEMO course led to a catalogue 404:
the read repository allowed STRUCTURED only. Outline, level materials and
coverage now also accept PUBLISHED DEMO courses, using one shared predicate.
The PUBLISHED course/item gates, authentication and private GOAL exclusion
remain intact. No course type/status or enrollment is written to Neon.
Tag `cycle-385-399-journeys.1` contains this release repair; the original tag
is retained. Verify its exact runtime before claiming live acceptance.

The repair passed 13 directly affected API units, API types and changed-file
lint/format. Both health endpoints returned patch revision
`f3778833d9c0be7663820b76fe05b2e54e50e91d` before final measurements.

## Post-Release Measurements

Two local Node smoke attempts failed on the public web-health TCP connection
before authentication. Separate default/IPv4 diagnostics returned
`UND_ERR_CONNECT_TIMEOUT`.
No credentials or learning data were sent by those failed attempts. Browser and
PowerShell HTTPS worked. No VPN, proxy, certificate or firewall setting was
changed. A temporary bounded PowerShell/.NET check verified both exact revisions,
readiness and existing-account login, then made exactly three GET samples per
route. It was removed after use; only numeric aggregates are kept here.

| Route      | HTTP ms (PowerShell/.NET) | Median HTTP | Handler ms          |
| ---------- | ------------------------- | ----------- | ------------------- |
| dashboard  | 1407, 689, 777            | 777         | 915.7, 189.0, 197.1 |
| lessons    | 1097, 724, 588            | 724         | 457.7, 117.8, 112.9 |
| reviews    | 539, 533, 522             | 533         | 38.3, 25.1, 19.7    |
| characters | 3586, 578, 676            | 676         | Not instrumented    |
| item       | 844, 902, 839             | 844         | Not instrumented    |

Dashboard handler median was 197.1ms versus baseline 298.9ms. This is an observed
three-sample small-account result, not a causal guarantee or full-size N2 load
claim. HTTP totals are not comparable to the Node baseline because transport
changed. The first characters sample exceeded 2000ms; all second/third samples
met the existing warm budget. Response sizes remained 6305/12799/1265/58703/12342
bytes respectively. Queue timings contain only numeric allowlisted phases.

## Live Journey

Real IAB verified that the published demo outline, materials and coverage now
load. Its next-step link preserved course/level context; opening the existing
unfinished lesson showed the same reading stage and a `К курсу` link, which
returned to the original level. No lesson start/progress/answer/finish, preference,
enrollment or course-switch action was submitted. Completion/failure/owner-race
and mobile/theme behavior are controlled browser tests, not live write claims.
The legacy demo report has seven items/eleven core cards and one sentence without
a selected reading; this is separate from V4 and not silently repaired content.

The existing V4 aggregate report still showed 300 items: 79 components, 101
kanji, 120 word pairs and 521 core cards, with zero selected RU/EN/reading field
gaps. This confirms presence, not independent pedagogical quality or N2 coverage.
No new content wave was published. All live inspection tabs were closed after
preserving screenshots; local servers and temporary measurement/build/test files
were removed. Only the intentional source, tests and aggregate reports remain.

Changed areas: lesson navigation/focus/completion, course material previews and
read lifecycle, shell translation settings and preference hooks, API client and
outline snapshot, dashboard orchestration and queue timing, and published course
read predicates. Prisma/schema/data, SRS scheduling and answer grading are
unchanged. No dependency or license/source inventory changes were needed.

Initial release CI 40728717759 succeeded: Quality 122958886012; Web smoke
122960529340, 479 passed/one skipped in 4.4 minutes. Live screenshots are outside Git.

## Rapid Filter Repair

Patch CI 40730438870 initially passed Quality and 478 browser cases, but Chromium
segfaulted before creating the installation test's context. A targeted rerun of
Web smoke (without debug logs or changed assertions) exposed a real intermittent
lesson-filter race: an old transition effect could overwrite the latest partial
filter intent between two changes. The second run again passed 478 cases, but
failed the strict same-turn filter assertion. Neither result is reported green.

Lesson filters now use Next's existing native-history integration, already used
by the course catalogue. Each merge reads the synchronously updated URL, with
no RSC navigation/transition effect that can restore stale filters. Back/reload,
source, safe return context, selection and grading are unchanged. The regression
now repeats twelve sequences of four immediate changes and checks every merged
URL; all eight focused desktop/phone navigation/completion cases passed, along
with 13 relevant units, lint and production build/types. Patch tag:
`cycle-385-399-journeys.2`; earlier tags remain unchanged. Final CI is required.
