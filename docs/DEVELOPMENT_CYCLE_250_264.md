# Visual Hierarchy And UX Cycle 250-264

Baseline: `1426c6f`. Fifteen tasks, separate commits, batched checks, a release
tag and live acceptance. Next unused task after this cycle: 265.

## Design Brief

The previous cycle improved reachability but the product still feels like a
collection of similarly weighted panels. Establish a neutral canvas, deliberate
type hierarchy and fewer competing boxes. Put study actions before onboarding
and statistics. Keep Japanese material central, metadata quiet and recovery
controls explicit. Original design only: no WaniKani assets, CSS or content.

| ID  | Scope               | Acceptance                                                                                                              | State    |
| --- | ------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------- |
| 250 | Neutral surfaces    | Distinct canvas, working surface and subject accents in light/dark; no external fonts or dependency                     | Accepted |
| 251 | Navigation identity | Desktop has one current destination; kana still maps to Symbols on phones; grouped navigation stays compact             | Accepted |
| 252 | Study summary       | Two actionable study tiles dominate; burned/difficult counts remain visible but secondary, with exact values            | Accepted |
| 253 | Dashboard order     | Study summary appears before optional beginner guide; custom widget visibility/order remain intact                      | Accepted |
| 254 | Course progress     | One concise progress summary; exact pass rules accessible without losing completed/regressed state                      | Accepted |
| 255 | Forecast scan       | Count-proportional visual bars use real buckets, readable labels and honest empty/vacation states                       | Accepted |
| 256 | Lesson composition  | Stable glyph-led teaching area, distinct primary reading and bounded explanation width on phones/desktops               | Accepted |
| 257 | Review composition  | Prompt and answer form read as one focused workspace; metadata stays quiet; feedback and IME behavior unchanged         | Accepted |
| 258 | Kana composition    | Unframed exercise with bounded choice grid; actual prompt/actions remain above phone navigation                         | Accepted |
| 259 | Kana lesson path    | Original lesson ordinal and active/locked/mastered identity survive search/filter, without altering unlocks             | Accepted |
| 260 | Character catalogue | Glyph-first tile hierarchy with explicit state and readable meanings; no excessive metadata weight                      | Accepted |
| 261 | Item composition    | Clear material identity, meaning/reading hierarchy and lighter metadata; hidden readings remain hidden                  | Accepted |
| 262 | Search scan         | Compact aligned expression/reading/meaning rows, bounded metadata and clear whole-row hover/focus                       | Accepted |
| 263 | Appearance preview  | Actual local draft theme/density shown in preview; original select, explicit Save and Discard retained                  | Accepted |
| 264 | Course library      | Current course is visually distinct, explicit navigation versus enrollment actions; descriptions/counts remain accurate | Accepted |

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
Final cloud/live acceptance passed. Added focused assertions for one current navigation
destination at each breakpoint, forecast proportions, secondary counters,
onboarding position, original kana lesson numbering, current course identity
and draft/Discard preview state. A pre-check review also repaired the search
row's phone grid override. No API/schema/course-content changes are included.

### Batched Results

- Changed-file lint and formatting passed. Production build and TypeScript passed.
- 23 relevant unit cases passed, including six route-encoding cases. The second
  small unit run overlaps two earlier dashboard-layout cases; do not add them.
- Initial production batch: 213 passing browser cases, one intentional desktop
  skip for a phone-only review assertion. Subsequent targeted cases overlap.
- Thirty visual/catalogue checks passed after counter sizing. Final catalogue/
  kana checks passed 34 cases and the remaining two passed after correcting the
  test's assumption about already-open URL filters. The final item/dashboard
  production batch passed 46 cases, including both encoded-kanji-route cases.
  These are targeted reruns, not additional independent coverage totals.
- Visual review found that legacy character counters and single-column phone
  filters still displaced the actual glyphs. Counters are now inline, the course
  heading is smaller, phone filters use two columns, and unused filters start
  collapsed. Active URL filters reopen automatically and chips remain outside
  the disclosure. The first unfiltered tile has a viewport regression assertion.
- A development-server run was not counted as acceptance: Strict Mode's duplicate
  initial reads bypassed a single-failure mock. Production cases remain the gate.
- Live review exposed an existing hosted kanji-route bug: the server serialized
  an encoded dynamic parameter and the API client encoded it again. The API's
  direct Japanese lookup worked. The route now decodes once, leaves malformed
  encodings non-crashing and does not recursively decode. Dedicated unit and
  desktop/phone browser cases cover this boundary. No DB or API fix was needed.
- The level summary uses neutral wording, including at a course's last level.

### Live Verification

Final runtime: `fe6dfd01b53a838ae407c8ea78d8db1823df6769`.
Release tag: `cycle-250-264-ux`.

Both live health routes returned this full SHA. Final
[remote smoke 40355978153](https://github.com/wndffs/kanji-app/actions/runs/40355978153)
passed both exact revision gates. Three-sample HTTP medians: dashboard 567 ms,
lessons 352 ms, reviews 166 ms, characters 381 ms and item 444 ms. Both warm
samples per route met the 2000 ms gate. These are bounded pilot API measurements,
not browser CWV or a full N2/free-hosting cold-start performance guarantee.
The smoke uses a separate disposable audit account; its V4 enrollment is not a
course switch on the existing test profile and publishes no educational set.

[Study integrity 40355142814](https://github.com/wndffs/kanji-app/actions/runs/40355142814)
passed against PostgreSQL 18. Final
[CI 40355142697](https://github.com/wndffs/kanji-app/actions/runs/40355142697)
passed Quality and 325 production browser cases, with one intentional skip
(326 total, two workers). This includes the final route fix and all catalogue
repairs; local/cloud case counts overlap and must not be added together.

Live desktop inspection preserved the existing starter course, two due reviews,
two available lessons and the unfinished lesson. No study answer was submitted.
The dashboard has two study tiles and inline secondary counters; forecast and
course progress remain visible. Document/client widths were both 1265 px.
Kana's active unanswered exercise and original lesson numbers were inspected.
Light preview and Discard restored the confirmed system theme without Save.
The final live Japanese URL opened successfully after the route fix, showing
the glyph, curated meaning, taught kana reading, relations and stroke diagram.
No live clipboard overwrite, private-form save or study grading was performed.

Mobile and both-theme screenshots were inspected from the production browser
batch. A live IAB viewport override did not apply; raw CDP access was denied by
saved permission. No workaround or alternate browser was used. Temporary
viewport settings were reset. Do not describe this as a live mobile-device or
native Safari audit. This is also not a full screen-reader/physical IME audit.

Screenshots remain outside Git. No new asset, font, dependency or proprietary
educational material was added. RU/EN modes, private answers, SRS and attribution
layers remain. This cycle does not expand the finite pilot or complete the
unpublished 2300-kanji/8000-word main course.

All built-in browser tabs were closed after saving the final desktop/item and
server-proof screenshots. Local test/build sessions exited. The process check
found only the app's browser-tool runtimes, not owned Next/Playwright servers;
those app runtimes were not killed. Verified temporary test directories, `.next`
and `tsconfig.tsbuildinfo` were removed. The release report is the only final
documentation change; no scratch artifact is included in Git.
