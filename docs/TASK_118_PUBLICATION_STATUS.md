# Task 118 publication status

## Status

- Task: 118
- Updated: 2026-10-22
- State: **IN PROGRESS**
- Main course publication approved: **no**

The 2,300-kanji and 8,000-vocabulary publication target has not been reached or
claimed. This record captures the successful staging corpus, the exact
publication gap, and the checks required before editorial publication can
continue.

## Verified staging evidence

### Current editorial corpus (2026-10-22)

[Selected curation run 39795992224](https://github.com/wndffs/kanji-app/actions/runs/39795992224)
successfully applied only `task-118-foundation-kanji-03@1` and
`task-127-foundation-words-02@1`; old published batches were not reapplied.
The bridge reuses the existing demo 一 target/cards at main-course level 2,
slot 21. The word batch adds twenty words, forty meaning/reading cards and twenty
original JP/kana/RU/EN examples at level 5, slots 21-40. Five dictionary-confirmed
alternate readings are accepted on their existing reading cards, not duplicated
as new SRS cards. No seed or new external dictionary import was run.

| Batch    | SHA-256                                                            | Successful import run                  |
| -------- | ------------------------------------------------------------------ | -------------------------------------- |
| Kanji 03 | `fe1998be5842a0ca2f233670318949c51d82c58d68068851c3859f8e3560af92` | `1ffe0ec6-b81a-4276-9725-9005a89a8d89` |
| Word 02  | `0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f` | `2bdc929a-4eaf-48be-a642-11f2eaa7c41d` |

The main course now contains **40 components, 41 kanji, 40 words, 121 placements,
202 cards and 40 original bilingual examples**. Read-only Neon counts confirmed
these totals, **DRAFT** status, 60 defined levels and only five populated levels.
The complete main-course quality report in the
[run artifact](https://github.com/wndffs/kanji-app/actions/runs/39795992224/artifacts/12433926958)
scanned all **121 items with 0 blockers and 0 warnings**, policy v2, content
version `0db1fe8f38b0e22ec6ac4caebc8b96136f1abc7ac82a0c167e358f602881b9fa`.

There are **2,259 kanji and 7,960 words** remaining against the full target. The
published pilot stays at **40 components / 40 kanji / 20 words / 160 cards**;
new main-course content is not automatically enrolled or added to its version.
The corpus report's `publishedCourse` totals count distinct items reachable
through any published course, including the separate starter demo, not DRAFT
main-course placements. Its 42 kanji/22 words must not be mistaken for the
main-course totals or added to the pilot as new content.

### First vocabulary batch (2026-10-22)

[Curation run 39772153454](https://github.com/wndffs/kanji-app/actions/runs/39772153454)
successfully reapplied both kanji batches and the first reviewed word batch,
`task-127-foundation-words-01@1`, from cached source identities. The word manifest
SHA-256 is `1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf`;
its import run is `dfa8086c-7a96-4f98-908f-c9ed67a6665d`.

After that run the main course had **40 components, 40 kanji, 20 words, 100 placements,
160 learning cards and 20 project-authored bilingual examples**. The
[quality artifact](https://github.com/wndffs/kanji-app/actions/runs/39772153454/artifacts/12423651717)
reports **100 scanned items, 0 blockers and 0 warnings** under
`course-content-quality-v2`. Content version:
`ee716c17b483164b91caf81304fabf2420a525ce56e6767b327f9855bcf6288f`.

The main course remained **DRAFT**, with **2,260 kanji and 7,980 words**
remaining at that snapshot. The separate finite Foundation
pilot is tracked in `FOUNDATION_PILOT.md`; it reuses these cards and must not be
added to the main-course totals as new content. AI-authored/editor-reviewed
content is not represented as human-reviewed.

### Second kanji batch (2026-10-22, before vocabulary)

[Curation run 39750138315](https://github.com/wndffs/kanji-app/actions/runs/39750138315)
successfully applied both versioned batches to Neon. Batch 02 adds 14 reusable
components and 20 kanji (`山川木水火土金石上下右左百千円力女男子田`).
All 20 source readings and traced stroke graphics were independently checked
before application. Its SHA-256 is
`99268635c984603c30a1a53c2beb0bcd63a53316b9cb3a83b4e51c54e1c18714`;
import run `d031e0e4-90b7-4927-a8ee-6b0f0fb0d94b`.

At that snapshot, the combined main-course result was **40 components, 40 kanji, 80 placements
and 120 learning cards**. The
[quality artifact](https://github.com/wndffs/kanji-app/actions/runs/39750138315/artifacts/12413576549)
reports **80 scanned items, 0 blockers, 0 warnings**. Content version:
`db58a36b2db43ace1603544c3e0204fcd06433d279e0892744ccf75d909d1828`.
Main-course vocabulary was **0** and the course remained **DRAFT**. The
remaining targets then were **2,260 kanji and 8,000 vocabulary pairs**.
AI-authored/editor-reviewed batches are not represented as human-reviewed.

### First editorial batch (2026-10-21)

[Curation run 39606493648](https://github.com/wndffs/kanji-app/actions/runs/39606493648)
successfully applied `task-118-foundation-kanji-01@1` to Neon. Its checksummed
batch contains **26 components, 20 kanji, 46 placements and 66 learning cards**
in main-course levels 1-4. Batch SHA-256:
`34676566c590fd19d10349e6bb07c75d01471fc618872fa103db2e676fd138b8`.

The same run's
[quality artifact](https://github.com/wndffs/kanji-app/actions/runs/39606493648/artifacts/12348487149)
reports 46 scanned items, **0 blockers and 0 warnings**, under
`course-content-quality-v1`. Content version:
`3bb0c4e57999a1bb7e6fefafcdfe0706e11a7f6a493e0c9acaa9de55a32530fc`.
This is a bounded-batch result, not a full-course readiness pass.

At that snapshot, main-course vocabulary was **0** and the course remained
**DRAFT**, with **2,280 kanji and 8,000 vocabulary pairs** remaining. The older
published starter demo remains separate and must not be added to main-course
placement counts without verified allocation. Do not report 30,000 raw words
as 30,000 teachable words.

The live read-only inventory before curation showed 13,394 total `Kanji` rows,
30,000 `Word` rows and approximately 148 MB of database storage. The total
kanji-table count includes non-KANJIDIC supplemental rows; it is not the same
as the 13,108 imported KANJIDIC2 entries in the historical source report below.

### Historical import snapshot (2026-07-28)

Evidence source:
[Import staging content run 30359957598](https://github.com/wndffs/kanji-app/actions/runs/30359957598)
from 2026-07-28. Artifact:
`content-snapshot-2026-07-28-30359957598`.

| Source              | Result  |               Imported rows | Import run                             | Content SHA-256                                                    |
| ------------------- | ------- | --------------------------: | -------------------------------------- | ------------------------------------------------------------------ |
| KANJIDIC2           | success |           13,108 characters | `639cb8f8-3f0e-4e86-8658-0fca7090d598` | `d3bfc4373f785c6308d38faaaa5a86bd3bcb6c77368f9188232832c29e2c433c` |
| KanjiVG `r20250816` | success |              6,702 graphics | `902ed0d4-ac8a-47a6-8b52-3d70f88edebf` | `97f316c265eee227cac44af1baf1227f16c707a367038c6b3d72afc864dd8010` |
| JMdict `2026-07-28` | success | 30,000 bilingual word pairs | `bda8da91-d1df-4c85-90ff-6c983fe0c107` | `f8a59e2a456c64339da4ef8cd24ab8216cb11712ba71b5ac22a4779def2a2462` |

The corpus report records 37,047 kanji readings, 24,823 imported English kanji
meanings, 136,850 English word senses, and 63,581 Russian word senses. All
30,000 retained word identities have both Russian and English source evidence.
The final database size was 148 MB after the run, leaving approximately 364 MB
under the Neon free project's 512 MB limit.

The failed partial import from
[run 30343095577](https://github.com/wndffs/kanji-app/actions/runs/30343095577)
was removed by resetting the staging `public` schema before this run. The
successful run restored the verified source snapshot from cache and used the
bounded `bilingual-course-candidates-v1` JMdict profile.

## Publication-readiness audit

The historical 2026-07-28 and 2026-07-29 staging admin audits reported:

- global published seed baseline: 2 kanji and 2 words;
- main-course placements: 0 kanji and 0 words;
- main-course levels containing content: 0 of 60;
- allocation preview: 7 published seed items proposed, 0 allocation conflicts;
- publication-readiness checks passed: 3 of 8;
- blocking checks: allocation incomplete, empty levels, missing initial lesson,
  missing 2,300 placed kanji, and missing 8,000 placed words;
- unassigned imported capacity: 13,106 kanji and 29,998 words;
- candidate-plan selection: 2,298 kanji and 7,998 words with no unfilled slots.

Raw candidate capacity is sufficient, but it is not publication. The first v1
word plan placed every selected word in N5 and surfaced later-course proper
names before basic prerequisite-safe vocabulary. Deployed policy v2 applied the
latest prerequisite-kanji band as a word floor and produced this staging
distribution:

- kanji: Foundation 5, N5 101, N4 230, N3 109, N2 1,853;
- words: Foundation 0, N5 7,752, N4 246, N3 0, N2 0.

The v2 floor fixed the unsafe band relationship but did not make the word
shortlist editorially safe. Its first page still contained mixed-script
alternatives such as `ニッポン人` and multiple readings of the same standalone
numeral. No v2 word candidate was staged.

The first kanji page was suitable for bounded review. On 2026-07-29 the exact
20-item page (`日`, `国`, `会`, `人`, `年`, `大`, `十`, `二`, `本`, `中`, `長`,
`出`, `三`, `時`, `行`, `社`, `見`, `月`, `分`, `後`) was staged with
`needs-review` status. The operation reported 20 newly queued and 0 already
queued items. It created no cards, meanings, mnemonics, dependencies,
placements, or published content. Scale readiness then reported 2 published
kanji, 20 kanji in curation, and 13,086 remaining unassigned kanji candidates.
The first inspected item had all expected blockers: missing RU meaning, cards,
RU/EN mnemonics, and prerequisite.

## Remediation in this change

- JMdict production writes use bounded batches of 100 source entries.
- Each batch is one restart-safe transaction.
- Imported records, word identities, provenance updates, and senses are written
  in bulk instead of one network round trip per row.
- Duplicate expression-reading identities inside a batch are merged
  deterministically while retaining distinct source senses.
- A cancelled run can restart against the same checksum and safely revisit
  completed batches.
- The KanjiVG full-source minimum is 6,000 graphics. The previous 10,000 minimum
  exceeded the verified 6,702-row official release and made a successful report
  impossible.
- The full multilingual JMdict file remains the checksummed source snapshot.
- Staging stores the deterministic `bilingual-course-candidates-v1` selection:
  exactly 30,000 unique RU+EN expression-reading pairs, frequency-ranked with
  stable source tie-breakers.
- JMdict imported-record JSON is compact provenance instead of a duplicate of
  the source entry.
- The 30,000-pair candidate gate does not weaken the Task 118 publication gate:
  8,000 words still require project review, placement, cards, prerequisites, and
  readiness approval.
- Candidate policy v3 keeps every word at or after its latest prerequisite
  kanji band and presents earlier-band editorial work first.
- Policy v3 proposes at most one expression-reading representative per JMdict
  entry. It prefers source frequency, conventional orthography, the primary
  KANJIDIC2 reading for a standalone kanji, and more frequent prerequisite
  kanji while retaining every alternative in the imported layer.
- The candidate-plan summary reports the number of collapsed word alternatives
  so the reduced editorial pool remains auditable.
- `task-118-foundation-kanji-01@1` records the first reproducible editorial
  package: 26 project-authored components and the exact 20 staged kanji,
  reordered into prerequisite-safe main-course levels 1-4.
- Every kanji in that package has reviewed RU/EN meanings, a source-supported
  taught reading, bilingual meaning/reading explanations, two cards, published
  component dependencies, a placement, and mandatory KanjiVG coverage.
- `npm run db:curate` applies the package idempotently in bounded transactions,
  records a checksummed project-authored import run, and preserves the raw
  imported evidence layer.
- Lower KANJIDIC2 reading priority values are now treated consistently as
  earlier readings across candidate planning, lessons, reviews, item pages,
  search-adjacent surfaces, and overrides.

## Required next work

1. First-batch application/checksum and structural quality verification are
   complete. Retain the report above as the baseline for subsequent batches.
2. Verify candidate policy v3's staging band distribution,
   collapsed-alternative count, and first word pages.
3. Inspect an early, middle, and late foundation item through lessons and
   reviews before accepting the batch.
4. Continue bounded RU/EN vocabulary curation only after the v3 word shortlist
   passes editorial inspection.
5. Apply allocation only for published, quality-complete items.
6. Repeat scale-readiness and publication-readiness audits after every bounded
   publication batch.

Task 118 remains open until all 60 levels are populated, the database contains
at least 2,300 placed published kanji and 8,000 placed published vocabulary
pairs, and publication readiness reports zero blockers.
