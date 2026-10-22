# Resumable Reviews and Corrections (Task 125)

New scheduled sessions persist a bounded, versioned card-ID snapshot in
`ReviewSession.statsJson`. This is not a second SRS system. No schema migration
is required, and legacy sessions without the snapshot retain their old finish
behavior.

## API Contract

- `POST /reviews/start` creates one owner-locked session or returns the existing
  active snapshot. Empty queues return 400; duplicate starts cannot create two
  versioned sessions for one owner.
- `GET /reviews/active` returns the owner's active session, remaining scheduled
  items, remaining corrective items and original review statistics. `items`
  contains only unanswered cards, so `currentIndex` is zero. The progress DTO
  preserves total/answered counts for the original position label.
- `POST /reviews/:id/answer` is the scheduling operation. A card belongs to the
  snapshot and can have only one original answer; concurrency guards remain.
- `POST /reviews/:id/correction` validates an original missed/revealed card with
  the same private, blocked and reading rules. It changes only corrected-card
  IDs through a guarded session update. It never writes `UserSrsState` or adds
  another `ReviewAnswer`.
- `POST /reviews/:id/finish` rejects new-format sessions with unanswered cards or
  unfinished corrections. Original accuracy, errors and scheduling transitions
  are retained. Corrective success does not erase the original error.

Wrong corrective answers do not clear a step. Alternative taught-reading
diagnostics are neutral retries, not ordinary errors. Successful correction
replay is idempotent, including after finish. A stale device receives the
authoritative `corrected` state even if its current submitted answer is wrong;
the UI does not mistake that persisted state for another scheduling result.

## Learner Flow

The client completes scheduled prompts first, then re-presents missed cards in
a separate correction phase. Enter submits and advances; a wrong corrective
answer returns to the same prompt. Feedback identifies that SRS is unchanged.
Reload restores only unanswered steps. Reload after the final persisted
correction can safely finish the session. A failed write leaves the answer
available for retry and never displays completion.

Vacation pauses the scheduled snapshot without deleting it. After vacation is
disabled, the client resumes it. Private answer edits remain available in
feedback. Older API deployments without `/reviews/active` are handled only for
an explicit 404; other server failures are not silently converted into empty
queues or successful sessions.

## Verification and Limits

Focused service/repository tests cover ownership, wrong session modes,
snapshot integrity, duplicate starts, stale correction writes, original
statistics, blocked/private answers, neutral reading retries and legacy
compatibility. Browser cases cover desktop/mobile correction, interrupted
scheduled prompts, reload, vacation and failed saves. The PostgreSQL integrity
workflow also includes real versioned-session/correction cases.

[Task 125 PostgreSQL run 39747194550](https://github.com/wndffs/kanji-app/actions/runs/39747194550)
passed all 30 cases on 2026-10-22, including concurrent starts, resumable
wrong/reveal originals and overlapping correction writes. This proves the
repository behavior against a real isolated database, not a whole-production
or full-corpus certification.

Queues remain capped at 100 cards. The existing target hydration queries are
not a claim of a measured low query count; production-scale latency/query
budgets remain Task 123. A withdrawn/unavailable snapshot card produces a
conflict rather than silently discarding progress. Explicit recovery for
withdrawn editorial material remains operational follow-up.
