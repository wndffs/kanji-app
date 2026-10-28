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
| 414 | Version/push/deploy/exact runtime and live coverage inspection                       | Complete |

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

## Release Checkpoint

Tag: `cycle-400-414-source-evidence`. Push the 15 numbered commits together.
Broad cloud CI, exact web/API runtime and real read-only coverage acceptance
are required, not inferred from a successful push; observed results follow.
The live check must verify both V4's aggregate teaching aspects/unknown JLPT
metadata and the starter DEMO's corrected sentence-reading applicability,
without enrollment, learning writes, importing or publishing new content.

## Observed Live Acceptance

Both public health endpoints returned release revision
`7726d859ffccdf2d57cc104e9498cf2df95d4248`. The existing test profile opened
published V4 and the starter DEMO in the in-app browser; no new login, course
switch, lesson, review or account/preference write was made.

- V4: 300 materials, 79 components, 101 kanji, 120 word pairs and 521 core cards.
  Both teaching card types: 221/221; missing meaning/reading cards: 0/0.
  Missing RU/EN/required-reading answers: 0/0/0. Modern JLPT unknowns: 99 kanji,
  119 words. Exam coverage explicitly remains unconfirmed.
- DEMO: 7 materials, 11 cards, both teaching aspects 4/4 and no missing required
  reading. The meaning-answer-only cloze sentence is no longer a false gap;
  actual reading-card applicability remains covered by units.
- Both reports rendered correctly in the live dark desktop viewport. Local
  production Playwright supplied mobile/light/dark and horizontal-overflow
  acceptance; a real mobile device is not claimed.
- Live screenshots are outside Git in the agent visualization directory under
  `cycle-400-414/`. The owned IAB tab was closed; local Next/Playwright/source
  processes are absent and generated build/test outputs were removed.

## Final Result

All 15 numbered task commits (400-414) were pushed. Immutable release tag
`cycle-400-414-source-evidence` points at `7726d85`, the exact web/API revision
verified above. The subsequent documentation-only receipt does not replace
that runtime/tag or require another code deployment.

[CI run 40743297499](https://github.com/wndffs/kanji-app/actions/runs/40743297499)
completed successfully for that full SHA. Quality passed lint, types, workspace
units, source-tool guardrails and builds. Its workspace units retain 32 existing
conditional skips; no new skip was added. Full browser smoke: **479 passed,
one skipped**, without retries or weakened assertions.

This closes code/coverage/tooling delivery, not source attestation or course
expansion. New published content: zero; no Neon changes. Full-source download,
actual wave07 evidence, independent educational review and publication remain
separate next-batch gates. The next reserved batch is 415-429. Six dependency
audit advisories and representative full-size/device/performance acceptance
remain recorded risks, not hidden by a green functional suite.
