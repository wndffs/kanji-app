# Editorial Drafts

Cycle 175-189 adds isolated school/family proposals: nine components, ten kanji,
twenty exact expression/reading pairs and twenty original JP/kana/RU/EN examples.
These are AI-authored candidates, not independently approved teaching content.
No proprietary data or new downloads are used. Existing imported JMdict,
KANJIDIC2 and KanjiVG rows remain the evidence layer with their license duties.

The files `editorial-draft-kanji-07.ts` and `editorial-draft-words-07.ts` are
deliberately absent from curation registries and all finite pilot manifests.
Word source IDs remain null rather than guessed. Publishing the application
does not apply them to Neon, add cards or change any learner's selected course.

## Inspect

```bash
npm run content:drafts:preview -- --mode ru-en
npm run content:drafts:preview -- --mode ru
npm run content:drafts:preview -- --mode en
npm run content:coverage
```

These commands work without a database. Preview checks both word spelling and
example-sentence kanji against earlier registered/draft placements. Proposed
levels are components 8, kanji 9, words 10; these are independent level-order
proposals, not sourced JLPT classifications. Coverage separates the reviewed
registry, immutable V1-V4 source seals, pending drafts and the 2,300/8,000 target.
Source counts are not live publication evidence.

With DATABASE_URL already provided securely in the environment:

```bash
npm run content:drafts:evidence
```

This performs two bounded exact-candidate reads in a PostgreSQL READ ONLY
transaction, reports linked provenance, raw kanji reading observations and stored
priority matches, then disconnects. It never writes resolved IDs into source,
changes review dates or approves anything. Missing rows and mismatched readings
require correction; linked rows alone are not full provenance validation.
Do not paste database credentials into logs or this document.

## Before Publication

Independent educational review must check natural wording, accepted synonyms,
special readings, examples and component stories. Exact source IDs/readings,
successful checksummed imports, source licenses and first-priority compatibility
must pass existing curator preflight. Only then create an approved versioned
manifest, preserve prior hashes, apply selected batches and pass all quality
gates before sealing a new finite course. Never mutate V4 to include drafts.
