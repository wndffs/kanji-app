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

| ID | Deliverable | Acceptance | State |
| --- | --- | --- | --- |
| 340 | Scope and roadmap | Reserve 340-399; specify this batch's observed gaps and boundaries | Complete |
| 341 | Owner/source isolation | Remount on login/token/source changes; query-only filtering preserves the workspace | Planned |
| 342 | Cancellable queue reads | Abort obsolete active/queue reads; old 200/401 cannot change a new login | Planned |
| 343 | Cross-source resume | Visible unfinished-session route; no automatic abandon/start/grade | Planned |
| 344 | Explicit search | Bounded glyph/kana/romaji/RU/EN query, IME-safe; no per-keystroke requests/history | Planned |
| 345 | Picker filters | URL kind/level/selected filters, combined deterministically; no extra API GET | Planned |
| 346 | Picker pages | Max 24 visible entries; reload/Back, clamp invalid pages, actionable empty/reset | Planned |
| 347 | Selected batch | Preview actual ordering and remove one chosen material without losing hidden selections | Planned |
| 348 | Small batches | Real capped 1/3/5 presets and recommendation reset; do not add unavailable material | Planned |
| 349 | Count and start contract | Material/card totals distinct; no selection/order mutation during start; no start during settings save | Planned |
| 350 | Source recovery | Course/deck identity and useful empty/error destinations; malformed source does not silently become a course | Planned |
| 351 | Study progress | Material position and current phase separate from learned/SRS count; quiz progress is confirmed/local to its card set | Planned |
| 352 | Previous material | Previous teaching material uses existing confirmed PATCH; no quiz bypass or grading change | Planned |
| 353 | Batched acceptance | Focused helper/API/browser cases, web build/types, touched lint/format, phone/themes | Planned |
| 354 | Release | Task commits/push/tag, exact runtime health, read-only real lobby, CI and cleanup | Planned |

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
