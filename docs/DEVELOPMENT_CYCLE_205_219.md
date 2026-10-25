# Development Cycle 205-219

Baseline: `fa69ec4`. Fifteen user-authorized functional tasks, independent commits,
batched relevant checks, push, application deployment and live verification.
Tests, repairs and evidence commits are not additional tasks.

| ID  | Scope                       | Acceptance                                                                     | State       |
| --- | --------------------------- | ------------------------------------------------------------------------------ | ----------- |
| 205 | Review timeline projection  | Deterministic due/scheduled counts exclude new and burned cards                | Implemented |
| 206 | Own card review metadata    | Published level pages expose only the current user's eligible card state       | Implemented |
| 207 | Review-time API filter      | Due/scheduled predicates apply before pagination                               | Implemented |
| 208 | Review-time browsing        | URL-backed review filter and honest per-item due labels                        | Implemented |
| 209 | Whole-level progress totals | Counts use all published placements, independent of page/filter                | Implemented |
| 210 | Level progress navigation   | Compact counts link to new/learning/burned/due views                           | Implemented |
| 211 | Per-prompt progress         | Expand an item's meaning/reading/listening state without opening all details   | Implemented |
| 212 | Level search API            | Bounded Japanese/title/global-answer search before pagination, no private text | Implemented |
| 213 | Search navigation           | Explicit submit, clear, history and item-return preserve the query             | Implemented |
| 214 | Review ordering API         | Stable course/due-first ordering without changing schedules                    | Implemented |
| 215 | Review ordering control     | URL-backed sorting retains filters and resets page                             | Implemented |
| 216 | Compact material list       | Grid/list mode with kana and RU/EN content retained                            | Implemented |
| 217 | Remembered material view    | Owner-scoped local preference with blocked-storage fallback                    | Implemented |
| 218 | Direct level map links      | Every outline level is navigable, respecting current filters                   | Implemented |
| 219 | Empty-view recovery         | Reset filters or recover an out-of-range page without losing the level         | Implemented |

Browsing never enrolls, switches courses, unlocks lessons or writes SRS. Due
means a stored card timestamp has arrived, not a promise that vacation/course
eligibility gates allow grading. Kana remains outside SRS. Only aggregate Neon
source evidence may be saved to GitHub; detailed source records are excluded by
the user's explicit decision. V4 and existing content seals remain unchanged.
No new dataset, dependency or proprietary teaching content is planned.

## Acceptance

Implementation: 15/15 separate functional commits. Local acceptance passed:
18 relevant unit cases, 34 production browser cases across desktop/mobile,
API/web/shared typechecks, changed-file ESLint, formatting and production build.
Release and cloud evidence are pending at this checkpoint. Nothing here claims
new curriculum publication or independent approval of draft07.

Review found and repaired cross-kind target-ID ambiguity, limited answer search
to the selected level's eligible card IDs, and moved secondary ordering controls
into the filter disclosure. Wildcard characters are escaped as literals in
Prisma substring searches. Private overrides/notes never participate in search.

The API still reads lightweight metadata for one complete level to compute
unfiltered totals, filter and sort before the 30-item teaching hydration. Search
adds sequential target-ID-limited reads, not a constant SQL budget or a full
course scan. Counts describe items, not cards; the disclosure describes cards.
Dates are snapshots formatted in the browser's local timezone. No polling or
automatic scheduling changes were added.
