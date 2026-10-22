# Direct Word Examples

## Identity and Scheduling

`WordExample` links the exact `Word.id` (the unique expression/reading pair) to
`Sentence.id`. Each link has its own UUID, unique `(wordId, sentenceId)`, stable
`sortOrder`, timestamps, and `ContentStatus` (default `DRAFT`). Only `PUBLISHED`
links are displayed. Different readings of the same spelling remain separate
word identities; no expression-only matching is performed.

`writeWordExample` upserts this pair without replacing its UUID. It writes only
the link; showing or linking an example never creates or updates `LearningItem`,
`LearningCard`, `Dependency`, `ReviewAnswer`, or `UserSrsState`. Existing sentence
learning items, if any, retain their independent scheduling behavior.

## Eligibility and Attribution

Every displayed or newly published example must have non-whitespace Japanese,
Russian, and English text. Its `Sentence.licenseId` must match the DataSource's
license, which must have a nonempty explicit name and a non-private scope.
The DataSource must have a name, nonempty attribution, and an HTTPS homepage or
download URL. URLs must use an ASCII hostname, no embedded credentials, and the
default HTTPS port (or explicit `:443`). Attribution uses the first eligible URL.

- Authored sentences without an import require an explicit `PROJECT_AUTHORED`
  license record and a matching DataSource. The existing attribution DTO labels
  their source name with `авторский пример проекта`.
- Imported sentences require an existing `ImportedRecord`, nonempty source ID,
  `TATOEBA_SENTENCE` with an `OPEN_DATA` license (or `PROJECT_AUTHORED` with the
  corresponding authored license), and a matching DataSource on the import run.
  The run must be `SUCCESS`, with a nonempty version and a 64-hex SHA-256 checksum.
  A stored `Sentence.sourceId`, if present, must match the imported record ID.
- Provenance remains on Sentence / ImportedRecord / ImportRun / DataSource /
  License. The link does not duplicate it. `SentenceDto` is unchanged; the API
  returns the sentence's RU/EN text and full existing attribution fields.

These are traceability and metadata checks, not an automatic legal review or a
claim that dictionary licensing permits unrelated example text. Curators remain
responsible for the actual sentence and translation rights and exact word usage.

## Bounded Reads and Quality

Item details return at most five examples; lessons at most three per item.
The shared loader processes at most 100 item identities per SQL query, using
lateral per-item limits, the `(wordId, status, sortOrder, id)` index, and only a
bounded sentence-ID hydration query. Provenance is checked again after hydration
to fail closed if it changes between reads. No whole sentence/link table is
loaded into application memory.

Direct examples are ordered by `sortOrder`, then link UUID, before legacy
examples. Legacy examples still come from published SENTENCE learning items
whose PREREQUISITE relation points to the requested item. They pass exactly the
same eligibility filter. This also preserves examples for non-word items.
An explicit direct link in any status suppresses the same legacy sentence for
that word, so a draft/archived link cannot reappear through fallback.

Quality processes published word links for each bounded item page in SQL and
returns aggregate validity, invalid-link count, and an evidence fingerprint.
It checks **all** published links, not just the displayed three/five. Any invalid
published link produces an `invalid-source` blocker even when a good example
also exists. No valid example produces a `missing-example` blocker. There is no
blanket waiver or fabricated exception; this change adds no exception mechanism.
The fingerprint participates in the existing report content checksum.

The existing guarded PostgreSQL 18 suite
`apps/api/test/reviews-postgres.integration.test.ts` includes real-query cases for
direct API item/lesson examples without sentence LearningItems, duplicate upserts,
3/5 limits across 101 words, quality pagination, draft suppression, strict legacy
fallback, bad licenses beyond the display cap, and failed/unversioned/unchecked
imports. It retains the loopback-only `kanji_integration` database guard and exact
fixture cleanup. No workflow changes are required; these tests are not a license
to run writes against Neon or any production database.

## Deployment Order and Legacy Compatibility

1. Pre-apply the exact additive SQL in
   `packages/db/prisma/migrations/20261022120000_add_word_examples/migration.sql`
   through the authorized Neon SQL editor.
2. After the SQL is applied, the parent pushes schema/runtime together, making the
   migration available on main. Additive pre-apply keeps API autodeployment safe.
3. Immediately run the existing `prisma migrate deploy` workflow to replay and
   record that exact migration in Prisma's history.

Do not push runtime code that queries WordExample before step 1. This sequence
does not require a separate migration-only branch or push.

The SQL uses `CREATE TABLE IF NOT EXISTS` and `CREATE ... INDEX IF NOT EXISTS`;
replaying the exact migration after pre-apply is intentional. It assumes the
pre-existing Word, Sentence, and ContentStatus schema and does not repair an
unrelated, incompatible table with the same name. It contains no data backfill,
no sentence scheduling changes, and no SRS writes. Strictly licensed read fallback
is retained instead of mass-copying unverified legacy relations. Consequently,
previously displayed examples with incomplete provenance are now hidden and
block quality when attached to published words.
