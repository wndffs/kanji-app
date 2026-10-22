# Development Cycle 130-144

Baseline: `83ec1ff138860ae8f791558d3542b2694379ec05`.
User instruction, 2026-10-22: develop, commit and push independently; validate
related changes in batches. Do not publish V3 or new Neon content before fifteen
additional tasks are completed. After all fifteen pass acceptance, prepare a
separately sealed new version, publish the reviewed additions and verify it.

This is a bounded development cycle, not completion of the full 2,300-kanji /
8,000-word release. Documentation, test repairs and follow-up fixes do not count
as extra tasks. Existing pilot seals, enrollments and SRS identities stay intact.

| ID  | Scope                            | Acceptance                                                                                                     | State                           |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| 130 | Published-item visibility        | Public detail, history and discovery exclude unpublished items; admin remains separate                         | Acceptance passed               |
| 131 | Server-paged search              | Only the requested stable page is hydrated; total and page metadata stay correct                               | Acceptance passed               |
| 132 | Search page navigation           | Previous/next pages and reload/back preserve URL query and page                                                | Acceptance passed               |
| 133 | Search type/level filters        | Validated filters work end-to-end and reset pagination deliberately                                            | Acceptance passed               |
| 134 | Kana-aware search                | Hiragana/katakana reading variants match without changing stored answers or source evidence                    | Acceptance passed               |
| 135 | Search request isolation         | Stale responses and auth changes cannot overwrite the current search or clear a newer session                  | Acceptance passed               |
| 136 | Bounded related-item hydration   | Related lists use bounded selections and do not recursively hydrate unused detail graphs                       | Acceptance passed               |
| 137 | Bounded character-target loading | Deduplicated 100-ID reads retain order, all cards, SRS state and legacy JLPT metadata                          | Acceptance passed               |
| 138 | Batched review targets           | Scheduled/practice queues avoid per-card target reads and preserve card-specific answers                       | Acceptance passed               |
| 139 | Batched dashboard targets        | Activity/leeches hydrate shared targets once per bounded batch without changing counts or SRS                  | Acceptance passed               |
| 140 | Bounded text-deck lookups        | Token/target queries stay bounded and preserve prerequisite-safe match results                                 | Acceptance passed               |
| 141 | Item history request lifecycle   | History pagination remains item/user scoped through navigation, retries and auth changes                       | Acceptance passed               |
| 142 | Study audio lifecycle            | Navigation, preference changes and unmount stop obsolete playback without false completion                     | Acceptance passed               |
| 143 | Editorial registry inventory     | A source-only command reports hashes, levels, prerequisites and finite-pilot inclusion without database writes | Acceptance passed; source-only  |
| 144 | Next finite pilot seal           | Explicit N5/mixed-level policy and exact source/count closure; V1/V2/V3 unchanged                              | Acceptance passed; V4 published |

The later entries require a scoped code inspection before implementation. If a
proposed gap is already solved, record that evidence and replace it with a real
unmet acceptance slice; do not count a no-op or an existing feature as completed.

## Checkpoints

- Development complete: 15/15.
- Acceptance checked: 15/15, including final remote CI.
- Publication threshold reached: yes.
- No manual curation/publication workflow before the threshold.
- Automatic application deploys and CI on authorized pushes remain enabled.
- After the threshold: apply only reviewed pending batches, run quality checks,
  seal/publish the new finite version, and verify the deployed revision and
  representative desktop/mobile learning flows. No silent course switch.

Checks are grouped by changed modules, normally after several functional
commits. Any failed acceptance remains open until repaired. No background
servers, browser tabs or temporary repository files should be left behind.

## Batched Acceptance Evidence

All fifteen rows passed local and remote acceptance. Counts below describe
overlapping focused batches and must not be added into a unique-test total.

- Search/visibility/normalization/API-client unit batch: 82 passed.
- Target hydration/API regression batch: 226 cases passed after repairing one
  obsolete query-order assertion; the dashboard-focused batch passed 82 cases.
- Editorial inventory: 20 passed and the source-only CLI reports zero issues.
- Finite pilot family: 193 focused tests passed, including V4 and unchanged
  V1/V2/V3 seals. Remote smoke tooling: 112 tests passed.
- Search desktop/mobile flows passed after correcting skeleton/result selectors;
  the final filtered pagination pair also passed. Item/history flows: 8 passed.
- Listening audio flows: 8 passed; kana speech lifecycle: 2 passed after opening
  the listening assessment fixture rather than a recognition exercise.
- Relevant API, DB and web typechecks, changed-file ESLint and formatting passed.
- Initial remote Study integrity run `39849159528` passed against PostgreSQL.
  Initial CI quality passed, but two browser pagination assertions needed the
  selector repair above; a final push must receive fresh green CI before writes.

Final CI `39854377479` and PostgreSQL 18 Study integrity `39854377486` both
passed at `fa082919293b3fe07345bd561242467a87aa5f8f`. The production-build
browser suite passed all 215 desktop/mobile cases. Only after these results,
selected curation `39855468624` was dispatched for `task-118-course-kanji-06`
and `task-127-course-words-06`.

## Verified Release: 2026-10-23

Runtime revision: `419e97fdcfef30bc00e8e9df820ff9a54e2e72f4`.
Release tag: `cycle-130-144-v4` (runtime revision, not a new educational-content seal).

- [Selected curation 39855468624](https://github.com/wndffs/kanji-app/actions/runs/39855468624)
  applied only kanji-06 and word-06, without seed or old-batch reapplication.
  Main-course quality scanned 300 items: zero blockers and zero warnings,
  content version `8e51da5fe13f567cf959629ec55660f2a10b35c341e19e7806fc300992ac0e93`.
- Initial V4 publication `39857759491` expired at 60 seconds during the final
  repeated quality scan and rolled back. The V4-only transaction budget is now
  120 seconds, still Serializable, still with all checksum/quality checks. All
  149 relevant publisher tests, DB types and changed-file lint passed afterward.
- [Fresh plan 39858666896](https://github.com/wndffs/kanji-app/actions/runs/39858666896)
  confirmed no partial pilot remained and the same planned content version.
- [Publication 39858951154](https://github.com/wndffs/kanji-app/actions/runs/39858951154)
  succeeded: **79 components, 101 kanji, 120 words, 300 items, 521 cards,
  120 original bilingual examples, seven levels**. Course UUID
  `ed80100c-e1dc-4399-8379-78d0aa912ee0`; publication record UUID
  `a88880b1-27a3-474d-af1f-0e9ef261d6f7`; live content version
  `eeae844d6abb0e7d7eeacf6fe7227377a1457f2106902f7d962902122b8dceee`.
  `enrolledUserId` is null: publication did not enroll or switch learners.
- [CI 39858521166](https://github.com/wndffs/kanji-app/actions/runs/39858521166)
  and [PostgreSQL 18 integrity 39858521115](https://github.com/wndffs/kanji-app/actions/runs/39858521115)
  passed on the runtime revision, including the production desktop/mobile suite.
- [Remote smoke 39859400700](https://github.com/wndffs/kanji-app/actions/runs/39859400700)
  passed on V4 using a new disposable account, explicitly enrolling/selecting
  only that account. Both web and API reported the exact runtime revision.
  Three samples per API route gave medians: dashboard 598 ms, lessons 1662 ms,
  reviews 167 ms, characters 406 ms, item 472 ms. Both warm samples per route
  met 2000 ms. This is a small-corpus HTTP check, not browser CWV or full-scale
  latency proof. The review queue was empty, so it did not exercise a live review
  answer or naturally complete all seven levels.
- The live IAB catalog showed V4. Explicitly adding it to the existing disposable
  audit profile displayed confirmation that its current course was not changed.
  Reloading the dashboard confirmed V2 remained selected while V4 was available.
  The earlier live search found 一 by いち and displayed один / one plus いち.
  Desktop/mobile interaction coverage above uses local/cloud fixtures; this is
  not an exhaustive real-device browser matrix.

V4 includes the complete prepared V3 source set plus the two sixth batches.
V3 was not separately published as a redundant intermediate catalog entry;
its seal remains unchanged, as do existing V1/V2 courses. The main course stays
DRAFT with seven populated levels out of sixty. Remaining full-course content:
**2,199 kanji and 7,880 words**. Listening asset coverage, pitch-accent licensing,
the final visual refresh and full-scale accessibility/performance gates remain
open. No WaniKani content was copied; teaching content is project-authored RU/EN,
AI-authored and independently AI-reviewed, not human pedagogical certification.
Existing JMdict/KANJIDIC2/KanjiVG provenance and license obligations are unchanged.

Temporary IAB tabs and local test servers were closed after verification. The
final documentation-only evidence commit does not change the tested runtime SHA.
