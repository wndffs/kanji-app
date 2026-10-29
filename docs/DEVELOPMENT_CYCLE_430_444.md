# Lexical Backbone 430-444

Baseline `267e16f`, 2026-10-29. Continue separate numbered commits, push,
batched scoped checks and a verified deployment/publication at the end.
Preserve every account, learning-card identity, schedule and V1-V5 seal.

## Revalidated Scope

The published V5 has 111 kanji/140 word pairs, but its vocabulary is almost
entirely nouns. Its authoring pipeline hardcodes noun metadata. Close this
prerequisite gap before claiming an N4-oriented vocabulary backbone: select one
bounded twenty-word wave (ten verbs, five i-adjectives, five nouns) from thirty
source-verified candidates (13 verbs, eight i-adjectives, nine nouns),
with original RU/EN pedagogy and examples. Add only the missing prerequisite
kanji 前; reuse the existing component-moon/knife visual cues, explicitly
distinguishing visual resemblance from etymology and 月 from the lower-left
shape. No extra component is needed. Place 前 at 11 and words at 12.

The existing twenty-word batch contract is preserved, not relaxed to fit drafts.
Ten remaining candidates are deferred, not published or counted twice.
Expected additive scope is one kanji, 20 pairs, 20 examples and 42 cards.
Only if evidence, independent review and live curator gates pass, prepare a
separate finite V6: 88 components/112 kanji/160 pairs, 360 items, 632 cards,
twelve levels. Neither a dictionary match nor this specification approves
publication. Never enlarge V5 or silently switch/enroll an existing user.

N4-oriented is an independent curriculum direction, not a JLPT entry label.
This bounded slice first fills basic vocabulary gaps; it does not establish
complete N4 coverage. Imported priority ranks are coarse source hints, not
corpus occurrence counts or learner proficiency. Exact spelling/reading pairs
remain distinct. No competitor content, grammar course, kana SRS, new dependency,
bulk raw import, destructive migration or paid-service change.

## Tasks

| ID  | Acceptance                                                             | State    |
| --- | ---------------------------------------------------------------------- | -------- |
| 430 | Independent selection policy and honest scope/labels                   | Complete |
| 431 | Deterministic usefulness/source-priority/readiness ranking             | Complete |
| 432 | Exact pair identity, ambiguity and evidence metadata                   | Complete |
| 433 | Non-noun authoring metadata and bounded verbs/adjectives               | Complete |
| 434 | Bounded useful nouns and time/language vocabulary                      | Complete |
| 435 | Verified 前 and earlier component/kanji closure                        | Complete |
| 436 | Curated RU meanings and conservative near-answer boundaries            | Complete |
| 437 | Matching EN meanings, synonyms and exclusions                          | Complete |
| 438 | Source-bound reading choices and explicit scope notes                  | Complete |
| 439 | Original JP/kana/RU/EN examples with prerequisite checks               | Complete |
| 440 | Independent content review, corrections and versioned seal             | Complete |
| 441 | Registry, placement/policy, finite-version and scoped preflight checks | Complete |
| 442 | Verified additive application/publication or exact blockers            | Complete |
| 443 | Batched learner/content acceptance and database impact                 | Complete |
| 444 | Release, exact runtime and real coverage/gap report                    | Complete |

## Operator Boundaries

Use the already verified external 2026-10-29 source cache; do not download or
reimport the corpus. Detailed source matches/glosses and screenshots stay
outside Git; only intentional curated identities and aggregate reports belong
in the repository. Existing source/license/quality/seal guards remain enabled.
Capture original private-state/old-course fingerprints before teaching writes.
Apply only new selected batches. The existing word preflight reads the full
registry and is slow; do not remove that guard merely to improve job timing.
Test locally only touched contracts, then use batched CI and one bounded remote
audit with an isolated account. Close browser tabs and finished helpers.

## Development Checkpoint

Full local scan matched all thirty exact bilingual candidates, all twenty
selected source IDs, 前's KANJIDIC2 on-reading and its KanjiVG primary graphic.
Candidate fingerprint `66ddf8b66fa6195afc370f9e4572620dba0d58fb92615052df76b005d1a3f56c`;
source fingerprint `007e2a5593b48b3bd77742c13f761dd1d6ca332843307346f6d2752003065240`.
Detailed observations stay in the external cache. No raw import or live write.

Scoped first-pass checks passed: 139 tests for selection, proposal content,
curator/POS and source tools. The word planner now checks at most four words
concurrently, preserves every source/ownership/placement check and drains all
in-flight reads before propagating a failure. Registry-wide preflight still
completes before any mutation. Its 71-test contract passed; actual operator
timings and publication are not inferred from mocks. At that first checkpoint,
the two reviewers had not completed review, reviewedAt was null and the proposal
was excluded from publishing registries. The final reviewed seal below supersedes
that development-only state, not the historical source records.

The user confirmed standing permission to use the two independent reviewers
for each subsequent batch without repeating the authorization question.

Both reviewers completed correction passes and approved the teaching content as
AI-only review, not human certification or live safety. They are closed.
`LEXICAL_WAVE08_REVIEW.md` records findings/corrections; the versioned decision
binds the final source payloads. Kanji SHA-256
`48ab03fce1511887a7c99aa5f290fa51b0dc86a45c624b99228c42940fa7428a`;
words `60833d0bc8ba76f4b734f0a46307cb3de4977ed637c510b01da1a75353e27a67`.

V6's canonical SHA-256 is
`544528b1d3d0d191e2d3285e76092b9a7cc795b0645e7ce5f9b4cc7ff4bf7156`;
publication-record UUID `1e43f4d1-9ed6-4f55-9bdc-08430d07cbe6`, not a live course
UUID. All sixteen source batches are pinned. V1-V5 source hashes/targets remain
unchanged, and V6 preserves V5's ten complete level/policy objects before adding
KANJI at 11 and WORD at 12. The publication operator retains the V4/V5 bounded
120-second Serializable transaction and all three quality scans for V6 too.
Its validate-only command passes without a database. No implicit enrollment.

Realistic preflight fixtures now cover all 360 V6 items in bounded scopes and
verify reviewed block reasons/provenance, with no account/SRS write access.
The historical draft07 preview is frozen to its original six-batch context;
later registries cannot rewrite that archive's prerequisites. Global registry
tests now count eight batches, while previous finite seals stay independently
asserted. Future unknown CLI version tests use v7, not the newly supported v6.
Live database checks were not yet complete at that development checkpoint.
Their actual results, rather than the proposal, are recorded next.

## Live Source And Safety Preflight: Task 442

Read-only kanji preflight
[40904420851](https://github.com/wndffs/kanji-app/actions/runs/40904420851)
passed on `36f2b9c` in 39 seconds total. Its database check took about six
seconds. No teaching writes occurred in that run. Separate read-only Neon
checks found all twenty exact selected JMdict source IDs, successful imports,
both imported locales (`ru-RU`/`en-US`) and open-data license/attribution rows.
The existing 前 graphic has nine paths matching its nine strokes, and the
selected ゼン reading exists. No raw corpus download or reimport was needed.

Before teaching writes, the 15:47:20 UTC snapshot captured all eleven private
tables and the four actually published V1/V2/V4/V5 courses (V3 is an unpublished
intermediate seal). It includes 24 users/settings, 162 SRS states, 49
enrollments, eight review sessions, five answers and six kana-progress rows.
Existing finite courses share 339 distinct items/590 cards, 1,248 accepted
answer rows and 46 meaning-block rows. Sorted complete-row digests stay only
in the operator session, never in Git. Old level/placement rows are included.
The initial physical PostgreSQL size is 160,530,432 bytes; this is not a Neon
quota or billable-storage measurement.

The explicit application selects only `task-118-course-kanji-08` and
`task-127-course-words-08`, never seed or earlier batch application.
The finite-publication plan is the rollback preview: V5 remains available,
and no user is automatically switched. If a later issue occurs, keep learners
on V5 and make a separately versioned repair; do not delete teaching rows or
rewrite immutable source seals merely to undo a rollout.

[Application 40905867645](https://github.com/wndffs/kanji-app/actions/runs/40905867645)
passed. Successful authored import runs are kanji
`d6ea468b-b923-4cf0-a59c-d86b1cef1224` and words
`64090816-c5c3-4563-a2dc-75971baef2e5`. The unchanged raw layer remains
30,000 word pairs, 13,108 kanji and 6,702 graphics. The complete 360-item quality
scan reports zero blockers/warnings, policy v2, content version
`27b76035232ef812be9e3f932e897e9cfc1b8c6c27077efa0a92202ab0214e4f`.
This teaching-quality token is distinct from a finite course publication version.

The full-registry word preflight took 154 seconds. Selected word application,
including its fresh full-registry preflight, took 343 seconds. The optimization
does not skip either check or promise an equivalent speedup for every Neon run.
After application, every original private/old-course/level/placement/item/card/
answer/block fingerprint matched. Physical database size was 160,792,576 bytes,
an observed 262,144-byte (256 KiB) increase, not a billable storage estimate.
No write rerun is claimed: existing-publication idempotence is checked separately
by the post-publication read-only plan, avoiding unnecessary answer-row rewrites.

A live aggregate query confirms exactly ten authored verbs, five i-adjectives,
five nouns and twenty published bilingual example links at the new vocabulary
level. The sixty-level main course remains DRAFT with twelve populated levels;
it is not mistaken for the separately published finite course.

## Finite V6 Publication: Task 442

[Read-only plan 40906635712](https://github.com/wndffs/kanji-app/actions/runs/40906635712)
passed against the applied content with no existing V6. The explicit
[publication 40908104197](https://github.com/wndffs/kanji-app/actions/runs/40908104197)
then passed all three source/quality/manifest checks, including the bounded
Serializable transaction. Actual course UUID:
`ae9dac23-36f5-4017-95d3-cf93b344b924`; live content version:
`9c599c7ab7e1dc539bd7b433e8357dda082506d05a1ef3720a1337e97ee63829`.
The result explicitly reports `enrolledUserId: null`. There are 88 components,
112 kanji, 160 exact word pairs, 360 items and 632 cards in twelve levels.
No migration, seed, old-source reapplication or account/course selection change
was needed. V1-V5 remain independently sealed.

[Post-publication plan 40908802623](https://github.com/wndffs/kanji-app/actions/runs/40908802623)
passed with the same course UUID, content version and exact placements. This
is existing-publication idempotence verification, not a second publication or
curator write. All original private-state and old-course fingerprints still
matched immediately after publication.

## Batched And Live Acceptance: Task 443

[CI 40904285471](https://github.com/wndffs/kanji-app/actions/runs/40904285471)
passed Quality/build and 479 browser cases (one existing skip), attempt 2.
Attempt 1 passed Quality and 478 browser cases; Chromium crashed with SIGSEGV
before the mobile installation scenario could create its context. The rerun
passed without code or assertion changes. A preceding genuine stale aggregate
expectation was corrected in `36f2b9c`: the reviewed registry is 112/160, not
111/140. [Study integrity 40904285419](https://github.com/wndffs/kanji-app/actions/runs/40904285419)
passed against PostgreSQL 18. Local checks were scoped to modified contracts;
no local development server or duplicate complete browser run was started.

[Remote V6 audit 40909088233](https://github.com/wndffs/kanji-app/actions/runs/40909088233)
passed with both exact runtime revisions
`37898b1317bf39b2f37e9fc251e096df55e49b8c`. It created one isolated audit
account, enrolled/selected V6 only for that account, and checked settings,
both kana paths, search, dashboard, lessons, reviews, characters and item reads.
It did not start a lesson/review or submit learning answers. Three HTTP samples
each gave dashboard median 708 ms (range 690-2,071), lessons 391 ms, reviews
133 ms, characters 397 ms and item 546 ms. The first dashboard sample exceeded
two seconds; the two subsequent samples did not. This is a bounded warm audit,
not a latency guarantee or proof that free-host cold starts are eliminated.

After audit, all original cohort fingerprints still match the original snapshot.
Only User/UserSettings/UserEnrollment exclude users created after the explicit
pre-audit cutoff; all learning-progress tables are compared in full. The final
physical size is 160,956,416 bytes, 425,984 bytes above the original snapshot,
including the publication and audit-account metadata, not just teaching content.
No private fields, digests, detailed dictionary observations or screenshots are
committed. Aggregate reporting is the user's explicit boundary.

Live IAB acceptance confirms all twenty new word-reading pairs at level 12,
the twelve-level program and exact 88/112/160/632 totals. All 272 kanji/word
materials have both meaning and reading cards; missing RU/EN/required-reading
counts are zero. Modern JLPT metadata remains unknown for 110 kanji/159 words,
and exam coverage is explicitly unconfirmed. Existing shared progress remains
visible while the inspected account keeps its original selected demo course.

The live 午後 item shows ごご, the corrected post-noon/p.m. scope including
evening, links to 午/後 and the original JP/kana/RU example with project
attribution. This is a read-only inspection, not a graded learner session.

## Release And Remaining Gap: Task 444

Tag `cycle-430-444-lexical-backbone` identifies this complete release checkpoint.
Actual web/API health and the remote audit both confirm runtime
`37898b1317bf39b2f37e9fc251e096df55e49b8c`. The later CI checkpoint `36f2b9c`
differs only in `packages/db/test/editorial-wave.test.ts`; subsequent release
receipts change documentation only. No unrelated runtime edit or empty rebuild
was introduced merely to force all SHAs to look identical.

Published content grew by one kanji, twenty exact word pairs, twenty original
bilingual examples and 42 cards relative to V5. The long-term 2,300-kanji/
8,000-pair target still lacks 2,188 kanji and 7,840 pairs. Volume ratios are
4.9%/2%, not JLPT coverage, proficiency or chances of passing. Grammar, full
reading/listening exam preparation and licensed recorded word audio were not
added in this batch. No new dependency, migration, competitor content or
inferred modern JLPT labels. Independent AI review is not human certification.

Screenshots and source observations stay outside Git. Both content reviewers
are closed; no local test/server session is left running. Agent-created browser
tabs are closed at handoff. **430-444 are complete; 445-459 is next, not started.**
