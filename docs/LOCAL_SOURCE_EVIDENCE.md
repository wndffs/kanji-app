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
