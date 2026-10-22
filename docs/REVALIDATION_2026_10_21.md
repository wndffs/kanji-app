# Product Revalidation: 2026-10-21

## Target

Independent WaniKani-comparable daily learning: components unlock kanji, kanji
unlock vocabulary, small lessons lead to typed quizzes, separate meaning/reading
cards follow deterministic SRS, and level progress explains the next action.
Content supports RU, EN and RU+EN. Kana is the canonical reading; optional lesson
romaji is an aid. Data, order, wording and visual design remain independent.

Hiragana/Katakana are a separate Duolingo-inspired character curriculum, not
phrase study or kana SRS: basic symbols, dakuten/handakuten, yoon, special sound
units, recognition, typing, matching, tracing and adaptive practice.

## Verified Result and Limits

This pass reviewed contracts, deployment, dependency audits, study integrity and
private editing, with two independent reviewers. Local checks are focused;
cloud CI runs broader checks. This does not claim exhaustive review of every
file, accessibility state or production-scale query.

- Main course, updated 2026-10-22: **61 placed kanji, 60 placed vocabulary,
  53 components and 60 bilingual examples**. Its combined 174-item/295-card batches passed a live quality
  report with zero blockers and warnings. The
  course is still DRAFT, not a published 2,300-kanji/8,000-word course.
- Raw corpus: 13,108 KANJIDIC2 entries, 30,000 bilingual JMdict pairs, 6,702
  KanjiVG graphics. Imported evidence is not editorial publication.
- The published starter demo is separate: 2 kanji/2 words.
- Published Foundation **v1** retains **40 components, 40 kanji, 20 words and
  160 cards**. Separately sealed **v2** now offers **53 components, 61 kanji,
  60 words and 295 cards**, reusing main-course identities. Explicit v2 enrollment
  and selection preserved the audit profile's SRS/private data; v1's live
  component/kanji/word chain is not whole-pilot completion. See
  `REMOTE_SMOKE_2026_10_22.md` for the disclosed synthetic progress fixtures.
- Kana practice has desktop/mobile regressions. Target lists have 115 Hiragana
  and 113 Katakana entries including combinations/special units, not that many
  basic characters.
- Listening infrastructure is implemented; test audio is not corpus coverage.
  Pitch-accent research remains deferred, without integrated accent data.
- The 90/100 WaniKani and 85/100 Duolingo-character goals are targets, not current
  measured scores. A tiny released corpus cannot justify whole-product parity.

See `TASK_118_PUBLICATION_STATUS.md` for exact batch/report hashes.
[Database run 39614884231, attempt 2](https://github.com/wndffs/kanji-app/actions/runs/39614884231/attempts/2)
verified forward migration and idempotent seed.
[Study integrity run 39614725843](https://github.com/wndffs/kanji-app/actions/runs/39614725843)
passed **27 tests on real PostgreSQL 18**, including competing writers, stale
snapshots, owner/mode boundaries, finish-vs-answer races and real rollback.

## Audit Repairs

| Finding                                              | Resolution                                                              |
| ---------------------------------------------------- | ----------------------------------------------------------------------- |
| Shared DB imports broke importer compilation         | Corrected TypeScript build root                                         |
| Smoke runner could infer success from partial output | Actual exit result and bounded full-run deadline                        |
| Concurrent answers could overwrite/count twice       | Serializable snapshot guards, 409 conflicts, real PostgreSQL regression |
| Practice accepted stale counters or wrong modes      | Progress compare-and-swap and mode checks                               |
| Prerequisites could pass from one card               | Batched all-card stage checks                                           |
| Private answer replacement could delete the original | Atomic owner/card-scoped update                                         |
| Mnemonic drafts mixed RU/EN or types                 | Scoped loading, drafts and stale-response guards                        |
| Kana distractors shared correct aliases              | Alias-disjoint choices and safe exercise fallback                       |
| Late kana response/401 changed script or login       | Request revisions and script/user-scoped remount                        |
| Short near-words passed as typos                     | Conservative minimum and RU/EN negative regressions                     |
| Review result was not announced                      | Scoped live status without early answers                                |
| Serialized config exposed connection secrets         | Redacted database/Redis URLs and token secret                           |
| Vulnerable runtime dependency tree                   | Compatible updates and verified Next/Vitest migration                   |
| Publication lacked comprehensive quality proof       | Task 119 bounded reusable audit and gate                                |
| Presentation preferences lacked durable contracts    | Task 120 enums, migration, API, prepaint and responsive controls        |

Residual Prisma/static-config and trusted-lint advisories are documented in
`DEPENDENCY_SECURITY.md`; zero critical advisories is not zero advisories.
Neon cold-start diagnosis is in `NEON_CONNECTIONS.md`. Readiness is an on-demand
diagnostic, not continuous database polling that consumes free compute.

## Revalidated Roadmap

| Task    | State                                         | Remaining Proof                                                          |
| ------- | --------------------------------------------- | ------------------------------------------------------------------------ |
| 111-115 | Implemented, bounded tests                    | Full corpus and whole-product accessibility                              |
| 116     | Listening mechanism implemented               | Real licensed assets, storage/CORS, coverage                             |
| 117     | Research deferred                             | Approved source/license before integration                               |
| 118     | In progress; blocks full release              | 2,239 kanji, 7,940 vocabulary, 55 empty levels, rollout                  |
| 119     | Implemented; live batch verified              | Same audit over eventual full corpus                                     |
| 120     | Implemented; focused acceptance tested        | Whole-product contrast belongs to 121-122                                |
| 121     | Not started                                   | Original visual system after functional/data contracts                   |
| 122     | Discovered blockers being repaired            | Width/zoom/keyboard/axe/screen-reader matrix                             |
| 123     | Bounded daily-use features implemented        | Full-scale/CWV budgets, real OS install and remote offline acceptance    |
| 124     | Content-fingerprint restore passed; gate open | Full corpus, recovery policy, remote matrix, rollback, security sign-off |
| 125     | Implemented and live-smoke verified           | Eventual whole-product acceptance                                        |
| 126     | Implemented; first examples live              | Editorial coverage as the corpus grows                                   |
| 127     | Repeatable editorial batches in use           | Remaining reviewed corpus, not only importer capacity                    |
| 128     | V1 preserved; expanded V2 published           | Complete remote mobile matrix and later versioned expansion              |
| 129     | Migrated and live verified                    | No inferred modern JLPT coverage claim                                   |

Order: correctness/CI, Task 119 before more Task 118 publication, independent
Task 120, contracts below, reviewed editorial batches, final visual refresh,
whole-product accessibility, daily-use improvements, final production proof.
Bounded operational parts of 124 can run early. Never lower the 2,300/8,000 gate
or mark raw glosses reviewed just to reach a number.

## Task 125: Corrective Retrieval

Implementation added on 2026-10-22; API and browser acceptance checks are
described in `REVIEW_CORRECTIONS.md`. All 30 PostgreSQL 18 integrity cases passed.
The live starter-account lesson, review, reload and corrective retrieval flow
is recorded in `REMOTE_SMOKE_2026_10_22.md`; full-product release remains open.

- Keep exactly one scheduling answer per card/session; preserve original error,
  penalty, due date and review accuracy.
- Re-present missed cards after intervening cards or at batch end. A correct
  retrieval clears a corrective step; wrong attempts stay recoverable.
- Server validation reuses private/blocked answers and neutral reading retries,
  but never creates another `ReviewAnswer` or changes `UserSrsState`.
- Scope to the owner's original session; persist/reconstruct remaining steps
  across reload. Network failure never means completion.
- Test duplicate requests, reload, ownership, original error counts and SRS.

Existing optional recent-mistake practice does not complete this in-session loop.

## Task 126: Direct Vocabulary Examples

Implemented with an additive migration, bounded licensed example queries and
quality policy v2. The first 20 original examples were applied in live curation
run 39772153454; no sentence learning cards were created.

- Relate vocabulary directly to bounded, attributed examples. Showing an example
  must not create a schedulable sentence or a fake sentence prerequisite.
- Preserve exact word/reading, RU/EN, source, license, import run and provenance;
  label authored examples explicitly.
- Reuse the relation in item pages, lessons and quality gates. Missing examples
  require an explicit audited exception, not placeholders or a blanket waiver.
- Test attribution failures, pagination, duplicate links and absence of SRS writes.

## Task 127: Restart-Safe Editorial Expansion

The first 20-word versioned batch is applied to Neon with stable target/card
identities. Reapplication, interruption and source preflight have PostgreSQL
regressions. This completes a bounded batch, not the eventual 8,000 words.
The third reviewed 20-word batch and fourth kanji batch are now applied. All
174 main-course items passed quality v2 with zero blockers/warnings in run
39814286342; exact counts/hashes are in `TASK_118_PUBLICATION_STATUS.md`.

- Resolve components across versioned batches with stable placement offsets,
  preserving existing cards, private content and progress.
- Produce manifests from cached legal sources with readings, RU/EN senses,
  prerequisite characters and hashes; independently review before applying.
- Apply bounded kanji/vocabulary batches, then quality and placement reports.
- Separate imported/reviewed/placed/published/enrolled counts.
- Test interruption, reapplication, checksum changes and progress preservation.

### Next Functional Batch (Prepared, Not Yet Applied)

Vocabulary batches 04 and 05 add forty source-checked words and forty original
JP/kana/RU/EN examples. Batch 04 completes the calendar months and irregular
dates at level 5 slots 61-80. Batch 05 opens level 6 slots 1-20 with school,
age/status, time and everyday compounds. The reusable word, kanji and component
writers now check destination and prerequisite bands against the actual 60-level
blueprint rather than hardcoding Foundation destinations. Pure validation also
rejects levels outside that blueprint. A course band's name does not assign an
official modern JLPT value to any dictionary row.

These sources are AI-authored and independently AI-reviewed, not human-reviewed.
Kanji batch 05 adds twenty more signs and ten components, using existing licensed
KANJIDIC2/KanjiVG records. Prepared V3 totals are 63 components, 81 kanji, 100 words,
244 placements, 425 cards and 100 examples across six populated levels. These
are source-manifest totals until server application is independently confirmed.
The separately reviewed word-06 reinforcement slice adds another twenty words
at level 6 slots 21-40. Registry totals become 120 words and 120 examples;
V3 remains frozen at 100 words. This slice does not silently expand any pilot.
Existing reviewed manifests, pilot V1/V2 seals, card identities and learner
enrollments are unchanged. Prepared source counts must not be reported as live
or published counts before a successful curation/quality run. The next finite
pilot must be separately sealed and explicitly enrolled; no silent upgrades.

## Task 128: Finite-Corpus Pilot

V1 was published by run 39784436544; separately sealed v2 was published by 39820406188. Course/catalog enrollment is
add-only and separate from current-course selection. The pilot content version
remains pinned to its original 100 items when unrelated main-course batches grow.
V2 has its own 174-item/295-card content seal and never silently upgrades v1.
Local desktop/mobile catalog regressions and live desktop prerequisite/typed
quiz/SRS/private-answer checks passed; the full remote mobile matrix is still open.

- A separately versioned foundation pilot must pass the same strict item quality
  and prerequisite rules; do not publish an empty 60-level main course.
- Enrollment is explicit/add-only and preserves card identity for transition to
  main, without duplicate SRS state.
- Verify a remote account can learn components/kana, unlock kanji, review both
  meanings/readings and edit private answers on desktop/mobile.
- State actual finite counts. Final release remains Task 124, not the pilot.

## Task 129: JLPT Source Edition Accuracy

Implemented in `03a5b5e`, migrated by run 39785278290 without starter reseeding,
and verified through read-only Neon queries and live search/lessons. The real
PostgreSQL suite passed 41 cases. See `JLPT_SOURCE_EDITIONS.md` for the initial
same-integer manual-edit ambiguity and preservation boundaries.

Live search on 2026-10-22 displayed imported 日 as `N4`. KANJIDIC2's `jlpt`
field is the pre-2010 four-level system, not a current N1-N5 label. The
[source DTD](https://www.edrdg.org/kanjidic/kanjidic2_dtdh.html) explicitly
distinguishes these editions. Treat this as a data/display defect, not a
reason to silently rewrite the original imported value.

- Preserve the raw old-level evidence and expose its edition explicitly.
- Keep independently sourced/curated modern levels separate; do not invent an
  official current kanji list or assign old level 2 to N2/N3 arbitrarily.
- Update import/storage metadata, item/search/character/lesson/review labels,
  filters and curriculum-planning consumers consistently. Modern filters must
  not compare directly against a legacy integer.
- Migrate existing imported values with source checks, preserving manual modern
  metadata and original source/checksum evidence. No new external import is
  required just to stop a misleading N label.
- Test old 4 is not displayed as N4, old 3 is not N3, ambiguous old 2 remains
  explicit, current independently authored N5 stays N5, and missing data stays
  unknown. Course bands remain the project's independent learning order.

## Execution Order, Not Task IDs

Task numbers are stable identifiers, not a strict execution sequence. New
findings receive new IDs without renumbering existing commits or specifications.
The present order is:

1. Task128 v1/v2 publication/enrollment and the bounded live desktop chain are done.
   Task129's JLPT repair is also deployed. Neither means full release approval.
2. The selected Task118/127 rollout and Task124 isolated read-only restore
   rehearsal passed. Its newer version-2 run 39821158337 matched all 45 public
   table counts and content SHA-256 values in a fresh PostgreSQL 18 service;
   it is not full disaster-recovery sign-off. Task123
   target and prerequisite-card hydration are deduplicated and sequentially
   batched at 100 IDs. Network interruption preserves unconfirmed review input
   without automatic retries; static install metadata/icons are implemented.
   Bounded manual remote measurements passed on both pilots, with no repeated
   study-GET sample above the initial 2-second target. Optional foreground
   reminders are deployed: explicit permission/opt-out, IANA timezone, atomic
   24-hour/local-day claim, no background push or polling. Seven local routes
   passed starting initial JS/CSS budgets; `WEB_BUNDLE_BUDGETS.md` distinguishes
   static asset bytes from actual browser performance. Exhausted lesson caps now
   skip graph hydration while retaining full-user daily-limit accounting.
   Full positive-path graph/query budgets, representative latency/CWV, actual
   OS installation and remote offline acceptance remain open. A production-only
   worker now caches exactly a public offline error page and one original icon,
   never app/API/private data or queued writes. Its 39 unit cases and 16 focused
   production desktop/mobile cases passed; `OFFLINE_SHELL.md` states the limits.
   See `REVIEW_REMINDERS.md` and `REMOTE_PERFORMANCE.md`.
3. Continue Task118/127 reviewed batches toward 2,300 kanji and 8,000 words;
   add licensed audio coverage from Task116 where an approved source exists.
4. Finish Task123 measured performance and daily-use acceptance, including
   installability and safe static-shell behavior. Foreground reminder opt-in/out
   and no-false-completion offline guards are implemented. Do not start a visual
   refresh while these functional contracts are still changing.
5. Task121 original configurable visual system after functional/data contracts.
6. Task122 whole-product responsive, keyboard and accessibility acceptance.
7. Task124 final release: complete corpus, remote route matrix, recovery/rollback,
   security and accessibility sign-off. The isolated content-fingerprint restore
   rehearsal is intentionally narrower than this final gate.

Task119, Task120, Task125 and Task126 provide implemented prerequisites.
Task117 pitch-accent research remains deferred pending source/license approval.
