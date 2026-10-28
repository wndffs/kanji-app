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

| ID | Deliverable | Acceptance | State |
| --- | --- | --- | --- |
| 355 | Audit and specification | Record actual gaps, preserve existing working review/correction behavior | Complete |
| 356 | Owner and request isolation | Account/token remount, cancellable reads, stale 200/401/settings/write guards and single-flight actions | Planned |
| 357 | Local read recovery | Explicit queue retry and refresh, existing lobby retained on refresh failure, no write replay | Planned |
| 358 | Focused review lobby | One primary start, optional settings and queue detail, useful empty/vacation/error actions | Planned |
| 359 | Honest counts | Distinct cards/materials; pending corrections separate from original answers and accuracy | Planned |
| 360 | Queue inspection filters | URL kind/prompt/level/pages over loaded data only; start still uses the full authoritative queue | Planned |
| 361 | Zoned due times | Actual dueAt and feedback dates use validated user timezone, explicit missing/invalid values | Planned |
| 362 | Prompt hierarchy | Meaning/reading/listening clear, no pre-answer reading/meaning/audio transcript leaks, IME-safe submit | Planned |
| 363 | Precise feedback | Retry/typo/wrong/reveal/ignore/correction remain distinct; private editor belongs to current card | Planned |
| 364 | Unconfirmed-write recovery | Retain answer, explicit read-only reconciliation, no automatic resend or false completion | Planned |
| 365 | Keyboard and focus | Same-turn duplicate actions blocked; answer/feedback/retry/private-save focus remains usable | Planned |
| 366 | Responsive controls | Compact lobby, long feedback fit, phone/small-height answer and continuation controls | Planned |
| 367 | Confirmed completion | Opening/resuming is read-only; explicit finish checkpoint after all work, honest summary/next route | Planned |
| 368 | Batched acceptance | Scoped helpers/API/browser tests, build/types, touched lint/format and both-theme screenshots | Planned |
| 369 | Release | Commit/push/tag, exact health revisions, read-only real review entry, CI, cleanup | Planned |

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
