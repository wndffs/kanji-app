# Local Source Evidence

Persistent snapshots default to `~/.cache/kanji-srs/content-sources`, overridden
by `KANJI_CONTENT_CACHE` or `--cache-root`. Use a fixed `--snapshot-version`.
`npm run content:snapshot -- --snapshot-version YYYY-MM-DD --offline` never
downloads; it requires an existing matching manifest and can repair XML from a
verified archive. Default operation may download the three existing official
sources. No downloads or cache artifacts belong in Git.

The local evidence reader requires all three pinned source identities, archive
and XML SHA-256, download date and manifest version. It rejects repository-local
snapshots, symlink escapes, duplicate identities and oversized files. It attaches
the existing source license/attribution contract, including JMdict's separate
non-English terms; this does not approve redistribution of raw Russian glosses.
Manifest hashes establish local integrity, not a cryptographic publisher signature.

No database connection, source import or publication is performed. Candidate
matches, source provenance, independent educational approval and explicit
publication authorization remain separate gates. Only aggregates go to Git.

Streaming XML uses `saxes@6.0.0` (ISC) as a root **development-only** dependency.
It avoids a new handwritten XML parser and full-corpus object allocation. Its
upstream repository is archived; use is limited to bounded, local source tools,
not the web/API runtime. No external DTD/entity is fetched. Only bounded literal
internal entities are expanded; malformed XML, excessive depth/records/text,
unexpected roots, cancellation and changed-file hashes fail closed. Existing
dictionary parsers handle selected candidate records, not a second import path.

Run `npm run content:drafts:local -- --snapshot-dir ABSOLUTE_DIRECTORY`.
The default stdout is aggregate counts only. `--report ABSOLUTE_EXTERNAL_FILE`
creates an exclusive local detailed report (never overwrites); its directory
must already exist and resolve outside the repository. `--require-complete`
exits 2 for missing/ambiguous/nonbilingual evidence, but even exit 0 is not
publication readiness. `--help` does no I/O. No environment credentials are
read. Tool modules use explicit `.mts` ESM, not a package-wide module change.

`--worksheet ABSOLUTE_EXTERNAL_FILE` creates an original-content review worksheet
bound to candidate prose, the source snapshot and exact observations. Editing
prose/identities or changing either fingerprint makes the binding stale. A bound
worksheet is only ready for independent review (or still source-blocked), never
approval. A reviewer name or edited JSON flag cannot turn it into a publishing
credential. Existing curator/review/publication gates are not wired to this file.

## Refreshing an expired CI source cache

The read-only `Audit reviewed source refresh` workflow downloads the official
archives to runner temp and prints aggregate checksums for explicitly named
reviewed word manifests. It has no database secret and does not upload source
files. Compute the matching baseline against the intact local pinned snapshot
with `npm exec -- tsx scripts/compare-reviewed-source-snapshots.mts
--snapshot-dir ABSOLUTE_DIRECTORY --batch REGISTERED_ID` (repeat `--batch`
as needed). The lexical seal covers exact pairs, source identifiers and the
effective RU/EN gloss/part-of-speech set. Reordering and commonness alone do
not change it. Compare two local snapshots with `--before-dir` and `--after-dir`
instead. Output remains aggregate-only.

This is evidence for reviewing a new pin, not permission to repin or import.
Scope changes and separate historical sense-note proofs need their own review.
The teaching workflow retains its fixed official archive hashes and all
database preflight requirements.
