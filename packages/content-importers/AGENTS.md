# packages/content-importers/AGENTS.md

This package owns source importers and normalization pipelines.

## Requirements

- Keep raw source parsing separate from curated course generation.
- Track source, license, version/date, checksum, and import run.
- Tests must use small fixtures in `data/fixtures`.
- No external network calls in unit tests.
- Do not commit huge raw datasets by default.

## Importer direction

Implement importers incrementally:

1. KANJIDIC2 fixture parser.
2. JMdict fixture parser.
3. KanjiVG fixture parser.
4. Tatoeba fixture parser.
5. Full local-file import commands.
6. Normalized DB write pipelines.
