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

- Main course: **20 placed kanji, 0 placed vocabulary, 26 components**. Its
  46-item/66-card batch passed a live quality report with zero blockers. The
  course is still DRAFT, not a published 2,300-kanji/8,000-word course.
- Raw corpus: 13,108 KANJIDIC2 entries, 30,000 bilingual JMdict pairs, 6,702
  KanjiVG graphics. Imported evidence is not editorial publication.
- The published starter demo is separate: 2 kanji/2 words.
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

| Task    | State                                  | Remaining Proof                                                              |
| ------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| 111-115 | Implemented, bounded tests             | Full corpus and whole-product accessibility                                  |
| 116     | Listening mechanism implemented        | Real licensed assets, storage/CORS, coverage                                 |
| 117     | Research deferred                      | Approved source/license before integration                                   |
| 118     | In progress; blocks full release       | 2,280 kanji, 8,000 vocabulary, 60 levels, rollout                            |
| 119     | Implemented; live batch verified       | Same audit over eventual full corpus                                         |
| 120     | Implemented; focused acceptance tested | Whole-product contrast belongs to 121-122                                    |
| 121     | Not started                            | Original visual system after functional/data contracts                       |
| 122     | Discovered blockers being repaired     | Width/zoom/keyboard/axe/screen-reader matrix                                 |
| 123     | Not complete                           | Measured budgets, installability, offline, reminders                         |
| 124     | In progress                            | Full corpus, restore rehearsal, remote smoke, rollback and security sign-off |

Order: correctness/CI, Task 119 before more Task 118 publication, independent
Task 120, contracts below, reviewed editorial batches, final visual refresh,
whole-product accessibility, daily-use improvements, final production proof.
Bounded operational parts of 124 can run early. Never lower the 2,300/8,000 gate
or mark raw glosses reviewed just to reach a number.

## Task 125: Corrective Retrieval

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

- Relate vocabulary directly to bounded, attributed examples. Showing an example
  must not create a schedulable sentence or a fake sentence prerequisite.
- Preserve exact word/reading, RU/EN, source, license, import run and provenance;
  label authored examples explicitly.
- Reuse the relation in item pages, lessons and quality gates. Missing examples
  require an explicit audited exception, not placeholders or a blanket waiver.
- Test attribution failures, pagination, duplicate links and absence of SRS writes.

## Task 127: Restart-Safe Editorial Expansion

- Resolve components across versioned batches with stable placement offsets,
  preserving existing cards, private content and progress.
- Produce manifests from cached legal sources with readings, RU/EN senses,
  prerequisite characters and hashes; independently review before applying.
- Apply bounded kanji/vocabulary batches, then quality and placement reports.
- Separate imported/reviewed/placed/published/enrolled counts.
- Test interruption, reapplication, checksum changes and progress preservation.

## Task 128: Finite-Corpus Pilot

- A separately versioned foundation pilot must pass the same strict item quality
  and prerequisite rules; do not publish an empty 60-level main course.
- Enrollment is explicit/add-only and preserves card identity for transition to
  main, without duplicate SRS state.
- Verify a remote account can learn components/kana, unlock kanji, review both
  meanings/readings and edit private answers on desktop/mobile.
- State actual finite counts. Final release remains Task 124, not the pilot.
