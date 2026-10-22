# Development Cycle 130-144

Baseline: `83ec1ff138860ae8f791558d3542b2694379ec05`.
User instruction, 2026-10-22: develop, commit and push independently; validate
related changes in batches. Do not publish V3 or new Neon content before fifteen
additional tasks are completed. After all fifteen pass acceptance, prepare a
separately sealed new version, publish the reviewed additions and verify it.

This is a bounded development cycle, not completion of the full 2,300-kanji /
8,000-word release. Documentation, test repairs and follow-up fixes do not count
as extra tasks. Existing pilot seals, enrollments and SRS identities stay intact.

| ID  | Scope                            | Acceptance                                                                                                     | State                       |
| --- | -------------------------------- | -------------------------------------------------------------------------------------------------------------- | --------------------------- |
| 130 | Published-item visibility        | Public detail, history and discovery exclude unpublished items; admin remains separate                         | Implemented; checks pending |
| 131 | Server-paged search              | Only the requested stable page is hydrated; total and page metadata stay correct                               | Implemented; checks pending |
| 132 | Search page navigation           | Previous/next pages and reload/back preserve URL query and page                                                | Implemented; checks pending |
| 133 | Search type/level filters        | Validated filters work end-to-end and reset pagination deliberately                                            | Implemented; checks pending |
| 134 | Kana-aware search                | Hiragana/katakana reading variants match without changing stored answers or source evidence                    | Implemented; checks pending |
| 135 | Search request isolation         | Stale responses and auth changes cannot overwrite the current search or clear a newer session                  | Implemented; checks pending |
| 136 | Bounded related-item hydration   | Related lists use bounded selections and do not recursively hydrate unused detail graphs                       | Implemented; checks pending |
| 137 | Bounded character-target loading | Deduplicated 100-ID reads retain order, all cards, SRS state and legacy JLPT metadata                          | Implemented; checks pending |
| 138 | Batched review targets           | Scheduled/practice queues avoid per-card target reads and preserve card-specific answers                       | Implemented; checks pending |
| 139 | Batched dashboard targets        | Activity/leeches hydrate shared targets once per bounded batch without changing counts or SRS                  | Planned                     |
| 140 | Bounded text-deck lookups        | Token/target queries stay bounded and preserve prerequisite-safe match results                                 | Implemented; checks pending |
| 141 | Item history request lifecycle   | History pagination remains item/user scoped through navigation, retries and auth changes                       | Implemented; checks pending |
| 142 | Study audio lifecycle            | Navigation, preference changes and unmount stop obsolete playback without false completion                     | Planned                     |
| 143 | Editorial registry inventory     | A source-only command reports hashes, levels, prerequisites and finite-pilot inclusion without database writes | Local acceptance passed; source-only |
| 144 | Next finite pilot seal           | Explicit N5/mixed-level policy and exact source/count closure; V1/V2/V3 unchanged                              | Local acceptance passed; not published |

The later entries require a scoped code inspection before implementation. If a
proposed gap is already solved, record that evidence and replace it with a real
unmet acceptance slice; do not count a no-op or an existing feature as completed.

## Checkpoints

- Development complete: 13/15.
- Acceptance checked: 0/15.
- Publication threshold reached: no.
- No manual curation/publication workflow before the threshold.
- Automatic application deploys and CI on authorized pushes remain enabled.
- After the threshold: apply only reviewed pending batches, run quality checks,
  seal/publish the new finite version, and verify the deployed revision and
  representative desktop/mobile learning flows. No silent course switch.

Checks are grouped by changed modules, normally after several functional
commits. Any failed acceptance remains open until repaired. No background
servers, browser tabs or temporary repository files should be left behind.
