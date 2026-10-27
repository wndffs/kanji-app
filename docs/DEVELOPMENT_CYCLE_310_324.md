# Kanji Catalogue Workspace 310-324

Baseline: `5f0df32`. The prior release's CI 40521770684 has now completed:
Quality and Web smoke both passed. This cycle implements the next 15 tasks,
commits them separately, batches relevant checks, then pushes/deploys and
inspects the real application. Next unused task after this cycle: 325.

## Validated Gaps

The kanji character hub has four course filters and a fixed grid. It has no
search, sorting or list view. Its 60-item pagination lives only in React state,
so reload, Back and opening a material lose the current page. Meanings from RU
and EN are concatenated without language labels. Card stage metadata is already
available but not shown. The count called Learning includes all started items,
including passed/burned, so those figures must not imply disjoint buckets.
The hub GET checks ownership but cannot cancel an obsolete fetch. Kanji detail
pages have no safe return route into this catalogue.

Use an original quiet workbench, not a competitor's layout/CSS. Keep a visible
search and compact result toolbar; place optional filters/reading controls in
the existing disclosure. Grid/list icons, small state labels, readable Japanese,
bounded paging and complete mobile/light/dark states are required. Defaults
remain the course order, grid and visible kana readings. No large new dashboard.

## Tasks

| ID | Deliverable | Acceptance | State |
| --- | --- | --- | --- |
| 310 | Scope and prior release check | Record observed gaps, safety boundaries and the prior completed CI | Complete |
| 311 | Cancel obsolete catalogue reads | Abort old GETs on retry/unmount, preserve owner checks and 401 handling | Implemented |
| 312 | URL pagination | Reload/Back retain pages; invalid and out-of-range pages are bounded without empty phantom pages | Implemented |
| 313 | Multilingual search | Explicit search covers glyph, kana, romaji and RU/EN meaning; bounded normalized query, no per-keystroke history spam | Implemented |
| 314 | Deterministic ordering | Course/reading/meaning/weakness ordering, stable ties, missing values last, no mutated API arrays | Implemented |
| 315 | Grid and list | URL-backed icon control, same links/results, stable phone layout | Implemented |
| 316 | Current-level shortcuts | Real current level and weak-item scopes; no fake level when course is absent | Implemented |
| 317 | Honest study metadata | Started count is labelled honestly; actual stage is distinct from aggregate item completion | Pending |
| 318 | Bilingual meaning rows | RU/EN/RU+EN display labelled rows, explicit missing translation, no silent cross-language fallback | Pending |
| 319 | Safe return context | A kanji detail link can return to canonical same-origin catalogue filters/page/options; reject external/untrusted return URLs | Pending |
| 320 | Filter recovery | Search chips and clear actions are consistent; empty/no-course states expose a useful recovery action | Pending |
| 321 | Reading visibility | URL-backed reading checkbox hides kana hints by default only when requested; no grading effects | Pending |
| 322 | Per-item reading actions | Explicit reveal and copy controls outside navigation links; no hidden-reading leak in link labels | Pending |
| 323 | Batched acceptance | Focused helpers/API/browser tests, TypeScript/build/lint/format and phone/desktop captures | Pending |
| 324 | Deploy and verify | Push/tag, full web revision check, API liveness and real catalogue/material navigation; resource cleanup | Pending |

## Boundaries

No new dependency, imported/copied competitor content, corpus publication,
schema/migration/seed, account reset or changed SRS/answer validation. Kana stays
outside SRS. Reading visibility is a browsing aid, not a scored study session.
Do not infer next-review dates or schedules from stage names. Keep private
account boundaries and existing item/lesson/review reading policy unchanged.
Search may match the existing RU and EN learning meanings regardless of the
display language; do not add unrelated languages or raw dictionary glosses.

All context is bounded canonical query data, not arbitrary redirects. Do not
persist tokens, catalogue responses, private progress or full query snapshots
in browser storage. Source licensing and item attributions remain unchanged.

## Verification Plan

Batch pure query/search/sort/count/localization/context tests, the relevant
API-client GET signal case and character catalogue/detail browser cases. Cover
late 200/401 after account change, aborts, no extra GET on filters, page limits,
IME search, empty results, both themes/viewports, list/grid consistency, hidden
reading controls and same-origin safe return. Build/typecheck web and lint/format
only touched files; use cloud CI for its full suite. Keep captures/temp results
outside Git, close IAB tabs and stop only owned test/dev servers.
