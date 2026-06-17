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

## Data-source tables

Minimum tables:

- `DataSource`
- `License`
- `Attribution`
- `ImportRun`
- `ImportedRecord`

Every imported entity should be traceable back to source and import run.

## WaniKani boundary

Forbidden:

- Scraping WaniKani.
- Importing WaniKani educational content.
- Using WaniKani mnemonics, radical names, hints, examples, audio, or level order.
- Using unofficial WaniKani dumps or Anki decks as seed data.

Allowed later, if deliberately implemented:

- User enters own API token.
- App maps user progress to local independent content by kanji/word identity.
- App does not store or display WaniKani educational content.
