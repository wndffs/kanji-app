# Cohesive Learner Experience 265-279

Baseline: `706c8f2`. User-approved direction: establish three reference screens,
review the visual direction, then port it to the learner application. Fifteen
task numbers are reserved below. Next unused number after this cycle: 280.

## Design Contract

Build an original, quiet study workspace. The first screen answers what to do
now and how the current level is progressing. Study screens concentrate on one
glyph, the requested answer and one next action. Use neutral surfaces, green
actions, blue kanji and restrained warm vocabulary/kana accents. Use existing
Lucide icons and the project icon, not decorative illustration or a hero.

Use a consistent type scale, readable Japanese and a compact navigation rail.
Keep optional statistics separate from the daily path. No nested cards, repeated
hero headings, marketing copy, decorative gradients or oversized metadata.
Both themes and phone layouts are part of the reference, not later add-ons.

## Approval Gate

Tasks 265-267 produce a **development-only** `/design-reference` with three
interactive reference screens and explicitly marked project-authored demo
fixtures. It makes no API requests, changes no account/preferences/progress and
is unavailable in production. Its answer preview uses the existing Japanese
package; it is not an alternative SRS engine or a new published course.

Show desktop/phone screenshots and request feedback **before task 268**. Do
not call the entire batch complete, publish a replacement interface, or treat
the visual direction as approved merely because automated tests pass.

| ID  | Deliverable                       | Acceptance                                                                                                                                   | State      |
| --- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 265 | Visual brief and checkpoint       | Scope, hierarchy, constraints, original-data boundary and approval gate are explicit                                                         | Complete   |
| 266 | Three reference compositions      | Dashboard, lesson and review use one responsive visual vocabulary, light/dark and original glyph assets                                      | Approved   |
| 267 | Interactive reference and review  | Screen/phase/theme/language controls work locally; keyboard/IME/reveal boundaries tested; six desktop/phone screenshots presented for review | Approved   |
| 268 | Production study dashboard        | Agreed composition uses real account counts and saved widget settings, without fake demo data                                                | Integrated |
| 269 | Current-level path                | Real level/pass states and next goal are concise, including final/empty/completed states                                                     | Integrated |
| 270 | Forecast and secondary statistics | Actual schedule is readable; optional history/statistics do not displace study actions                                                       | Integrated |
| 271 | Lesson teaching composition       | Meaning/reading relationships and RU/EN modes use the approved reference without premature answer disclosure                                 | Integrated |
| 272 | Mandatory lesson check            | Existing quiz semantics, recovery and completion remain; no SRS state before required correct answers                                        | Integrated |
| 273 | Reviews and session results       | Keyboard/IME flow, errors, correction, reveal and real results retain their distinct semantics                                               | Integrated |
| 274 | Kana character map                | Basic signs, modified sounds and combinations are visually distinct; original data and separate mastery retained                             | Integrated |
| 275 | Kana lesson path                  | Current lesson and prerequisites are understandable; route/search/filter state remains recoverable                                           | Integrated |
| 276 | Kana exercise composition         | Recognition, reverse, matching and typing fit phones and long Japanese without altering mastery rules                                        | Integrated |
| 277 | Catalogue and material pages      | Approved hierarchy transfers to real catalogues/readings/private notes with unchanged visibility boundaries                                  | Integrated |
| 278 | Appearance and consistency        | Saved theme/density/text-size preferences apply consistently; explicit Save/Discard and owner isolation remain                               | Integrated |
| 279 | Batched acceptance and release    | Relevant checks, desktop/phone inspection, release tag, deploy and exact-revision server smoke completed                                     | Verifying  |

## Boundaries

No WaniKani content, CSS, layout tracing, mnemonics, level order or assets. No
new production dependency, remote font or proprietary media. Reference words
are simple factual Japanese examples with project-authored RU/EN labels and
original explanatory wording. They are not imported or published to Neon.

No migration, seed, new corpus publication, account reset, SRS interval change
or accepted-answer-policy change. Kana remains outside SRS. Only aggregate
source reports may be exported. The 2300-kanji/8000-word curriculum remains a
separate unfinished content programme and is not delivered by this design work.

## Verification

Batch relevant unit tests, changed-file lint/format, a web build/typecheck and
focused browser cases. Reference tests verify zero remote/API traffic and no
storage writes, mobile bounds, theme/translation controls, answer/reveal/IME
behavior and keyboard navigation. Production tests verify a 404 at the preview
route. Reuse existing test fixtures for real learner screens when porting.

Keep captures and generated builds outside Git or in tool-required ignored
directories; remove generated output and stop owned servers after inspection.
Commit each task separately and push checkpoints. Release only after the
approved 15-task cycle, not after the first three design references.

## Checkpoint 265-267: Ready For Visual Review

Implemented the scoped development-only reference. Three compositions share
neutral surfaces, compact type, a restrained rail and clear subject/action
colors. The lesson has meaning/reading phases with original bilingual notes;
the review has distinct wrong/correct/revealed states and local-only counters.
An empty/composing answer is not submitted, revealed answers do not count as
accepted, and Continue retains Enter-only flow. Learning validation stays in
the existing Japanese package; the component does not schedule SRS.

The reference is deliberately not a replacement lesson/quiz implementation.
Its final lesson command is labelled Finish Preview, not a course completion.
Actual mandatory quizzes and saved progress are handled in tasks 271-273 only
after approval. All twenty-four demo questions are private in-memory examples,
not an imported/published deck. A full preview refresh resets only these examples.

Verified in one scoped batch and overlapping visual reruns:

- Ten relevant unit cases passed (six reference cases and four existing
  navigation cases). Scoped ESLint and Prettier passed.
- Final web production build and TypeScript passed.
- Six development browser cases passed on desktop/phone. They cover three
  screens in both themes, keyboard phase/screen navigation, English/RU+EN,
  wrong/correct/reveal feedback, Enter, composition events, no external/API
  traffic and zero Storage.setItem calls. Twelve final screen captures were
  inspected; button bounds and document widths fit the tested viewports.
- The phone lesson originally overlaid its explanation with a sticky action
  bar. A compact glyph/meaning/reading row and normal-flow footer removed the
  overlap. The final RU reading-phase action is entirely in the phone viewport.
- Six production browser cases passed: preview returns 404 on both viewport
  projects; four existing responsive/keyboard navigation cases still pass.
- Manual IAB inspection covered the dashboard, lesson reading phase and
  correct-answer feedback. Screenshots are in an offline gallery outside Git.
  No real login, course selection, private-form save or study grading occurred.

The offline gallery includes light/dark and desktop/phone selectors and needs
no dev server. The temporary IAB tab was closed and the owned dev server stopped.
App browser-tool runtimes are not learner/test servers and were left alone.
Generated builds and temporary browser outputs are removed before final status.

**Gate approved:** the user reviewed the screenshots and approved continuing
("в целом да. продолжай"). Tasks 268-279 may now port the agreed direction.
No new curriculum publication is included. Retire reference-only duplicates
once the approved screens have been integrated and verified in task 279.

## Integration Progress

This section supersedes the checkpoint states in the table above.

- 268 implemented: shared neutral tokens and two real study action tiles;
  duplicate header action removed when tiles are visible. Personal widget
  order/visibility is unchanged. Default layout uses stable grid tracks.
- 269 implemented: level heading, immediate next step, passed/total subject
  counts and a real level-catalogue link. Detailed states and prerequisite paths
  remain available. Final/empty/completed decisions still come from the API.
- 270 implemented: forecast columns compare actual nonzero buckets, with
  absolute count/time labels and honest vacation/empty states. Secondary
  activity, workload and SRS tables remain optional disclosures.
- 271 implemented: unframed two-column teaching, compact mobile identity,
  subject-accent memory notes and normal-flow footer. Existing translation,
  reading/furigana/romaji visibility and source attribution are retained.
- 272 implemented: mandatory check shares the focused prompt/answer treatment,
  per-material progress and distinct accepted/retry/wrong feedback. Scheduling,
  completion writes and recovery are unchanged; summary shows actual results.
- 273 implemented: real review queue uses the approved focused width, subject
  stripe, thin answered-card progress and quiet result summary. Alternative
  readings remain neutral retries; correction has its own progress label and
  still does not change SRS. Existing keyboard/IME and grading paths retained.
- 274 implemented: assessment map groups actual signs by variant with separate
  mastered/total counts, compact character tiles and current/started/mastered
  states. No new character data or SRS state is created.
- 275 implemented: current lesson shows actual separate mastery; finder rows
  distinguish current/available/mastered/locked and name the preceding lesson
  for locked rows. Search/filter retain original unit identity and ordinal.
- 276 implemented: all kana exercise prompts have stable framing, two-column
  choices/matching, readable glyphs and full-width phone feedback actions.
  Existing recognition/reverse/matching/typing/listening/tracing evidence and
  separate mastery are unchanged.
- 277 implemented: glyph-first catalogue tiles now share subject surfaces and
  actual study-state accents. Material tabs, reading facts, related practice
  and private forms share compact hierarchy; hidden readings and attribution
  are not replaced by preview content.
- 278 implemented: original compact rail and active state, shared theme tokens,
  spacing density, configurable lesson glyph sizes (including sentence and
  phone overrides), matching appearance preview. Save/Discard and account
  ownership guards remain the existing source of truth.
- 279 in progress: integration checks, cleanup, release and server verification.

## Integration Acceptance

The agreed composition now uses existing learner DTOs and authenticated flows,
not prototype fixtures. The dashboard endpoint has aggregate subject counts,
not a full level glyph list, so it links to the actual catalogue rather than
inventing a grid. The active/final/empty course and vacation states remain real.

Local verification:

- 42 scoped unit cases cover dashboard layout/actions, lesson stages/quiz,
  pronunciation, kana grouping/routing/exercises, preferences and item routes.
- Changed-file ESLint/Prettier and the final production build/typecheck passed.
  An overly narrow new test assertion was corrected during typecheck.
- 169 production browser cases passed across desktop/phone, with one intentional
  desktop skip for a mobile-only sticky-input case. Existing recovery, account
  isolation, private edits, saved preferences, mandatory quizzes, correction,
  audio evidence and keyboard/IME scenarios remain covered.
- Six final focused browser cases passed after the phone dashboard header and
  locked-unit prerequisite label were refined and the prototype retired.
- Twenty light/dark desktop/phone captures were saved outside Git for the five
  core compositions. Inspected views fit without horizontal overflow or action
  overlap. Production theme captures use fixture accounts, not Neon resets.

The development prototype and its local demo state/validator were removed after
integration. The retained route guard verifies 404 in all builds. No new corpus,
dependency, font, external asset, schema, seed, migration or SRS policy is added.
Live deployment verification is recorded below once the exact revisions pass.
