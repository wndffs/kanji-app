# Development Cycle 130-144

Baseline: `83ec1ff138860ae8f791558d3542b2694379ec05`.
User instruction, 2026-10-22: develop, commit and push independently; validate
related changes in batches. Do not publish V3 or new Neon content before fifteen
additional tasks are completed. After all fifteen pass acceptance, prepare a
separately sealed new version, publish the reviewed additions and verify it.

This is a bounded development cycle, not completion of the full 2,300-kanji /
8,000-word release. Documentation, test repairs and follow-up fixes do not count
as extra tasks. Existing pilot seals, enrollments and SRS identities stay intact.

| ID  | Scope                            | Acceptance                                                                                                     | State                                  |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 130 | Published-item visibility        | Public detail, history and discovery exclude unpublished items; admin remains separate                         | Implemented; checks pending            |
| 131 | Server-paged search              | Only the requested stable page is hydrated; total and page metadata stay correct                               | Implemented; checks pending            |
| 132 | Search page navigation           | Previous/next pages and reload/back preserve URL query and page                                                | Implemented; checks pending            |
| 133 | Search type/level filters        | Validated filters work end-to-end and reset pagination deliberately                                            | Implemented; checks pending            |
| 134 | Kana-aware search                | Hiragana/katakana reading variants match without changing stored answers or source evidence                    | Implemented; checks pending            |
| 135 | Search request isolation         | Stale responses and auth changes cannot overwrite the current search or clear a newer session                  | Implemented; checks pending            |
| 136 | Bounded related-item hydration   | Related lists use bounded selections and do not recursively hydrate unused detail graphs                       | Implemented; checks pending            |
| 137 | Bounded character-target loading | Deduplicated 100-ID reads retain order, all cards, SRS state and legacy JLPT metadata                          | Implemented; checks pending            |
| 138 | Batched review targets           | Scheduled/practice queues avoid per-card target reads and preserve card-specific answers                       | Implemented; checks pending            |
| 139 | Batched dashboard targets        | Activity/leeches hydrate shared targets once per bounded batch without changing counts or SRS                  | Implemented; checks pending            |
| 140 | Bounded text-deck lookups        | Token/target queries stay bounded and preserve prerequisite-safe match results                                 | Implemented; checks pending            |
| 141 | Item history request lifecycle   | History pagination remains item/user scoped through navigation, retries and auth changes                       | Implemented; checks pending            |
| 142 | Study audio lifecycle            | Navigation, preference changes and unmount stop obsolete playback without false completion                     | Implemented; checks pending            |
| 143 | Editorial registry inventory     | A source-only command reports hashes, levels, prerequisites and finite-pilot inclusion without database writes | Local acceptance passed; source-only   |
| 144 | Next finite pilot seal           | Explicit N5/mixed-level policy and exact source/count closure; V1/V2/V3 unchanged                              | Local acceptance passed; not published |

The later entries require a scoped code inspection before implementation. If a
proposed gap is already solved, record that evidence and replace it with a real
unmet acceptance slice; do not count a no-op or an existing feature as completed.

## Checkpoints

- Development complete: 15/15.
- Local acceptance checked: 15/15; final remote CI pending.
- Publication threshold reached: no.
- No manual curation/publication workflow before the threshold.
- Automatic application deploys and CI on authorized pushes remain enabled.
- After the threshold: apply only reviewed pending batches, run quality checks,
  seal/publish the new finite version, and verify the deployed revision and
  representative desktop/mobile learning flows. No silent course switch.

Checks are grouped by changed modules, normally after several functional
commits. Any failed acceptance remains open until repaired. No background
servers, browser tabs or temporary repository files should be left behind.

## Batched Acceptance Evidence

All implemented rows above have now passed local acceptance; their original
pending labels record implementation checkpoints, not the current gate state.

- Search/visibility/normalization/API-client unit batch: 82 passed.
- Target hydration/API regression batch: 226 cases passed after repairing one
  obsolete query-order assertion; dashboard batching adds 82 focused cases.
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

No Neon curation or pilot publication has been dispatched at this checkpoint.
