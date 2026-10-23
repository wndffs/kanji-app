# Daily-use Development Cycle 160-174

Baseline: `b76c26d`, verified runtime `4647341`, Foundation V4 unchanged.
Continue the user-authorized fifteen-task batches with separate commits,
batched relevant checks, push, then application release and remote verification.
This cycle finishes the learner surfaces outside the previous seven-screen pass.
No proprietary content, copied layouts or new course publication. Kana stays
outside SRS; existing card identity, private content and learning progress stay intact.

| ID  | Task                       | Acceptance                                                                                                                    | State    |
| --- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------- |
| 160 | My courses                 | Enrolled courses and current selection visible alongside available catalog; adding never silently switches                    | Accepted |
| 161 | Course switch confirmation | Explicit target confirmation, conflict recovery and no duplicate writes or progress reset                                     | Accepted |
| 162 | Character account boundary | Logout/switch drops old progress; late success/401 cannot replace a newer session; recoverable load error                     | Accepted |
| 163 | Character navigation       | Keyboard tabs with URL/back support and retained kanji filters across scripts                                                 | Accepted |
| 164 | Kana chart hierarchy       | Separate basic/modified/combined sounds without changing mastery; weak symbols and lessons remain reachable                   | Accepted |
| 165 | Bounded kanji catalog      | Filter first, render at most sixty rows per page; counts and all matches remain reachable                                     | Accepted |
| 166 | Search controls            | Query primary, optional filters disclosed, applied filters visible and independently removable with URL/page reset            | Accepted |
| 167 | Search result hierarchy    | Japanese, kana and translation primary; only real metadata, compact original rows and accessible navigation                   | Accepted |
| 168 | Private deck boundary      | Account switch clears text/drafts/results; stale create/archive/detail requests cannot affect new account                     | Accepted |
| 169 | Deck library               | Active/archive separation and title filtering, clear empty state, preserve archive/restore actions                            | Accepted |
| 170 | Intentional deck creation  | Builder opens on demand, draft retained while hidden, one submission, invalid limits rejected locally                         | Accepted |
| 171 | Deck learning path         | Filter items by type and new/started state without changing prerequisite ordering; optional technical reasons                 | Accepted |
| 172 | Private practice boundary  | Account change invalidates pending practice reads/writes and private feedback; newer login survives stale 401                 | Accepted |
| 173 | Focused practice           | Quiet session shell, keyboard source selection, concise bilingual feedback and completion next action; no SRS mutation        | Accepted |
| 174 | Responsive completion      | Consistent operational layouts, icons and mobile widths across the changed screens; screenshots and batched regression repair | Accepted |

Implementation: 15/15. Acceptance: 15/15. Release: verified.

Each task requires working behavior and focused regression coverage. Tests and
repair-only commits do not count toward fifteen. Full corpus expansion, licensed
audio coverage and the previous lesson API warm-latency follow-up remain separate
open work; this cycle does not claim N2 content completion or faster DB queries.
No new dependencies are planned. Close owned processes/tabs and keep temporary
test output outside the repository.

## Local Acceptance

All fifteen tasks are implemented in independent feature commits. The focused
production browser batch passed 58 cases initially. Four selector/name failures
were repaired and passed together with eight additional cases in the twelve-case
rerun (70 unique desktop/mobile cases total). Fourteen relevant unit cases passed;
web typecheck, changed-file lint, formatting and production build passed.

The first full CI run `39972150532` passed Quality and 248 browser cases but found
one transient duplicate completion-link selector. The repair scopes the link to
the result region and independently waits for restored global navigation, with
no arbitrary sleeps and no removed assertions. Its focused desktop/mobile pair
passed. Commit `2b96230` changes only that browser test; runtime source remains
`c51cbbf9af39005eb1190cc5a3789b258600dc4e`. Test-only build filters intentionally
avoid an identical web/API deployment. Final cloud and server evidence follows.

## Remaining Product Work

The cycle improves daily usability, not dictionary/course completeness. Foundation
V4 remains 101 kanji, 120 words, 79 components and 521 cards across seven levels;
the long-term independent course target remains 2,300 kanji and 8,000 words.
Continue reviewed content batches and lesson-API performance work next, rather
than claiming the full corpus or final whole-product release is complete.
The next unused task ID is 175; old numbered acceptance gates remain stable.

## Verified Release: 2026-10-23

Runtime and release tag: `c51cbbf9af39005eb1190cc5a3789b258600dc4e`,
`cycle-160-174-ux`. Main additionally contains the test-only repair `2b96230`;
no application source differs between that CI revision and the deployed runtime.

- [Final CI 39973389767](https://github.com/wndffs/kanji-app/actions/runs/39973389767)
  passed Quality and **249 production browser cases**, one intentional skip.
  Its first browser job stalled in Ubuntu package downloads for over seven
  minutes before any test ran; it was cancelled and only unsuccessful jobs were
  rerun on a fresh runner. Attempt two passed. Do not classify that installation
  stall as a code failure or weaken browser assertions to avoid it.
- [PostgreSQL study integrity 39973389535](https://github.com/wndffs/kanji-app/actions/runs/39973389535)
  passed at the final CI revision. No migrations or data imports were required.
- Initial [remote smoke 39975308266](https://github.com/wndffs/kanji-app/actions/runs/39975308266)
  stopped at `/ready` with HTTP 503 before registering its test account. A
  subsequent readiness check reported the database available. Fresh
  [remote smoke 39975892416](https://github.com/wndffs/kanji-app/actions/runs/39975892416)
  passed with exact web/API SHA matching on existing Foundation V4. It used its
  own disposable account; the user-requested profile was not enrolled/switched.
- Three HTTP samples per route had medians: dashboard 905 ms, lessons 2102 ms,
  reviews 291 ms, characters 507 ms, item 665 ms. Lessons still exceeded the
  2000 ms warm target. These small-corpus samples do not establish CWV, full-course
  performance, naturally earned level progression or a live review answer (the
  new audit profile had an empty review queue).
- IAB verified the new enrolled/available course library with the test profile's
  starter demo still selected. Search found the published word 小学生 with kana
  しょうがくせい and its Russian meaning. At 393x852 there was no horizontal page
  overflow. 学校 was not in the currently published results; search is not a claim
  of complete JMdict/course coverage. Hiding/reopening the deck builder retained
  the draft locally; it was not submitted to the server.
- Representative desktop/mobile screenshots cover course confirmation, deck
  library, kanji pagination, search and focused practice. The final validation is
  not an exhaustive real-device or assistive-technology audit.

Remaining operational follow-ups include lesson-query latency and bounded
cold-start readiness handling; a successful warmed retry does not close them.
New dependencies: none. Existing independent content and source licenses are
unchanged; no WaniKani content, CSS or layout was copied. No new Neon course
version was published during this UI/functional cycle.

Owned local smoke servers and temporary build output were removed. Viewport
overrides were reset, screenshots saved outside the repository, and temporary
IAB tabs closed. Only intentional source, tests and documentation remain.
