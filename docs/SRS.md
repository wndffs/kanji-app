# SRS design

## Goal

Implement a deterministic, configurable SRS engine that schedules `LearningCard` reviews.

## Default MVP stages

The exact names are not important, but default intervals can start as:

1. Apprentice 1: 4 hours
2. Apprentice 2: 8 hours
3. Apprentice 3: 1 day
4. Apprentice 4: 2 days
5. Guru 1: 7 days
6. Guru 2: 14 days
7. Master: 30 days
8. Enlightened: 120 days
9. Burned: no next review

The stage list must be configurable. UI must not hardcode the schedule.

## Inputs

`calculateNextReview` should receive:

- current SRS state
- SRS stage config
- answer result
- current timestamp
- card metadata if needed
- mistake severity if needed

## Outputs

Return:

- previous stage
- next stage
- next availableAt
- whether burned
- penalty applied
- details useful for audit/debugging

## Mistake handling

MVP rule suggestion:

- Correct: advance by 1 stage unless already burned.
- Typo accepted: stay on current stage or advance based on strict mode.
- Wrong in early stages: demote 1 stage, minimum stage 1.
- Wrong in later stages: demote 2 stages or to a configured review floor.
- Reveal: count as wrong and do not advance.
- Resurrect burned: return to configured stage, e.g. Guru 1 or Apprentice 4.

## Forecast

Implement forecast by grouping due cards by hour/day using user timezone from settings.

## Review queue ordering

Review ordering is separate from scheduling. The repository selects only
non-burned cards whose `availableAt` is due, ordered oldest-first and capped by
the user's review budget. A saved presentation preset may then:

- deterministically shuffle that current batch for the learner's local day;
- preserve oldest-first order;
- place lower course levels first within the batch.

No preset changes `availableAt`, stage, streaks, mistake counts, review history,
or the membership of the budget-limited due batch. SRS state changes only when
an answer is recorded through the scheduler.

## Leech detection

Start simple:

- Track wrongCount and correctStreak.
- A card is a leech candidate if wrongCount is high and recent mistakes persist.
- Optional practice for recent lessons, recent mistakes, and burned cards is
  read-only with respect to SRS. Its answers do not change stages, due dates,
  streaks, wrong counts, or review history.
- Add API/UI later to show leeches and extra mnemonics.

MVP leech score is deterministic and intentionally simple:

```text
score =
  wrongCount * 2
  + recentWrongCount * 4
  + stageDropCount * 3
  + stageDropMagnitude * 1
  - correctStreak * 2
```

Clamp score to `0..100`. A non-burned card is a leech candidate at score `>= 12`.
Burned cards always have score `0` and are not leech candidates. A correct streak
is recovery evidence: each correct answer in the current streak reduces score by
2, so correct streaks lower or stabilize leech pressure and never increase it.
