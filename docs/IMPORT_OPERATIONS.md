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
```

Use the full multilingual `JMdict.gz` distribution and decompress it outside the repository.
The English-only `JMdict_e.gz` file cannot populate Russian word senses. The importer stores
English (`eng`/`en`) and Russian (`rus`/`ru`) glosses as normalized word senses. Other languages
are discarded before `ImportedRecord.rawJson` is written and are counted as unsupported in the
import stats; they are never silently converted to English.

The EDRDG general license covers the Japanese/English JMdict components under CC BY-SA 4.0,
while its license statement identifies non-English glosses as separately copyrighted. The
multilingual import therefore uses `LicenseRef-JMdict-Multilingual`; retain EDRDG and Russian
source attribution and verify source-specific terms before redistributing the imported Russian
glosses.

The commands store only the source file basename in `ImportRun.sourceFileName`,
plus checksum, source version/date, optional downloaded date, status, stats,
errors, and imported records. Keep the exact download URL and license on the
`DataSource`/`License` rows rather than in ad hoc notes.

Tatoeba imports currently use sentence/link TSV exports only. They store
sentence IDs and language links in `ImportedRecord.rawJson`. They do not import
audio, and they do not claim author attribution unless an author-capable export
is explicitly added and tested.

## Verification

After a command finishes:

1. Check the command JSON output for `importRunId`, `checksumSha256`, and
   `status`.
2. Open the admin screen and inspect the Import runs list.
3. Confirm the run shows source, license, source file name, checksum, stats,
   status, finished time, and any error text.
4. Confirm `data/raw/` contains no tracked files except `.gitkeep`.

If a future API-triggered import endpoint is added, it must be development-only
or otherwise explicitly controlled. It must reject unsafe paths, path traversal,
absolute production paths, and files outside an allowlisted import directory.
