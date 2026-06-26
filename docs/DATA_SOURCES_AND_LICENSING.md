# Data sources and licensing plan

## Rule

The app must not rely on proprietary WaniKani content. Use open or compatible sources and track attribution in the database and UI.

## Preferred sources

### EDRDG: JMdict / KANJIDIC2

Use for Japanese dictionary entries, readings, senses, kanji metadata, and priority/frequency hints where available.

Implementation requirements:

- Track source file name, source URL, downloaded date, checksum, and license.
- Keep raw source fields separate from curated Russian and English learning content.
- Do not pretend raw dictionary glosses are final lesson copy.

### KanjiVG

Use for stroke order SVG/path data and kanji component graphics.

Implementation requirements:

- Store source attribution.
- Preserve enough metadata to regenerate SVG paths if the renderer changes.
- Do not mix KanjiVG component groupings with proprietary radical names.

### Tatoeba

Use for example sentences only after attribution and license handling are implemented.

Implementation requirements:

- Store sentence ID, author if available, license, source URL, and language links.
- Filter low-quality or too-hard sentences.
- Do not use audio unless its individual audio license is compatible and stored.
- The current importer uses the sentence and link exports only. Those exports provide sentence IDs and language links but not reliable author metadata. Author attribution must be added before importing exports that include authors, and audio must remain disabled until per-audio license metadata is modeled and tested.

## Raw dataset hygiene

Full-size raw source dumps must not be committed. Keep downloaded files outside the repository, or in ignored local paths such as `data/raw/` while running CLI imports. Only small hand-authored or trimmed fixtures belong in `data/fixtures/`.

Docker build contexts must exclude raw dumps so production images cannot accidentally contain source archives, TSV dumps, XML dumps, or local downloads.

## Data-source tables

Minimum tables:

- `DataSource`
- `License`
- `ImportRun`
- `ImportedRecord`

Attribution is currently represented by `DataSource.attributionText`, `License`, `ImportRun`, `ImportedRecord`, and attribution DTOs shown in item/admin views. If attribution becomes more granular than one data source per imported record, add a dedicated attribution/link table instead of overloading raw target fields.

Every imported entity should be traceable back to its source, license, checksum, source file, source version/date, downloaded date when known, and import run. Imported target rows should point to the exact `ImportedRecord` that produced them, not only to a source-record string.

Global accepted and blocked answers are curated learning content. They must carry provenance such as `sourceKind=PROJECT_AUTHORED` and must not be silently derived from raw imported glosses without curation.

## WaniKani boundary

Forbidden:

- Scraping WaniKani.
- Importing WaniKani educational content.
- Using WaniKani mnemonics, radical names, hints, examples, audio, or level order.
- Using unofficial WaniKani dumps or Anki decks as seed data.
- Importing or linking WaniKani audio, example sentences, mnemonics, hints, or radical names.

Allowed later, if deliberately implemented:

- User enters own API token.
- App maps user progress to local independent content by kanji/word identity.
- App does not store or display WaniKani educational content.
