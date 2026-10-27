# Focused Material Workspace 325-339

Baseline: `363fdd9`. Prior cycle 310-324 is released; corrected CI 40537818883
passed (367 browser cases, one skipped). Next unused task after this batch: 340.

## Observed Gaps

The material GET waits for a separate private-mnemonic GET before showing any
content. Failure of that optional read replaces the whole page with an error.
Those reads and confusable lookups cannot be cancelled. Material tabs are local
state. The hero repeats SRS schedule information and joins RU/EN meanings with
slashes. Kanji dictionary readings are always expanded and ignore the hide-
reading switch. Related-item readings also ignore it. Mnemonics follow long
relations/example lists rather than the main teaching content.

Use an original compact material workbench: Japanese and selected meanings first,
visible reading tools, small level metadata, then teaching content. Put optional
dictionary evidence behind disclosure and schedule detail in History. Preserve
all attribution, personal edits and authoritative API grading/history behavior.

## Tasks

| ID | Deliverable | Acceptance | State |
| --- | --- | --- | --- |
| 325 | Scope | Record observed gaps, exact boundaries and acceptance | Complete |
| 326 | Cancellable material reads | Abort obsolete item/kanji/private/pair GETs; retain owner and 401 guards | Planned |
| 327 | Independent private-note recovery | Public teaching renders without waiting for private notes; loading/error/retry is local; unsafe note writes stay disabled | Planned |
| 328 | Bookmarkable material tabs | Known view query survives reload and Back without extra material reads; preserve safe catalogue/course context | Planned |
| 329 | Bilingual hero meanings | Label selected RU/EN rows and show absent translation explicitly, never substitute another language | Planned |
| 330 | Focused material header | Compact real level/JLPT/stage; schedule details reachable in History rather than duplicated above study | Planned |
| 331 | Visible-reading audio | Explicit browser speech for visible readings, respect existing voice/rate, cancel on hide/tab/item/unmount, no autoplay | Planned |
| 332 | Reading evidence hierarchy | Hide switch covers taught/dictionary readings; optional dictionary disclosure; global answers remain separate | Planned |
| 333 | Teaching-first mnemonics | Project learning mnemonics/hints precede related materials; private text stays in My Notes | Planned |
| 334 | Bounded relationships | Compact previews, explicit more/less, honest loaded/server totals, related kana respects hidden-reading policy | Planned |
| 335 | Focused attributed examples | Bounded examples with labelled selected translations, honest missing values, unchanged attribution/reveal | Planned |
| 336 | Safe personal editor states | No impossible card submission, no editing unloaded note snapshots, clear unsaved note state | Planned |
| 337 | Responsive material layout | Low-clutter study/notes/history/source layouts, phone text fit, light/dark, no nested section cards | Planned |
| 338 | Batched acceptance | Scoped unit/API/browser tests, web build/typecheck, touched lint/format, screenshots | Planned |
| 339 | Release | Commit/push/tag, exact deployed revision, API liveness, real material navigation, resource cleanup | Planned |

## Boundaries And Checks

No new dependencies, copied competitor assets/data, corpus/course publication,
migrations/seeds, account resets, SRS or answer-validation changes. Kana remains
outside SRS. Existing source attribution stays accessible. No private text,
credentials, progress dumps or detailed Neon exports in Git reports.

Browsing options are URL-only; no private responses/drafts are persisted in
storage. No automatic retry/replay of POST/PATCH/DELETE. Optional-read failure
does not prove saved data is absent: disable the note editor until its snapshot
loads. Do not cancel writes and report them as unrecorded. Owner checks reject
late responses, including 401 after a new login. Reading concealment covers
structured readings, not arbitrary mnemonic prose that may mention kana.

Batch pure view/translation/preview tests, API signal cases and item browser
scenarios on desktop/phone. Cover slow/failed notes, explicit recovery, late
owners, view Back/reload, hidden readings, audio cancellation, previews and
private writes. Run no repeated full local monorepo suite. Cloud CI supplies
broader regression coverage. Keep screenshots/test output outside Git and close
temporary browser tabs and owned servers before finishing.
