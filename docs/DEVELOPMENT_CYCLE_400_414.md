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

| ID  | Acceptance                                                                           | State    |
| --- | ------------------------------------------------------------------------------------ | -------- |
| 400 | Compare objective/current app, reserve 400-499 and define this batch                 | Complete |
| 401 | Required-reading gaps follow actual card types; tests cover cloze and ordinary cards | Complete |
| 402 | Report absent required kanji/word teaching aspects independently                     | Complete |
| 403 | Count modern-label coverage/unknowns without implying syllabus coverage              | Complete |
| 404 | Extend on-demand course coverage UI with compact honest scope counters               | Complete |
| 405 | External persistent source cache defaults and explicit offline reuse                 | Complete |
| 406 | Validate local manifest paths/checksums/source identity and attribution contract     | Complete |
| 407 | Stream exact candidate KANJIDIC2 reading evidence                                    | Complete |
| 408 | Stream exact JMdict pairs, restrictions and ambiguity                                | Complete |
| 409 | Stream exact primary KanjiVG stroke evidence                                         | Complete |
| 410 | Aggregate observations and explicit blockers, no automatic ready flag                | Complete |
| 411 | Safe local evidence CLI, no network/DB writes and no detailed Git report             | Complete |
| 412 | Fingerprinted review worksheet, rejecting stale/missing approval bindings            | Complete |
| 413 | Scoped units/browser matrix, types/build/lint and actual source run where available  | Complete |
| 414 | Version/push/deploy/exact runtime and live coverage inspection                       | Planned  |

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

## Batched Local Acceptance

- 38 focused tests passed across shared coverage, API course projection, snapshot
  cache and local source readers. Fixtures only; no external network in tests.
- Eight production-web Playwright cases passed: desktop/mobile on-demand coverage,
  local grouping, retry, late old-owner response and material paging. Coverage
  still performs one explicit read and no writes; theme captures and overflow
  checks use the existing runner.
- Web production build, API typecheck, source-tool typecheck and changed-file
  ESLint passed. CI now explicitly includes the source-tool tests/typecheck.
- CLI help works without I/O. No source import, database changes or publication.
- Real-source attestation remains **blocked by download**, not passed: the official
  JMdict endpoint returned only 15,894 of 22,207,146 bytes before a bounded curl
  transfer timed out at 45 seconds. The earlier stalled transfer was stopped;
  the incomplete archive was removed. No full snapshot manifest was created and
  no fixture is substituted for corpus evidence. Retry from a working route/cache
  before using task 415 to resolve actual wave07 blockers.
- `npm audit` reports six high advisories in existing Nest/Prisma dependency
  chains, none in `saxes`/`xmlchars`. No unrelated dependency upgrades performed.
  Parser use remains local/dev-only and its archived upstream is documented.
