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

| ID | Scope | Acceptance | State |
| --- | --- | --- | --- |
| 235 | Desktop destinations | Courses, kana, decks, practice and settings are directly reachable; current destination is marked; phone keeps five primary tabs | Implemented |
| 236 | Overflow navigation | Arrow/Home/End navigation, Escape return, short-screen scrolling and icon labels work without duplicating primary navigation | Implemented |
| 237 | Forecast summary | Dashboard exposes honest upcoming counts and the first populated bucket without opening the full forecast; empty/vacation states remain accurate | Implemented |
| 238 | Dashboard targets | Whole actionable metric tiles are links, counters remain real, compact widgets do not stretch into large empty grid rows | Implemented |
| 239 | Lesson selection | Selection count and Start remain reachable while editing a long group; limits, suggested selection and mandatory quiz are unchanged | Implemented |
| 240 | Lesson phase navigation | Meaning/reading/context labels fit phones and large text; visited phases and current phase are visually distinct, without unlocking quiz answers | Implemented |
| 241 | Review queue overview | Meaning/reading/listening counts summarize the actual queue; start action remains primary and does not alter review ordering or scheduling | Planned |
| 242 | Review feedback | Result has a clear icon/text identity and Continue remains reachable while details are expanded; retry/correction/typo/reveal semantics stay intact | Planned |
| 243 | Kana first viewport | Compact script/mode/mastery composition brings the actual exercise and action above phone navigation; mastery stays outside SRS | Planned |
| 244 | Kana lesson finder | Search lesson title/glyph/romaji, filter existing kana groups, clear an empty search, retain chosen lesson and script safely | Planned |
| 245 | Character filter recovery | Applied kanji filters and one-step reset are visible without losing the active script; filter/history/pagination remain correct | Planned |
| 246 | Reading utility | Explicit icon action copies only an already-visible kana reading, reports success/failure and never exposes a hidden reading | Planned |
| 247 | Search recovery | Failed search can retry the same submitted query/page/filters in place; no unsubmitted draft or stale response is substituted | Planned |
| 248 | Private library recovery | Retry a failed library read without losing the text-builder draft; empty filtered results have a clear reset action | Planned |
| 249 | Settings draft safety | Discard restores the last confirmed settings and preview; delayed load/save responses cannot overwrite another account or a later local edit | Planned |

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

Implementation and release acceptance are pending.
