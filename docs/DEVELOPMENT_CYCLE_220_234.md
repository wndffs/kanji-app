# Design Cycle 220-234

Baseline: `591b1d8`. User-approved original learner-product redesign. Fifteen
separate task commits, batched relevant checks, push, application deployment and
live verification. Repairs and release evidence are not extra functional tasks.

## Product Specification

The daily action and Japanese learning material are primary. Secondary metadata,
filters, sources and editing tools stay available without competing with them.
Desktop uses a permanent navigation rail; mobile uses a compact header and
bottom navigation. Active study keeps a distraction-free shell. This is the
working application, not a landing page or a visual clone of WaniKani.

Use a neutral light/charcoal dark system, teal commands, and distinct blue,
coral and amber subject accents. Define shared typography, spacing, borders,
focus, density and motion tokens. Use existing Lucide icons and original app
assets, not decorative stock images. No new font/network/runtime dependency.
Japanese glyphs and licensed stroke graphics are the product's primary media.

Sections are unframed content bands. Cards are for repeated materials, counters,
dialogs and genuinely framed study tools, never nested section cards. Keep
readable Japanese, stable answer controls, real counts and existing explicit
meaning/reading phases. Do not reveal quiz answers early.

| ID  | Scope                         | Acceptance                                                                               | State       |
| --- | ----------------------------- | ---------------------------------------------------------------------------------------- | ----------- |
| 220 | Visual foundations            | Shared multi-hue light/dark tokens, typography and form/action primitives                | Implemented |
| 221 | Application navigation        | Desktop rail, mobile bottom navigation, active routes and focus-shell preservation       | Implemented |
| 222 | Dashboard                     | One clear daily action, linked counters and scannable course progress                    | Implemented |
| 223 | Lessons                       | Clean queue selection, subject hierarchy, focused study and mandatory quiz               | Implemented |
| 224 | Reviews and practice          | Stable prompt/answer/feedback composition without answer leakage or SRS changes          | Implemented |
| 225 | Kana and character hub        | Distinct script controls, clear mastery path, readable exercise/character surfaces       | Implemented |
| 226 | Item details                  | Japanese/reading/meaning hierarchy, accessible tabs and optional personal/source details | Implemented |
| 227 | Courses                       | Compact catalog and level workspace, subject accents, preserved search/filter/history    | Implemented |
| 228 | Search                        | Search-first layout, compact bilingual results, restrained filters and metadata          | Implemented |
| 229 | Decks                         | Scannable private library and text-mining workspace without nested panels                | Implemented |
| 230 | Settings                      | Legible preference groups, live appearance preview and unobscured save actions           | Implemented |
| 231 | Authentication                | Original compact login/register presentation with unchanged validation                   | Implemented |
| 232 | Loading/error/empty states    | Consistent recoverable statuses, skeletons and dialogs without false success             | Implemented |
| 233 | Responsive and density polish | 360/390/768/1280 layout, long labels, compact mode and large study text                  | Implemented |
| 234 | Focus and motion polish       | Keyboard-visible navigation, safe focus targets, reduced motion and visual acceptance    | Implemented |

## Invariants

No educational publication, course switch, progress reset, SRS rule change,
answer-validation change, dependency addition or migration is required. RU/EN/
RU+EN modes, user settings, private content and kana's separate mastery remain.
Neon reports remain aggregate-only. Existing V4 content and seals are unchanged.
The main course's 2300-kanji/8000-word target is not completed by visual work.

## Verification

Run changed-file lint, typechecks, relevant tests and production browser flows
in batches. Verify desktop/mobile screenshots, no horizontal overflow, both
themes, increased text, navigation/focus, and unchanged mandatory learning checks.
Publish only after the fifteen tasks and local acceptance; confirm exact live
web/API revisions and server smoke. Store screenshots and temporary outputs
outside the repository, stop owned processes and close temporary IAB tabs.

Implementation: 15/15 separate task commits. Local batched acceptance passed:
32 relevant unit cases, web typecheck, changed-file ESLint, formatting and the
production build. The learner browser batch covered 249 distinct passing cases
and one intentional skip across desktop/mobile after the editor repair below.
The final targeted dashboard/design rerun passed all 34 cases; these overlap
the broader batch and are not added to its total. Cloud/live acceptance is pending.

The visual matrix covers 360/390/768/1280 px, light/dark themes, compact density,
extra-large Japanese, keyboard skip navigation and reduced motion. Screenshots
were inspected for the dashboard, lesson, item and settings surfaces. This is
not a complete screen-reader, physical-keyboard/IME or browser-zoom audit.

Batched review repaired three presentation issues: appearance drafts now apply
temporarily and restore saved preferences when leaving; untouched default
dashboards prioritize the course and collapse secondary analytics without
automatically saving or changing personal layouts; editor save actions remain
above mobile navigation even after scrolling its last row. A browser assertion
checks the button against the navigation's actual bounds, not only the viewport.

Live review also tightened the mobile course toolbar so a realistic long title
does not push the first complete material below navigation. The existing course
browser test now uses that title and checks the first material's bottom edge.
Full cloud smoke found an overflowing confirmation on a 390 x 360 viewport:
dialogs are now height-bounded with internal scrolling. Eight targeted course/
admin recovery cases passed after these repairs. A separate earlier course
rerun had one non-reproduced stale-session timeout; its four isolation cases
passed on the targeted rerun, without changing auth logic or weakening checks.

The live word page exposed a second overload source not represented by the tiny
fixture: many raw dictionary senses preceded examples and mnemonics. They now
have a closed-by-default native disclosure, retaining language filtering and
source attribution. Curated meanings and kana readings stay immediately visible.
All 24 item browser cases passed after this focused repair.

Initial bundle measurement covered five static routes: 131415 B raw / 22416 B
gzip CSS and at most 209207 B gzip initial JS, within existing per-route budgets.
The dynamic item/kana HTML was not captured by this local measurement, so it
reported incomplete (5/7), not a full performance-budget pass or a CWV result.
