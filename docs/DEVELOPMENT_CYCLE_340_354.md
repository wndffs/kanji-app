# Lesson Selection And Safe Resume 340-354

Baseline: `f57802f`. Roadmap: `ROADMAP_340_399.md`. Next unused task after this
batch is 355; do not start it in this request.

## Observed Gaps And Contract

LessonsClient currently reads the requested deck only when loading, does not
remount for a changed account/source, and has no abort/current-owner guard on
active/queue GETs. An active lesson from another source is ignored. The picker
renders every eligible item and has no search/filter/page options. The selected
strip follows eligible-array order rather than the selected lesson order, has
no individual removal, and does not distinguish card and material counts.
Selection can change while start is pending; start can race a settings write.
Teaching supports previous phases, but not a previous material.

Retain existing working teaching, phase tabs, pronunciation, private mnemonics,
mandatory quiz and deterministic server checks. The source/eligibility/remaining
limit from the API is authoritative. Browsing never learns/unlocks an item.

| ID  | Deliverable              | Acceptance                                                                                                            | State     |
| --- | ------------------------ | --------------------------------------------------------------------------------------------------------------------- | --------- |
| 340 | Scope and roadmap        | Reserve 340-399; specify this batch's observed gaps and boundaries                                                    | Complete  |
| 341 | Owner/source isolation   | Remount on login/token/source changes; query-only filtering preserves the workspace                                   | Complete  |
| 342 | Cancellable queue reads  | Abort obsolete active/queue reads; old 200/401 cannot change a new login                                              | Complete  |
| 343 | Cross-source resume      | Visible unfinished-session route; no automatic abandon/start/grade                                                    | Complete  |
| 344 | Explicit search          | Bounded glyph/kana/romaji/RU/EN query, IME-safe; no per-keystroke requests/history                                    | Complete  |
| 345 | Picker filters           | URL kind/level/selected filters, combined deterministically; no extra API GET                                         | Complete  |
| 346 | Picker pages             | Max 24 visible entries; reload/Back, clamp invalid pages, actionable empty/reset                                      | Complete  |
| 347 | Selected batch           | Preview actual ordering and remove one chosen material without losing hidden selections                               | Complete  |
| 348 | Small batches            | Real capped 1/3/5 presets and recommendation reset; do not add unavailable material                                   | Complete  |
| 349 | Count and start contract | Material/card totals distinct; no selection/order mutation during start; no start during settings save                | Complete  |
| 350 | Source recovery          | Course/deck identity and useful empty/error destinations; malformed source does not silently become a course          | Complete  |
| 351 | Study progress           | Material position and current phase separate from learned/SRS count; quiz progress is confirmed/local to its card set | Complete  |
| 352 | Previous material        | Previous teaching material uses existing confirmed PATCH; no quiz bypass or grading change                            | Complete  |
| 353 | Batched acceptance       | Focused helper/API/browser cases, web build/types, touched lint/format, phone/themes                                  | Complete  |
| 354 | Release                  | Task commits/push/tag, exact runtime health, read-only real lobby, CI and cleanup                                     | Releasing |

## Safety And Verification

No dependency, schema, migration, seed, corpus/course publication, account reset
or SRS/grading-policy change. No copied data/assets or new educational claims.
URL stores only browsing/source options, not selections, answers, private data
or tokens. New GETs accept AbortSignal; writes are never silently cancelled or
automatically replayed. Owner/unmount checks gate follow-up actions after awaits.
Source IDs remain compatible with existing API IDs and bounded/URL-encoded.
An unknown source must not expose another user's content or switch their course.

Test eligible versus selected counts, active source mismatch, slow/failed/stale
GETs, page/query restoration, filtered hidden selections, exact start body and
pending controls, IME, server-confirmed previous-material recovery and existing
mandatory quiz. Use only scoped local tests, one batched browser family and
focused repairs; broad CI runs after push. Capture both themes/viewports outside
Git, close IAB tabs and owned test servers, and remove temporary build/output.

## Local Acceptance

Implemented 341-352 using existing API contracts; only the web GET adapters gain
optional cancellation. No backend business logic, dependency, schema or corpus
was changed. The picker searches only existing Japanese and RU/EN learning
fields, not external dictionary/network data. Selected item IDs and answers are
never serialized into the browsing URL or persisted as local drafts.

- Five relevant unit files: **49 tests passed** (browser/source helpers,
  selection, study phases, quiz and API adapters). Build/typecheck found nullable
  kana romanization; it now yields an empty search field rather than an unsafe
  string assumption. Final production build and TypeScript passed.
- Changed-file ESLint and Prettier passed. No full local monorepo suite ran.
- Main browser batch: **32/34 passed**. Both failures were the same test using
  an exact nested-label locator; the snapshot already showed correct filters
  and both URL values. Used the actual combobox roles. All six focused search,
  batch-order and mandatory-quiz cases then passed on desktop/phone.
- Visual inspection found inherited 136px picker rows and a full-height mobile
  five-item grid. Reduced rows to 72px, kept disabled-but-eligible content
  readable, and made the selected group a bounded horizontal strip. All four
  final batch/mandatory-quiz visual cases passed, including row/strip bounds,
  document overflow and the primary action above phone navigation.
- All **34 lesson scenarios** have passed across the main/focused runs. New
  coverage includes same-turn filter merges, IME, no extra GET/write on browsing,
  hidden selections, URL page bounds/reload/Back, exact start ordering, old-owner
  200/401 for both reads, late settings responses, source handoff without writes,
  two-click single-start, pending controls, invalid source, daily limit, and
  previous-material failure/retry without moving until confirmation.

Light/dark desktop/phone picker and teaching captures plus viewport screenshots
are outside Git. A full-page capture can show sticky navigation over its current
viewport; viewport images and geometric checks are used for actual control bounds.
No competitor wording/assets, new dataset or educational translation was added.

## Release Candidate

Code acceptance commit: `6dd9611923caaa3e494f8f04c4cd4ccaec338efd`.
Release tag: `cycle-340-354-lessons`. Push the 15 numbered task commits together
through existing GitHub/Vercel/Render integrations. Check exact web and API
revisions and real read-only lesson-lobby browsing. Do not start/answer/abandon
a live lesson or save preferences for acceptance. No course publication, schema
operation or test-account reset is part of this release.
