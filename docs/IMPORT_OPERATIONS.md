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

Prepare the shared KANJIDIC2, KanjiVG, and multilingual JMdict snapshot once:

```powershell
npm run content:snapshot -- --snapshot-version 2026-07-13
```

The command stores compressed archives, decompressed XML, and `manifest.json`
under ignored `.cache/content-sources/2026-07-13/`. A repeat with the same
snapshot label verifies archive and content SHA-256 values and uses the local
files without another network request. Use a new date when intentionally
refreshing either mutable EDRDG distribution. Partial downloads use temporary
siblings and are removed or atomically replaced; they are never treated as a
valid cache entry.

```powershell
npm run import:jmdict -- .cache\content-sources\2026-07-13\JMdict.xml --source-version 2026-07-13 --selection-profile bilingual-course-candidates-v1
npm run import:kanjidic2 -- .cache\content-sources\2026-07-13\kanjidic2.xml --source-version 2026-07-13
npm run import:kanjivg -- .cache\content-sources\2026-07-13\kanjivg-20250816.xml --source-version r20250816
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

Long-running import commands write throttled progress to `stderr` in the form
`[import:JMdict] 42000/210000 (20.0%)`. The final machine-readable result remains
the JSON object on `stdout`. Progress advances only after a complete source
record has been written and is emitted at roughly one-percent intervals, plus
the exact start and completion states.

JMdict production writes are committed in bounded batches of 100 source
entries. Imported records, expression-reading identities, provenance updates,
and senses are written in bulk within each batch transaction. If a process is
cancelled, rerunning the same checksum safely revisits completed batches and
continues the same import run without duplicating compound identities.

Use the full multilingual `JMdict.gz` distribution and decompress it outside
the repository. The English-only `JMdict_e.gz` file cannot populate Russian
word senses. The staging workflow verifies the full source checksum, then uses
the versioned `bilingual-course-candidates-v1` profile to select exactly 30,000
unique expression-reading pairs that have both English and Russian senses.
Frequency-marked pairs sort first; the JMdict sequence and expression-reading
identity provide deterministic tie-breakers.

The bounded candidate pool is 3.75 times the 8,000-word published-course target
and is deliberately separate from project-reviewed learning content. Other
languages are discarded during parsing and never silently converted to
English. `ImportedRecord.rawJson` stores only the JMdict sequence, selected word
count, and retained locales. The complete verified XML remains outside the
database, while `ImportRun` and the snapshot manifest retain its source URL,
version, download time, and checksum. The JMdict CLI defaults to this bounded
profile so an omitted flag cannot accidentally request an unbounded production
import.

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

## Verified staging snapshot

Use the manually dispatched GitHub Actions workflow `Import staging content` for
a complete staging import. It restores a verified source snapshot from GitHub
Actions Cache and downloads only missing snapshots from these official
distributions:

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
`manifest.json` and `corpus-report.json`. The manifest records each source's
official URL, original download time, filenames, SHA-256 values for both the
compressed archive and imported XML, and the post-import database report. The
verified archives and XML are retained only in an Actions Cache entry keyed by
snapshot date and preparation-script version. They are never committed or
uploaded as workflow artifacts. Cache retention is operational, not permanent;
keep the manifest checksums for verification and use a new snapshot date for an
intentional refresh.

The post-import report separates the imported candidate dictionary from
published learning content. `dictionary.kanji` and `dictionary.words` measure imported targets;
`publishedCourse.kanji` and `publishedCourse.words` measure items learners can
actually study. The staging workflow runs the report with `--require-full` and
fails unless the database has at least 10,000 kanji, 6,000 imported stroke
graphics, 30,000 words, 30,000 words with both Russian and English imported
senses, and successful KANJIDIC2, KanjiVG, and JMdict import runs. The KanjiVG
threshold detects a truncated source while remaining below the verified 6,702
graphics in release `r20250816`. These are completeness guards, not curriculum
targets. Task 118 still requires 2,300 placed published kanji and 8,000 placed
published vocabulary pairs with project-reviewed RU/EN content.

After all three dictionary sources are loaded, the staging workflow runs
`npm run db:curate`. This reapplies the repository's versioned editorial
batches without changing imported KANJIDIC2/JMdict meanings or provenance. A
batch fails closed when its target, taught reading evidence, required stroke
data, component prerequisite, or course level is missing. The standalone
`Deploy staging curation` workflow applies the same command without downloading
the source corpus again.

Vocabulary registry planning shares bounded course and prerequisite-kanji reads
within one calculation (at most 512 entries per cache). Overflow is read normally,
not skipped. Each batch still checks exact registered placement and curriculum
band. Word, source, and license evidence remains uncached. A later plan or selected
write starts fresh, and each applied word revalidates its evidence inside the
transaction. The cache is a query-count optimization, not a persistent snapshot
or permission to apply a stale plan.

EDRDG's current JMdict and KANJIDIC2 URLs are mutable daily distributions. The
local and Actions caches make repeated imports of one snapshot deterministic
while that cache exists. Long-term replay still requires retaining the original
archives in storage permitted by their license terms; the manifest is
sufficient to verify them. KanjiVG uses an immutable release URL.

The full multilingual JMdict file is the verified source, but the operational
database stores only the bounded bilingual selection profile. The admin
translation-review queue offers ranked targets for which both locales are
available. Confirming a translation writes a separate project-authored
curation layer; it does not replace or relabel imported dictionary senses. A
failed Action can be rerun: source checksum and compound database keys make
imports idempotent.

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
