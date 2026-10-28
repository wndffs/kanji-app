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
| 369 | Release                     | Commit/push/tag, exact health revisions, read-only real review entry, CI, cleanup                       | Complete |

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

## Release Candidate

Code acceptance commit: `19d58c0e1229fd39ceda44cc667d72406576b0fe`.
Release tag: `cycle-355-369-reviews`. Push the 15 numbered commits together
through the existing GitHub/Vercel/Render integrations. Verify the exact web
and API revisions, cloud CI and real read-only review entry. Opening/resuming
must not start, answer, correct or finish a live session. Do not change the
account's settings to manufacture a particular acceptance state.

No schema operation, seed, course publication or Neon content change is part
of this release. Next batch is 370-384; none of those tasks has started.

## Server Acceptance

On 2026-10-28 both public health endpoints returned the released full revision
`b97f57b0a2e5b4d0d28bde69e51610d8869e6ae9`. Vercel reported deployment
success. The API also returned production/local-auth and healthy status.

Read-only IAB acceptance opened the actual authenticated review lobby: two due
cards, two materials and two meaning prompts. The expanded preview showed the
real due timestamps in the profile's Europe/Moscow timezone. Selecting reading
produced the honest 0/2 empty state without changing the two-card Start action.
Reset restored both cards; level 1 survived reload, and browser Back restored
the unfiltered URL. There was one Start button and no horizontal document
overflow. No review was started, answered, corrected or finished; no settings,
account, corpus or progress data was changed.

The available live profile had only two meaning prompts, so larger pagination,
listening, active-session recovery, private-answer writes and phone/theme
acceptance remain controlled local production-browser coverage, not live-write
claims. The real-server screenshot is outside Git at
`cycle-355-369/live-reviews.png` in the task visualization directory.

The temporary IAB tab is closed. Owned Next/Playwright processes exited. Local
`.next`, TypeScript build info and cycle-specific test output were removed after
preserving final screenshots. Cloud quality and both Study integrity runs have
passed. Initial broad web smoke ran 454 cases: 451 passed, one skipped, and the
desktop/phone MVP integration path failed because its assertion still used the
old queue-counter label. Its expectation is updated to the actual new caption;
no application behavior or other test expectation is weakened. The follow-up
verification and final runtime revision are recorded below after completion.

The scoped integration repeat passed **6/6 on the production build**, covering
desktop and phone registration/lesson/review/private-answer/item flow. A prior
dev-server repeat passed 5/6 and aborted one dashboard navigation before the
changed assertion; it is not counted as a clean run. Production build/types,
the changed integration file's ESLint and Prettier passed. The test-only repair
is released under `cycle-355-369-reviews.1`; the original tag is not moved.

## Completed Release

All 355-369 are complete, individually committed and pushed, with one additional
test-only CI repair. Original runtime tag: `cycle-355-369-reviews`. Final patch
tag: `cycle-355-369-reviews.1`, commit
`3ff02fc097012350f3eecf505a0fefc66a8b9e70`.

[CI 40710885018](https://github.com/wndffs/kanji-app/actions/runs/40710885018)
succeeded. Quality job 122895514834 passed. Web smoke job 122897228027 ran 454
cases: **453 passed, one skipped, zero failed** in 3.0 minutes. Both Study
integrity runs 40710886706 and 40710885294 succeeded. The original failed CI run
40708902912 is superseded by this verified successful run, not concealed.

The runtime remains `b97f57b0a2e5b4d0d28bde69e51610d8869e6ae9` on web and API.
The patch changes only the integration test and this report; Vercel explicitly
reported `Canceled by Ignored Build Step`, and Render's existing ignoredPaths
also excludes those files. No extra deployment is needed to apply the tested
runtime code. The final report-only commit does not move either tag or replace
the checked runtime revision.

No owned server/test process, temporary browser tab or cycle build/test output
remains. Screenshots are preserved outside Git. No Neon data, private content,
account, progress, dependency or license boundary changed. Next task is **370**.
