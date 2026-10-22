# Remote Smoke: 2026-10-22

## Scope

Manual browser checks against [Vercel](https://kanji-app-rho.vercel.app) and
[Render](https://kanji-srs-api.onrender.com), with read-only verification in
Neon PostgreSQL 18. A new disposable audit profile was used; no existing
learner account was changed. Credentials are not recorded here.

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

## Automated Complement

[CI run 39748375728](https://github.com/wndffs/kanji-app/actions/runs/39748375728)
passed quality and the complete production-bundle browser smoke job.
[Study integrity run 39748375800](https://github.com/wndffs/kanji-app/actions/runs/39748375800)
passed the isolated PostgreSQL 18 workflow. These checks complement the live
browser sequence; mocks and local test databases are not described as live
learner coverage.

## Still Required

Task 124 remains incomplete: full-corpus quality/publication, complete remote
desktop/mobile route coverage, storage/audio checks if enabled, backup restore,
rollback rehearsal and whole-product security/accessibility sign-off.
