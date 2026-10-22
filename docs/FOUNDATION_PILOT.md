# Finite Foundation Pilot

Task128 defaults to `japanese-foundation-pilot-v1`: a separate, versioned
five-level pilot containing **40 components, 40 kanji and 20 words**, reusing
**100 existing learning items and 160 existing cards**. It is not the completed
60-level course and is not full Task128 or production-readiness approval.

An explicitly selected, separately sealed `japanese-foundation-pilot-v2` is now
available for independent parent planning/publication. It contains **53 components,
61 kanji and 60 words**, reusing **174 existing items and 295 existing cards** in
five levels. This local change is not evidence that v2 has been live-planned or
published. It never upgrades/enrolls v1 learners or changes their current course.

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

The common publisher accepts only canonical equality with one of the two known
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
They also preserve the pre-scope fixture checksum across unrelated main-course
expansion before, during and after publication, while rejecting duplicate/moved
finite placements and extra pilot items. Quality-loader tests cover invalid
scopes, course/cursor intersections, terminal pages and unchanged global reporting.
The CLI parser is tested without constructing Prisma, including malformed and
conflicting flags; subprocess checks also confirm early CLI failure. Existing quality-loader tests remain the separate
coverage of its database projection/pagination. No PostgreSQL/network/browser
verification, live enrollment or publication was performed locally. No new
dependencies, educational content, copyrighted assets or source-license changes
are introduced.

```sh
npm exec -- vitest run packages/db/test/foundation-pilot.test.ts packages/db/test/foundation-pilot-publication.test.ts packages/db/test/content-quality-report.test.ts packages/db/test/content-quality.test.ts --no-cache --no-fsModuleCache --configLoader runner --maxWorkers=2
npm exec -- tsc -p packages/db/tsconfig.json --noEmit --incremental false
```
