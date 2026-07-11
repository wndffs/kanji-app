# Data sources and licensing plan

## Rule

The app must not rely on proprietary WaniKani content. Use open or compatible sources and track attribution in the database and UI.

## Preferred sources

### Kana catalogue

The hiragana/katakana lesson catalogue contains project-authored factual
symbol-to-romaji mappings for 46 modern basic characters, 20 dakuten variants,
5 handakuten variants, and 33 standard yoon combinations in each script.
It does not copy mnemonics, explanations, ordering, or other educational text
from third-party applications. Additional orthographic rules should be added as
separately reviewed project content.

### EDRDG: JMdict / KANJIDIC2

Use for Japanese dictionary entries, readings, senses, kanji metadata, and priority/frequency hints where available.

EDRDG distributes KANJIDIC2 and the Japanese/English components of JMdict under
CC BY-SA 4.0. The same license statement says that non-English JMdict glosses
are separately copyrighted by their compilers. Store KANJIDIC2 as
`CC-BY-SA-4.0`, store the multilingual JMdict source as
`LicenseRef-JMdict-Multilingual`, keep attribution and share-alike flags enabled,
and link to the [EDRDG license statement](https://www.edrdg.org/edrdg/licence.html).

Implementation requirements:

- Track source file name, source URL, downloaded date, checksum, and license.
- Keep raw source fields separate from curated Russian and English learning content.
- Do not pretend raw dictionary glosses are final lesson copy.
- Import the multilingual `JMdict` file when Russian glosses are required. `JMdict_e` contains
  English glosses only.
- Attribute the Russian dictionary source listed by EDRDG and verify its source-specific terms
  before redistributing Russian glosses outside this personal application.
- Discard unsupported JMdict gloss languages during parsing. Persist only Russian and English
  glosses, and record the number of discarded glosses in import statistics.
- Discard non-Japanese KANJIDIC2 readings and non-English meanings before persisting imported
  records; do not expose or retain them as application data.

### KanjiVG

Use for stroke order SVG/path data and kanji component graphics.

KanjiVG is distributed under CC BY-SA 3.0. Store it as `CC-BY-SA-3.0`, retain
Ulrich Apel/KanjiVG attribution, and keep the imported paths separate from
project-authored component names and explanations.

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
