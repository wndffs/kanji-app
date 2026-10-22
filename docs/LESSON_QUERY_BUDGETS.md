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

## Prerequisite Cards

Canonical prerequisite-card lookup deduplicates requested learning-item IDs
before querying sequential chunks of at most 100, using the existing target
batch-size constant. Empty input performs no query. Its delegate-call budget is
`ceil(unique requested prerequisite item IDs / 100)`; 101 IDs require two
calls and 201 require three. Focused tests also cover 1,001 IDs with eleven
calls, with at most one in-flight query and no arbitrary item or card limit.

Every batch retains the published-item filter, listening query eligibility,
selected audio source/license fields and the existing post-query audio eligibility
check. All returned meaning/reading and eligible listening card IDs are retained,
independently of user progress. Repeated input IDs do not duplicate card IDs.
Missing/unpublished items or items with no eligible cards have no map entry;
the existing service nonempty-card guard keeps those prerequisites locked.
No recovery lookup, `take`, dropped tail or partial-success fallback is added.
If any batch fails, the entire lookup rejects and no subsequent batch starts.

Evidence: `apps/api/test/lesson-prerequisite-batching.test.ts` covers boundaries,
duplicate IDs spanning boundaries, complete card sets, listening eligibility,
missing/ineligible-only items, later-batch failure and sequential execution.
Existing lesson tests retain the service-level all-required-cards and missing-card
fail-closed checks. Counts are Prisma delegate calls, not measured SQL statements;
relation loading can produce additional SQL. Full graph size, endpoint latency
and browser Core Web Vitals remain unmeasured. This slice does not complete Task123.

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
