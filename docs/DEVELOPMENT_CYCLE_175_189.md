# Development Cycle 175-189

Baseline: `1fb9a58`. Fifteen functional slices, independently committed, with
relevant checks in batches. No task is counted for tests, repairs or documentation.
Push and verify a new application release after acceptance. Existing V1-V4 seals,
learner identities and schedules must remain unchanged.

| ID  | Scope                       | Acceptance                                                                          | State      |
| --- | --------------------------- | ----------------------------------------------------------------------------------- | ---------- |
| 175 | Indexed lesson progress     | Exact card/stage gates without repeated scans of per-item progress                  | Local pass |
| 176 | Course eligibility graph    | Read published placement/card/dependency metadata without teaching payload          | Local pass |
| 177 | Deck eligibility graph      | Same lightweight boundary with owner and archive checks                             | Local pass |
| 178 | Selected teaching hydration | Sequential bounded exact-ID loads, private text scoped to owner                     | Local pass |
| 179 | Available queue hydration   | Hydrate only today's selectable items and visible prerequisites                     | Local pass |
| 180 | Session reads               | Starting needs no teaching payload; resume hydrates only remaining session items    | Local pass |
| 181 | Answer reads                | Check/complete hydrate only the requested eligible session item                     | Local pass |
| 182 | Exhausted deck budget       | Validate deck ownership/status without loading its items at the daily cap           | Local pass |
| 183 | Remote cold-start gate      | Bounded readiness-only retries before account writes; no mutation retries           | Local pass |
| 184 | Late readiness recovery     | Late successful probe replaces stale unavailable cache without parallel probes      | Local pass |
| 185 | Next kanji draft            | Original RU/EN content, explicit readings/components/placements, pending review     | Local pass |
| 186 | Next word draft             | Original RU/EN meanings, reading aids and examples; no invented source IDs          | Local pass |
| 187 | Draft evidence report       | Read-only exact source-pair checks with provenance, never publish or infer approval | Local pass |
| 188 | Draft teaching preview      | Database-free RU/EN/both preview and prerequisite closure for editorial review      | Local pass |
| 189 | Curriculum coverage report  | Separate approved registry, sealed courses, candidates and remaining target         | Local pass |

New drafts live outside the approved curation registry. Application publication is
not educational approval. Without independent review and database evidence these
drafts remain unpublished, and V4 remains the current finite content version.
No proprietary material, new dataset download or new runtime dependency is planned.

## Acceptance Checkpoint

Implementation: 15/15 independent functional commits. Local acceptance: 15/15.
Release verification: pending. Source inspection commands are documented in
`EDITORIAL_DRAFTS.md`; draft review/publication is explicitly not completed.

Relevant local batch: 237 tests passed across nine files; the additional
metadata/hydration race guard passed in the focused 61-case rerun. API and DB
typechecks, changed-file ESLint and formatting passed. Repairs preserve all-card
prerequisite gates, daily caps, owner checks, private text, listening eligibility
and unchanged SRS scheduling. No schema migration or dictionary import is needed.

The lightweight graph still scales with course placements/card IDs. This bounds
rich teaching hydration, not total graph metadata or PostgreSQL statement count.
Runtime latency must be measured on the deployed version, not inferred from
mock query counts. The remote readiness retry budget is six GET attempts with
three seconds between 503 responses, within the existing overall deadline.
Other errors and all writes still fail immediately without automatic retry.
