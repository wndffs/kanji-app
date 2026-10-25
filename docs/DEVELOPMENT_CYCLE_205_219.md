# Development Cycle 205-219

Baseline: `fa69ec4`. Fifteen user-authorized functional tasks, independent commits,
batched relevant checks, push, application deployment and live verification.
Tests, repairs and evidence commits are not additional tasks.

| ID  | Scope                       | Acceptance                                                                     | State    |
| --- | --------------------------- | ------------------------------------------------------------------------------ | -------- |
| 205 | Review timeline projection  | Deterministic due/scheduled counts exclude new and burned cards                | Accepted |
| 206 | Own card review metadata    | Published level pages expose only the current user's eligible card state       | Accepted |
| 207 | Review-time API filter      | Due/scheduled predicates apply before pagination                               | Accepted |
| 208 | Review-time browsing        | URL-backed review filter and honest per-item due labels                        | Accepted |
| 209 | Whole-level progress totals | Counts use all published placements, independent of page/filter                | Accepted |
| 210 | Level progress navigation   | Compact counts link to new/learning/burned/due views                           | Accepted |
| 211 | Per-prompt progress         | Expand an item's meaning/reading/listening state without opening all details   | Accepted |
| 212 | Level search API            | Bounded Japanese/title/global-answer search before pagination, no private text | Accepted |
| 213 | Search navigation           | Explicit submit, clear, history and item-return preserve the query             | Accepted |
| 214 | Review ordering API         | Stable course/due-first ordering without changing schedules                    | Accepted |
| 215 | Review ordering control     | URL-backed sorting retains filters and resets page                             | Accepted |
| 216 | Compact material list       | Grid/list mode with kana and RU/EN content retained                            | Accepted |
| 217 | Remembered material view    | Owner-scoped local preference with blocked-storage fallback                    | Accepted |
| 218 | Direct level map links      | Every outline level is navigable, respecting current filters                   | Accepted |
| 219 | Empty-view recovery         | Reset filters or recover an out-of-range page without losing the level         | Accepted |

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
Release and cloud verification passed. Next unused task number: 220. Nothing here claims
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

## Verified Release: 2026-10-25

Runtime: `20dcba1f2bd8958802dcd7dada881b6f6699cabb`.
Release tag: `cycle-205-219-progress`. The final evidence-only commit does not
change application source or educational-content seals.

- [CI 40188389143](https://github.com/wndffs/kanji-app/actions/runs/40188389143)
  passed Quality and 283 production browser cases with one intentional skip.
- [Study integrity 40188389116](https://github.com/wndffs/kanji-app/actions/runs/40188389116)
  passed against PostgreSQL 18. No Neon migration, import or seed was required.
- Both live health endpoints returned the exact runtime SHA. Render initially
  showed its free-instance waking page; this is not a guarantee of instant cold
  starts. The application became ready without configuration changes.
- [Remote smoke 40188551387](https://github.com/wndffs/kanji-app/actions/runs/40188551387)
  passed exact web/API SHA checks on a separate disposable V4 audit account.
  Three-sample HTTP medians: dashboard 797 ms, lessons 704 ms, reviews 188 ms,
  characters 494 ms, item 645 ms. Both warm samples per route met 2000 ms.
  These are finite-course API samples, not browser CWV or a full N2 benchmark;
  that fresh audit account has no naturally due reviews.
- Live IAB search on level five found the same mountain word for Russian,
  English and katakana reading queries, preserving the full 80-item summary
  while returning one result. Opening its canonical item and returning retained
  the exact level, query and review-time ordering.
- On the existing test profile, level one reported 63 items, 61 new and two in
  progress. Its due filter returned the two existing overdue component cards;
  the expanded meaning prompt showed its stored SRS stage and timestamp.
  No learning answer, progress update, course enrollment or course switch was
  submitted in these live UI checks. Counts are snapshot facts, not proof of
  grading all prompts or unlocking later levels.
- The list survived reload. At a 393 x 852 viewport the document/client widths
  were both 378 px (the scrollbar occupies the remainder), with two due rows
  and no horizontal overflow. Desktop and mobile screenshots are saved outside
  the repository. The original grid view was restored afterwards, and the
  temporary viewport override was reset.

No dependency, dataset download or proprietary content was introduced. V4 still
contains 79 components, 101 kanji, 120 words, 300 items, 521 cards, 120 original
bilingual examples and seven levels. Draft07 and the main course remain
unpublished; the reviewed backlog remains 2199 kanji / 7880 words. No detailed
Neon source report was exported. Existing data/license layers are unchanged.

Local coverage is 18 relevant unit cases and 34 production browser cases.
The cloud suite includes overlapping cases; its counts are not added to the
local totals. Generated builds and temporary outputs were removed, owned Node
servers had exited, and temporary IAB tabs were closed after verification.
