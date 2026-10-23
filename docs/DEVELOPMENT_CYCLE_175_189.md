# Development Cycle 175-189

Baseline: `1fb9a58`. Fifteen functional slices, independently committed, with
relevant checks in batches. No task is counted for tests, repairs or documentation.
Push and verify a new application release after acceptance. Existing V1-V4 seals,
learner identities and schedules must remain unchanged.

| ID | Scope | Acceptance | State |
| --- | --- | --- | --- |
| 175 | Indexed lesson progress | Exact card/stage gates without repeated scans of per-item progress | In progress |
| 176 | Course eligibility graph | Read published placement/card/dependency metadata without teaching payload | Planned |
| 177 | Deck eligibility graph | Same lightweight boundary with owner and archive checks | Planned |
| 178 | Selected teaching hydration | Sequential bounded exact-ID loads, private text scoped to owner | Planned |
| 179 | Available queue hydration | Hydrate only today's selectable items and visible prerequisites | Planned |
| 180 | Session reads | Starting needs no teaching payload; resume hydrates only remaining session items | Planned |
| 181 | Answer reads | Check/complete hydrate only the requested eligible session item | Planned |
| 182 | Exhausted deck budget | Validate deck ownership/status without loading its items at the daily cap | Planned |
| 183 | Remote cold-start gate | Bounded readiness-only retries before account writes; no mutation retries | Planned |
| 184 | Late readiness recovery | Late successful probe replaces stale unavailable cache without parallel probes | Planned |
| 185 | Next kanji draft | Original RU/EN content, explicit readings/components/placements, pending review | Planned |
| 186 | Next word draft | Original RU/EN meanings, reading aids and examples; no invented source IDs | Planned |
| 187 | Draft evidence report | Read-only exact source-pair checks with provenance, never publish or infer approval | Planned |
| 188 | Draft teaching preview | Database-free RU/EN/both preview and prerequisite closure for editorial review | Planned |
| 189 | Curriculum coverage report | Separate approved registry, sealed courses, candidates and remaining target | Planned |

New drafts live outside the approved curation registry. Application publication is
not educational approval. Without independent review and database evidence these
drafts remain unpublished, and V4 remains the current finite content version.
No proprietary material, new dataset download or new runtime dependency is planned.
