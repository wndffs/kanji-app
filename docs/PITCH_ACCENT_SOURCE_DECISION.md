# Pitch-accent source decision

## Decision

- Task: 117
- Status: **DEFERRED**
- Evaluated on: 2026-07-28
- Integration permitted: **no**

Pitch-accent import, persistence, settings, and UI remain blocked. The current
research identifies UniDic for Contemporary Written Japanese as the preferred
candidate for a later, separately approved import, but no exact current artifact
has been downloaded and verified. Kanjium is not approved as a production data
source.

This decision completes the research-only outcome allowed by Task 117. It does
not approve schema or application changes.

## Candidate evaluation

### UniDic for Contemporary Written Japanese

Owner and publisher: National Institute for Japanese Language and Linguistics
(NINJAL), UniDic Consortium.

Official references:

- [UniDic home and current release notices](https://clrd.ninjal.ac.jp/unidic/)
- [English download page](https://clrd.ninjal.ac.jp/unidic/en/)
- [English release archive](https://clrd.ninjal.ac.jp/unidic/en/back_number_en.html)
- [License FAQ](https://clrd.ninjal.ac.jp/unidic/faq.html)
- [Commercial-use policy](https://clrd.ninjal.ac.jp/unidic/commerce_use.html)
- [UniDic manual](https://clrd.ninjal.ac.jp/unidic/UNIDIC_manual.pdf)

#### License and redistribution compatibility

The contemporary written-language dictionaries from version 2.x onward are
offered under a GPL v2.0, LGPL v2.1, and modified BSD triple license. The project
would select the modified BSD terms. NINJAL explicitly permits commercial use
of these versions.

Redistribution is compatible only when the exact selected archive's `BSD` and
`AUTHORS` files have been reviewed and their notices are preserved. For a web
application, the source, dictionary name and version, selected BSD license, and
authors must be shown in attribution. NINJAL must not be presented as endorsing
the application.

#### Version, download date, and checksum

No artifact was downloaded during this evaluation, so there is no verified
SHA-256 checksum and no importable source snapshot.

The official pages do not currently identify one artifact consistently:

- the Japanese home page announces contemporary UniDic version `2025.12`;
- the English download page still presents version `3.1.0` as the latest;
- the English archive identifies `unidic-cwj-3.1.0.zip`, released on
  `2021-04-01`, under the triple license.

Evaluation date `2026-07-28` is not a download date. A future approval must pin
one official archive, record its actual download date, calculate SHA-256 over
the downloaded bytes, and retain the bundled license files outside the
repository with the raw source.

#### Entry identity and reading disambiguation

UniDic exposes distinct surface, orthographic, kana, pronunciation, lemma, and
hierarchical lexical identity fields. A future importer must not join on
expression alone. It may publish a claim only when one UniDic record resolves
to exactly one local vocabulary target by:

1. exact local expression to `orthBase` or the deliberately selected
   orthographic field;
2. exact normalized local reading to the corresponding UniDic kana field;
3. compatible lexical identity and part of speech when duplicate rows remain.

Katakana-to-hiragana normalization may be used for comparison, but it must not
collapse distinct expressions or pronunciations. Zero matches, multiple
remaining matches, inflected-only matches, and compound-derived guesses must
produce no claim. The UniDic `lid` or `lemma_id` and original row identity must
be retained as source evidence.

#### Accent representation and dialect

UniDic's `aType` represents the accent nucleus as a mora position. `0` means a
flat/unaccented pattern; comma-separated values represent multiple possible
patterns in source order. `aModType` and `aConType` describe changes caused by
inflection and combination and are not standalone dictionary-form claims.

The reviewed official material does not provide enough evidence here to assign
a precise dialect label to a future learner-facing claim. Approval therefore
requires a source-backed dialect label for the selected artifact. Until then,
missing data must never be rendered as `0`, and no pattern may be synthesized
from spelling, conjugation, or surrounding words.

#### Attribution

A future import must retain:

- data-source name and official URL;
- exact dictionary name, archive version, download date, and SHA-256;
- selected modified BSD license and the archive's authors/copyright notice;
- import-run identity and the exact source row or stable lexical identifier;
- a visible source and dialect label wherever a pattern is displayed.

The application attribution page must reproduce the notices required by the
selected archive.

#### Update and removal policy

Updates require a new immutable source version and import run. Existing claims
must not be overwritten in place. A dry run must report added, removed, changed,
ambiguous, and unmatched expression-reading identities before publication.

Removing or disabling a source must hide its claims without changing meanings,
readings, lessons, review results, or `UserSrsState`. Historical provenance may
remain for audit while unpublished claims are excluded from API responses.

#### Conflicts between sources

Each source pattern is an independent claim. Conflicting claims must be stored
and displayed separately with their own source and dialect labels; the importer
must not silently select, merge, average, or rank them as one truth. If the UI
cannot explain a conflict clearly, it must display no pitch-accent claim.

#### Public and commercial deployment

NINJAL's commercial-use page permits commercial use of contemporary written
UniDic version 2.x and later under the available free licenses. Public
deployment is therefore potentially compatible under the selected modified BSD
terms, subject to reviewing the exact archive and satisfying its attribution
requirements. This is not approval to deploy pitch data before those checks.

### Kanjium

Repository: [mifunetoshiro/kanjium](https://github.com/mifunetoshiro/kanjium)

- Evaluated revision:
  `8a0cdaa16d64a281a2048de2eee2ec5e3a440fa6` (`2024-06-16`)
- Candidate file: `data/source_files/raw/accents.txt`
- Repository claim: 124,137 word patterns and CC BY-SA 4.0 licensing
- Download date: not downloaded
- SHA-256: not calculated
- Status for production import: **REJECTED**

The repository declares its additions, including pitch notation, under CC
BY-SA 4.0 and requests attribution to Uros O. However, the reviewed repository
documentation does not identify the pitch-accent data's underlying linguistic
sources, dialect, collection method, confidence, or entry-level provenance.
The file also has no versioned release artifact or published checksum. A
repository-wide license statement cannot replace traceable evidence for each
learner-facing pitch claim.

The project must not import Kanjium pitch data unless a future evaluation
resolves those provenance and dialect gaps and separately approves the
share-alike obligations.

## Approval gates

Task 117 may be reopened for integration only after all of these gates pass:

1. Select one official UniDic contemporary written-language artifact.
2. Record its exact URL, version, actual download date, and SHA-256.
3. Review and retain the artifact's `BSD` and `AUTHORS` files.
4. Confirm a source-backed dialect label and document `aType` parsing against
   the selected version.
5. Validate deterministic exact expression-and-reading matching against a
   representative local vocabulary sample, including duplicates and
   inflections.
6. Approve an attribution surface and an update/removal runbook.
7. Record a new decision with status **APPROVED** before any schema, importer,
   API, settings, or UI change.

After approval, pitch accent remains optional evidence only. It must never
create an SRS card, alter accepted answers, affect correctness, or reschedule
study state.
