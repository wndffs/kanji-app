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

| ID | Scope | Acceptance | State |
| --- | --- | --- | --- |
| 220 | Visual foundations | Shared multi-hue light/dark tokens, typography and form/action primitives | Implemented |
| 221 | Application navigation | Desktop rail, mobile bottom navigation, active routes and focus-shell preservation | Implemented |
| 222 | Dashboard | One clear daily action, linked counters and scannable course progress | Implemented |
| 223 | Lessons | Clean queue selection, subject hierarchy, focused study and mandatory quiz | Implemented |
| 224 | Reviews and practice | Stable prompt/answer/feedback composition without answer leakage or SRS changes | Implemented |
| 225 | Kana and character hub | Distinct script controls, clear mastery path, readable exercise/character surfaces | Implemented |
| 226 | Item details | Japanese/reading/meaning hierarchy, accessible tabs and optional personal/source details | Implemented |
| 227 | Courses | Compact catalog and level workspace, subject accents, preserved search/filter/history | Implemented |
| 228 | Search | Search-first layout, compact bilingual results, restrained filters and metadata | Pending |
| 229 | Decks | Scannable private library and text-mining workspace without nested panels | Pending |
| 230 | Settings | Legible preference groups, live appearance preview and unobscured save actions | Pending |
| 231 | Authentication | Original compact login/register presentation with unchanged validation | Pending |
| 232 | Loading/error/empty states | Consistent recoverable statuses, skeletons and dialogs without false success | Pending |
| 233 | Responsive and density polish | 360/390/768/1280 layout, long labels, compact mode and large study text | Pending |
| 234 | Focus and motion polish | Keyboard-visible navigation, safe focus targets, reduced motion and visual acceptance | Pending |

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

Implementation and acceptance pending.
