# Finite Foundation Pilot

Task128 defaults to `japanese-foundation-pilot-v1`: a separate, versioned
five-level pilot containing **40 components, 40 kanji and 20 words**, reusing
**100 existing learning items and 160 existing cards**. It is not the completed
60-level course and is not full Task128 or production-readiness approval.

An explicitly selected, separately sealed `japanese-foundation-pilot-v2` is now
published after independent parent planning/review. It contains **53 components,
61 kanji and 60 words**, reusing **174 existing items and 295 existing cards** in
five levels. Live plan and publication evidence is recorded below. Publication
never automatically upgrades/enrolls v1 learners or changes their current course.

## Published V6: 2026-10-29

Retention cycle 445-459 changes study/practice presentation and adds one
independently licensed word-pronunciation sidecar, not the finite manifest,
placements, card set or enrollment. Read-only plan `40920054697` confirms V6's
same UUID/content version below after attachment; original learning state is
preserved. No V7 or listening SRS expansion is implied. Full runtime receipts
are in `DEVELOPMENT_CYCLE_445_459.md`.

Cycle 430-444 adds the independently sealed `japanese-foundation-pilot-v6`:
**88 components, 112 kanji, 160 word pairs, 360 items, 632 cards and 160 original
bilingual examples**, across twelve populated levels. New content is one kanji
and twenty word pairs: ten verbs, five i-adjectives and five nouns. The complete
V5 source set and its first ten level/policy objects remain unchanged.

[Read-only plan 40906635712](https://github.com/wndffs/kanji-app/actions/runs/40906635712)
and [explicit publication 40908104197](https://github.com/wndffs/kanji-app/actions/runs/40908104197)
passed, with no implicit enrollment. Live course UUID:
`ae9dac23-36f5-4017-95d3-cf93b344b924`; content version:
`9c599c7ab7e1dc539bd7b433e8357dda082506d05a1ef3720a1337e97ee63829`.
The canonical manifest SHA-256 is
`544528b1d3d0d191e2d3285e76092b9a7cc795b0645e7ce5f9b4cc7ff4bf7156`;
its publication-record UUID is `1e43f4d1-9ed6-4f55-9bdc-08430d07cbe6`, not the
live course UUID. Sixteen sources are pinned; the two added seals are kanji08
`48ab03fce1511887a7c99aa5f290fa51b0dc86a45c624b99228c42940fa7428a`
and words08 `60833d0bc8ba76f4b734f0a46307cb3de4977ed637c510b01da1a75353e27a67`.

V6 retains the bounded V4/V5 120-second Serializable publication transaction,
all source/license/quality guards, and exact semantic meaning-block comparison.
KANJI at level 11 and WORD at level 12 retain stage 5/90% pass policies and
prerequisite requirements. This is a small basic vocabulary expansion toward
N4, not full N4/N3 coverage or human pedagogical certification. Existing users
choose/enroll explicitly; publication does not silently switch their course.
The manual workflows accept explicit V6; defaults remain V1 and read-only plan.
Full source, preservation and acceptance receipts: `DEVELOPMENT_CYCLE_430_444.md`.

Post-publication read-only plan `40908802623` confirms the same UUID/version and
all placements. Exact-revision V6 remote smoke `40909088233` passed on web/API
`37898b1`. Existing learner state and earlier finite courses were preserved;
all 272 kanji/word materials have both meaning/reading, with zero missing
RU/EN/required readings. Modern JLPT labels remain unknown for 110 kanji/159
words. Publication does not certify exam coverage.

## Published V5: 2026-10-29

Cycle 415-429 adds a separately sealed `japanese-foundation-pilot-v5` through
`buildFoundationPilotManifestV5()`: **88 components, 111 kanji, 140 word pairs,
339 existing items, 590 existing cards and 140 original bilingual examples**
in ten populated levels. This is still a foundation, not full N4/N3 coverage.
Its fourteen reviewed sources contain the twelve V4 sources unchanged plus
`task-118-course-kanji-07@1` and `task-127-course-words-07@1`.

[Read-only plan 40854725090](https://github.com/wndffs/kanji-app/actions/runs/40854725090)
and [explicit publication 40855074022](https://github.com/wndffs/kanji-app/actions/runs/40855074022)
passed. Course UUID: `29080946-ac34-4db5-aeb4-9955cfbc70e1`; live content version:
`fe7a3c9def95073fc11ef754cc6b79a9196da6537c55d2a9617ee87a0ed4aaca`.
Post-publication plan `40855686356` confirms the same UUID/version and exact
placements. No existing user was enrolled or switched. Exact-revision V5 remote
smoke `40855779425` passed on web/API `3f9d62d`, using a separate audit account.

V5's stable publication-record UUID is
`44b901f4-0262-46a9-a094-e4dac255874a`; its canonical manifest SHA-256 is
`2943f058d3590f190274bdcabf81e1270c1fa1274f5b6e2c02b0e9737eeca03a`.
The added source seals are respectively
`c29f311e3f05cd03e1b12a232bc660bfcd7a548a689ff76c798ab7d56313ae06` and
`8a7c53c07b87b31ecfa27173731c8213f755a3349332f40ef5372c46e521ebf4`.
These hashes are not live course IDs or publication content-version hashes.

Existing placements, V1-V4 canonical manifests and defaults remain unchanged.
New levels 8/9/10 contain 9 components, 10 kanji and 20 words respectively;
their core types are COMPONENT/KANJI/WORD, retaining stage 5 and 90%.
Dependency requirements still apply independently. The N5 course bands are
project curriculum metadata, not invented modern JLPT labels for entries.

V5 requires the sealed expected meaning blocks to match actual meaning-card
blocks, successful licensed source provenance and zero quality blockers.
Quality reads stay bounded to 100-item scopes with completeness checks; the
339 placements must match exactly. Like V4, V5 uses a bounded 120-second
Serializable publication transaction. No timeout, source, quality or rollback
guard is disabled. `--pilot v5 --validate-only` passed without database access.

The existing manual publication workflow now offers V5, still defaulting to
`v1` and read-only `plan`. Only explicit `publish` writes the finite course;
it offers no enrollment input and cannot switch or reset existing learners.
The remote smoke workflow also accepts explicit V5 selection and exact web/API
revisions, with the same bounded temporary-account audit and sanitized report.
Actual operator/publication receipts belong in `DEVELOPMENT_CYCLE_415_429.md`;
preparing this manifest does not itself publish V5 or certify human review.

## Published V4: 2026-10-23

Task144 prepares a separately sealed `japanese-foundation-pilot-v4` via
`buildFoundationPilotManifestV4()`: **79 components, 101 kanji, 120 words,
300 existing items, 521 existing cards and 120 original bilingual examples**.
All seven levels are populated. After all 15 cycle tasks passed acceptance,
selected Neon curation, a fresh read-only plan and explicit publication succeeded.
[Publication 39858951154](https://github.com/wndffs/kanji-app/actions/runs/39858951154)
created course UUID `ed80100c-e1dc-4399-8379-78d0aa912ee0`, live content version
`eeae844d6abb0e7d7eeacf6fe7227377a1457f2106902f7d962902122b8dceee`.
No user was enrolled or switched by publication. Exact-revision remote smoke
`39859400700` passed on web/API commit `419e97f`; full evidence and limits are in
`DEVELOPMENT_CYCLE_130_144.md`. This finite pilot is not full-course publication
or human pedagogical certification. Source review dates remain sealed evidence.

V4's stable publication-record UUID is
`a88880b1-27a3-474d-af1f-0e9ef261d6f7`; canonical manifest SHA-256 is
`7353baf893c3bde9fb7279529bcf69d66d7e0b9ef81396a8fb96169c686e70fc`.
This is not a live content-version hash or a database course UUID.
V1/V2/V3 manifests, source seals, UUIDs, counts and default V1 selection remain
unchanged; V3 stays 63/81/100, 244 items, 425 cards and six levels.

Only these twelve version-1 sources are selected, in this order. The sixth
kanji source is actually named `task-118-course-kanji-06`, not
`task-118-foundation-kanji-06`; no source alias or future-registry expansion is
accepted. The first ten source payloads retain V3's seals.

| Source                       | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| task-118-foundation-kanji-01 | `34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8` |
| task-118-foundation-kanji-02 | `99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714` |
| task-118-foundation-kanji-03 | `fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92` |
| task-118-foundation-kanji-04 | `5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850` |
| task-118-foundation-kanji-05 | `95a4b69a331f200caa5044717cde9d628c3d3ad1d79600000c142a55967a3c1b` |
| task-118-course-kanji-06     | `74482be25706778fafe6e18b5ffc144718a3bf7a4181a5aacc8323516b223833` |
| task-127-foundation-words-01 | `1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf` |
| task-127-foundation-words-02 | `0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f` |
| task-127-foundation-words-03 | `ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4` |
| task-127-foundation-words-04 | `81496c6ffcb91d0d7fa046b8f075b4b1aff6e2ccec7f69d48c48708bb043b5b6` |
| task-127-course-words-05     | `e1fd34111d46183f4376934d9d55429c191524e7d319ec367b8bdb2c4d972f36` |
| task-127-course-words-06     | `8a9e0cef7dc10ec355125ffb7bb989d96cd531d0f85767280b735b6ad9790858` |

| Level | Preserved placements                             | Core pass policy |
| ----- | ------------------------------------------------ | ---------------- |
| 1     | 63 components                                    | COMPONENT        |
| 2     | 22 kanji                                         | KANJI            |
| 3     | 18 kanji                                         | KANJI            |
| 4     | 41 kanji                                         | KANJI            |
| 5     | 80 words, slots 1-80                             | WORD             |
| 6     | 40 words, slots 1-40; 16 components, slots 41-56 | WORD             |
| 7     | 20 kanji, slots 1-20                             | KANJI            |

All policies retain stage 5 and 90%: L5 requires 72/80 word items, L6 requires
36/40 word items, and L7 requires 18/20 kanji items, with **all cards of each
qualifying item** at the policy stage. Core-policy completion is not completion
of all items/cards. In particular, passing L6's WORD core says nothing about
mastering its 16 components; it must not be presented as completing all 56 items
or all 96 cards. These components remain placed in L6, with their exact original
dependencies gating the corresponding L7 kanji at stage 1. Every card of every
required component must meet that stage; the level policy never waives per-item
prerequisites. Words still require all cards of their spelling-kanji prerequisites
at stage 2. L6/L7 retain the main blueprint's N5 band, not an official JLPT claim
for individual entries. No placements/order, global items/cards, answers, quality
rules, license evidence or user schedules are rewritten.

The existing publisher rejects noncanonical V4 payloads before any database
access, verifies exact source hashes/review dates and applies all current quality
gates. Placement reads use `take: 301` and require exactly 300 rows. Quality reads
use three disjoint sorted 100-ID scopes, each with a terminal-page check; all
300 items must pass. Synthetic tests exercise these bounds and publication write
arguments only, not PostgreSQL persistence or live enrollment. No new data,
dependencies or license assumptions beyond the existing legally reusable raw
sources and project-authored curation are introduced.

V4 publication has a bounded 120-second Serializable transaction budget; V1/V2/V3
retain 60 seconds and all versions retain a 10-second acquisition wait. Live
attempt `39857759491` rolled back at 60 seconds during the final repeated quality
scan after the read-only plan passed. The larger V4-only budget preserves all
three in-transaction scans, checksum comparisons and rollback behavior; it is not
an unlimited timeout or permission to skip validation.

Local database-free inspection is `npm run db:publish:pilot -- --pilot v4 --validate-only`.
Only after the parent acceptance gate, an operator may explicitly choose V4 in
the existing read-only plan/publication flow. Omitting `--pilot` still selects V1;
omitting a mode still plans read-only. The workflow adds only the V4 choice and
enum guards, keeps `v1`/`plan` defaults and exposes no enrollment input. There is
no automatic upgrade, enrollment, source expansion or current-course selection.

## Prepared V3 (Not Yet Published)

`buildFoundationPilotManifestV3()` is a separate six-level finite expansion:
63 components, 81 kanji, 100 words, 244 existing targets and 425 existing cards.
Levels 5 and 6 use WORD completion policies; level 6 retains the main blueprint's
N5 band. This is an independent course band, not an official JLPT assignment to
individual dictionary entries. The full main-course target remains 2,300/8,000.

V3 adds exactly these three reviewed sources to the seven V2 sources:

| Source                       | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| task-118-foundation-kanji-05 | `95a4b69a331f200caa5044717cde9d628c3d3ad1d79600000c142a55967a3c1b` |
| task-127-foundation-words-04 | `81496c6ffcb91d0d7fa046b8f075b4b1aff6e2ccec7f69d48c48708bb043b5b6` |
| task-127-course-words-05     | `e1fd34111d46183f4376934d9d55429c191524e7d319ec367b8bdb2c4d972f36` |

The stable publication-record UUID is `41a64921-eb2c-433e-9761-250e3b31015e`;
canonical manifest SHA-256 is
`a7261a33902acba75a8058ba043b4f6ab786978315783e23cb9479cd040617d1`.
These are prepared source seals, not proof of database application/publication.
After curation and quality checks, use `--pilot v3 --plan` before the explicit
`--pilot v3 --publish`. Neither action silently enrolls users or selects V3.
V1/V2 source/canonical seals and default CLI behavior are unchanged.
The later `task-127-course-words-06` slice is deliberately outside V3's ten-source
seal, even though its twenty words are registered in the main-course writer.

## Separate V2 Seal

`buildFoundationPilotManifest()` retains its v1 signature and defaults.
`buildFoundationPilotManifestV2()` uses only these seven named approved
version-1 source batches, in this order, never every future registry entry:

| Source                       | SHA-256                                                            |
| ---------------------------- | ------------------------------------------------------------------ |
| task-118-foundation-kanji-01 | `34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8` |
| task-118-foundation-kanji-02 | `99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714` |
| task-118-foundation-kanji-03 | `fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92` |
| task-118-foundation-kanji-04 | `5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850` |
| task-127-foundation-words-01 | `1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf` |
| task-127-foundation-words-02 | `0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f` |
| task-127-foundation-words-03 | `ef7090a4cea8c4b74c04a3cebfe85dc9832d64e1b7d071e409232287e7cf2ff4` |

V2 stable publication-record UUID: `4c599bc8-e28c-4527-9d9b-a99a3a7c8779`.
V1 UUID stays `c5d6546d-6f29-451e-bbc5-a0ba4b887048`.
The complete v1 canonical manifest was captured before the refactor and remains
`f2febe7e3a1e5a11800530c7992819ab2c3a06f5c33ae3dd0f5218de68c68b86`;
its ordinary ordered JSON SHA-256 remains
`8b3108bb59b3b3329f6bb56469923f696824139b2ee0870086cb90eaae5e3fc7`.
V2 canonical manifest SHA-256 is
`4d2f3aab0b2b160774ab5a2ca19a675f28423c48561218abca4c8737c47d53e1`.
These manifest seals are not live course content-version hashes.

The common publisher accepts only canonical equality with one of the five known
sealed manifests and exact approved registry/source hashes. Altered counts,
targets, answers, source records/IDs/order, approval dates or level policies
fail before any database read. Caller-provided counts or slugs do not define
an arbitrary publishable course. V1 has no new manifest fields and keeps its
original 100-item/160-card identity, version and metadata shape.

V2 retains the five verified word02 alternate reading answers: 日本/にっぽん,
一人/いちにん, 二人/ににん, 水田/みずた and 左右/そう. Each word still has
one primary reading and one reading card. The planner resolves the canonical
alternate Word rows and requires identical source evidence and exact stored
`acceptedReadingEvidence`; it never creates alternative targets/cards.
Word spelling and every example's Han characters must have an earlier kanji
inside the same finite set. Full current quality gates remain mandatory.

Use the explicit version only after independent parent review:

```sh
npm run db:publish:pilot -- --pilot v2 --validate-only
npm run db:publish:pilot -- --pilot v2 --plan
npm run db:publish:pilot -- --pilot v2 --publish
```

Omitting `--pilot` still selects v1 and omitting a mode still means read-only
plan. `--pilot v1` is accepted explicitly; missing, invalid or duplicate pilot
flags are rejected before Prisma construction. An optional `--enroll-user-id
UUID` remains limited to one explicitly requested user; neither pilot performs
automatic enrollment or current-course changes by default. The workflow adds
a `pilot` choice (`v1` default, `v2` explicit), guards both fixed enums and uses
`foundation-pilot-<v1|v2>-<mode>-<run-id>` artifacts.

Placement scans use the sealed expected item count plus one: 101 for v1 and
175 for v2, with exact expected-count checks (100/174), including reapplication.
Source-record scans likewise request their exact expected count plus one.
Quality loader page/scoped-ID limits remain 100: v2 uses sorted disjoint scopes
of 100 and 74 UUIDs, including terminal-page verification for a full 100-row
page. It scans all 174 rows, not only the first scope. Missing, repeated,
out-of-scope or unordered results reject publication. V1's query order and
canonical quality snapshot remain unchanged. The sections below describe the
original v1 operator evidence; those historical runs do not prove v2 publication.

The source course remains `japanese-ru-n2`, whether currently `DRAFT` or
`PUBLISHED`. This tool never publishes or updates that course, changes its
2,300-kanji/8,000-word publication gate, or changes global learning-item hints,
dependencies, cards, answers, schedules or private learner data.

## Fixed Inputs And Preconditions

The pilot accepts exactly the two registered Task118 version-1 kanji batches and
the first Task127 version-1 word batch. All three must record independent review
dates. The planner then requires:

- Each named project-authored source has the exact checksum-keyed `SUCCESS`
  import run, version, manifest filename and matching review date.
- Every persisted curation record matches its approved manifest payload. Word
  records must also match their actual JMdict target's dictionary-evidence IDs,
  version, checksum and license ID. JSONB object ordering is not significant.
- The known structured main course has exactly one placement for each of the
  100 registered pilot targets, with the original target identities, levels,
  slots and unlock policies. The query matches the three exact target-type/ID
  sets and reads at most 101 rows. Duplicate or moved pilot-target placements
  are rejected, including in later levels; unrelated main-course items are allowed.
- All direct prerequisites exactly match the registered manifest, are inside
  this finite set and occupy earlier levels. Components have no prerequisites;
  kanji require their registered components at stage 1; words require their
  spelling kanji at stage 2. There is no global fallback or dependency waiver.
- The existing full quality loader visits all 100 pilot items in both courses,
  using an internal exact item-ID scope and keyset pages of at most 100,
  including the terminal page after an exact 100-row page. Every current policy
  issue, blocker or warning on these items prevents publication. Missing,
  repeated, unordered or unexpected scoped quality rows also fail closed.
  The internal scope requires 1–100 distinct nonempty UUIDs, intersects with the
  course and cursor, and rejects invalid input before reading the database.
  Public full-course reports remain unfiltered by default; quality rules and
  source/prerequisite checks are not weakened for the finite pilot.
- Card slots and accepted answers match the approved manifests: a meaning card
  for each component and meaning/reading cards for each kanji and word. Their
  existing card IDs are retained, not recreated.

Independent source/wording/license review still belongs to the parent. Local
fixtures do not prove that a live database satisfies these requirements.

## Levels And Learner State

Placements are identical to the main-course batches: components occupy level 1,
kanji occupy their existing levels 2–4, and words occupy level 5 slots 1–20.
Pilot levels use the established pass-policy helper: components for level 1,
kanji for levels 2–4, and words for level 5, retaining stage 5 and 90% defaults.
Main-course policies are not changed.

The same `LearningItem` and `LearningCard` IDs mean existing SRS state, private
synonyms and mnemonics remain associated with those cards. No schedule reset,
progress migration, synthetic level completion or user-wide enrollment is run.

## Read-Only Plan And Atomic Publication

The implementation lives in `packages/db/src/foundation-pilot.ts` and
`packages/db/prisma/publish-foundation-pilot.ts`. The root `db:publish:pilot`
script delegates to the database workspace's `prisma:publish-foundation-pilot`
script. No schema or API change is required.

A pure, database-free manifest inspection is:

```sh
npm run db:publish:pilot -- --validate-only
```

Once all source manifests have been independently reviewed and applied, an
operator can supply `DATABASE_URL` and run the read-only database plan:

```sh
npm run db:publish:pilot -- --plan
```

After reviewing the plan, explicit publication is:

```sh
npm run db:publish:pilot -- --publish
```

The equivalent workspace command is:

```sh
npm run prisma:publish-foundation-pilot --workspace @kanji-srs/db -- --plan
```

No mode flag also means read-only planning. Only explicit `--publish` enables
writes. Supply at most one mode flag: repeats and all combinations (including
`--plan --validate-only`) fail before manifest/database setup. A missing,
malformed or repeated enrollment UUID also fails before Prisma construction.
The CLI applies the existing 15-second Neon connection/pool defaults
without overriding explicit operator settings. Importing it does not create a
Prisma client or start the CLI. These commands were not run against a database
as part of local implementation.

For the staged database, manually dispatch **Foundation pilot publication**
(`.github/workflows/publish-foundation-pilot.yml`) from the committed revision.
Choose `plan` (the default), review the report, then dispatch `publish` explicitly.
The workflow uses `STAGING_DATABASE_URL`, shares the `staging-database`
concurrency group without canceling an in-progress run, generates Prisma and
validates the manifest before planning/publishing. It uploads the result as
`foundation-pilot-<mode>-<run-id>` with 90-day retention when a report exists.
It does not run migrations, seed data or automatically enroll users. The parent
operator performs and verifies these live runs after commit.

Publication first plans without mutations. It then opens one bounded
`Serializable` transaction, repeats all preconditions and compares the finite
content checksum with the outside plan. It creates/reuses only the pilot course,
its five levels and its 100 placements, using the existing item IDs. The new
placements use a single bounded `createMany` with duplicate skipping, rather
than 100 sequential network upserts; existing placements are validated before
that call and never updated by it. The new course stays draft until full pilot
quality and repeated main-course quality for the same 100 pilot item IDs match
the original snapshot inside that transaction. Any mismatch or database
error rolls back the whole publication. There is no automatic serialization
retry; the operator can rerun a fresh plan after resolving a conflict.

Reapplication requires the same checksums and existing identities. Unexpected
pilot items, missing/moved slots, modified level metadata, changed hashes, an
unrecognized existing course or orphan publication metadata are rejected rather
than silently repaired or removed. There is no destructive reconciliation.

## Publication Metadata

`Course` has no JSON metadata field. A dedicated project-authored metadata
source/license and checksum-keyed publication `ImportRun` record the finite
content version, original source checksums/run IDs, counts and item placements.
The run's `statsJson` and a `PROJECT_AUTHORED` imported record hold identical
metadata linked to the pilot's actual course UUID.

Stable v1 manifest record UUID:

```text
c5d6546d-6f29-451e-bbc5-a0ba4b887048
```

The content version includes the manifest checksum, source identities/checksums,
existing item/target IDs, placements, prerequisites, hints and the complete
quality snapshot. Unordered answers, blocked answers, mnemonics, hints,
prerequisites, source readings, stage-index membership and quality placements are
sorted by canonical semantic values, not incidental row UUIDs or ORM order.
Duplicates are retained, as are primary-answer markers, hint versions,
placement slots, prerequisite stages and original item/card identities.
Incidental answer/mnemonic/hint row IDs and timestamps are excluded. Manifest
ordering, source provenance and example-evidence fingerprints remain significant;
real content or item/card identity changes still fail reapplication. Publication metadata
does not copy user IDs or private learning data. A new content/source version
needs a new pilot version, not replacement under this UUID or slug.

## Optional Explicit Enrollment

The manual publish run
[39784436544](https://github.com/wndffs/kanji-app/actions/runs/39784436544)
succeeded on 2026-10-22. The earlier attempt timed out while writing placements;
bounded `createMany` placement insertion fixed that without changing the content
version. The successful default publication enrolled no users. Subsequent actual
catalog enrollment and a component-to-kanji-to-word browser chain are recorded
with their synthetic-fixture limits in `REMOTE_SMOKE_2026_10_22.md`.

`--publish --enroll-user-id UUID` is opt-in for one existing user only. It adds a
missing enrollment with `ACTIVE` status but never reactivates or modifies an
existing enrollment, including `PAUSED`. Missing settings are created with the
database's NULL current-course default; assignment then uses an explicit
`currentCourseId: null` predicate. An existing current course and all other
preferences are preserved. The default does not discover,
enumerate, enroll or change any user.

A read-only plan may also name that UUID to check the user's existence without
enrollment. `--validate-only --enroll-user-id UUID` is rejected because database-free
validation cannot perform that check. The publication workflow exposes no
enrollment input; explicit CLI enrollment remains an operator-only action.

## Limits And Verification

The pilot shares global items/cards by design. Later edits to those shared
objects can affect both courses; this publisher detects relevant drift when
planning/reapplying, not continuously at API runtime. The main course may grow
with unrelated components, kanji or words, including later batches and slots.
Those items never enter the frozen pilot's placement set, quality snapshot or
content version. Query scoping itself is not hashed, so the unchanged original
100-item corpus retains its previous checksum. The pilot still requires exactly
100 items, 160 cards and five levels; extra pilot placements (including unrelated
items) remain invalid. Changing registered targets, shared content, original
identities or provenance still fails closed. This is not a general course
publishing mechanism or a quality waiver for the expanded main course; inspect
that course's full unfiltered quality report separately.

After live main-course expansion to 121 items/202 cards, read-only plan
[39798186965](https://github.com/wndffs/kanji-app/actions/runs/39798186965)
returned the same existing pilot UUID, manifest-record UUID and content version
`44cfcf60a4ce70a0af3452e46ac81dd7fae581b4301ac8410db3395729bd5870`,
still 100 items/160 cards. Its
[plan artifact](https://github.com/wndffs/kanji-app/actions/runs/39798186965/artifacts/12433569208)
records this actual post-expansion check; no publication/enrollment write was
requested by that run.

Focused tests use synthetic persistence fixtures, the real quality validator and
a stubbed quality-page loader. They exercise stable reapplication with reversed
ORM collections and recreated incidental IDs both between runs and between
preflight and the transaction, plus rejection of actual content/identity drift.
With canonical approved source fixtures, they preserve the fixture checksum across unrelated main-course
expansion before, during and after publication, while rejecting duplicate/moved
finite placements and extra pilot items. Quality-loader tests cover invalid
scopes, course/cursor intersections, terminal pages and unchanged global reporting.
The CLI parser is tested without constructing Prisma, including malformed and
conflicting flags; subprocess checks also confirm early CLI failure. Existing quality-loader tests remain the separate
coverage of its database projection/pagination. No PostgreSQL/network/browser
verification, live enrollment or publication was performed locally. No new
dependencies, educational content, copyrighted assets or source-license changes
are introduced.

Read-only live plan [39818928167](https://github.com/wndffs/kanji-app/actions/runs/39818928167)
at commit `2a4d785` confirmed the same original v1 UUID and content version
`44cfcf60a4ce70a0af3452e46ac81dd7fae581b4301ac8410db3395729bd5870`
after the main course grew to 174 items/295 cards. No publication/enrollment write
was requested. The old test harness's invented 2026-10-23 approval dates were
replaced with canonical 2026-10-22 dates for sealed validation; its synthetic
persistence hash necessarily changed. This does not change the real v1 manifest
or live content version. All 102 focused pilot tests passed after that fixture
repair. V2's separate live verification follows.

## Verified V2 Publication: 2026-10-22

Read-only [plan 39819668870](https://github.com/wndffs/kanji-app/actions/runs/39819668870)
passed before explicit [publication 39820406188](https://github.com/wndffs/kanji-app/actions/runs/39820406188),
job `119969876295`, at commit `1b4a209`. The
[publication report](https://github.com/wndffs/kanji-app/actions/runs/39820406188/artifacts/12443544161)
records course UUID `7236105a-d559-42bb-9abb-d1a1551323b4`, manifest-record UUID
`4c599bc8-e28c-4527-9d9b-a99a3a7c8779`, **174 items / 295 cards / five levels**,
and content version
`98a522c5d6f4894fae2f001569aa59f8315c221502eee0da479905c3990fff9b`.
The published source set has 60 original bilingual examples. The report's
`enrolledUserId` is null: publication did not enroll or select a course for users.

The live catalog then listed v2. Explicit enrollment on the disposable audit
profile preserved the current v1 course; a separate dashboard selection saved
v2 and exposed five new lessons under the existing daily cap. Read-only checks
before enrollment, after enrollment and after selection retained exactly 160
SRS rows and the same full-row state/private-override digests. Only the explicit
enrollment and current-course selection changed. These 160 states include the
previously disclosed 153 synthetic fixtures; this is preservation evidence, not
proof of naturally learning the whole pilot. No scheduling answer was submitted.

[Remote smoke 39821968993](https://github.com/wndffs/kanji-app/actions/runs/39821968993)
separately created a fresh profile, explicitly selected v2 and passed dashboard,
lesson, review, character and item response checks, including reminder defaults
and a disabled reminder claim. See `REMOTE_PERFORMANCE.md` for measured timings
and limits. V1 retains its original UUID/content version above. Neither pilot
adds new dictionary identities or completes the main-course publication gate.

```sh
npm exec -- vitest run packages/db/test/foundation-pilot.test.ts packages/db/test/foundation-pilot-publication.test.ts packages/db/test/content-quality-report.test.ts packages/db/test/content-quality.test.ts --no-cache --no-fsModuleCache --configLoader runner --maxWorkers=2
npm exec -- tsc -p packages/db/tsconfig.json --noEmit --incremental false
```
