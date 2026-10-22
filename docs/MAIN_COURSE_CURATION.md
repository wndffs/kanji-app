# Main-course curation

## Purpose

Task 118 content is stored as versioned editorial batches in
`packages/db/src/main-course-content.ts`. These batches are independent
project-authored learning content. They do not copy another product's
mnemonics, level order, labels, or data.

Imported KANJIDIC2 and KanjiVG rows remain the source-evidence layer. A
curation batch adds only the reviewed learning layer:

- Russian and English learning meanings and accepted answers;
- a source-supported taught reading and normalized answer;
- project-authored Russian and English meaning/reading explanations;
- project-authored component relationships;
- meaning and reading cards;
- prerequisite dependencies;
- main-course placement.

## Foundation batch

`task-118-foundation-kanji-01@1` contains:

- 26 reusable project-authored components;
- 20 kanji: `日`, `人`, `大`, `十`, `二`, `三`, `月`, `本`, `中`, `出`,
  `分`, `見`, `国`, `会`, `年`, `長`, `行`, `社`, `時`, and `後`;
- component placement at main-course level 1;
- prerequisite-safe kanji placement across levels 2-4.

All 20 kanji require an imported KANJIDIC2 target, exact source reading
evidence, and KanjiVG stroke data. The command fails instead of publishing an
item when any of those checks is missing.

`task-118-foundation-kanji-02@1` adds 14 components at level 1 slots 27-40 and
20 more kanji across levels 2-4. It reuses only explicitly registered earlier
components at their verified published main-course placements. The original
batch checksum and all existing card/placement identities remain unchanged.
Every batch must have independent parent-agent review before application;
pending authorship is valid for inspection, not permission to publish.

## Approved Single-Kanji Bridge

`task-118-foundation-kanji-03@1` adds exactly one kanji, 一, with
`authoredAt: 2026-10-22` and `reviewedAt: 2026-10-22`. Its original bilingual copy
teaches RU `один` / `единица`, EN `one`, and source reading イチ with the single
accepted hiragana answer いち. It requires KanjiVG evidence and reuses the
published earlier `component-one-stroke` at level 1 slot 1. Its `components`
array is empty: there is no duplicate or invented component.

The explicit main-course placement is level 2 slot 21. The first two manifests
use level 2 slots 1-15; their objects, order and hashes are unchanged. Database
preflight still rejects any unexpected live collision rather than moving items.
After this bridge, the registry has 41 kanji and the same 40 components. This
does not change the finite pilot's separately pinned first-two-batch manifest or
the full course publication gate.

The existing demo 一 target, global learning item and meaning/reading cards are
reused through their stable unique keys. Existing demo placements, card IDs,
private overrides/mnemonics and SRS rows remain attached and are not reset.
Course-owned teaching content is reconciled, not copied into a second target.
The curator does not write raw `Kanji` fields, source KANJIDIC2 imported
records/readings or KanjiVG rows. Its own project-authored curation records remain
separate from that imported layer.
In particular it does not rewrite the historical seed field
`kanjidicSourceId = starter:kanji:kanji-one` to a fabricated import ID, nor change
independently authored modern N5 metadata. Source evidence comes from the linked
imported record, whose source identity is `kanjidic2:4e00`.

The parent independently reviewed the educational copy and verified live
source/readings/graphics on 2026-10-22, then recorded approval in the manifest.
This is not a human-review claim or live curation/publication proof. Complete
database preflight and full quality validation remain mandatory before application.

Approved bridge manifest SHA-256:

```text
fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92
```

Database preflight checks the entire batch before its first write: source
readings, KanjiVG evidence, earlier components and free/stable placement slots.
The current lesson target summary uses the first stored priority reading;
the taught reading must match it and have exact raw KANJIDIC2 evidence of the
declared type. `sourceType` defaults to `ja_on` for unchanged earlier manifests;
explicit `ja_kun` is also supported, never inferred from an arbitrary answer.
For 木 the taught reading is ボク/ぼく, while vocabulary
will independently teach き. A future curated-reading selection must change
all display/quality contracts together, not silently alter imported priorities.

## Approved Fourth Kanji Batch

`task-118-foundation-kanji-04@1` is AI-authored and was independently reviewed by
the parent on 2026-10-22 (`reviewedAt: 2026-10-22`). Approval is not a human-review
claim or live rollout proof. It adds 20
kanji: `四五六七八九口目耳手足雨空天気先生学小文`, with 13 original reusable
components at level 1 slots 41-53: 五, 七, 九, 亠, 耳, 手, 足, 雨, 穴, 气, 小, 生, 文.
It reuses registered earlier components where the shapes actually occur.
Component cues for 気, 先 and 学 are explicitly partial visual aids, not complete
decompositions or historical etymologies.

Candidate placements are level 2 slots 22-27, level 3 slots 13-18 and level 4
slots 14-21. The full registry therefore describes 53 components and 61 kanji;
these are manifest counts, not live publication counts. All first-three approved
manifests and the separate frozen word and pilot manifests remain unchanged.

Source readings (exact KANJIDIC2 string -> sole accepted answer):

```text
四 シ -> し       五 ゴ -> ご       六 ロク -> ろく
七 シチ -> しち   八 ハチ -> はち   九 キュウ -> きゅう
口 くち -> くち   目 モク -> もく   耳 ジ -> じ
手 シュ -> しゅ   足 ソク -> そく   雨 ウ -> う
空 クウ -> くう   天 テン -> てん   気 キ -> き
先 セン -> せん   生 セイ -> せい   学 ガク -> がく
小 ショウ -> しょう               文 ブン -> ぶん
```

Read-only Neon queries verified successful licensed KANJIDIC2/KanjiVG evidence
and exact source readings for all 20, without downloading dictionaries again.
Nineteen teach source on-readings. For 口 the existing published demo card already
teaches `くち`, which is exactly supported by `ja_kun` source evidence and the
first stored KUNYOMI reading. Keeping it avoids silently changing a learned card
to `こう`; source priorities, old card identities and SRS states are not rewritten.
Other source readings are not silently added as accepted answers to these cards.
The parent reviewed the component shapes, meanings and independent teaching copy.
No modern JLPT values are inferred from legacy source metadata. Educational
copy is original project content; imported KANJIDIC2/KanjiVG evidence and its
existing license/attribution tracking remain separate.

Approved manifest SHA-256:
`5547b31673a20cffdfc817b0a95bd8b3e202108529c844f5090e0234fefa7850`.

## Apply

Apply migrations and the main-course shell before curation. The open-data
imports must already exist.

```bash
npm run db:curate -- --validate-only
npm run db:curate -- --batch task-118-foundation-kanji-03 --validate-only
npm run db:curate -- --batch task-118-foundation-kanji-03 --preflight-only
npm run db:migrate:deploy
npm run db:seed
npm run db:curate
```

The curation command:

- supports a database-free `--validate-only` manifest and validates every batch
  before writing;
- supports strict `--batch <registered-id>` selection, validating the full
  registry but preflighting/applying only that batch and its registered earlier
  component closure; earlier published batches are not reapplied;
- supports read-only `--preflight-only` for pending content; application still
  requires independent review for every selected batch before client construction;
- rejects unknown/repeated batch IDs, missing values, unknown/duplicate flags and
  conflicting inspection modes before database construction;
- records a SHA-256-addressed project-authored import run;
- writes one component or kanji in each bounded transaction;
- reconciles only project-authored meanings, answers, mnemonics, components,
  dependencies, and placements owned by the batch;
- preserves imported meanings, readings, provenance, and stroke graphics;
- is idempotent and can resume safely after a partial failure.

No selection means all registered batches, preserving the existing default.
All four current manifests are approved. All selected batches must still be reviewed
before any application starts; a future pending batch prevents default-all
application until approval. Negative tests cover explicit pending fixture clones,
never modifications to the approved manifests. The CLI uses
`withNeonConnectionDefaults` and disconnects in `finally`.

Use the manual `Deploy staging curation` GitHub Action for Neon. The full
`Import staging content` workflow also applies all versioned batches after
KANJIDIC2, KanjiVG, and JMdict so a rebuilt database does not lose curated
course content.

For the bounded bridge plus word batch 02, the parent-owned manual workflow
accepts both optional selections:

```text
kanji_batch = task-118-foundation-kanji-03
word_batch = task-127-foundation-words-02
```

After both manifests have final approval, this path pure-validates first,
applies selected kanji 03, then preflights/applies selected word batch 02. That
order publishes 一 at its registered earlier placement before 一人/一月/一日
are checked. It avoids reapplying either old kanji batch or old published word
answers. Blank selections retain the workflow's default-all behavior. Successful
live rollout evidence is recorded in `TASK_118_PUBLICATION_STATUS.md`.

For a new kanji-only addition without reapplying any vocabulary, explicitly use:

```text
kanji_batch = task-118-foundation-kanji-04
word_batch = <empty>
skip_words = true
```

`scripts/staging-curation-selection.mjs` rejects `skip_words` without an explicit
kanji batch, conflicting word selection, malformed IDs or nonboolean input before
database writes. Its fixed boolean outputs gate validation/preflight/application
steps. Unknown but syntactically valid batch IDs are still rejected by each
registered-manifest CLI before migrations. The full main-course quality report
always runs, even when vocabulary writes are skipped. This mode never runs seed.

## Verification

After applying a batch:

1. Download the workflow corpus-report artifact.
2. Confirm the curation import run is `SUCCESS` and its checksum matches the
   command output.
3. Confirm each batch's kanji are published and placed in levels 2-4.
4. Confirm all component prerequisites are published at level 1.
5. Inspect one early, middle, and late item in lessons and reviews.
6. Run the main-course allocation and publication-readiness reports.

The main course remains `DRAFT` until all 60 levels, 2,300 kanji, and 8,000
vocabulary expression-reading pairs pass the complete Task 118 gate.

Focused local checks cover the empty-component bridge, inherited stroke closure,
occupied slot/source/graphics failures, strict CLI parsing, preserved first-two
hashes, reuse of demo card IDs and modern/source metadata, private progress and
idempotent selected application. No live database curation is performed locally.
