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

## Apply

Apply migrations and the main-course shell before curation. The open-data
imports must already exist.

```bash
npm run db:curate -- --validate-only
npm run db:migrate:deploy
npm run db:seed
npm run db:curate
```

The curation command:

- supports a database-free `--validate-only` manifest and validates every batch
  before writing;
- records a SHA-256-addressed project-authored import run;
- writes one component or kanji in each bounded transaction;
- reconciles only project-authored meanings, answers, mnemonics, components,
  dependencies, and placements owned by the batch;
- preserves imported meanings, readings, provenance, and stroke graphics;
- is idempotent and can resume safely after a partial failure.

Use the manual `Deploy staging curation` GitHub Action for Neon. The full
`Import staging content` workflow also applies all versioned batches after
KANJIDIC2, KanjiVG, and JMdict so a rebuilt database does not lose curated
course content.

## Verification

After applying a batch:

1. Download the workflow corpus-report artifact.
2. Confirm the curation import run is `SUCCESS` and its checksum matches the
   command output.
3. Confirm the 20 kanji are published and placed in levels 2-4.
4. Confirm all component prerequisites are published at level 1.
5. Inspect one early, middle, and late item in lessons and reviews.
6. Run the main-course allocation and publication-readiness reports.

The main course remains `DRAFT` until all 60 levels, 2,300 kanji, and 8,000
vocabulary expression-reading pairs pass the complete Task 118 gate.
