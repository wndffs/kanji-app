# Editorial Registry Inventory

Read-only, source-only inventory of the current kanji/component and word builders:

```sh
npm run content:inventory
npm run --silent content:inventory -- --json
npm run --silent content:inventory -- --json --include-completion-draft
```

Default output is human-readable; `--json` emits one JSON document on stdout
(use npm's `--silent` to suppress script banners). No output path is required or
accepted. No Prisma client, environment/secrets, database, network or file writes
are used. Invalid registry content exits nonzero in either format.

The versioned SHA-256 hashes the canonical inventory payload, excluding its own
hash. Batch checksums retain the existing builders' `JSON.stringify(batch)` SHA-256
contract. Output has no timestamps or machine-dependent paths.

Counts are **prepared source targets**, never live/applied/published counts. Word
identity is expression plus reading; components use their stable keys and kanji
their characters. Review status reflects source `reviewedAt`, not human approval
or publication eligibility. Slots are explicit level/sort-order lists. Prerequisite
closure includes transitive components, expression kanji and example-sentence
kanji, all in the same course on strictly earlier levels.

`--include-completion-draft` adds the large, currently unregistered full-course
kanji draft to this read-only report. It does not add it to the application
registry or change review/publication status. The default report remains the
approved source registry; do not replace published counts with the opt-in draft
totals. Reading-example words in kanji guidance are not additional word cards.

V1/V2/V3 membership uses fixed ID/version/checksum references from
`packages/db/src/foundation-pilot.ts`, without importing its database runtime.
New batches do not enlarge those finite seals; V4 is deliberately not consulted.
Each seal compares its fixed distinct totals with matching prepared sources and
prepared targets outside the seal. Missing sources are marked `incomplete` (useful
for injected subset fixtures); present but changed sealed sources are validation
errors. Duplicate identities, cross-kind source IDs, conflicting slots and broken
prerequisites also fail validation. Shared source file paths are valid.

`buildEditorialRegistryInventory({ kanjiBatches, wordBatches })` supports fixture
injection without mutating inputs. Existing batch validators still apply, including
the twenty-word slice rule. This command neither authorizes publication nor checks
licensed dictionary evidence in a live database. It adds no content or data sources;
existing provenance/license obligations remain unchanged.
