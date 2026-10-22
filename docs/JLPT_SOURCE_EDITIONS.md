# JLPT Source Editions

Task129 separates historical KANJIDIC2 evidence from independently curated modern
JLPT metadata. It does not assign new modern levels or alter course order.

## Storage Contract

| Location                                | Meaning                                                    | Allowed importer values                                                             |
| --------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `Kanji.jlptLevel`                       | Modern N1-N5, independently sourced/curated                | The KANJIDIC2 importer never updates this field; new imported kanji start with NULL |
| `Kanji.legacyJlptLevel`                 | KANJIDIC2's pre-2010 four-level classification             | Integer 1..4 or NULL                                                                |
| `ImportedRecord.rawJson.misc.jlptLevel` | Original parsed KANJIDIC2 `jlpt` evidence                  | Unchanged source value, even if outside 1..4                                        |
| `KanjiDic2CharacterDto.jlptLevel`       | Historical parser property name retained for compatibility | Validated legacy 1..4 or NULL, never a modern N label                               |

The [KANJIDIC2 DTD](https://www.edrdg.org/kanjidic/kanjidic2_dtdh.html)
describes the source edition. Old level 4 is not a modern `N4` label, old level 3
is not a modern `N3` label, and old level 2 must not be silently converted to
either N2 or N3. Missing modern metadata remains unknown. The project's
`CourseBand` is an independent pedagogical order, not a conversion table.

An out-of-range source integer such as 5 remains in raw evidence but becomes NULL
in the compatibility DTO and legacy column. Non-integer source text continues to
fail parser validation rather than being rounded. The raw property is not renamed
or rewritten to manufacture a different source edition.

## Supported Writers

The supported kanji writers are the KANJIDIC2 importer and the independently
authored seed. The importer now writes only `legacyJlptLevel` from source JLPT
data, including when retrying or importing a different source checksum. Its
update payload deliberately omits `jlptLevel`; a curated modern 5 or any other
existing modern value therefore survives reimport. The authored seed's modern
metadata is unchanged by this slice. Other clients must not copy a raw historical
integer into the modern column.

Existing successful same-checksum imports are still skipped; the migration
repairs historical storage without forcing a reimport or changing import-run
status, source records, versions or checksums.

## Migration And Evidence Limits

Migration `20261022160000_separate_legacy_kanji_jlpt` adds the nullable legacy
column, an index and a 1..4 check constraint. DDL and data repair run in one
PostgreSQL block. Reapplication to unchanged data is a no-op.
Rows actually backfilled also receive `updatedAt = CURRENT_TIMESTAMP`, invalidating
curriculum candidate snapshots keyed by the aggregate update time. Rejected and
already-backfilled rows retain their timestamps on rerun.

The migration supports an earlier additive deployment step that creates only the
nullable column and its index. It adds the legacy check constraint separately
when missing, then performs the full source-checked backfill. Pre-adding the
column/index alone does not repair any values or mark this migration applied.

Backfill requires all of:

- `Kanji.legacyJlptLevel` is NULL. Already-backfilled rows are never rewritten.
- The kanji's linked `ImportedRecord` has type `KANJIDIC2_CHARACTER`.
- Its linked import run is `SUCCESS` and its data source is exactly `KANJIDIC2`,
  matching the supported importer's registered source name.
- The raw literal equals the kanji character; the character is a single codepoint.
- The record's source ID equals `Kanji.kanjidicSourceId` and the canonical
  `kanjidic2:<lowercase UCS hex>` identity for that character.
- `rawJson.misc.jlptLevel` is a JSON number equal to an integer in 1..4. Strings,
  fractions, missing values, objects and old level 5 are not accepted.

Only these proven rows receive a legacy value. Their existing modern
`jlptLevel` is cleared **only when equal to the proven historical value**.
Modern 5, differing manual modern values, unlinked metadata and records with
failed/pending runs, wrong source, mismatched literal or mismatched IDs are left
alone. No old-to-modern mapping is performed. Original source rows remain intact.

Reapplication does not revisit already-backfilled rows. A later manual modern
edit, even one numerically equal to the raw historical value, therefore survives
all subsequent executions of this migration.

On the first backfill there is an unavoidable ambiguity: no separate audit
history records every out-of-band manual edit to `jlptLevel`. A manual modern value equal to the linked
old value is indistinguishable from the historical importer's write and will be
cleared by this first-backfill rule. Without matching source evidence no
inference is made;
unlinked or unverifiable values are preserved, not certified as modern. Operators
who know of same-value manual edits must retain their external evidence and
restore/recurate the modern value after migration. This repair does not claim to
infer those edits or establish the provenance of every surviving modern value.

## Scope And Verification

Items/search, lessons, reviews, decks, dashboard, administrative item views and
confusable comparisons use a shared label formatter: modern metadata takes
precedence; otherwise valid historical evidence reads `до 2010: 4`, never `N4`.
The character hub returns its optional `legacyJlptLevel` separately and keeps
modern JLPT filter values restricted to `jlptLevel`. Candidate ranking/planning
no longer maps legacy integers to modern levels; policy version is
`independent-frequency-prerequisites-v4-modern-jlpt`, invalidating earlier plans.
The authored seed and the project's independent course bands are unchanged.

On 2026-10-22 the nullable column, constraint and index were added successfully
through Neon SQL Editor before deploying consumers. This additive step did not
backfill values or record the Prisma migration as applied. Run the complete
source-checked migration after PostgreSQL CI succeeds, before any changed
importer run. Regenerate Prisma Client after changing the schema.

Fixture tests cover all valid old levels, missing/invalid values, raw preservation,
idempotent imports and an actual changed-checksum reimport preserving modern N5.
Two focused tests in `apps/api/test/reviews-postgres.integration.test.ts` execute
the exact migration SQL using the established PostgreSQL 18 harness. They cover
source guards, modern N5/differing-value preservation, unlinked rows, unchanged
raw records, idempotent reruns and later same-value manual edits. The harness
also covers the pre-added column/index path and timestamp changes limited to
actual backfills, with unchanged timestamps on rejected rows and reruns. The harness
requires `INTEGRATION_DATABASE_URL` targeting loopback host, database
`kanji_integration`, public/default schema, with no connection-routing parameters.
These tests shadow the four referenced tables with transaction-local temporary
UUID fixtures; they do not reset or update permanent rows. Temporary tables drop
on commit/connection close and the existing harness disconnects its clients.

```sh
node node_modules/vitest/vitest.mjs run packages/content-importers/test/kanjidic2.test.ts packages/db/test/legacy-kanji-jlpt-migration.test.ts --no-cache --configLoader runner --maxWorkers=1
node node_modules/typescript/bin/tsc -p packages/content-importers/tsconfig.json --noEmit --incremental false
node node_modules/typescript/bin/tsc -p packages/db/tsconfig.json --noEmit --incremental false
node node_modules/vitest/vitest.mjs run apps/api/test/reviews-postgres.integration.test.ts --maxWorkers=1 -t "JLPT"
```

With the explicit integration URL absent, the PostgreSQL tests are skipped. Local
verification does not prove a live migration succeeded. No new data source,
license, dependency or external dataset is introduced; KANJIDIC2 attribution and
raw import separation are preserved.
