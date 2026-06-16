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

## Leech detection

Start simple:

- Track wrongCount and correctStreak.
- A card is a leech candidate if wrongCount is high and recent mistakes persist.
- Add API/UI later to show leeches and extra mnemonics.
