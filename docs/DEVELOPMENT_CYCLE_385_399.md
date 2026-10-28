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

| Task | Deliverable | State |
| --- | --- | --- |
| 385 | Audit, measurable scope and boundaries | Complete |
| 386 | Validated course/level return through lesson filtering and study focus | Planned |
| 387 | One coherent completion/empty-state return action for the originating course | Planned |
| 388 | Abort obsolete outline/material reads; retain confirmed catalogue content on same-query retry | Planned |
| 389 | Single-flight, owner-guarded RU/EN selector and cross-tab preference synchronization | Planned |
| 390 | Course kana/furigana/romaji and translation modes obey stored settings with long-text fit | Planned |
| 391 | Bounded baseline measurement and numeric queue-handler timing without data leakage | Planned |
| 392 | Overlap evidenced independent dashboard activity reads with primary reads | Planned |
| 393 | Coalesce overlapping dashboard target hydration, preserving IDs/order/limits | Planned |
| 394 | Bounded owner-scoped confirmed-outline cache, explicit invalidation, no due/progress caching | Planned |
| 395 | Explicit GET reconciliation of unconfirmed translation-setting writes, never automatic replay | Planned |
| 396 | Keyboard/focus recovery and reduced-motion behavior for affected controls | Planned |
| 397 | Original visual-cohesion pass for return links, mode status, narrow tables and long settings | Planned |
| 398 | Scoped unit/browser matrix, account/race/failure checks, themes/viewports, types/build/lint | Planned |
| 399 | Release, CI, exact runtime, finite remote measurements and real learner-route inspection | Planned |

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
