# Task 118 publication status

## Status

- Task: 118
- Updated: 2026-07-28
- State: **IN PROGRESS**
- Main course publication approved: **no**

The 2,300-kanji and 8,000-vocabulary publication target has not been reached or
claimed. This record captures the last auditable staging import, the blocking
failure, and the checks required before editorial publication can continue.

## Last staging evidence

Evidence source:
[Import staging content run 29243186549](https://github.com/wndffs/kanji-app/actions/runs/29243186549)
from 2026-07-13.

| Source              | Result    |     Imported rows | Import run                             | Content SHA-256                                                    |
| ------------------- | --------- | ----------------: | -------------------------------------- | ------------------------------------------------------------------ |
| KANJIDIC2           | success   | 13,108 characters | `0e483791-e42d-47be-b46b-89bc076eae77` | `e2debd18fac3a9b3fe56285607a80b0932658164d870b03085488307eb4f9352` |
| KanjiVG `r20250816` | success   |    6,702 graphics | `05953022-2f2a-4d7c-87f0-4c8c4779a96f` | `97f316c265eee227cac44af1baf1227f16c707a367038c6b3d72afc864dd8010` |
| JMdict              | cancelled |     not auditable | no successful run                      | `575c14564fbaa8a4ef70cfcfbaf8824bbd41e728f1b03218c59269d4643fba83` |

The JMdict step ran for approximately five hours before the six-hour workflow
limit cancelled the job. The database report step was skipped, so partial word
rows must not be reported as a verified corpus.

The repository-authored starter seed contains two published kanji and two
published words. Relative to the Task 118 targets, that isolated seed baseline
is short by 2,298 kanji and 7,998 expression-reading pairs. These are not
production publication counts: the exact staging gap must come from the next
successful database report and main-course readiness audit.

## Remediation in this change

- JMdict production writes use bounded batches of 100 source entries.
- Each batch is one restart-safe transaction.
- Imported records, word identities, provenance updates, and senses are written
  in bulk instead of one network round trip per row.
- Duplicate expression-reading identities inside a batch are merged
  deterministically while retaining distinct source senses.
- A cancelled run can restart against the same checksum and safely revisit
  completed batches.
- The KanjiVG full-source minimum is 6,000 graphics. The previous 10,000 minimum
  exceeded the verified 6,702-row official release and made a successful report
  impossible.

## Required next run

After this change is committed and pushed:

1. Run `Import staging content` with a pinned snapshot label and checksums.
2. Require a successful JMdict import run and generated `corpus-report.json`.
3. Record exact imported word and bilingual-word counts from the artifact.
4. Run the main-course scale-readiness and publication-readiness audits.
5. Record exact published kanji, published expression-reading pairs, remaining
   gaps, allocation plan version, and blocking issue counts.
6. Continue bounded editorial curation; raw candidates must not be relabeled as
   project-reviewed content.

Task 118 remains open until all 60 levels are populated, the database contains
at least 2,300 placed published kanji and 8,000 placed published vocabulary
pairs, and publication readiness reports zero blockers.
