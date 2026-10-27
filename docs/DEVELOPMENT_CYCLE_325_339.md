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

| ID  | Deliverable                       | Acceptance                                                                                                                | State     |
| --- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------- |
| 325 | Scope                             | Record observed gaps, exact boundaries and acceptance                                                                     | Complete  |
| 326 | Cancellable material reads        | Abort obsolete item/kanji/private/pair GETs; retain owner and 401 guards                                                  | Complete  |
| 327 | Independent private-note recovery | Public teaching renders without waiting for private notes; loading/error/retry is local; unsafe note writes stay disabled | Complete  |
| 328 | Bookmarkable material tabs        | Known view query survives reload and Back without extra material reads; preserve safe catalogue/course context            | Complete  |
| 329 | Bilingual hero meanings           | Label selected RU/EN rows and show absent translation explicitly, never substitute another language                       | Complete  |
| 330 | Focused material header           | Compact real level/JLPT/stage; schedule details reachable in History rather than duplicated above study                   | Complete  |
| 331 | Visible-reading audio             | Explicit browser speech for visible readings, respect existing voice/rate, cancel on hide/tab/item/unmount, no autoplay   | Complete  |
| 332 | Reading evidence hierarchy        | Hide switch covers taught/dictionary readings; optional dictionary disclosure; global answers remain separate             | Complete  |
| 333 | Teaching-first mnemonics          | Project learning mnemonics/hints precede related materials; private text stays in My Notes                                | Complete  |
| 334 | Bounded relationships             | Compact previews, explicit more/less, honest loaded/server totals, related kana respects hidden-reading policy            | Complete  |
| 335 | Focused attributed examples       | Bounded examples with labelled selected translations, honest missing values, unchanged attribution/reveal                 | Complete  |
| 336 | Safe personal editor states       | No impossible card submission, no editing unloaded note snapshots, clear unsaved note state                               | Complete  |
| 337 | Responsive material layout        | Low-clutter study/notes/history/source layouts, phone text fit, light/dark, no nested section cards                       | Complete  |
| 338 | Batched acceptance                | Scoped unit/API/browser tests, web build/typecheck, touched lint/format, screenshots                                      | Complete  |
| 339 | Release                           | Commit/push/tag, exact deployed revision, API liveness, real material navigation, resource cleanup                        | Releasing |

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

## Local Acceptance

Tasks 326-337 are implemented. No backend/schema/content changes were needed.
Optional notes no longer gate teaching; the editor and its saved-note list use
the confirmed private snapshot, never an inferred empty state during failure.
Only explicit user actions write personal answers/notes. Existing source links,
review history cursor handling and per-user answer scope remain unchanged.

- Five relevant unit files: **58 cases passed**. The first run's new API test
  incorrectly compared a `Headers` instance to a plain object; corrected it to
  read the authorization header using the structured API.
- Web production build and TypeScript passed. Touched-file ESLint and Prettier
  passed. No full local monorepo suite was run.
- Initial browser batch: 46/52 passed. Fixed three test scenarios: ambiguous
  taught/dictionary reading locator, missing attribution in a test fixture, and
  the old slash-joined hero translation assertion. All six focused cases passed.
- Screenshot review exposed excessive pre-tab whitespace. Reduced the header,
  placed audio beside reading/copy, moved confusables beside stroke detail and
  put the leech notice inside Study. Final-source browser batch: **50/52 passed**;
  the remaining case matched both a textarea and saved-list text. Scoped the
  locator to the saved list; both repaired cases and both slow-note cases passed.
  All 52 item scenarios have passed against final app source across these runs.
- Regressions cover slow/failed private reads, late old-owner 200/401, no false
  empty notes, preserved tabs/Back/reload/context without extra material GETs,
  hidden reading evidence, no speech autoplay, cancellation, loaded/server
  preview counts, attribution, bilingual absence, cardless forms and private
  write recovery. First-viewport tab bounds pass on desktop and phone.

Light/dark study and notes captures plus first-viewport images are stored outside
Git. Full-page captures are visual aids; fixed navigation is also checked in
viewport captures. Browser speech is synthesis, not a recorded native-speaker
asset. No new dataset or competitor material was used.

## Release Candidate

Code acceptance: `6792abde1f6eafe3bc62c95a89b35834a2b7e820`.
Version tag: `cycle-325-339-material`. Push all 15 task commits together through
the existing GitHub/Vercel/Render integrations. Confirm deployed full revisions,
API liveness and read-only material/tab/reading navigation with the existing
test profile. Do not publish a course or alter any account/progress/preferences
for acceptance. Cloud CI and final live evidence are recorded after deployment.
