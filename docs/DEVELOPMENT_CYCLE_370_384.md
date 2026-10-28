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
| 384  | Commit/push/version, deploy code, exact health revisions, read-only live acceptance and CI            | Complete |

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

## Server Acceptance

On 2026-10-28 both public health endpoints returned
`0be79ef135fc52c613060965bdf5879b8858a1b0`; Vercel reported deployment success.
The API health request took longer to return but completed successfully. This
single observation is not an attribution of delay to a query or cold start.

The real authenticated IAB session opened the published V4 course without
enrolling or switching from the existing starter course. Its on-demand report
confirmed **300 items: 79 components, 101 kanji, 120 words and 521 non-listening
cards across seven levels**. Missing selected RU answers: 0; EN: 0; reading
answers where applicable: 0. These are field-presence counts, not independent
pedagogical approval or proof of full N2 coverage.

JLPT grouping exposed sparse source metadata: N5 labels on two kanji and one
word; no stored JLPT on 99 kanji and 119 words. The 79 components are also in
the unassigned bucket. This does not mean those words/kanji are outside JLPT or
that other bands have been fully covered. Future content audits must account
for these unknown labels rather than filling them from guesses.

The next-step read correctly reported that V4 was not the current course and
did not offer to start its lessons or switch it. Level two showed selected
readings and real unsatisfied predecessor links/stage requirements. Opening a
component preserved the course/level return link; returning restored level two.
No enrollment, course switch, preference save, lesson/review action, import,
seed or content publication was submitted. No horizontal overflow was observed
in the live report. Current-course positive and phone/theme acceptance are
controlled local browser cases, not claims of live writes or live-mobile tests.

The live aggregate screenshot is outside Git at
`cycle-370-384/live-coverage.png` in the task visualization directory. The
temporary IAB tab is closed; owned local servers exited and cycle-specific
build/test output was removed after preserving final screenshots.

## Cross-Platform Layout Repair

Initial cloud CI 40718876986 passed Quality and 468 browser cases with one
skip, but the Linux phone first-material boundary still failed by 22px. The
optional next-step check now follows the material list, before coverage, rather
than spending first-viewport space above it. The strict geometry assertion was
not relaxed. Production build/types, targeted lint/format and all eight focused
desktop/phone next-step/coverage/paging cases passed after this repair.
Patch tag: `cycle-370-384-course-path.1`; the original tag is not moved.

Both public health endpoints subsequently returned patch revision
`d9614dd0c8ddb2ee7386cc598a23b01ccf804438`. A fresh real IAB visit verified
that materials precede the optional next-step block, level-two prerequisites
still render, and the aggregate report retains 300 items/521 cards with zero
RU/EN/reading gaps. Grouping by course stage remains separate from the sparse
JLPT-source labels described above. The final live screenshot was renewed;
the temporary tab was closed. No live writes were made during patch acceptance.

## Completed Release

All 370-384 are complete, individually committed and pushed, followed by the
cross-platform layout repair. Final tag: `cycle-370-384-course-path.1`.
Verified runtime and CI commit: `d9614dd0c8ddb2ee7386cc598a23b01ccf804438`.
The original `cycle-370-384-course-path` tag is retained unchanged.

[CI 40721147665](https://github.com/wndffs/kanji-app/actions/runs/40721147665)
succeeded. Quality job 122932060851 passed. Web smoke job 122933422411 ran
470 cases: **469 passed, one skipped, zero failed** in 4.4 minutes. Both Study
integrity runs 40721150557 and 40721147656 succeeded. The original Linux phone
failure is superseded by this passing run with the strict assertion retained.

The final report-only commit does not replace the verified runtime revision
or move either tag. No new course content was published; draft07 still requires
exact source evidence, independent review and separate publication permission.
Only aggregate source/live counts are retained in Git. All owned browser tabs
and local servers are closed; temporary build/test outputs are removed and
final screenshots remain outside Git. Next task is **385**; none of 385-399
has started.
