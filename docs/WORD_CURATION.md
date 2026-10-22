# First Vocabulary Curation Batch

This is the bounded first Task127 batch, not completion of the vocabulary course
or a declaration that its wording has been human-approved. The manifest is
`packages/db/src/main-course-word-content.ts`; its dedicated curator is
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

## Exact Source Choices

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

## Read-Only Preflight

`planMainCourseWordBatch(db, batch)` is exported and accepts pending-review
manifests. It performs no mutations. Before application, it validates the entire
batch, including its last word, before license/source/run metadata is written:

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

All live application is blocked while `reviewedAt` is null, before database
reads, writes or CLI client construction. A database-free manifest check is:

```sh
npm run db:curate:words -- --validate-only
npm run db:curate:words -- --preflight-only
```

This command validates the manifest only, not live source evidence. The parent
must separately run the exported read-only preflight against the intended
database and review its source/wording results before recording approval.

After approval, `npm run db:curate:words` applies the batch with `DATABASE_URL`.
Both staging curation/import workflows run the read-only preflight before this
step. The two inspection flags are mutually exclusive; unknown/duplicate flags
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

```sh
node node_modules/vitest/vitest.mjs run packages/db/test/main-course-word-content.test.ts packages/db/test/main-course-word-curation.test.ts --no-cache --configLoader runner --maxWorkers=1
node node_modules/typescript/bin/tsc -p packages/db/tsconfig.json --noEmit --incremental false
```
