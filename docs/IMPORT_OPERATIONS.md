# Import operations

## Rule

Local source imports are controlled CLI operations. The public API does not accept
server file paths and does not read arbitrary files. Admin users can inspect
recorded import runs through `GET /admin/import-runs` and the admin UI.

Run imports only from a trusted local shell against a local or explicitly chosen
database. Set `DATABASE_URL`, generate the Prisma client, and run migrations
before importing.

```powershell
npm install
npm run db:generate
npm run db:migrate
```

## Commands

Use legally reusable source files downloaded outside the repository. If a local
workspace path is needed, use ignored `data/raw/` and keep only `.gitkeep`
tracked there. Do not commit raw full-size source dumps unless a task explicitly
asks for a tiny fixture.

```powershell
npm run import:jmdict -- C:\data\JMdict.xml --source-version 2026-07
npm run import:kanjidic2 -- C:\data\kanjidic2.xml --source-version 2026-06
npm run import:kanjivg -- C:\data\kanjivg.xml --source-version 2026-06
npm run import:tatoeba -- C:\data\sentences.tsv C:\data\links.tsv --source-version 2026-06
npm run content:report -- --output C:\data\corpus-report.json
```

The three XML import commands also accept reproducibility metadata:

```powershell
npm run import:jmdict -- C:\data\JMdict.xml `
  --source-version 2026-07-11 `
  --source-downloaded-at 2026-07-11T09:30:00Z `
  --checksum-sha256 <sha256-of-decompressed-xml>
```

When `--checksum-sha256` is present, the command verifies the XML before making
database changes. The checksum is normalized to lowercase and must contain 64
hexadecimal characters.

Use the full multilingual `JMdict.gz` distribution and decompress it outside the repository.
The English-only `JMdict_e.gz` file cannot populate Russian word senses. The importer stores
English (`eng`/`en`) and Russian (`rus`/`ru`) glosses as normalized word senses. Other languages
are discarded before `ImportedRecord.rawJson` is written and are counted as unsupported in the
import stats; they are never silently converted to English.

JMdict priority tags are normalized into an approximate `Word.commonnessRank`
for cross-feature sorting. `nfXX` represents a 500-word frequency band, while
the `ichi/news/spec/gai` tier 1 and tier 2 markers map to approximate ranks
1,000 and 10,000. This is an ordering heuristic, not an exact corpus frequency.

The EDRDG general license covers the Japanese/English JMdict components under CC BY-SA 4.0,
while its license statement identifies non-English glosses as separately copyrighted. The
multilingual import therefore uses `LicenseRef-JMdict-Multilingual`; retain EDRDG and Russian
source attribution and verify source-specific terms before redistributing the imported Russian
glosses.

The commands store only the source file basename in `ImportRun.sourceFileName`,
plus checksum, source version/date, optional downloaded date, status, stats,
errors, and imported records. Keep the exact download URL and license on the
`DataSource`/`License` rows rather than in ad hoc notes.

## Full staging snapshot

Use the manually dispatched GitHub Actions workflow `Import staging content` for
a complete staging import. It downloads these official distributions on a
GitHub-hosted runner:

- multilingual `JMdict.gz` from EDRDG;
- `kanjidic2.xml.gz` from EDRDG;
- the immutable KanjiVG `r20250816` combined XML release.

The workflow applies migrations, then imports KANJIDIC2, KanjiVG, and JMdict in
that order. It shares the `staging-database` concurrency lock with the migration
workflow, so do not cancel a running import to start a database deploy.

To run it:

1. Confirm the GitHub repository secret `STAGING_DATABASE_URL` contains the
   direct Neon connection string.
2. Open **Actions -> Import staging content -> Run workflow** on `main`.
3. Enter the current download date as `snapshot_version` in `YYYY-MM-DD` form.
4. For an initial snapshot, leave the three expected archive checksums empty.
5. For a pinned repeat while the same files remain available, copy the archive
   checksums from the previous run's `manifest.json` into the expected checksum
   inputs. The workflow aborts before touching the database if any archive has
   changed.

Every run uploads a small `content-snapshot-...` artifact containing
`manifest.json` and `corpus-report.json`. The manifest records official URLs,
download time, filenames, SHA-256 values for both compressed archives and
imported XML, and the post-import database report. Source archives are deleted
from the runner and are never committed or uploaded as artifacts.

The post-import report separates the raw dictionary from published learning
content. `dictionary.kanji` and `dictionary.words` measure imported targets;
`publishedCourse.kanji` and `publishedCourse.words` measure items learners can
actually study. The staging workflow runs the report with `--require-full` and
fails unless the database has at least 10,000 kanji, 10,000 imported stroke
graphics, 100,000 words, 30,000 words with both Russian and English imported
senses, and successful KANJIDIC2, KanjiVG, and JMdict import runs. These are
completeness guards, not curriculum targets.

EDRDG's current JMdict and KANJIDIC2 URLs are mutable daily distributions. An
exact later replay therefore also requires retaining the original archives in
private storage permitted by their license terms. The manifest is sufficient to
verify those retained files. KanjiVG uses an immutable release URL.

The full multilingual JMdict import retains only Russian and English glosses.
The admin translation-review queue only offers ranked targets for which both
locales are available. Confirming a translation writes a separate
project-authored curation layer; it does not replace or relabel imported
dictionary senses.
It can run for a long time and consume substantial Neon storage; inspect the
provider's current usage after the first run. A failed Action can be rerun:
source checksum and compound database keys make imports idempotent.

Tatoeba imports currently use sentence/link TSV exports only. They store
sentence IDs and language links in `ImportedRecord.rawJson`. They do not import
audio, and they do not claim author attribution unless an author-capable export
is explicitly added and tested.

## Verification

After a command finishes:

1. Check the command JSON output for `importRunId`, `checksumSha256`, and
   `status`.
2. Run `npm run content:report -- --require-full` and record the raw dictionary
   and published-course counts separately.
3. Open the admin screen and inspect the Import runs list.
4. Confirm the run shows source, license, source file name, checksum, stats,
   status, finished time, and any error text.
5. Confirm `data/raw/` contains no tracked files except `.gitkeep`.

If a future API-triggered import endpoint is added, it must be development-only
or otherwise explicitly controlled. It must reject unsafe paths, path traversal,
absolute production paths, and files outside an allowlisted import directory.
