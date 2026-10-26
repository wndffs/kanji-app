# Visual Hierarchy And UX Cycle 250-264

Baseline: `1426c6f`. Fifteen tasks, separate commits, batched checks, a release
tag and live acceptance. Next unused task after this cycle: 265.

## Design Brief

The previous cycle improved reachability but the product still feels like a
collection of similarly weighted panels. Establish a neutral canvas, deliberate
type hierarchy and fewer competing boxes. Put study actions before onboarding
and statistics. Keep Japanese material central, metadata quiet and recovery
controls explicit. Original design only: no WaniKani assets, CSS or content.

| ID  | Scope               | Acceptance                                                                                                              | State   |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------- |
| 250 | Neutral surfaces    | Distinct canvas, working surface and subject accents in light/dark; no external fonts or dependency                     | Planned |
| 251 | Navigation identity | Desktop has one current destination; kana still maps to Symbols on phones; grouped navigation stays compact             | Planned |
| 252 | Study summary       | Two actionable study tiles dominate; burned/difficult counts remain visible but secondary, with exact values            | Planned |
| 253 | Dashboard order     | Study summary appears before optional beginner guide; custom widget visibility/order remain intact                      | Planned |
| 254 | Course progress     | One concise progress summary; exact pass rules accessible without losing completed/regressed state                      | Planned |
| 255 | Forecast scan       | Count-proportional visual bars use real buckets, readable labels and honest empty/vacation states                       | Planned |
| 256 | Lesson composition  | Stable glyph-led teaching area, distinct primary reading and bounded explanation width on phones/desktops               | Planned |
| 257 | Review composition  | Prompt and answer form read as one focused workspace; metadata stays quiet; feedback and IME behavior unchanged         | Planned |
| 258 | Kana composition    | Unframed exercise with bounded choice grid; actual prompt/actions remain above phone navigation                         | Planned |
| 259 | Kana lesson path    | Original lesson ordinal and active/locked/mastered identity survive search/filter, without altering unlocks             | Planned |
| 260 | Character catalogue | Glyph-first tile hierarchy with explicit state and readable meanings; no excessive metadata weight                      | Planned |
| 261 | Item composition    | Clear material identity, meaning/reading hierarchy and lighter metadata; hidden readings remain hidden                  | Planned |
| 262 | Search scan         | Compact aligned expression/reading/meaning rows, bounded metadata and clear whole-row hover/focus                       | Planned |
| 263 | Appearance preview  | Actual local draft theme/density shown in preview; original select, explicit Save and Discard retained                  | Planned |
| 264 | Course library      | Current course is visually distinct, explicit navigation versus enrollment actions; descriptions/counts remain accurate | Planned |

## Boundaries And Checks

No API/schema/import/seed/course publication, SRS scheduling, answer validation,
private progress or RU/EN/RU+EN changes. Kana stays outside SRS. No curriculum
expansion is claimed. Only aggregated source reports may leave Neon.

Run changed-file format/lint, relevant unit cases, production build/typecheck
and browser flows for touched learner routes in batches, not after each commit.
Add regressions for structural changes, original kana numbering, theme draft
preview and responsive layouts. Inspect actual desktop/phone screenshots in
both themes. Verify published SHA and bounded server smoke after all tasks.
Keep temporary outputs outside Git, stop owned servers and close temporary IAB
tabs. Do not count overlapping reruns as additional independent coverage.

## Acceptance

Implementation: 15/15 tasks committed separately (`24c9480` through `3b00220`).
Acceptance remains pending. Added focused assertions for one current navigation
destination at each breakpoint, forecast proportions, secondary counters,
onboarding position, original kana lesson numbering, current course identity
and draft/Discard preview state. A pre-check review also repaired the search
row's phone grid override. No API or data changes are included.
