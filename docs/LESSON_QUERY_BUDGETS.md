# Lesson Target Query Budgets

This is a bounded Task123 repair, not completion of the performance task and not
a production latency or end-to-end query-budget pass.

## Target Hydration

Course and deck lesson reads preload targets by exact `(targetType, targetId)`.
Each type uses `findMany` with an explicit ID set, in sequential chunks of at
most 100 unique IDs. There is at most one in-flight target-hydration call. No
whole target table is loaded and there is no per-item `findUnique` fallback.

The target delegate-call budget is:

`sum(ceil(unique requested IDs for each target type / 100))`

Measured by focused repository tests, for both course and deck paths:

| Input                                               | Previous target calls | Current target calls       |
| --------------------------------------------------- | --------------------- | -------------------------- |
| 101 distinct word targets                           | 101 `findUnique`      | 2 `findMany` (100 + 1 IDs) |
| One target of each of four types                    | 4 `findUnique`        | 4 `findMany`               |
| Word / kanji sharing an ID, repeated word reference | 3 `findUnique`        | 2 `findMany`               |
| Empty source                                        | 0                     | 0                          |

These are Prisma delegate-call counts, not captured PostgreSQL statement counts.
Prisma relation includes may issue additional SQL statements. No live database,
network timing, query planner, or production load measurements are claimed here.

## Preserved Contracts

- Target rows are mapped back to original source order; unordered query results
  and duplicate references do not reorder or remove lesson records.
- Kanji readings keep priority/reading order; meanings keep primary/locale/text
  order. Word senses keep locale/meaning order. Existing pure target mappings,
  locale flags, answers, private text, and source-kind behavior are unchanged.
- A missing target still raises the existing type-specific error, including for
  a single-item source. No silent omission or unbounded recovery query is used.
- Course/current-course filters, deck ownership, nested card/answer/audio/text
  includes, and prerequisite metadata are unchanged.
- Task126 example reads remain separate: at most three examples per lesson item,
  with 100-identity batches and the existing attribution/provenance validation.
- No new item limit is applied. Locked items needed for prerequisite calculation
  remain in the source result; only the pre-existing no-eligible-card filter
  remains in effect.

## Remaining Limits

The initial course enrollment/level/item metadata query still loads the full
selected published course graph, including nested cards, answers, dependencies,
and lesson text. Deck metadata also remains unpaginated. Returned records and
preloaded target maps therefore still scale with the source size. This patch
does not bound that graph, redesign prerequisite calculation, or establish a
complete endpoint memory/SQL/latency budget.

Evidence lives in `apps/api/test/lesson-target-batching.test.ts` and the existing
`apps/api/test/items-examples.test.ts`; the latter verifies the retained
three-example limit and attribution on 101-item course/deck sources.
