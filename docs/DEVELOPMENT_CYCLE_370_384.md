# Course Path And Content 370-384

Baseline: `2708352`. Implements 370-384 only. Next batch is 385-399.
One numbered commit per task; scoped checks are batched before release.

## Audit

Published placements are already distinct from imported dictionary rows, but
the course explorer exposes only item totals. It has no per-level/band/JLPT
learning-answer gap report, no current-course next-step entry and no actionable
prerequisite state. Its reading field comes from the dictionary target rather
than the reading card. Item details already separate dictionary evidence and
accepted answers and already group relations; extend those rather than rebuild.

The last verified publication was V4: 79 components, 101 kanji, 120 words,
300 items and 521 cards. These are historical evidence, not a fresh Neon audit.
The local reviewed registry has the same kanji/word volume. Pending draft07
has nine components, ten kanji and twenty word-reading pairs (69 proposed cards).
It is outside curator inputs. Its bilingual prose exists but exact-source
resolution and independent review are not complete. data/raw has no full local
snapshot; fixtures must never be presented as complete source evidence.

## Acceptance

| Task | Deliverable | State |
| --- | --- | --- |
| 370 | Audit and bounded specification; distinguish published/imported/draft | Complete |
| 371 | Authenticated, read-only aggregate published coverage by level/band/JLPT and RU/EN/reading gaps | Planned |
| 372 | Current-course next step from authoritative lesson queue, honest unavailable/non-current states | Planned |
| 373 | Bounded prerequisite details and links; all required cards/stages checked, no eligibility bypass | Planned |
| 374 | Component/kanji relationship context and navigable study links without conflating shapes and meanings | Planned |
| 375 | Kanji/vocabulary reinforcement with explicit taught versus dictionary reading evidence | Planned |
| 376 | Consistent selected meaning/reading presentation in course cards, explicit missing selection | Planned |
| 377 | Reserve existing draft07 as the next bounded wave, not another unreviewed expansion | Planned |
| 378 | Prepare original Russian wave review notes and conservative accepted-meaning gates | Planned |
| 379 | Matching English review notes and bilingual missing-content checks | Planned |
| 380 | Validate kana readings and alternatives without claiming source attestation | Planned |
| 381 | Validate independent placement/prerequisites and explicit provenance blockers | Planned |
| 382 | Reproducible aggregate readiness CLI/report; no detailed Neon export | Planned |
| 383 | Scoped helper/API/content/browser acceptance, responsive screenshots, types/build/lint | Planned |
| 384 | Commit/push/version, deploy code, exact health revisions, read-only live acceptance and CI | Planned |

## Boundaries

No database write/migration/seed/import, content publication or account reset.
No automatic promotion of draft07, source-ID invention, seal changes or
independent-review claim for AI-authored content. Runtime coverage counts
published course placements only; imported dictionary volume and draft readiness
are different scopes. JLPT labels are stored metadata, not proof of exam coverage.
Reports in Git contain aggregates only. No new dataset download, dependency,
competitor content/assets or SRS/answer-grading change. Kana stays outside SRS.

Prerequisite explanations are read-only observations, not a promise that daily
budget, vacation, course selection or active-session rules allow starting.
Reuse existing lesson eligibility rules; the server still validates starts.
Only explicitly requested coverage reads run, with no polling or extra reads
per filter. Reject stale owners; preserve course navigation context where valid.
Batch local tests and use cloud CI for broad regressions. Keep all screenshots
outside Git; close owned browser tabs/servers and remove generated outputs.
