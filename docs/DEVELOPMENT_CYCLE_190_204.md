# Development Cycle 190-204

Baseline: `1e86b77`. User-authorized fifteen-task development cycle, independent
feature commits and batched relevant checks, then push, application release and
live verification. Repair/test/documentation commits do not count as tasks.

| ID  | Scope                   | Acceptance                                                                                      | State    |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------- | -------- |
| 190 | Published syllabus API  | Authenticated read-only outline excludes draft courses/items and reports real level counts      | Accepted |
| 191 | Course explorer         | Dedicated owner-scoped screen with loading, login, missing course and retry states              | Accepted |
| 192 | Level materials API     | Stable 30-item pages hydrate only requested published items                                     | Accepted |
| 193 | Level material grid     | Read-only links to components/kanji/words with count and page navigation                        | Accepted |
| 194 | Material kind filters   | Course-level filtering before pagination, not by global levelHint                               | Accepted |
| 195 | Study-state filters     | New/learning/burned uses own complete eligible card sets before pagination                      | Accepted |
| 196 | Learning presentation   | Canonical kana and curated RU/EN/both meanings on material tiles                                | Accepted |
| 197 | Explorer URL lifecycle  | Reload/back/forward retain level, filters and page without stale results                        | Accepted |
| 198 | Level navigation        | Adjacent published levels and direct level selection reset item page deliberately               | Accepted |
| 199 | Course navigation links | Catalog/library/dashboard link to read-only course/level views without enrollment/switch writes | Accepted |
| 200 | Kana account boundary   | Account changes reset old learning drafts/results and fence old responses                       | Accepted |
| 201 | Adaptive kana isolation | Old reads/writes/401 cannot change newer exercise/session or clear newer login                  | Accepted |
| 202 | Kana deep links         | Unit/character links open only matching unlocked lessons, never mark learned                    | Accepted |
| 203 | Kana recovery           | In-place retry preserves route/script selection, no automatic answer replay                     | Accepted |
| 204 | Draft evidence workflow | Manual read-only source report against existing Neon imports, no curation/publication           | Accepted |

Course exploration does not unlock, enroll, select a course or change SRS. Kana
remains separate lessons/mastery, not SRS. Published educational content remains
V4 unless independent review and the existing strict publication gates pass;
draft07 remains a proposal, not an implicit upgrade. No new dependencies or
proprietary data are planned. Temporary artifacts stay outside the repository.

## Local Acceptance

Implementation: 15/15 independent functional commits. Local acceptance: 15/15.
Cloud CI and live release verification: passed. Next unused task number: 205.

Seventy-one relevant unit cases passed. Web/API/DB typechecks, changed-file
ESLint, formatting and the production web build passed. Sixty focused production
browser cases passed across desktop/mobile course, character and kana flows.
The first browser batch stopped on newly added selector/fixture issues: the
framework's second alert, labels containing option text and a missing saved
RU+EN setting. These were repaired without removing assertions or adding sleeps;
the complete affected batch then passed. JSX and UUID-return-link defects found
by earlier checks were fixed before the accepted build.

Syllabus metadata contains only published structured courses and published
placements. Level progress reads the selected level's lightweight card metadata,
with SRS states scoped to the authenticated user and the existing listening
eligibility rules. Kind and study state are filtered before stable pagination;
only the selected thirty item payloads are hydrated. Metadata itself scales with
one level, not a constant bound or a claimed whole-course SQL budget.

Task204 uses an aggregate-only alternative. The detailed JSON artifact proposal
was blocked by automatic risk review because external row-level data transfer
was not separately authorized. The committed workflow accepts no arbitrary input,
prints fixed numeric coverage and approval-false fields, uploads no artifact,
does no migration/seed/curation/publication, and keeps the secret out of dependency
installation. Detailed external artifacts remain excluded unless authorized.

There is no new dependency, dictionary import or curriculum publication. Published
V4 remains 101 kanji / 120 words. Draft07 still needs independent source/content
review; count-only evidence is not approval and does not reduce the content backlog.

## Verified Release: 2026-10-23

Runtime: `8a9b3cf297f14a419c5f358d689c0a997ac4fe1d`.
Release tag: `cycle-190-204-courses`, pointing to the deployed runtime rather than
an educational-content seal. Final tested source head:
`6a1139bd4e17365735e3abb8c8fd61eca7bbb8ff`; its only later change is a browser-test
assertion. Documentation-only release evidence does not change runtime source.

- [CI 39992852012](https://github.com/wndffs/kanji-app/actions/runs/39992852012)
  passed Quality and 273 production browser cases, with one intentional skip.
  An earlier full run exposed an asynchronous listening-test assertion reading
  the captured request before fetch completed. It now polls the same exact
  payload assertion; no production practice behavior or assertion was weakened.
- [Study integrity 39992851968](https://github.com/wndffs/kanji-app/actions/runs/39992851968)
  passed against PostgreSQL 18. No migration, dictionary import or seed was
  required on Neon.
- Both live health endpoints reported the exact runtime SHA. The final layout
  repair keeps material tiles in the first viewport, places optional course
  description/all-level lists below them, and retains stacked mobile filters.
- [Remote smoke 39994067700](https://github.com/wndffs/kanji-app/actions/runs/39994067700)
  passed with exact web/API SHA matching and a separate disposable V4 audit
  account. Median HTTP times over three samples: dashboard 933 ms, lessons 517 ms,
  reviews 214 ms, characters 782 ms, item 638 ms. Both warm samples per route met
  2000 ms. This is a small finite-course API measurement, not browser CWV or a
  full N2 corpus benchmark. The new account has no naturally due reviews.
- Live IAB checks opened V4 level five without enrolling or switching the named
  test profile, displayed 30 of its 80 words per page, opened page two, restored
  page one through history, and returned from the canonical word detail to the
  same course/level/filter. Kana readings and RU+EN meanings were present.
  The original Russian display mode was restored afterwards.
- At 393 x 852 and desktop sizes, material tiles were visible in the first
  viewport. Mobile document width equaled client width, without horizontal
  overflow. The character-hub link opened the unlocked vowels lesson directly
  at `i`; no answer, mastery or SRS progress was submitted during live UI checks.
- [Draft coverage 39991707454](https://github.com/wndffs/kanji-app/actions/runs/39991707454)
  passed the read-only aggregate inspection: ten kanji targets/readings/priority
  matches/stroke links and twenty word targets/source links/bilingual imports.
  `publicationApproved` remains false. Presence/counts are not independent
  provenance or pedagogical approval; no draft was applied or published.

Local unique browser coverage is 62 cases: the sixty-case affected batch plus
two focused listening-assertion cases. The later twelve-case explorer rerun
overlaps the sixty and is not added again. Seventy-one relevant unit cases passed.
Full cloud CI is recorded separately rather than added to local unique totals.

Published V4 remains 79 components, 101 kanji, 120 words, 300 items, 521 cards,
120 original bilingual examples and seven levels. The reviewed content backlog
remains 2199 kanji / 7880 words toward the planned main course. Draft07 and the
main course remain unpublished. No new dependency, license or proprietary content
was introduced. Existing licensed source layers and original teaching wording
remain separate.

Owned local Node servers were stopped; generated builds and temporary test
outputs were removed. Live screenshots remain outside the repository. Temporary
IAB tabs were closed after verification.
