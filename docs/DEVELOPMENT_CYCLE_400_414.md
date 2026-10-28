# Learning Scope And Source Evidence 400-414

Baseline `2b29567`. Scope: 400-414 only. Separate commits, batched scoped checks,
push, deployment and real read-only acceptance. No subagents in this batch.

## Audit And Minimal Plan

Coverage currently treats every non-component as requiring a reading answer,
so a cloze-only demo sentence is falsely reported as missing reading. It also
cannot distinguish a missing kanji/word reading card from an absent answer, or
express how sparse modern JLPT metadata is without manually counting rows.
Extend the existing explicitly loaded coverage endpoint/disclosure; do not add
polling, a new dashboard request, exam percentages or a new learning mode.

The legal local-source download/cache tool exists, but defaults to an in-repo
cache and has no strict offline path. Draft07 still has no exact local source
attestation. Build on the existing source contracts/parsers, using a proven
streaming XML reader rather than loading full corpora into memory. New tooling
must be local/read-only, bounded, deterministic and fail closed on corrupt,
ambiguous or stale evidence. Matching a source is not pedagogical approval.

## Tasks

| ID | Acceptance | State |
| --- | --- | --- |
| 400 | Compare objective/current app, reserve 400-499 and define this batch | Complete |
| 401 | Required-reading gaps follow actual card types; tests cover cloze and ordinary cards | Planned |
| 402 | Report absent required kanji/word teaching aspects independently | Planned |
| 403 | Count modern-label coverage/unknowns without implying syllabus coverage | Planned |
| 404 | Extend on-demand course coverage UI with compact honest scope counters | Planned |
| 405 | External persistent source cache defaults and explicit offline reuse | Planned |
| 406 | Validate local manifest paths/checksums/source identity and attribution contract | Planned |
| 407 | Stream exact candidate KANJIDIC2 reading evidence | Planned |
| 408 | Stream exact JMdict pairs, restrictions and ambiguity | Planned |
| 409 | Stream exact primary KanjiVG stroke evidence | Planned |
| 410 | Aggregate observations and explicit blockers, no automatic ready flag | Planned |
| 411 | Safe local evidence CLI, no network/DB writes and no detailed Git report | Planned |
| 412 | Fingerprinted review worksheet, rejecting stale/missing approval bindings | Planned |
| 413 | Scoped units/browser matrix, types/build/lint and actual source run where available | Planned |
| 414 | Version/push/deploy/exact runtime and live coverage inspection | Planned |

## Boundaries

No new Neon content, source import, seed, migration, account reset, course switch
or learning write in acceptance. Publication authorization alone never bypasses
source/license/independent review gates. No guessed source IDs or modern JLPT
levels; no fixtures described as full corpus evidence. Cache/report files live
outside Git and outside the repository. Only RU/EN teaching content. Kana stays
outside SRS. No change to scheduling, answer grading or accepted answer sets.

If sources are unreachable, finish the bounded tooling and report the exact
blocker rather than simulating attestation. A source update invalidates evidence;
existing reviewed/published seals are immutable. Any parser dependency must be
small, licensed and development-tool-only, with no browser/API payload increase.
Close owned browser tabs/processes and remove generated test/build files.
