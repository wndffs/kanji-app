# Bounded Vocabulary Curation Batches

These are bounded Task127 batches, not completion of the vocabulary course
or a declaration that their wording has been human-approved. The registry is
`buildMainCourseWordBatches()` in `packages/db/src/main-course-word-content.ts`;
the second manifest is `packages/db/src/main-course-word-content-02.ts`. The dedicated curator is
`packages/db/prisma/curate-main-course-words.ts`.

## Review State And Counts

- Batch: `task-127-foundation-words-01`, version `1`.
- AI-authored on `2026-10-22`; independently reviewed and corrected by the parent
  agent on the same date. This is not a human-review claim.
- All twenty exact source identities and RU/EN availability were checked in
  Neon. Application still requires a complete read-only database preflight.
- Twenty word learning items at main-course Foundation level 5, slots 1–20.
- Forty review cards: one meaning and one exact-reading card per word.
- Eighty bilingual mnemonics and eighty bilingual hints: meaning and reading,
  each in Russian and English, for every word.
- Twenty original Japanese examples, each with kana, Russian and English text.
- No sentence learning items/cards, user SRS writes or imported-layer rewrites.

Reviewed manifest SHA-256:

```text
1ceeb2467961f707e57047ab0c46a91badaa048f036ac3299a5a7d0685f99daf
```

The hash covers the complete ordered JSON manifest, including approval metadata.
Recording a review date or changing a wording intentionally changes the hash.
The focused manifest test pins the current reviewed version; update that
expectation deliberately alongside independently reviewed manifest changes.
Existing kanji batch objects and their checksums are not changed by this work.

## First Batch Source Choices

These pairs and identities were provided as parent-verified Neon candidates.
Local tests use synthetic fixtures, not a new network verification of the corpus.

| Expression | Taught Reading | JMdict Identity | Primary RU   | Primary EN |
| ---------- | -------------- | --------------- | ------------ | ---------- |
| 山         | やま           | jmdict:1302680  | гора         | mountain   |
| 川         | かわ           | jmdict:1390020  | река         | river      |
| 水         | みず           | jmdict:1371260  | вода         | water      |
| 火         | ひ             | jmdict:1193610  | огонь        | fire       |
| 木         | き             | jmdict:1534520  | дерево       | tree       |
| 石         | いし           | jmdict:1382440  | камень       | stone      |
| 土         | つち           | jmdict:1445270  | почва        | soil       |
| 金         | かね           | jmdict:1242590  | деньги       | money      |
| 女         | おんな         | jmdict:1344930  | женщина      | woman      |
| 男         | おとこ         | jmdict:1419990  | мужчина      | man        |
| 子         | こ             | jmdict:1307770  | ребёнок      | child      |
| 田         | た             | jmdict:1442730  | рисовое поле | rice field |
| 上         | うえ           | jmdict:1352130  | верх         | top        |
| 下         | した           | jmdict:1184140  | низ          | bottom     |
| 右         | みぎ           | jmdict:1171010  | право        | right      |
| 左         | ひだり         | jmdict:1290800  | лево         | left       |
| 円         | えん           | jmdict:1175570  | иена         | yen        |
| 力         | ちから         | jmdict:1554820  | сила         | strength   |
| 人         | ひと           | jmdict:1580640  | человек      | person     |
| 月         | つき           | jmdict:1255430  | луна         | moon       |

Accepted meanings are deliberately narrow, project-authored teaching subsets,
not copies of all imported dictionary glosses. For example, this batch teaches
金/かね as money, 月/つき as the moon, and 円/えん as the currency. Kanji on-readings
are not accepted in place of these exact word readings. The 金 example uses the
natural polite form お金, while the reading card still accepts only かね.

## Approved Second Batch

`task-127-foundation-words-02@1` is authored on `2026-10-22` with
`reviewedAt: 2026-10-22`. The parent independently reviewed all twenty educational
entries, verified their live primary/alternate source pairs, corrected date and
reading explanations, and recorded approval. This is not human approval or live
application proof; full database preflight and quality validation remain mandatory.

Approved manifest SHA-256:

```text
0110505331b1066653f4b62ce20f4c8bbb98e94ccf701eafac26ecda9a0e6a4f
```

It adds twenty noun items at the same level 5, slots 21-40, forty cards, eighty
mnemonic texts, eighty hint texts and twenty original JP/kana/RU/EN examples.
Examples use Han characters and hiragana, with no other scripts. No extra
sentence learning items, grammar curriculum or SRS state are created.

| Expression | Primary Reading | JMdict Identity | Primary RU            | Primary EN     |
| ---------- | --------------- | --------------- | --------------------- | -------------- |
| 本         | ほん            | jmdict:1522150  | книга                 | book           |
| 日本       | にほん          | jmdict:1582710  | Япония                | Japan          |
| 一人       | ひとり          | jmdict:1576150  | один человек          | one person     |
| 二人       | ふたり          | jmdict:1582670  | два человека          | two people     |
| 大人       | おとな          | jmdict:1414170  | взрослый              | adult          |
| 男子       | だんし          | jmdict:1420070  | мальчик               | boy            |
| 女子       | じょし          | jmdict:1345140  | девочка               | girl           |
| 火山       | かざん          | jmdict:1193910  | вулкан                | volcano        |
| 水田       | すいでん        | jmdict:1371890  | заливное рисовое поле | rice paddy     |
| 上下       | じょうげ        | jmdict:1352710  | верх и низ            | top and bottom |
| 左右       | さゆう          | jmdict:1290810  | лево и право          | left and right |
| 一月       | いちがつ        | jmdict:1162120  | январь                | January        |
| 二月       | にがつ          | jmdict:1461560  | февраль               | February       |
| 三月       | さんがつ        | jmdict:1300250  | март                  | March          |
| 一日       | いちにち        | jmdict:1576260  | один день             | one day        |
| 二日       | ふつか          | jmdict:1462900  | два дня               | two days       |
| 三日       | みっか          | jmdict:1301330  | три дня               | three days     |
| 十日       | とおか          | jmdict:1335000  | десять дней           | ten days       |
| 国         | くに            | jmdict:1592250  | страна                | country        |
| 中         | なか            | jmdict:1423310  | внутри                | inside         |

The month names are January/February/March, not durations of one/two/three
months. 一日/いちにち means a whole day's duration, not the different reading
ついたち for the first date. 二日/ふつか, 三日/みっか and 十日/とおか each accept
both duration and date meanings: respectively `второе число` / `second day of
the month`, `третье число` / `third day of the month`, and `десятое число` /
`tenth day of the month`, alongside their two/three/ten-day durations. Their
hints explicitly explain both senses rather than marking a date wrong.

Optional `acceptedReadings` contains additional source-verified readings, not
the primary again. Only the second batch declares them: 日本/にっぽん,
一人/いちにん, 二人/ににん, 水田/みずた and 左右/そう. The primary reading remains
the taught example reading and the only primary reading answer. Verified extras
are accepted on that same reading card, never duplicate cards or word items.
Kana syntax and normalized duplicates across primary/extras are rejected.
Every extra requires its own canonical `Word` exact expression/reading, the same
JMdict entry and identical successful imported record/run/version/checksum/license
evidence, with both imported RU/EN senses. All are rechecked during application.
Additional evidence is traced on the second batch's authored records; no raw
source import or imported-layer mutation is performed.

`buildMainCourseWordBatch()` intentionally remains the frozen first-batch
builder used by the finite pilot. Neither its batch object nor its words acquire
optional offset/reading properties. Its checksum above remains unchanged.
`sortOrderStart` defaults to 1 and is omitted on batch 01; batch 02 declares 21.
The registry validator rejects duplicate batch IDs, expression/reading identities
and course/level/slot triples, including conflicts in unselected batches.

The missing 一 prerequisite is now registered separately in approved
`task-118-foundation-kanji-03@1`, reusing the demo target/cards and prior stroke
component, with main-course level 2 slot 21. It must be applied
before the word preflight can resolve 一人, 一月 and 一日 to that published
earlier placement. Merely having a raw source or starter-course item is not a
fallback. See `MAIN_COURSE_CURATION.md` for the selected kanji-then-word operator
path. No live database preflight was run locally.

The parent separately owns the quality projection for sibling readings. The
quality loader must include only canonical alternatives backed by the same
successful source evidence; its gate must not be weakened or fed unverified
manifest readings as though they were source evidence. The local word-curator
checks do not verify that separate projection. A full publication quality report
over all items and alternatives is still required before applying this batch.

## Read-Only Preflight

`planMainCourseWordBatch(db, batch)` is exported and accepts pending-review
manifests. It performs no mutations. Before application, it validates the entire
batch, including its last word, before license/source/run metadata is written:

`planMainCourseWordBatches(db, batches)` first validates the complete registry,
then plans every batch read-only. The CLI and `applyMainCourseWordBatches` finish
this whole-registry preflight before any mutation, even when `--batch` selects
only one batch. A late invalid source, reading variant or slot blocks all writes.

- Look up each `Word` only by the exact expression/reading composite key.
- Require the exact `jmdictEntryId`, imported-record ID/type and source-record ID.
- Require a successful JMdict import, a nonempty known version and a valid
  SHA-256 checksum, matching source/license IDs, the multilingual JMdict license
  reference, attribution and HTTPS source/license URLs.
- Full legacy JMdict JSON must contain the exact expression/allowed reading,
  respecting reading restrictions, plus RU/EN raw glosses and imported senses.
- The bounded importer's current JSON is deliberately compact: exactly
  `sequence`, positive integer `importedWordCount`, and RU/EN `retainedLocales`.
  Require that precise shape and sequence together with the canonical Word's
  exact pair, linked successful source record and both imported WordSense
  locales. It does not pretend that the compact row contains reading
  restrictions or duplicate gloss text. Mixed/malformed shapes fail closed;
  the checksummed source snapshot remains the underlying import evidence.
- Resolve every Han character in both the word and example through the existing
  kanji batch registry. Require a published KANJI learning item at that registered
  earlier placement in this exact main course. A global candidate, another
  course's item or an inferred dependency is not a fallback.
- Check word slots are free or already belong to the same word item. Existing
  main-course placements are not moved; other course placements are untouched.
- Reject imported sense collisions and non-project teaching-text collisions,
  conflicting curation source/license metadata and foreign example provenance.

Only the word expression's kanji become its stage-2 prerequisites. Additional
kanji in examples must also already be published earlier, but examples do not
create separate sentence-learning prerequisites or cards.

## Application And Restart

Direct or explicitly selected application of a batch is blocked while its
`reviewedAt` is null, before database reads, writes or CLI client construction.
Default registry application preflights all batches, then applies reviewed
batches only and reports the pending IDs it skipped. It does not approve pending
content, and pending content with invalid source/prerequisites still blocks the
whole preflight.

Both current word manifests are approved. Pending-review regressions explicitly
clone a fixture with `reviewedAt: null`; the approved manifests are never mutated
to manufacture a pending state.

Database-free and read-only inspection commands are:

```sh
npm run db:curate:words -- --validate-only
npm run db:curate:words -- --preflight-only
npm run db:curate:words -- --batch task-127-foundation-words-02 --validate-only
```

`--validate-only` validates the registry manifests only, not live source evidence.
`--preflight-only` checks every registered batch against the database, including
pending manifests; selection never narrows that safety check. The parent
must separately run the exported read-only preflight against the intended
database and review its source/wording results before recording approval.

After approval, `npm run db:curate:words` applies all reviewed batches with `DATABASE_URL`.
To avoid rewriting earlier published answers while adding batch 02, use
`npm run db:curate:words -- --batch task-127-foundation-words-02`. Only that
registered, reviewed batch is applied after the complete registry preflight.
Single-batch exported helpers retain their existing behavior for focused callers.
The operator workflow `.github/workflows/deploy-staging-curation.yml` also has
optional input `word_batch`: leave it blank to retain the existing full curation
path, or set `task-127-foundation-words-02` to pass that selection to the word CLI
and skip old kanji reapplication. The selection narrows word mutations, not the
CLI's complete registered-word preflight. The older staging import workflow keeps
its default all-reviewed-batches behavior. No workflow changes are part of this
slice, and neither operator path bypasses approval or source checks.
Both staging curation/import workflows run the read-only preflight before this
step. The two inspection flags are mutually exclusive; unknown/duplicate flags
and unknown/repeated/missing `--batch` selections
are rejected before database construction so a mistyped preflight cannot write.
The CLI applies `withNeonConnectionDefaults`, preserving explicit settings while
defaulting Neon's connection and pool timeouts to 15 seconds. Importing the
module for tests does not start it or instantiate a database client.

Application uses these bounded transactions:

1. Create/reuse the project-authored license/source and checksum-keyed import run
   with `PENDING` status. This source is separate from JMdict and kanji curation.
2. Commit each word separately. Recheck its source identity and prerequisite
   availability; upsert stable learning-item/card keys, authored senses, answers,
   version-1 bilingual mnemonics/hints, stage-2 dependencies and its fixed slot.
   Source-verified extra readings share its existing reading card; only the
   original reading is primary.
   Store its complete manifest entry and dictionary evidence in a
   `PROJECT_AUTHORED` imported record. Upsert the sentence by this source and a
   stable batch/entry/expression/reading key, then use Task126 `writeWordExample`
   to stage its link as `DRAFT`. Newly created word items remain `DRAFT`.
3. In one final transaction, change the run to `SUCCESS`, then validate and
   publish all twenty links through the real Task126 helper. Its validation can
   see the uncommitted success inside this transaction. Publish the twenty word
   learning items only after all links validate. Any failure rolls back the
   success marker and every publication in that transaction.
4. On a caught application failure, mark the run `FAILED`. A process termination
   may leave it `PENDING`; neither state makes its examples eligible. Earlier
   per-word commits remain available for idempotent restart, not false completion.

Reruns reuse the same learning-item/card, sentence/example and checksum-run
identities. A rerun temporarily returns this run to `PENDING`; its examples can
be unavailable until successful finalization. No imported `Word` or imported
sense is changed. `WordSense` uniqueness omits `sourceKind`, so authored senses
use the explicit `noun (course-authored)` POS namespace; collisions are rejected
rather than relabeling an imported row. Learner overrides, private mnemonics and
SRS state are never written. Serialize operator invocations of this curator;
parallel-run coordination is not implemented by this bounded batch.

## Licensing And Remaining Verification

The teaching copy and sentences are independently project-authored. Their
source, license, manifest file/version/checksum, imported record and import run
remain traceable. Imported JMdict evidence and its attribution/license metadata
are preserved separately. The multilingual JMdict metadata notes that Russian
gloss rights need source-specific review; a passing structural preflight is not
blanket legal approval for redistribution.

Focused local checks use synthetic database fixtures and the real Task126 write
helper. They cover exact identities, late preflight failures, mandatory kanji
placement/publication, collisions, existing IDs/private progress, interruption,
reapplication, and rollback of final publication. They do not replace a real
PostgreSQL execution or the parent's independent review of all twenty entries.
Registry orchestration tests use the exact registered pairs with synthetic
persistence/source fixtures, not live editorial/source approval. They cover complete
preflight before writes, pending selection, selected-only application preserving
earlier answer IDs, and reapplication. Alternative-reading tests cover unknown
canonical pairs, wrong entries, missing imported locale and mismatched source
records before mutations, plus multiple accepted answers on the same two cards.

```sh
node node_modules/vitest/vitest.mjs run packages/db/test/main-course-word-content.test.ts packages/db/test/main-course-word-curation.test.ts --no-cache --configLoader runner --maxWorkers=1
node node_modules/typescript/bin/tsc -p packages/db/tsconfig.json --noEmit --incremental false
```
