# Editorial Drafts

2026-10-29 wave08 checkpoint: the bounded lexical proposal was independently
AI-reviewed and corrected, then registered/applied as kanji08/words08. The
reviewed corpus is now 112 kanji/160 exact word pairs; V6 publication
`40908104197`, post-publication plan `40908802623` and remote audit `40909088233`
passed. See `LEXICAL_WAVE08_REVIEW.md` and `DEVELOPMENT_CYCLE_430_444.md`.
Thirty observed candidates yielded twenty selected pairs; ten deferred pairs
are neither published nor counted as reviewed pending content. Source matching,
AI review and actual publication remain distinct evidence layers.

2026-10-29 update: wave07 is retained as a nonpublishing proposal archive.
Independently AI-reviewed immutable copies are registered as
`task-118-course-kanji-07` and `task-127-course-words-07`. See
`editorial-wave07-review.ts` and `DEVELOPMENT_CYCLE_415_429.md` for bound review
and source evidence. At that checkpoint the registry/applied teaching content
contained 111 kanji/140 word pairs. V5 publication `40855074022` and its
post-publication plan passed; those are separate live receipts, not consequences
of registration.
The archived draft's null review/source fields are not publishing credentials,
and its 69 proposed cards are no longer counted as a new pending backlog.

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

The manual **Inspect editorial draft coverage** GitHub Action uses only
`--summary-only`: fixed numeric source-coverage counts and `publicationApproved:
false`. It never prints dictionary rows, internal IDs, source details or user
data and uploads no artifact. The existing secret is scoped to the read-only
inspection step, not dependency installation. Detailed external source artifacts
remain outside this workflow and require separate authorization.

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
