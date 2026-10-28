# Focused Review Workspace 355-369

Baseline: `c871bb6`. This request implements 355-369 only. Next batch is
370-384; do not begin it here. Follow `ROADMAP_340_399.md` with the observed
gaps and measurable acceptance below.

## Findings

ReviewsClient has a read revision counter but no account-keyed remount,
AbortSignal or current-token guard. Its settings response can overwrite a newer
login. Opening a fully answered active session automatically POSTs finish.
The lobby shows card counts but not distinct materials, and its preview is a
fixed six-item slice. Due dates are available but not shown; feedback uses the
browser timezone instead of the selected user timezone. Failed answers retain
text, but there is no read-only reconciliation path before deliberate retry.
The private-answer feedback editor is not keyed to its card. Enter-only review
and listening concealment already work and must be preserved, not rebuilt.

| ID  | Deliverable                 | Acceptance                                                                                              | State    |
| --- | --------------------------- | ------------------------------------------------------------------------------------------------------- | -------- |
| 355 | Audit and specification     | Record actual gaps, preserve existing working review/correction behavior                                | Complete |
| 356 | Owner and request isolation | Account/token remount, cancellable reads, stale 200/401/settings/write guards and single-flight actions | Complete |
| 357 | Local read recovery         | Explicit queue retry and refresh, existing lobby retained on refresh failure, no write replay           | Complete |
| 358 | Focused review lobby        | One primary start, optional settings and queue detail, useful empty/vacation/error actions              | Complete |
| 359 | Honest counts               | Distinct cards/materials; pending corrections separate from original answers and accuracy               | Complete |
| 360 | Queue inspection filters    | URL kind/prompt/level/pages over loaded data only; start still uses the full authoritative queue        | Complete |
| 361 | Zoned due times             | Actual dueAt and feedback dates use validated user timezone, explicit missing/invalid values            | Complete |
| 362 | Prompt hierarchy            | Meaning/reading/listening clear, no pre-answer reading/meaning/audio transcript leaks, IME-safe submit  | Complete |
| 363 | Precise feedback            | Retry/typo/wrong/reveal/ignore/correction remain distinct; private editor belongs to current card       | Complete |
| 364 | Unconfirmed-write recovery  | Retain answer, explicit read-only reconciliation, no automatic resend or false completion               | Complete |
| 365 | Keyboard and focus          | Same-turn duplicate actions blocked; answer/feedback/retry/private-save focus remains usable            | Complete |
| 366 | Responsive controls         | Compact lobby, long feedback fit, phone/small-height answer and continuation controls                   | Complete |
| 367 | Confirmed completion        | Opening/resuming is read-only; explicit finish checkpoint after all work, honest summary/next route     | Complete |
| 368 | Batched acceptance          | Scoped helpers/API/browser tests, build/types, touched lint/format and both-theme screenshots           | Complete |
| 369 | Release                     | Commit/push/tag, exact health revisions, read-only real review entry, CI, cleanup                       | Planned  |

## Boundaries

No dependency, backend schema/migration/seed, corpus publication or account reset.
No change to grading, typo tolerance, stages, scheduling, correction policy,
private-answer scope or vacation behavior. The API remains authoritative.
Due-preview filters are browsing options, not selection of a smaller session.
The queue DTO contains due cards, not a future schedule: never invent forecast
times or claim all future scheduled work is covered. No educational dataset,
competitor wording/assets or unlicensed content is introduced.

No tokens, answers, progress snapshots or private text in URL/storage/reports.
Local filters may be URL-backed; no per-keystroke API reads. Reads can be
cancelled; writes are not cancelled or automatically replayed. Reconciliation
cannot infer that a lost response means the answer was not saved. Opening a
live review may resume an existing snapshot but must not start/answer/finish it.

Batch focused helper/API tests and the review browser family; repair narrowly.
Keep existing listening, vacation, correction accuracy, alternate-reading and
private-answer cases. Test old-owner 200/401, pending actions, failed refresh,
same-turn filters, timezone, concealment, IME, ambiguous writes and explicit
finish. Capture desktop/phone/short-height states outside Git. Use cloud CI for
broad regressions; close IAB tabs/owned servers and remove temporary outputs.

## Local Acceptance

Implemented 356-367 within the existing review API contract. Web GET adapters
now accept cancellation; no API business logic, schema, seed, dependency or
grading/scheduling rule changed. Queue filters inspect due cards only; they do
not select a smaller session or expose hidden readings/listening transcripts.

- Focused workspace-helper and API-adapter units: **35 passed** in two files.
- Final production build, web TypeScript (including tests), touched-file ESLint
  and Prettier passed. No full local monorepo suite was run.
- Main review browser batch: **76/78 passed**. Both failures were one synthetic
  IME test calling Playwright fill after compositionstart, which ended that
  composition. Fill now precedes compositionstart and waits for input focus.
  Four focused IME/short-height cases passed on desktop and phone.
- Visual inspection found a narrow two-column session header splitting its
  title. It now stacks below 600px. Light/dark lobby, prompt and long-feedback
  screenshots were inspected; final prompt/short-height captures were renewed.
- Follow-up inspection found an aborted refresh signal could be reused by
  settings/continuation reads. Each now gets a fresh cancellable controller.
  Regression cases cover changing order and completing after failed refresh.
  An already-answered start snapshot also shows the explicit finish checkpoint.
  All **10 final focused cases** passed on desktop and phone.
- All **84 review cases** have passed across the main and focused runs. Coverage
  includes old-owner 200/401 and writes, failed reads, no automatic replay,
  ambiguous-answer reconciliation (not saved/next card/answered snapshot),
  actual timezone dates, bounded URL filters/reload/Back, same-turn actions,
  private drafts, IME, listening, vacation and original correction accuracy.

Screenshots are outside Git under the task visualization directory,
`cycle-355-369/`. Full-page captures can place sticky controls over the captured
viewport; viewport images and bounds check actual fit. Short-height tests use a
480px viewport, not a real OS virtual keyboard. No claim of physical-keyboard
or device-keyboard acceptance is made. Owned test servers exited after each run.
No competitor content/assets or educational dataset was introduced.
