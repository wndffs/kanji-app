# Design And UX Cycle 235-249

Baseline: `45f714b`. Fifteen user-authorized tasks, separate functional commits,
batched checks, push, version tag and live acceptance. Repairs and release
evidence are not additional tasks. This extends the original visual system from
220-234; it is not another theme replacement or a WaniKani visual/content clone.

## Specification

Make frequent destinations and the next study action easy to reach. Replace
empty/collapsed primary information with concise real summaries. Keep optional
metadata behind disclosures. Preserve keyboard navigation, explicit Save,
readable Japanese and RU/EN/RU+EN. A phone's first study viewport should contain
the actual prompt and a reachable action, not only navigation and metadata.
Use existing Lucide icons, Japanese material and original application assets.
No new production dependency or externally hosted fonts/media are needed.

| ID  | Scope                     | Acceptance                                                                                                                                          | State    |
| --- | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 235 | Desktop destinations      | Courses, kana, decks, practice and settings are directly reachable; current destination is marked; phone keeps five primary tabs                    | Accepted |
| 236 | Overflow navigation       | Arrow/Home/End navigation, Escape return, short-screen scrolling and icon labels work without duplicating primary navigation                        | Accepted |
| 237 | Forecast summary          | Dashboard exposes honest upcoming counts and the first populated bucket without opening the full forecast; empty/vacation states remain accurate    | Accepted |
| 238 | Dashboard targets         | Whole actionable metric tiles are links, counters remain real, compact widgets do not stretch into large empty grid rows                            | Accepted |
| 239 | Lesson selection          | Selection count and Start remain reachable while editing a long group; limits, suggested selection and mandatory quiz are unchanged                 | Accepted |
| 240 | Lesson phase navigation   | Meaning/reading/context labels fit phones and large text; visited phases and current phase are visually distinct, without unlocking quiz answers    | Accepted |
| 241 | Review queue overview     | Meaning/reading/listening counts summarize the actual queue; start action remains primary and does not alter review ordering or scheduling          | Accepted |
| 242 | Review feedback           | Result has a clear icon/text identity and Continue remains reachable while details are expanded; retry/correction/typo/reveal semantics stay intact | Accepted |
| 243 | Kana first viewport       | Compact script/mode/mastery composition brings the actual exercise and action above phone navigation; mastery stays outside SRS                     | Accepted |
| 244 | Kana lesson finder        | Search lesson title/glyph/romaji, filter existing kana groups, clear an empty search, retain chosen lesson and script safely                        | Accepted |
| 245 | Character filter recovery | Applied kanji filters and one-step reset are visible without losing the active script; filter/history/pagination remain correct                     | Accepted |
| 246 | Reading utility           | Explicit icon action copies only an already-visible kana reading, reports success/failure and never exposes a hidden reading                        | Accepted |
| 247 | Search recovery           | Failed search can retry the same submitted query/page/filters in place; no unsubmitted draft or stale response is substituted                       | Accepted |
| 248 | Private library recovery  | Retry a failed library read without losing the text-builder draft; empty filtered results have a clear reset action                                 | Accepted |
| 249 | Settings draft safety     | Discard restores the last confirmed settings and preview; delayed load/save responses cannot overwrite another account or a later local edit        | Accepted |

## Boundaries

No course publication, enrollment, course switch, reset, import, seed, migration,
new dictionary data, SRS interval or answer-validation change. Existing private
answers, mnemonics and progress remain scoped to their owner. Only aggregate
Neon source reports may be exported. This batch does not complete the main
2300-kanji/8000-word curriculum. Existing license/attribution layers remain.

## Acceptance Plan

Run formatting/lint/typechecks for touched modules, relevant local unit cases,
then production browser cases for the changed routes in a batch. Add focused
regressions for new interactions and stale-session/error behavior. Inspect
desktop/phone screenshots, both themes, large Japanese and short viewports.
After all fifteen tasks, push and verify CI, exact live web/API SHA, the bounded
remote smoke and actual UI. Do not count overlapping reruns as extra coverage.
Keep artifacts outside Git; stop owned test servers and close temporary IAB tabs.

Implementation: 15/15 separate functional commits. Local acceptance: 40 relevant
unit cases, changed-file lint, production build/typecheck and 269 passing learner
browser cases with one intentional skip. These include keyboard menu controls,
sound-group search, hidden-reading clipboard boundaries, query/library retries,
cross-section discard and delayed settings load/save isolation (200/401).

Batched repairs clarified the kana group's exact accessible label and scoped
settings error assertions to the form rather than Next's route announcer. A
load revision also invalidates obsolete setup requests. Visual inspection moved
the default forecast to the top of a naturally packed second desktop column;
personal layouts keep their own grid. The final dashboard rerun passed all 16
cases (overlapping the broader batch). The final mobile-rail fix passed two
additional overlapping navigation cases. Cloud/live acceptance passed. No new
curriculum content is claimed.

## Verified Release: 2026-10-25

Runtime: `8a30f49a02e29bbaa8dc1ef1844de336093f5c95`.
Release tag: `cycle-235-249-ux`. Fifteen separate task commits plus batched
repairs and evidence. Next unused task number: 250.

- [CI 40198386767](https://github.com/wndffs/kanji-app/actions/runs/40198386767)
  passed Quality and 321 production browser cases with one intentional skip.
  Cloud and local cases overlap; their counts must not be added together.
- [Study integrity 40198386676](https://github.com/wndffs/kanji-app/actions/runs/40198386676)
  passed against PostgreSQL 18. No Neon migration, seed, import or
  educational publication was needed for these UI changes.
- Both live health endpoints returned the exact runtime SHA. The bounded
  [remote smoke 40198678309](https://github.com/wndffs/kanji-app/actions/runs/40198678309)
  passed exact revision gates on a separate disposable V4 audit account.
  The audit's course selection applies only to that new account.
  Three-sample HTTP medians: dashboard 708 ms, lessons 430 ms, reviews 168 ms,
  characters 510 ms and item 704 ms. Both warm samples per route met 2000 ms.
  These are finite-course API measurements, not browser CWV, a full N2 benchmark
  or a guarantee about free-hosting cold starts.
- Live IAB verification retained the existing profile's starter course, two due
  reviews and two available lessons. The review overview correctly reported
  two meaning questions. No learning answer or course switch was submitted in
  these UI checks. The existing unfinished lesson was left intact.
- The default desktop forecast was visible next to the course rather than
  below it. Direct library/settings navigation, current destination and actual
  source counters were inspected. Document/client widths were 1265 px, without
  horizontal overflow or broken visible images.
- On a 393 x 852 phone viewport, document/client widths were 378 px. Kana
  exercise choices ended at 663 px, above navigation at 788 px. Live review
  found and repaired an unwanted internal scrollbar: the navigation's client
  and outer widths are now both 378 px. Focus outlines remain unclipped.
- The real kana finder matched normalized romaji within a modified-sound group
  without changing the active lesson, unlocking a unit or writing an answer.
  Its search/group filters were reset after inspection. Clipboard success,
  denial and hidden-reading boundaries were verified with mocked browser
  clipboard writes, not by overwriting the user's live clipboard.
- Light-theme preview and Discard restored the confirmed system theme without
  Save. Both themes, compact density, large Japanese, short menus and delayed
  settings responses are also covered by the local browser batch. This is not
  a complete screen-reader, native mobile Safari or physical IME audit.

Live screenshots are saved outside Git. The temporary viewport was reset and
all temporary IAB tabs were closed. Owned Node test servers exited; generated
builds and temporary browser outputs were removed before final status checks.

No production dependency, external font, dataset or proprietary teaching asset
was introduced. Existing RU/EN modes, attribution/license layers, SRS and private
progress remain. Only aggregate source reporting is allowed; no detailed Neon
source report was exported. V4 remains the finite 101-kanji/120-word pilot; this
cycle does not expand the unpublished 2300-kanji/8000-word main-course target.
