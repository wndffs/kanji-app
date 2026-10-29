# Cycle 475–489: Kana and Private Study

## Scope

Start from released V7 (`3a616d4`, runtime `620c120`): 117 kanji, 180 word pairs, 686 core cards. This cycle changes study tools, not the sealed curriculum, dictionary corpus or SRS stages. Kana remains separate from kanji/word SRS. Keep all accounts, progress, private overrides and finite source seals.

The existing app already has typing, recognition, reverse choice, matching, synthetic listening and KanjiVG tracing. Improve those flows instead of adding duplicate modes. Text decks currently create immediately from substring matching, cannot preview/correct choices, and do not use a morphological analyzer. Add a bounded private preview/selection workflow, reusable dictionary additions and useful grouping while preserving owner checks.

## Revalidated Tasks

| ID  | Concrete Delivery                                                                                           | State   |
| --- | ----------------------------------------------------------------------------------------------------------- | ------- |
| 475 | Audit current kana/deck paths and freeze this contract                                                      | Done    |
| 476 | Shared alias-safe kana distractors with variant/visual contrasts                                            | Pending |
| 477 | Specific RU/EN confusion feedback for common shape/mark/small-kana errors                                   | Pending |
| 478 | Lock matching answers during submission, expose corrections and honest session pacing                       | Pending |
| 479 | Density-independent ordered tracing geometry; one-pointer/cancel/retry recovery                             | Pending |
| 480 | Explicit synthetic kana audio, safe playback/fallback and sokuon context                                    | Pending |
| 481 | Bounded short-session length choice, preserving active sessions and separate kana progress                  | Pending |
| 482 | Document actual text segmentation, ambiguity and query-budget limitations                                   | Pending |
| 483 | Local proven ICU word segmentation with explicit bounded dictionary fallback, no external text transmission | Pending |
| 484 | Read-only text preview and private corrections before deck creation                                         | Pending |
| 485 | Add published dictionary materials to owned decks without duplicate cards/state                             | Pending |
| 486 | Scan/filter private library and deck contents; clear lesson entry and pacing                                | Pending |
| 487 | Owner/status/concurrency guards for new mutations and cross-account recovery                                | Pending |
| 488 | Two independent patch reviews, focused batched checks and responsive acceptance                             | Pending |
| 489 | Commit/push, deploy exact runtime, verify server and record release                                         | Pending |

## Acceptance and Boundaries

- Original project-authored feedback only; no competitor content, assets or scraping. Existing KanjiVG attribution remains. No kana `LearningCard` or `UserSrsState` writes.
- Displayed kana choices cannot share accepted romanizations. Real equivalent readings must not be presented as uniquely distinguishable by sound.
- Preserve active kana sessions, unconfirmed answers and completed trace strokes. No silent retry of mutations; no completion claim from a failed request.
- Text analysis uses only existing published materials. Preview is read-only; create revalidates submitted IDs against the submitted text. No raw dictionary row is automatically made into teaching content.
- No new production dependency, schema change or full dictionary import unless the audit proves it necessary. ICU is segmentation, not lemmatization, translation or a complete morphological analyzer.
- New deck mutations are owner-scoped, bounded and idempotent for the same material. They never change shared answers, another user's deck or any SRS state.
- Tests/checks batched and scoped locally. Full existing CI runs remotely; production checks use isolated test data. Detailed private observations and screenshots stay outside Git.

## Audit

Observed gaps: lesson distractors only de-duplicate canonical romaji, not aliases; adaptive distractors favour row distance over common shape contrasts; tracing checks nearest-distance rather than ordered path geometry and has no pointer ownership; adaptive listening bypasses the existing sokuon speech context; text decks enumerate arbitrary substrings up to eight codepoints and create before user review. Two bounded independent reviewers are auditing these paths and will review the resulting patch.

## Release

Not released. Task 490 is outside this cycle.
