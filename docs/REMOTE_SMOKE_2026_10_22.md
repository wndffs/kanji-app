# Remote Smoke: 2026-10-22

## Scope

Manual browser checks against [Vercel](https://kanji-app-rho.vercel.app) and
[Render](https://kanji-srs-api.onrender.com), with read-only verification in
Neon PostgreSQL 18. A new disposable audit profile was used; no existing
learner account was changed. Its narrowly scoped synthetic progress and due-date
fixtures are disclosed below. Credentials are not recorded here.

This is bounded deployment evidence for Tasks 120, 125 and 124, not full-course
release approval, a complete mobile audit or backup-restore certification.

## Verified

- Registration succeeded and opened the dashboard.
- The account was enrolled in the published starter demo, not the DRAFT main
  course. The dashboard showed two available component lessons.
- The two-component lesson completed its mandatory typed meaning quiz. It
  created two SRS states at stage 1 with their first scheduled interval.
- To test reviews without waiting four hours, only those two new audit-profile
  states had `availableAt` advanced to the past. The update was restricted to
  the exact generated email, stage 1, no prior review and exactly two states.
  No production interval configuration or other account was changed.
- One wrong answer and one correct answer were submitted through the UI.
  Reload after the first answer resumed only the unanswered second card and
  retained the original error count.
- The wrong card returned in the separate correction phase. Correct retrieval
  displayed `SRS: Без изменений` and the session finished.
- The summary retained **2 answers, 1 correct, 1 error, 50% accuracy**. A Neon
  query confirmed exactly one `ReviewAnswer` per SRS state: the correction did
  not create a third scheduling answer. The original due timestamps and stages
  remained unchanged by correction.
- Settings saved RU+EN, light theme, compact interface, reduced motion and
  large Japanese text. Reload restored the selected presentation values; a
  Neon query confirmed all five values in the account's `UserSettings` row.
- The separate Hiragana lesson loaded and accepted `a` for あ, then advanced
  to い. Neon recorded one `UserKanaProgress` row while SRS still contained
  exactly two component states: kana practice did not enter SRS.
- On-demand `/health` and `/ready` returned HTTP 200; readiness reported the
  database available. Render liveness remains `/health`, not a continuous
  database poll.

## Published Pilot Acceptance

The independently versioned pilot was published by
[run 39784436544](https://github.com/wndffs/kanji-app/actions/runs/39784436544):
40 components, 40 kanji, 20 words, 100 items and 160 cards. These reuse main-course
identities; they are not additional dictionary content.

- `/courses` listed the published pilot but not the DRAFT main course. Explicit
  enrollment reported success while preserving the current starter course.
  Selecting the pilot separately persisted the new current course and reused
  the account's two existing component states, with no duplicate SRS state.
- To reach one complete prerequisite chain without waiting through every
  neighboring item, 153 missing states were inserted for this generated audit
  account only, for pilot cards whose component/kanji/word target was **not 月**.
  They used stage 2 and future availability. Conflict-ignore preserved the two
  original states. This is synthetic fixture progress, not evidence of learning
  the entire pilot or naturally earning those stages.
- The actual UI then taught component 月, accepted `луна`, and created one new
  stage-1 state. Kanji 月 unlocked next, displayed the distinct meaning `месяц`
  and historical JLPT label `до 2010: 4`, then accepted `げつ` and `месяц` in its
  mandatory quiz, creating two new stage-1 states.
- Only those two exact new audit-profile kanji states had their due timestamps
  advanced to test reviews. The actual three-card session answered their meaning
  and reading plus an already-due original component card: **3 answers, 3 correct,
  0 errors, 100% accuracy**. Both kanji cards advanced to stage 2 before the word
  became available. No global stage interval was changed.
- Word 月 then unlocked. Its lesson showed curated `луна / moon`, the word reading
  `つき` rather than kanji `げつ`, and the original example `月がよく見えます。`
  with kana, Russian and English plus project attribution. The mandatory quiz
  accepted `つき` and `луна`; completion reported **one item and two SRS cards**.
- A subsequent owner/item-scoped read-only query returned exactly five 月 states:
  component meaning at stage 1, kanji meaning/reading at stage 2 with one
  scheduling answer each, and word meaning/reading at stage 1 with no review yet.
- The item's global meaning list remained `луна / moon`, while raw dictionary
  senses remained separately labeled as dictionary data. A private Russian answer
  `лунный диск` was added through the UI and remained visible after reload. It did
  not replace the global meanings or answers. Cross-user isolation is additionally
  covered by automated owner-boundary tests, not claimed from this one login.

Saved browser evidence includes `pilot-enrollment-confirmed-2026-10-22.png`,
`pilot-kanji-reading-2026-10-22.png`, `pilot-kanji-review-complete-2026-10-22.png`,
`pilot-word-example-bilingual-2026-10-22.png` and
`pilot-private-answer-persisted-2026-10-22.png` in the agent-local visualization
directory, outside the repository.

## Expanded Pilot V2

[Publication 39820406188](https://github.com/wndffs/kanji-app/actions/runs/39820406188)
added the separately sealed v2 pilot: **53 components, 61 kanji, 60 words,
174 items and 295 cards**. V1 remained unchanged; neither is additional raw
dictionary content. Publication enrolled no users.

The existing disposable audit profile explicitly added v2 through `/courses`.
The success message stated that its current v1 course was unchanged. Separate
selection on the dashboard then persisted v2 and showed five available lessons.
Before enrollment, after enrollment and after selection, read-only Neon checks
retained **160 SRS states**, full-row digest
`5500e1242fb02d64ba1512677bd5ca39`, and private-override digest
`5c32549f6e6eb8200c328532151fb6ac`. The latter verifies preservation of the
private 月 answer. Current course changed only on explicit selection; v2 gained
exactly one enrollment for this profile. The 153 earlier synthetic states remain
fixtures, not whole-pilot learning evidence. No new answer or schedule write was
made in this transition check. Screenshot: `pilot-v2-selected-live-2026-10-22.png`.

[Manual remote smoke 39821968993](https://github.com/wndffs/kanji-app/actions/runs/39821968993)
at runner commit `1b4a209` independently registered a fresh profile, enrolled and
selected v2, validated reminder opt-out/hour-9 defaults and the exact disabled
claim response, then passed three samples each for dashboard, lessons, reviews,
characters and item. Reviews were empty and the first lesson was a component.
Its timings are in `REMOTE_PERFORMANCE.md`; it is not mobile rendering or a
runtime-SHA attestation.

## Automated Complement

After the final runtime change `4a5a8b3`,
[CI run 39798323986](https://github.com/wndffs/kanji-app/actions/runs/39798323986)
recorded **175 passed production-bundle browser cases** across desktop/mobile,
including the new installation metadata cases; the mobile-only sticky-input
case was intentionally skipped in the desktop project. Its quality job completed scoped
workspace lint, typechecks, unit tests and builds. The ordinary API unit run's
27 intentional PostgreSQL skips are not claimed as coverage: the separate
[Study integrity run 39798323604](https://github.com/wndffs/kanji-app/actions/runs/39798323604)
actually passed **41 cases against PostgreSQL 18**.

[CI run 39748375728](https://github.com/wndffs/kanji-app/actions/runs/39748375728)
passed quality and the complete production-bundle browser smoke job.
[Study integrity run 39748375800](https://github.com/wndffs/kanji-app/actions/runs/39748375800)
passed the isolated PostgreSQL 18 workflow. These checks complement the live
browser sequence; mocks and local test databases are not described as live
learner coverage.

## Still Required

Task 124 remains incomplete: full-corpus quality/publication, complete remote
desktop/mobile route coverage, storage/audio checks if enabled, retained-backup
and application-recovery policy, rollback rehearsal and whole-product
security/accessibility sign-off. The newer isolated snapshot/content-fingerprint
restore passed in run 39821158337, matching all 45 public table counts and hashes;
see `DATABASE_RESTORE_REHEARSAL.md` for exact limits and the older count-only run.
