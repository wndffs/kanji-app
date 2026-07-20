# Product parity target and task specifications 111-124

This document is the durable product and engineering source of truth for the
remaining roadmap after Task 110. Read it before implementing any task in this
range. Update a task's status only after its acceptance criteria and relevant
checks pass.

## Product target

The structured course must become functionally comparable to WaniKani, not
merely loosely inspired by it. When a proven WaniKani learning mechanic is
compatible with this project's architecture and legal boundaries, functional
parity is the default:

- components unlock kanji and kanji unlock vocabulary through explicit stage
  prerequisites;
- lessons teach a small batch before a mandatory retrieval quiz;
- kanji and vocabulary meaning and reading are learned and reviewed separately;
- reviews advance or demote independent cards on deterministic SRS intervals;
- the dashboard makes lessons, reviews, workload, SRS spread, level progress,
  recent changes, and the next useful action obvious;
- item pages explain the complete learning object and connect it to
  prerequisites, vocabulary, examples, SRS state, and history;
- optional practice reinforces recent lessons, mistakes, burned items, and
  confusable items without changing scheduled SRS state;
- keyboard-first study and review flows remain fast enough for daily use.

Kana is an intentional extension, not another WaniKani SRS item type.
Hiragana and Katakana use a dedicated Duolingo-inspired character path with
short lessons, per-symbol progress, varied recognition exercises, optional
romaji, and adaptive practice. Kana progress must never create `UserSrsState`
rows.

Project differentiators remain first-class:

- Russian, English, or Russian plus English learning content;
- a separate Hiragana and Katakana curriculum;
- private accepted answers, notes, and mnemonics;
- structured courses plus prerequisite-safe personal text decks;
- configurable but original presentation.

### Similarity target

After Task 124:

- structured kanji and vocabulary workflow: at least 90/100 functional parity
  with the relevant WaniKani learning loop;
- kana character workflow: at least 85/100 parity with the character-card
  portion of Duolingo Japanese, excluding phrase and grammar study;
- visual similarity to either product: intentionally low. The interface must
  be original while providing comparable information and interaction speed.

Parity is measured by completed user workflows, not by matching screenshots,
colors, names, copy, or proprietary curriculum.

## Independent implementation boundary

Never copy or derive WaniKani proprietary mnemonics, component names, accepted
answer lists, explanations, example sentences, audio, illustrations, level
order, CSS, colors, layout composition, UI wording, API exports, unofficial
dumps, or Anki decks.

Allowed reference use:

- observe public or user-authorized screens to understand general product
  behavior and information architecture;
- reproduce generic mechanics such as prerequisite unlocks, staged lessons,
  typed recall, level progress, forecasts, and item-history navigation;
- implement those mechanics with project-owned code, independent wording,
  independent presentation, and source-traceable data.

If a required content or media source has unclear licensing, stop that part of
the task and record the unresolved decision. Do not substitute copied content
or silently generated facts.

## Primary product references

Official descriptions used to define behavior:

- [How WaniKani works](https://knowledge.wanikani.com/getting-started/how-wanikani-works/)
- [First lessons and required lesson quiz](https://knowledge.wanikani.com/getting-started/first-lessons/)
- [Unlocking kanji lessons](https://knowledge.wanikani.com/getting-started/unlocking-kanji/)
- [Unlocking vocabulary lessons](https://knowledge.wanikani.com/getting-started/unlocking-vocabulary/)
- [Level-up behavior](https://knowledge.wanikani.com/wanikani/getting-started/level-up/)
- [Level progress and item breakdown](https://knowledge.wanikani.com/widgets/level-progress/)
- [Review controls and item information](https://knowledge.wanikani.com/wanikani/review-buttons/)
- [Keyboard shortcuts](https://knowledge.wanikani.com/wanikani/keyboard-shortcuts/)
- [Vocabulary audio behavior](https://knowledge.wanikani.com/wanikani/audio/)
- [Duolingo character lessons](https://blog.duolingo.com/learning-to-read-japanese-characters/)
- [Duolingo Japanese writing systems](https://blog.duolingo.com/japanese-writing-systems/)

These sources describe mechanics only. They are not content sources.

## Cross-task engineering rules

- Keep SRS calculations in `packages/srs`.
- Keep answer normalization and validation in `packages/japanese`.
- Keep persisted data and migrations in `packages/db`.
- Keep API orchestration in `apps/api`; do not hide domain rules in React.
- Keep shared DTOs in `packages/shared`.
- Preserve Russian-only, English-only, and Russian-plus-English display modes.
- Preserve exact source, license, import-run, checksum, and attribution links
  for imported content.
- No task may change review due dates unless that change is its explicit,
  tested purpose.
- Optional practice and kana practice never mutate scheduled SRS state.
- Every task is one reviewable commit. Do not start the next task while the
  current working tree is dirty.
- Run only checks relevant to touched packages and scenarios.

## Task 111: level completion and unlock path

### Goal

Explain how the learner completes the current level, what material became
available because of the latest reviews, and the shortest useful prerequisite
path to the next locked material.

### WaniKani parity

Match the clarity of stage-based level progress and dependency unlocks:
components support kanji, qualifying kanji progress advances the level, and
qualified kanji unlock vocabulary. Do not copy WaniKani's level membership or
hardcode its content-specific counts.

### Product behavior

- Distinguish `lesson started`, `in progress`, `passed at the configured stage`,
  and `burned`; the existing "has SRS state" signal is not sufficient for level
  completion.
- Show the configured pass stage and required core-kanji count or percentage.
- Show current passed/required counts and a deterministic progress percentage.
- Group newly available components, kanji, vocabulary, and sentences after a
  qualifying review transition.
- For the next useful locked item, show every unmet prerequisite with its
  current stage, required stage, and direct item link.
- Prefer the earliest course item with the shortest prerequisite path. Stable
  course ordering breaks ties.
- Explain whether the next action is a lesson, a due review, waiting for the
  next interval, or completing a prerequisite.
- Level completion and unlock explanations must survive reloads.

### Technical scope

- Define an explicit project-owned level pass policy. It may be stored in course
  metadata or represented by a versioned policy object, but must not be a UI
  constant.
- Extend dashboard/course DTOs with pass-stage, required-count, passed-count,
  completion, newly-unlocked, and next-path data.
- Persist unlock events or an equivalent stable review-session result. Do not
  infer "newly unlocked" from a recent timestamp at render time.
- Calculate dependency satisfaction from actual `LearningItemDependency`
  thresholds and all required cards.
- Integrate unlock-event creation with the review transaction or its
  immediately committed result so retries remain idempotent.
- Add a dashboard journey section close to current-level progress. Reuse item
  links and bilingual summaries.

### Acceptance

- Advancing the final required card to the pass stage completes the level once.
- A demotion does not erase historical level completion, while current card
  stage remains accurate.
- A review that satisfies multiple dependencies records every newly available
  item exactly once.
- Reloading the dashboard preserves the unlock explanation.
- Locked paths list accurate current and required stages.
- Existing due dates, course placement, and lesson prerequisite rules remain
  unchanged.
- Add focused API service/repository tests and dashboard Playwright coverage for
  before-completion, just-completed, and waiting states.

### Non-goals

- No curriculum reorder.
- No copied 60-level WaniKani mapping.
- No visual redesign beyond the required journey surface.

## Task 112: complete item study pages

### Goal

Make an item page the authoritative place to understand and navigate a
component, kanji, vocabulary word, or sentence.

### WaniKani parity

Provide comparable depth: current SRS state, next review, composition,
meanings, readings, mnemonic material, vocabulary context, examples, and
related-item navigation.

### Product behavior

- Show the next scheduled review with timezone-aware absolute and relative time.
- Show current stage and a chronological SRS history with answer result,
  previous stage, next stage, and review time.
- Keep history bounded and paginated; the initial page should prioritize recent
  events.
- Components show kanji that use them.
- Kanji show component composition, the primary taught reading, additional
  accepted readings, visually separated on/kun evidence where available, and
  vocabulary that reinforces those readings.
- Vocabulary shows kanji composition, reading, part-of-speech evidence, common
  usage data when curated, audio when licensed, and attributed example
  sentences.
- Every related item is a direct link and includes bilingual display according
  to user settings.
- Private synonyms, notes, and mnemonics remain user-scoped and editable.
- Imported evidence and curated learning content stay visibly distinct.

### Technical scope

- Extend item-detail repository queries with the user's SRS state and paginated
  `ReviewAnswer` history.
- Add relation groups rather than one undifferentiated relation list.
- Add cursor pagination for history if a bounded first page is insufficient.
- Represent usage patterns only when source or project-authored provenance is
  stored. Do not generate unsupported grammar claims.
- Keep attribution adjacent to examples and imported metadata.

### Acceptance

- Item pages work for all four item kinds and for items with no user progress.
- Next-review information matches the review queue source of truth.
- Stage history orders deterministically and distinguishes typo/reveal/manual
  ignore from stage-changing answers.
- Relation links navigate without losing authentication or display mode.
- No private override from one user is visible to another.
- Add API tests for each item kind and Playwright coverage for kanji and
  vocabulary pages.

### Non-goals

- No pitch-accent display before Task 117.
- No unlicensed audio.
- No public user-generated content.

## Task 113: confusable kanji practice

### Goal

Provide optional side-by-side retrieval practice for kanji that learners
repeatedly confuse visually or semantically.

### Product behavior

- Show two or a small bounded set of confusable kanji together.
- Compare distinguishing components, meanings, readings, and example
  vocabulary without exposing an answer before recall.
- Support typed meaning and reading prompts using the existing validator.
- Explain the distinguishing feature after the answer.
- Build practice from curated confusable relations plus user-specific error
  evidence.
- Let the learner launch practice from an item page, recent mistakes, or the
  practice area.
- Practice attempts must not advance, demote, burn, resurrect, or reschedule an
  SRS card.

### Technical scope

- Add an explicit, source-traceable confusable relation type or dedicated
  relation table with `visual`, `semantic`, and optional project-authored
  explanation fields in RU and EN.
- Admin/editor approval is required before a global pair is published.
- Rank candidate pairs by recent wrong answers and relation strength; use a
  deterministic tie break.
- Reuse the resumable practice-session infrastructure from Task 106.
- Add direct related-practice links to item pages after Task 112.

### Acceptance

- A user with repeated errors receives the relevant published pair first.
- A user without history can deliberately open any published pair from an item
  page.
- Meaning and reading answers use global plus private accepted/blocked answers.
- Completing or abandoning the practice leaves all `UserSrsState` rows
  unchanged.
- Tests cover visual, semantic, missing-relation, private-answer, and resume
  cases.

### Non-goals

- No automatic publication of similarity pairs from glyph distance alone.
- No copied WaniKani "visually similar kanji" text or pair list.

## Task 114: adaptive kana practice

### Goal

Turn the existing kana track into adaptive practice that prioritizes weak
symbols and repeatedly confused sounds while keeping kana outside SRS.

### Duolingo parity

Mix recognition, sound-to-character, matching, typing, listening, and tracing
in short sessions. Use per-character progress to focus practice rather than
showing every symbol equally.

### Product behavior

- Record enough attempt detail to distinguish an incorrect romaji response from
  selecting another kana character.
- Maintain recent accuracy, current streak, last-practiced time, and confusion
  counts per symbol/pair.
- Build a bounded session from weak symbols, overdue practice, and a small
  amount of mastered review.
- Avoid presenting the same symbol or exercise direction repeatedly.
- Include basic kana, dakuten/handakuten, yoon, small `っ`, and long-vowel units
  only after their lesson unit is unlocked.
- Explain why a wrong option was confusable after feedback.
- Continue to support explicit script selection and mixed-script practice.

### Technical scope

- Persist immutable or safely aggregated kana-attempt evidence including
  expected character, submitted answer/selected character, exercise kind,
  correctness, and timestamp.
- Put adaptive selection and scoring in `packages/japanese`; keep it
  deterministic with an injected seed/time for tests.
- Keep lesson-unit unlocking based on kana mastery, not SRS stages.
- Bound retained attempt history or provide aggregate compaction.

### Acceptance

- A repeatedly missed character appears more often than a mastered character.
- A frequently selected wrong character becomes a confusable distractor.
- The selector never emits a locked unit.
- A session still contains variety and cannot become one repeated prompt.
- Reload/resume preserves the generated session.
- No kana operation writes `UserSrsState` or `ReviewAnswer`.
- Add package tests for selection and API/web tests for persistence and mixed
  exercises.

## Task 115: unified character hub

### Goal

Unify Hiragana, Katakana, and Kanji discovery and progress in one character
area without merging their learning models.

### Product behavior

- Provide top-level Hiragana, Katakana, and Kanji tabs.
- Hiragana and Katakana show the full character chart, lesson-unit state,
  mastery, weak symbols, and adaptive-practice actions.
- Kanji shows structured-course level progress, learned/passed/burned state,
  weak items, JLPT/band filters, and direct item links.
- Preserve the dedicated kana lesson and assessment experiences inside the hub.
- Preserve existing deep links or redirect them without losing script/mode.
- Make the different progress semantics explicit: kana mastery is practice
  progress; kanji progress is card/SRS progress.

### Technical scope

- Add a `/characters` route and update primary navigation.
- Define a unified read DTO with separate kana and kanji sections; do not invent
  one fake shared stage model.
- Reuse Task 114 scoring and existing dashboard/course queries.
- Use URL-addressable tabs and filters so reload/back/forward work.

### Acceptance

- All three tabs work on desktop and mobile.
- Existing `/kana` links remain functional.
- Counts agree with kana progress, course progress, and SRS state sources.
- Starting kana practice never changes kanji review state.
- Keyboard and screen-reader navigation identify tab, progress, and action
  state correctly.

## Task 116: licensed listening cards

### Goal

Add deterministic listening cards only when a project-owned or individually
license-compatible audio asset exists.

### WaniKani parity

Vocabulary audio should reinforce a definite word reading in context. Do not
pretend that isolated kanji has one canonical spoken form.

### Product behavior

- Listening cards are created for vocabulary or approved sentence targets, not
  components or isolated kanji.
- The prompt plays audio without revealing orthography or reading.
- The learner types the expected reading or, for an explicitly configured
  variant, the learning meaning.
- Replay is allowed and tracked but does not count as an error.
- Feedback reveals orthography, reading, meaning, speaker/source metadata, and
  attribution.
- Missing or failed audio produces a recoverable state and never grades an
  unheard prompt.
- User audio/autoplay preferences from Task 108 apply.

### Technical scope

- Add an `AudioAsset` model with target, media URL/storage key, checksum,
  duration, speaker/voice metadata, source, license, attribution, import run,
  publication status, and locale.
- Extend prompt enums with `listening` through an additive migration and update
  all exhaustive mappings.
- Publication must reject a listening card without an eligible published asset.
- Use stable served media, not browser speech synthesis, as the graded prompt.
  Browser TTS may remain an ungraded lesson aid.
- Decide and document storage/CORS/range-request behavior before production.

### Acceptance

- Licensed asset metadata is visible and source-traceable.
- An unavailable asset cannot generate or schedule a listening card.
- Listening answer validation reuses normalized reading/meaning rules.
- SRS transitions remain card-local and deterministic.
- Tests cover valid audio, missing audio, playback failure, replay, and
  attribution.

### Legal gate

Do not import Tatoeba audio or any bulk audio source until per-file license and
author/speaker attribution are modeled and verified. A project-owned recording
fixture is sufficient for implementation tests.

## Task 117: optional pitch-accent data

### Goal

Research and, only after approval, integrate optional pitch-accent evidence
with explicit provenance and no effect on answer correctness.

### Required decision record

Before code or schema changes, add a source evaluation covering:

- license and redistribution compatibility;
- exact version/download date/checksum;
- entry identity and reading disambiguation;
- accent representation and dialect;
- attribution requirements;
- update and removal policy;
- conflicts between sources;
- whether commercial or public deployment is permitted.

The decision must be `approved`, `rejected`, or `deferred`. `Deferred` or
`rejected` completes only the research portion and blocks integration.

### Product behavior after approval

- Show pitch accent only for an exact expression-and-reading match.
- Label dialect/source and make the feature optional in settings.
- Distinguish missing data from a flat/unaccented pattern.
- Never reject an otherwise correct reading because pitch data is missing or
  differs.
- Do not synthesize a pattern from spelling.

### Technical scope after approval

- Store source-linked accent records separately from curated meanings/readings.
- Support multiple source claims without silently choosing one.
- Add item-page and post-answer display only; no SRS card type in this task.

### Acceptance

- The source decision is committed and auditable.
- Every displayed pattern resolves to exact provenance.
- Unsupported or ambiguous entries display no claim.
- Disabling the setting removes pitch display without affecting study state.

## Task 118: full bilingual course publication

### Goal

Publish and verify at least 2,300 unique kanji and 8,000 unique vocabulary
expression-and-reading pairs in the independent 60-level main course.

### Scale comparison

This deliberately exceeds WaniKani's publicly described scale of roughly 2,000
kanji and 6,000 vocabulary words while retaining an independent order and
independent educational content.

### Content requirements

Every published kanji must have:

- one project-reviewed primary learning meaning in RU and EN;
- one project-reviewed primary taught reading and normalized accepted answers;
- required meaning/reading cards;
- valid published component prerequisites where applicable;
- level placement and course band;
- source traceability and KanjiVG coverage or an explicit reviewed exception;
- bilingual mnemonic/explanation or an explicit editorial exception with
  reason.

Every published vocabulary item must have:

- an exact expression-and-reading identity;
- project-reviewed RU and EN learning meanings and accepted answers;
- a project-reviewed reading card;
- published kanji prerequisites at configured stages;
- level placement after its prerequisites;
- source traceability;
- part-of-speech evidence and at least one attributed example where available,
  or an explicit reviewed exception.

### Publication workflow

- Use the existing versioned candidate plan, curation, allocation, readiness,
  publication, and enrollment-rollout operations.
- Process bounded editorial batches and preserve resume/checksum behavior.
- Never relabel raw imported glosses as project-authored without review.
- Never fill gaps with placeholder text, copied mnemonics, or unlabeled machine
  translation.
- Recalculate readiness inside the confirmed publication transaction.
- Keep learner enrollment rollout separate from course publication.

### Acceptance

- Database reports at least 2,300 unique placed published kanji and 8,000 unique
  placed published vocabulary pairs.
- All 60 levels contain prerequisite-safe published content.
- Zero blocking readiness issues remain.
- RU, EN, reading, card, prerequisite, attribution, and placement queries return
  no unexplained gaps.
- A production-scale lesson/review sample from early, middle, and late levels
  passes.
- Counts and the exact published plan version are recorded in an auditable
  report.

### Operational constraint

This task is not complete merely because raw KANJIDIC2/JMdict candidates exist.
Human-reviewed or explicitly approved project curation is required. If the
editorial corpus is not ready, report exact remaining counts and continue
bounded curation rather than weakening the gate.

## Task 119: automated editorial quality gates

### Goal

Turn the main content requirements into deterministic automated checks that
prevent regressions after full-course publication.

### Checks

- accepted answers exist and normalize to non-empty values;
- RU and EN primary meanings exist exactly once;
- taught readings are present, normalized, and supported by source evidence;
- blocked answers do not collide with accepted/private policy;
- prerequisites exist, are published, precede dependants, meet item-type rules,
  and contain no cycles;
- course placement is unique and within the 60-level blueprint;
- examples and audio have valid attribution/license records;
- imported and project-authored layers are not mislabeled;
- no unsupported language leaks into learner content;
- no placeholder, duplicate, malformed, or orphaned rows;
- sample answer validation succeeds for published cards.

### Technical scope

- Add a reusable quality package/service rather than duplicating rules in CLI,
  admin API, and publication code.
- Provide machine-readable issue codes, item IDs, severity, and remediation
  hints.
- Add bounded admin pagination/filtering and a CI/report command.
- Blocking issues must fail publication and production readiness.

### Acceptance

- Seeded invalid fixtures trigger each issue code.
- A valid bounded fixture produces zero blockers.
- The full published corpus report is versioned and reproducible.
- Checks run without loading the entire corpus into application memory.

## Task 120: persistent interface preferences

### Goal

Persist presentation preferences before the final visual refresh so the design
system has stable user contracts.

### Preferences

- theme: `system`, `light`, or `dark`;
- density: `comfortable` or `compact`;
- motion: `system`, `reduced`, or `full`;
- study Japanese text size from a bounded preset;
- lesson/review information density from bounded presets;
- existing translation, pronunciation, audio, lesson, review, and dashboard
  settings remain intact.

### Technical scope

- Add typed shared enums, additive settings fields/migration, validation,
  defaults, API persistence, and client hooks.
- Apply preferences at the document/root level without a flash of the wrong
  theme where practical.
- Respect OS `prefers-color-scheme` and `prefers-reduced-motion` in `system`
  modes.
- Compact density must not shrink controls below accessible targets.

### Acceptance

- Preferences survive login, reload, and another device using the same account.
- Invalid values fall back safely and API validation returns Russian-friendly
  errors.
- Reduced motion disables non-essential transitions.
- Study text remains readable at every preset on mobile and desktop.

## Task 121: original visual design system and product refresh

### Goal

Apply one original, coherent, production-quality visual system across the
learner product after functional/data work is complete.

### Boundary

Match WaniKani's clarity, speed, hierarchy, and item-type recognition, but not
its CSS, palette, exact layout, iconography, illustrations, or wording.

### Scope

- Define color, typography, spacing, border, elevation, focus, icon, data-viz,
  and motion tokens.
- Keep the palette multi-hue and accessible; item types may have recognizable
  accents without dominating every surface.
- Refresh dashboard, lessons, reviews, character hub, practice, search, decks,
  item pages, settings, authentication, and learner-facing error/empty states.
- Use Lucide icons for familiar actions and tooltips for unfamiliar icon-only
  controls.
- Keep operational screens dense and scannable; avoid marketing-page patterns,
  oversized card stacks, nested cards, decorative orbs, and gratuitous
  gradients.
- Preserve keyboard-first review speed and stable dimensions.

### Acceptance

- Every learner route uses the shared tokens/components.
- Desktop, tablet, and mobile screenshots show no overlap, clipping, blank
  content, or layout shift.
- Long Russian/English labels fit.
- Theme/density/motion preferences from Task 120 work on every refreshed route.
- Visual-regression screenshots are reviewed for all primary states.

## Task 122: responsive and accessibility quality pass

### Goal

Verify the complete product on mobile, tablet, keyboard, screen reader,
contrast, zoom, and reduced-motion configurations.

### Required matrix

- representative widths: 360, 390, 768, 1024, 1280, and wide desktop;
- 200% browser zoom and increased text;
- keyboard-only lesson, review, kana, search, item, settings, and dashboard
  flows;
- screen-reader names, landmarks, live feedback, dialogs, tabs, progress bars,
  and tables;
- light/dark contrast and non-color status communication;
- reduced motion;
- touch targets and virtual-keyboard behavior.

### Acceptance

- No critical axe violations in primary routes.
- Focus never becomes trapped or lost after feedback/navigation.
- Answer feedback is announced once and does not reveal hidden answers early.
- Mobile keyboards do not cover the active answer/action.
- Tables have usable compact alternatives.
- Every discovered blocker receives a regression test where practical.

## Task 123: performance, installability, and reminders

### Goal

Improve repeat daily use without compromising authenticated data or review
integrity.

### Scope

- Measure route bundles, API latency, database query counts, and Core Web Vitals
  before optimization.
- Optimize the slowest dashboard, lesson, review, item, and character queries.
- Add an installable manifest and original app icons.
- Cache only the application shell and safe static assets. Never serve stale
  authenticated queues, answers, schedules, or private content as current.
- Provide clear offline states; preserve unsent user input locally only when
  privacy-safe, and require server confirmation before showing completion.
- Add optional review reminders with explicit permission, timezone handling,
  deduplication, and a settings opt-out.
- Do not claim background reminders on platforms where the chosen deployment
  cannot reliably provide them.

### Acceptance

- Performance budgets are documented and met for representative production
  data.
- Installing and launching the app works on supported desktop/mobile browsers.
- Offline navigation never fabricates successful lesson/review writes.
- Reminder opt-in/out is persisted and duplicate notifications are bounded.
- No service worker caches tokens or private API responses.

## Task 124: production readiness and deployment verification

### Goal

Prove that the complete application, data, and operational procedures are
ready for sustained internet deployment.

### Scope

- Apply all migrations to a disposable production-like PostgreSQL database and
  verify forward deployment from the currently deployed version.
- Run full-course content/readiness reports at production scale.
- Verify API, web, Redis/queues if enabled, object/audio storage if enabled, and
  environment-variable contracts.
- Add health/readiness endpoints that distinguish process health from database
  and dependency readiness.
- Add structured error logging, request correlation, privacy-safe metrics, and
  alert thresholds.
- Document Neon backup/restore and point-in-time recovery procedures.
- Verify Render and Vercel build/start/deploy behavior and cross-origin
  configuration.
- Run remote smoke tests for registration/login, dashboard, kana, lesson,
  review, item, search, settings, and admin readiness.
- Verify rate limits, secure cookies/tokens, secrets, CORS, CSP, dependency
  audit decisions, and no test credentials in production.
- Record rollback steps for web, API, migrations, and content publication.

### Acceptance

- Production migrations complete from a clean database and from the previous
  deployed schema.
- Backup restore is rehearsed against a disposable database.
- Remote desktop/mobile smoke tests pass against the deployed URLs.
- No readiness blocker, untracked source, secret leak, critical accessibility
  defect, or unexplained high-severity dependency issue remains.
- Deployment, rollback, backup, restore, observability, and incident notes are
  committed and usable without chat history.

## Final outcome

Task 124 should leave a self-contained, independently designed Japanese
character-learning product whose core daily loop is recognizably as complete
and efficient as WaniKani's:

1. learn a prerequisite-safe batch;
2. pass a typed lesson quiz;
3. wait for deterministic reviews;
4. advance components and kanji to unlock the next material;
5. understand level progress and the next action;
6. inspect complete item relationships and history;
7. reinforce mistakes without corrupting SRS;
8. continue through a bilingual 2,300-kanji/8,000-vocabulary course.

Alongside that loop, learners have a separate adaptive Hiragana and Katakana
path inspired by proven character-teaching patterns, not a phrase-course clone.
The product must achieve this with independent content, independent curriculum,
independent wording, original visual design, and source-traceable legal data.
