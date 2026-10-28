# Course Path And Content 370-384

Baseline: `2708352`. Implements 370-384 only. Next batch is 385-399.
One numbered commit per task; scoped checks are batched before release.

## Audit

Published placements are already distinct from imported dictionary rows, but
the course explorer exposes only item totals. It has no per-level/band/JLPT
learning-answer gap report, no current-course next-step entry and no actionable
prerequisite state. Its reading field may be a target-resolved taught reading
or dictionary fallback, without identifying which. Item details already separate dictionary evidence and
accepted answers and already group relations; extend those rather than rebuild.

The last verified publication was V4: 79 components, 101 kanji, 120 words,
300 items and 521 cards. These are historical evidence, not a fresh Neon audit.
The local reviewed registry has the same kanji/word volume. Pending draft07
has nine components, ten kanji and twenty word-reading pairs (69 proposed cards).
It is outside curator inputs. Its bilingual prose exists but exact-source
resolution and independent review are not complete. data/raw has no full local
snapshot; fixtures must never be presented as complete source evidence.

## Acceptance

| Task | Deliverable                                                                                           | State    |
| ---- | ----------------------------------------------------------------------------------------------------- | -------- |
| 370  | Audit and bounded specification; distinguish published/imported/draft                                 | Complete |
| 371  | Authenticated, read-only aggregate published coverage by level/band/JLPT and RU/EN/reading gaps       | Complete |
| 372  | Current-course next step from authoritative lesson queue, honest unavailable/non-current states       | Complete |
| 373  | Bounded prerequisite details and links; all required cards/stages checked, no eligibility bypass      | Complete |
| 374  | Component/kanji relationship context and navigable study links without conflating shapes and meanings | Complete |
| 375  | Kanji/vocabulary reinforcement with explicit taught versus dictionary reading evidence                | Complete |
| 376  | Consistent selected meaning/reading presentation in course cards, explicit missing selection          | Complete |
| 377  | Reserve existing draft07 as the next bounded wave, not another unreviewed expansion                   | Complete |
| 378  | Prepare original Russian wave review notes and conservative accepted-meaning gates                    | Complete |
| 379  | Matching English review notes and bilingual missing-content checks                                    | Complete |
| 380  | Validate kana readings and alternatives without claiming source attestation                           | Complete |
| 381  | Validate independent placement/prerequisites and explicit provenance blockers                         | Complete |
| 382  | Reproducible aggregate readiness CLI/report; no detailed Neon export                                  | Complete |
| 383  | Scoped helper/API/content/browser acceptance, responsive screenshots, types/build/lint                | Complete |
| 384  | Commit/push/version, deploy code, exact health revisions, read-only live acceptance and CI            | Planned  |

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

## Local Acceptance

Implemented 371-382 with no database write, source download, dependency, schema
or publication change. The report reads only published structured placements,
non-listening cards and project-authored global answers. It contains no raw
dictionary rows or private progress/text. Declared empty levels stay visible
with zero counts. Coverage is loaded explicitly once per owner/course view;
grouping does not issue requests. The same all-required-card stage predicate is
used by lesson eligibility and prerequisite explanations, without changing it.

- **108 unique relevant unit cases** passed: shared aggregates/stage predicate
  (9), wave validation (13), API/course/lesson eligibility (57), web course/item
  routes and reading modes (29). API/shared/DB/web types and production web build
  passed. Touched-file ESLint and formatting passed.
- Initial browser batch passed 45/50. Four failures were test assumptions:
  getByLabel exact versus the actual combobox accessible name, and expecting a
  redundant view=study in the canonical default-study URL. The fifth exposed
  a real phone layout regression: new controls pushed the first material under
  navigation. Coverage now follows the material list, and the unqueried next
  step is compact. All six affected desktop/phone scenarios then passed.
- All **50 scoped browser scenarios** have passed across the main and focused
  runs. They cover no automatic coverage read, local grouping, explicit retry,
  current/non-current course behavior without switching, old-owner 401,
  prerequisites, selected/fallback fields, related course-return links, whole-word
  reinforcement, reading concealment, bounded relation previews and existing
  catalogue history/filter/progress behavior.
- Local aggregate wave report passes structural checks for 9 components,
  10 kanji, 20 word pairs, 20 examples and 69 proposed cards. Strict
  --require-ready exits 1 as expected. Independent review, exact source
  evidence and authorization remain blockers; reviewed/published volumes are
  not increased by this batch.

Desktop/phone light/dark coverage captures and viewport images are outside Git.
The table scrolls within its own container on narrow screens; the document does
not overflow. No claim of OS virtual-keyboard or live-write acceptance is made.
The existing Vite config-loader warning is unrelated to these changes.

## Release Candidate

Code acceptance: `5a664bdebf15ab0fffc74b275320b97888172b3f`.
Release tag: `cycle-370-384-course-path`. Push all fifteen numbered commits
together. Verify exact web/API health revisions and cloud CI. Live acceptance
is read-only: open a published course, inspect aggregate coverage and selected
versus fallback fields, and use prerequisite/related navigation where the real
profile has such data. Do not enroll, switch courses, start/answer lessons,
save preferences or publish draft07 to manufacture acceptance states.

The wave CLI and review notes are development artifacts only. No source IDs,
course content, account state or Neon data are published by this release.
