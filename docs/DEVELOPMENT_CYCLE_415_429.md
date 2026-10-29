# Verified Foundation Expansion 415-429

Baseline `7bfb53d`, 2026-10-29. User authorizes this batch, separate task commits,
push, batched scoped checks, deployment and publication of verified content
only. Preserve accounts, progress, private answers and all existing seals.

## Audit And Minimal Plan

Wave07 already proposes nine components, ten kanji and twenty exact word pairs
with twenty original bilingual examples, placed at levels 8/9/10. It remains
outside curator registries. V4 is unchanged: 101 kanji/120 words/521 cards.
Do not author another replacement draft or polish unrelated UI.

Direct JMdict still stalled after 15,894 bytes. The existing local Throne core
exposes a working proxy; using it explicitly, without changing system/VPN
settings, downloaded the three canonical archives into the external persistent
cache. The 2026-10-29 snapshot passes archive/XML hashes and pinned identities.
Actual full-source scan: 13,108 KANJIDIC2, 218,975 JMdict and 6,702 KanjiVG
records. All ten proposed kanji readings, twenty exact bilingual word pairs and
fifteen distinct graphic identities match without ambiguity. This is source
evidence, not independent educational approval or successful Neon preflight.

Review meanings, reading choices, component descriptions and examples first;
then bind the corrected content to evidence and review decisions. Promote only
the verified versioned batches, preserve V1-V4, prepare a finite V5, and run the
existing source/license/graph/quality guards before any additive application.
Missing live evidence blocks publication rather than weakening a guard.

## Tasks

| ID  | Acceptance                                                                     | State     |
| --- | ------------------------------------------------------------------------------ | --------- |
| 415 | Audit prior evidence and acquire real source snapshot; select bounded wave07   | Complete  |
| 416 | Review/correct RU meanings and semantic near-answer boundaries                 | Complete  |
| 417 | Review/correct corresponding EN scope and accepted meanings                    | Complete  |
| 418 | Verify kanji/whole-word readings, ambiguity and special-reading explanations   | Complete  |
| 419 | Review/correct original JP/kana examples and both translations                 | Complete  |
| 420 | Correct component shape/name and mnemonic factual claims                       | Complete  |
| 421 | Bind exact source identities through existing source preflight, no guessed IDs | Complete  |
| 422 | Validate prerequisite closure, placement and level progression policies        | Complete  |
| 423 | Record a versioned independent review decision bound to source/content         | Complete  |
| 424 | Prepare finite V5 without changing any V1-V4 object/hash/identity              | Complete  |
| 425 | Preview additive writes, query/storage costs and idempotent rerun              | Complete  |
| 426 | Apply approved selected teaching batches without resetting SRS                 | Complete  |
| 427 | Publish only the verified finite manifest, or report exact blockers            | Planned   |
| 428 | Batched relevant content/answer/integrity and unchanged-progress acceptance    | Local/CI  |
| 429 | Version/push/deploy/live verify and report actual published counts             | Planned   |

## Boundaries

Only RU/EN project-authored teaching content; imported evidence stays separate.
No WaniKani content, inferred modern JLPT labels, kana SRS, grammar expansion,
bulk raw import, account enrollment/switch/reset or destructive operation.
Detailed source reports, raw corpora and review worksheets stay outside Git;
committed reports contain aggregates and intentional curated provenance only.
Authorization does not substitute for source, license, review or curator gates.
New finite versions do not silently enlarge existing published courses.

The user approved two independent reviewers. Reviewer A inspected all twenty
word identities, meanings/accepted sets and all example fields. Reviewer B
inspected all nineteen component/kanji identities and reading explanations.
Corrections clarify real alternative readings, morae/sokuon, family/address
usage, friend gender/register, school stage and fictional mnemonics. Example
subjects use kana because 私 is not yet in the registered prerequisite closure.
Review is AI editorial review, not human certification or an originality proof.
Source matching alone must never set reviewedAt or readyToPublish. The discovered
semantic typo false positives are now explicitly blocked on new meaning cards.
Both reviewers completed a second read-only review of the corrected data and
reported no remaining editorial blockers. They did not independently rerun the
parent's tests or attest database/publication safety.

The immutable promoted content is bound by `editorial-wave07-review.ts` to
proposal/source fingerprints and separate full batch SHA-256 values. The old
proposal stays inspectable against its pre-wave context, but is not counted
again as pending content. Runtime published counts remain a separate DB read.

## Source Receipt

The local snapshot also passes a real `--offline` rerun: all three cache hits,
no downloads. Only exact curated identities and aggregate observation metadata
are committed; full source/review reports remain in the external cache.

A bounded live Neon SELECT (620 ms) confirmed 20/20 exact word IDs, successful
licensed attributed JMdict provenance and both imported locales; 10/10 exact
raw kanji readings, successful KANJIDIC2 provenance and successful graphics with
matching stroke counts. No raw import or database mutation was needed. These
observations do not replace transactional curator preflight or quality checks.

## Finite V5 And Operator Plan

V5 contains 88 components, 111 kanji, 140 word pairs, 339 items and 590 cards
across ten levels. Fourteen reviewed source batches include every V4 source
unchanged. V5 canonical SHA-256:
`2943f058d3590f190274bdcabf81e1270c1fa1274f5b6e2c02b0e9737eeca03a`.
Meaning blocks are part of the sealed expected target content and checked
against actual cards before publication. Old canonical V1-V4 objects/hashes
and identities are unchanged. No new SQL migration or runtime dependency.

The curation workflow defaults to read-only `plan`; only explicit `apply` can
write reviewed teaching content. Its database secret is no longer available
during npm installation. Content application no longer runs unrelated schema
migrations. The publication workflow likewise exposes the secret only to its
plan/publication step, not dependency installation or manifest validation.

Run selected kanji07-only plan before any teaching write. Capture aggregate
private-state/old-course fingerprints locally. Apply only that reviewed batch,
then preflight and apply selected word07; its kanji must already exist at the
registered earlier placements. Rerun selected applications to verify stable
IDs/counts and unchanged private state. Only after zero quality blockers/warnings
and a successful V5 read-only plan, publish V5 without enrollment. No bulk raw
import, source mutation, old-seal replacement, paid service or account reset.
These operator results are pending until actually observed.

## Read-Only Plan And Batched Checks

Selected kanji07-only workflow plan `40847490721` passed at `9552585`, without
migrations or teaching writes. The candidate is bounded to nine components,
ten kanji, twenty word pairs and twenty original examples: no full raw corpus
is loaded or imported. The real selected kanji preflight took about 18 seconds.
The following combined application is a separate explicit operator action;
its completion, quality results and idempotence are not implied by this plan.

Scoped local checks passed for source matching, sealed content, semantic
answer blocks, both curators, prerequisite placement and V1-V5 publication.
Database typecheck and changed-file ESLint passed. Runtime preflight tests
exercise all 339 V5 targets and fourteen source seals, reject missing actual
meaning blocks, and prohibit account/SRS/enrollment writes. Earlier finite
manifests retain their exact canonical hashes. Historical first-six-batch
tests now explicitly select their historical scope; global registry tests
expect seven reviewed waves.

CI `40847830081` and study-integrity `40847830071` passed at `14f082a`.
The earlier CI run found four stale test expectations after registering V5;
they were corrected without weakening source, quality or publication guards.
Live private-state fingerprints and final publication/deployment acceptance
remain separate checks below, not consequences of green mocked/unit tests.

## Selected Application: Task 426

[Run 40848704377, attempt 1](https://github.com/wndffs/kanji-app/actions/runs/40848704377/attempts/1)
passed at `14f082a` with explicit `apply`, selected
`task-118-course-kanji-07` and `task-127-course-words-07`, and `skip_words=false`.
Only these two teaching batches were written; the word planner also verifies
the earlier registered batches, without reapplying them. Kanji application
completed in about one minute; complete word preflight/application took about
3m44s/5m52s. These are operator timings, not UI request performance estimates.

Actual additive totals: nine components, ten kanji, twenty word pairs, twenty
original bilingual examples and 69 cards. A bounded live SELECT found 39 new
items, 69 stable card identities and 46 explicit meaning-block rows. The
339-item quality scan returned **zero blockers and zero warnings**; quality
content version `f5c10aa5777a7f5ab12ae9e751c3b948ac790d00f136344297484386e622965f`.
This is not the V5 publication manifest hash or its eventual live content hash.

Server-side fingerprints of all eleven private-state tables, V1-V4 course
rows and their 521 cards/answers/blocks matched the pre-application snapshot
exactly. Counts include 23 users, 162 SRS states, eight review sessions, five
review answers and 47 enrollments; no individual account fields or fingerprints
are committed. A second identical explicit attempt is running to verify
idempotence. V5 read-only planning is queued behind that database operation.
No schema migration, raw dictionary import, enrollment or paid change occurred.
