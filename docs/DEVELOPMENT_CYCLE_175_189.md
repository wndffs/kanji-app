# Development Cycle 175-189

Baseline: `1fb9a58`. Fifteen functional slices, independently committed, with
relevant checks in batches. No task is counted for tests, repairs or documentation.
Push and verify a new application release after acceptance. Existing V1-V4 seals,
learner identities and schedules must remain unchanged.

| ID  | Scope                       | Acceptance                                                                          | State    |
| --- | --------------------------- | ----------------------------------------------------------------------------------- | -------- |
| 175 | Indexed lesson progress     | Exact card/stage gates without repeated scans of per-item progress                  | Accepted |
| 176 | Course eligibility graph    | Read published placement/card/dependency metadata without teaching payload          | Accepted |
| 177 | Deck eligibility graph      | Same lightweight boundary with owner and archive checks                             | Accepted |
| 178 | Selected teaching hydration | Sequential bounded exact-ID loads, private text scoped to owner                     | Accepted |
| 179 | Available queue hydration   | Hydrate only today's selectable items and visible prerequisites                     | Accepted |
| 180 | Session reads               | Starting needs no teaching payload; resume hydrates only remaining session items    | Accepted |
| 181 | Answer reads                | Check/complete hydrate only the requested eligible session item                     | Accepted |
| 182 | Exhausted deck budget       | Validate deck ownership/status without loading its items at the daily cap           | Accepted |
| 183 | Remote cold-start gate      | Bounded readiness-only retries before account writes; no mutation retries           | Accepted |
| 184 | Late readiness recovery     | Late successful probe replaces stale unavailable cache without parallel probes      | Accepted |
| 185 | Next kanji draft            | Original RU/EN content, explicit readings/components/placements, pending review     | Accepted |
| 186 | Next word draft             | Original RU/EN meanings, reading aids and examples; no invented source IDs          | Accepted |
| 187 | Draft evidence report       | Read-only exact source-pair checks with provenance, never publish or infer approval | Accepted |
| 188 | Draft teaching preview      | Database-free RU/EN/both preview and prerequisite closure for editorial review      | Accepted |
| 189 | Curriculum coverage report  | Separate approved registry, sealed courses, candidates and remaining target         | Accepted |

New drafts live outside the approved curation registry. Application publication is
not educational approval. Without independent review and database evidence these
drafts remain unpublished, and V4 remains the current finite content version.
No proprietary material, new dataset download or new runtime dependency is planned.

## Acceptance Checkpoint

Implementation: 15/15 independent functional commits. Local acceptance: 15/15.
Release verification: passed. Source inspection commands are documented in
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

## Verified Release: 2026-10-23

Runtime: `bc4e41135b80d01cd736cf687742fc50daf78695`.
Release tag: `cycle-175-189-lessons`, pointing to this runtime, not an educational
content seal. The final evidence-only commit does not change application source.

- [CI 39980607349](https://github.com/wndffs/kanji-app/actions/runs/39980607349)
  passed Quality and 249 production browser cases, with one intentional skip.
- [Study integrity 39980607752](https://github.com/wndffs/kanji-app/actions/runs/39980607752)
  passed against PostgreSQL 18. No migration or seed was needed on Neon.
- Render deployment `dep-dbdo0sdg1s2s73duilbg` reported Live. Both live health
  endpoints returned the exact runtime SHA. Render initially displayed its
  waking-instance page; the bounded readiness change addresses Neon readiness,
  not a guarantee of instant Render cold starts.
- [Remote smoke 39981165632](https://github.com/wndffs/kanji-app/actions/runs/39981165632)
  passed with exact SHA matching and its own disposable V4 audit account. Median
  HTTP times over three samples: dashboard 605 ms, lessons 423 ms, reviews 183 ms,
  characters 526 ms, item 674 ms. Every route's two warm samples met 2000 ms.
  Lessons ranged 398-461 ms versus the previous cycle's 2102 ms median. This is
  a small-corpus comparison, not a full-scale benchmark or browser CWV measurement.
- Live IAB testing on the existing test profile retained its starter course,
  started two component lessons, reloaded and restored the selected session,
  completed both mandatory meaning checks and displayed two learned items / two
  created review cards. This exercised real check/complete writes. It did not
  bypass scheduling, earn all V4 levels or grade a naturally due review.
- The source-only coverage CLI passed. Local focused coverage is 238 unique
  relevant cases (237 in the combined batch plus one added race case); subsequent
  focused reruns overlap and must not be added to that total.

Content publication remains V4: 79 components, 101 kanji, 120 words, 521 cards,
120 original bilingual examples and seven levels. Pending draft07 proposes nine
components, ten kanji, twenty words, twenty examples and 69 cards. Those drafts
are outside curator inputs; source evidence inspection has not been run against
Neon and independent editorial approval is still required. They were not applied
or published, and do not reduce the 2199-kanji / 7880-word reviewed backlog.

No new dependency or source license was introduced. All new teaching copy is
project-authored; no WaniKani content, order, wording or visual assets were used.
No owned local Node servers remained after checks. Temporary IAB tabs were closed;
the live lesson screenshot is stored outside the repository.
