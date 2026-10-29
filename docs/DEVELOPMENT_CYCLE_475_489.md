# Cycle 475–489: Kana and Private Study

## Scope

Start from released V7 (`3a616d4`, runtime `620c120`): 117 kanji, 180 word pairs, 686 core cards. This cycle changes study tools, not the sealed curriculum, dictionary corpus or SRS stages. Kana remains separate from kanji/word SRS. Keep all accounts, progress, private overrides and finite source seals.

The existing app already has typing, recognition, reverse choice, matching, synthetic listening and KanjiVG tracing. Improve those flows instead of adding duplicate modes. Text decks currently create immediately from substring matching, cannot preview/correct choices, and do not use a morphological analyzer. Add a bounded private preview/selection workflow, reusable dictionary additions and useful grouping while preserving owner checks.

## Revalidated Tasks

| ID  | Concrete Delivery                                                                                           | State |
| --- | ----------------------------------------------------------------------------------------------------------- | ----- |
| 475 | Audit current kana/deck paths and freeze this contract                                                      | Done  |
| 476 | Shared alias-safe kana distractors with variant/visual contrasts                                            | Done  |
| 477 | Specific RU/EN confusion feedback for common shape/mark/small-kana errors                                   | Done  |
| 478 | Lock matching answers during submission, expose corrections and honest session pacing                       | Done  |
| 479 | Density-independent ordered tracing geometry; one-pointer/cancel/retry recovery                             | Done  |
| 480 | Explicit synthetic kana audio, safe playback/fallback and sokuon context                                    | Done  |
| 481 | Bounded short-session length choice, preserving active sessions and separate kana progress                  | Done  |
| 482 | Document actual text segmentation, ambiguity and query-budget limitations                                   | Done  |
| 483 | Local proven ICU word segmentation with explicit bounded dictionary fallback, no external text transmission | Done  |
| 484 | Read-only text preview and private corrections before deck creation                                         | Done  |
| 485 | Add published dictionary materials to owned decks without duplicate cards/state                             | Done  |
| 486 | Scan/filter private library and deck contents; clear lesson entry and pacing                                | Done  |
| 487 | Owner/status/concurrency guards for new mutations and cross-account recovery                                | Done  |
| 488 | Two independent patch reviews, focused batched checks and responsive acceptance                             | Done  |
| 489 | Commit/push, deploy exact runtime, verify server and record release                                         | Done  |

## Acceptance and Boundaries

- Original project-authored feedback only; no competitor content, assets or scraping. Existing KanjiVG attribution remains. No kana `LearningCard` or `UserSrsState` writes.
- Displayed kana choices cannot share accepted romanizations. Real equivalent readings must not be presented as uniquely distinguishable by sound.
- Preserve active kana sessions, unconfirmed answers and completed trace strokes. No silent retry of mutations; no completion claim from a failed request.
- Text analysis uses only existing published materials. Preview is read-only; create revalidates submitted IDs against the submitted text. No raw dictionary row is automatically made into teaching content.
- No new production dependency, schema change or full dictionary import unless the audit proves it necessary. ICU is segmentation, not lemmatization, translation or a complete morphological analyzer.
- New deck mutations are owner-scoped, bounded and idempotent for the same material. They never change shared answers, another user's deck or any SRS state.
- Tests/checks batched and scoped locally. Full existing CI runs remotely; production checks use isolated test data. Detailed private observations and screenshots stay outside Git.

## Audit

Observed gaps: lesson distractors only de-duplicate canonical romaji, not aliases; adaptive distractors favour row distance over common shape contrasts; tracing checks nearest-distance rather than ordered path geometry and has no pointer ownership; adaptive listening bypasses the existing sokuon speech context; text decks enumerate arbitrary substrings up to eight codepoints and create before user review. Two bounded independent reviewers audited these paths and reviewed the resulting patch; their findings were integrated before release.

## Release

Released as `cycle-475-489-kana-private-study`. Web and API both report exact runtime `876f84b5f2f79b191cfb800014da0903952375dc`. The release receipt is documentation-only and intentionally does not replace that verified deployment. Task 490 is outside this cycle.

## Implementation And Review

Two independent read-only reviewers inspected kana and private-deck paths. Applied their concrete findings: frozen matching rounds despite newly unlocked rows; stable trace callbacks, short-stroke direction checks and explicit retry; practice-only evidence no longer updates lesson mastery or permanently outranks unseen kana. Account ownership is checked before dispatch and after responses. Changed text selections require a fresh plan before saving, including prerequisite warnings. High-fanout prerequisite results are bounded before target hydration. Multiword deck search preserves word boundaries.

Mining budgets are explicit: 2,048 normalized candidates, 512 kanji, 320 published matches, 512 prerequisite materials/16 traversal rounds, 160 saved memberships and 12 mining/edit requests per user per minute. ICU boundaries are not a lemmatizer: inflected forms are not silently invented. Only already-published exact identities can be selected, and create revalidates them. Selection spans refer back to the supplied text. Missing prerequisites outside the saved-item cap are reported, not silently marked learned.

Custom additions/removals use canonical material IDs, the existing unique membership constraint and a parameterized owner-row lock. There are no new LearningCards, global accepted answers, SRS writes, schema changes or production dependencies. Removing a membership does not delete its learning history. Deck browsing groups components/kanji/words/sentences and filters learning state and RU/EN readings/meanings. The lesson link opens the existing separate picker, batch limit, daily budget and prerequisite gates; discovery filters do not bypass those rules or silently start a lesson.

Focused local acceptance: 31 Japanese-helper tests, 26 API tests and 15 web-helper tests passed; API/web/Japanese/shared typechecks, changed-source lint and formatting passed. New repository-boundary tests omit mastery/SRS delegates entirely, so accidental access fails. Existing full CI runs remotely. Browser acceptance exposed a genuine duplicate sibling-key bug that prevented closing a saved deck; fixed with distinct details/dictionary keys, retaining the regression test.

## Verified Release

- [CI 40958959644](https://github.com/wndffs/kanji-app/actions/runs/40958959644) passed Quality and web smoke: 487 browser cases passed, one existing skip. Includes desktop/mobile fixture coverage and the new preview correction and dictionary membership regressions. The earlier failed closing test was fixed in production code, not removed or relaxed.
- [Study integrity 40958959646](https://github.com/wndffs/kanji-app/actions/runs/40958959646) passed on PostgreSQL 18.
- [Final V7 remote smoke 40959790975](https://github.com/wndffs/kanji-app/actions/runs/40959790975) passed against the exact web/API runtime above. An earlier smoke on `e2c2292` also passed before the final UI-only repairs.
- Live built-in-browser acceptance created one isolated audit profile, previewed text without creating a deck, corrected a selected match, replanned and saved, added/removed a published dictionary word, verified the existing-member guard, closed/reopened the deck, filtered/grouped it and entered its original prerequisite-aware lesson picker without starting a lesson.
- Kana acceptance confirmed bilingual wrong-answer feedback, keyboard continuation, persisted position after reload and explicit tracing-to-reverse-choice fallback. The isolated profile has two practice attempts, zero lesson-mastery rows and zero SRS states. Historical mastery was deliberately preserved; this change prevents future casual practice from manufacturing lesson mastery rather than resetting old progress.
- All twelve baseline count/digest groups match: the original 27-account cohort and all eleven protected private-state tables, plus published course identities. No original-account course switch, answer, progress reset or private-answer edit. Only aggregate results are committed; digests and screenshots stay external.
- Warm runner medians from three samples per endpoint: dashboard 712 ms, lessons 430 ms, reviews 140 ms, characters 532 ms, item 490 ms. These are not cold-start or local VPN latency promises.

Live screenshots were visually inspected on the actual desktop viewport. The built-in-browser viewport override did not change the observed desktop dimensions in this run, so a live mobile screenshot is not claimed; mobile/theme acceptance comes from the CI browser fixtures. No external browser or local dev server was started. Reviewer agents and temporary browser tabs are closed after acceptance.

No teaching wave was published in this tools batch. Published V7 remains 117 kanji, 180 exact word pairs, 686 core cards and fifteen levels. ICU segmentation is not inflection recovery or full morphological analysis. No broad audio coverage or complete N4/N3 exam preparation is claimed. Next: 490–499, ten readiness/acceptance tasks, not another automatic content publication.
