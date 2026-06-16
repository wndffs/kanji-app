# AGENTS.md

## Project identity

We are building a personal Russian-localized Japanese kanji/vocabulary SRS web application inspired by the product patterns of WaniKani, jpdb, Kanshudo, Kanji Koohii, Renshuu, and Bunpro, but with independent data, independent wording, independent level order, and independent UI.

The app is for Russian-speaking learners from complete beginner through approximately JLPT N2. It must support two learning modes:

1. A structured level-based course: components -> kanji -> vocabulary -> sentences.
2. Dynamic decks/text mining: the user can paste Japanese text and the app creates a learning path from unknown words, kanji, and prerequisites.

This is a personal project, not a public marketplace. Do not build community-published mnemonics or public user-generated content in the MVP. The user may save private custom meanings, synonyms, notes, and mnemonics that are accepted as correct only for that user.

## Legal and data boundaries

Never copy WaniKani proprietary content, mnemonics, level order, radical names, example sentences, audio, CSS, visual design, copywriting, or database dumps.

WaniKani may be used only as product inspiration. Do not implement a scraper. Do not use unauthorized WaniKani decks, dumps, or API exports as seed data. If WaniKani import is ever added later, it must be limited to user-owned progress mapping and must not persist WaniKani educational content.

Use legally reusable data sources only. Track every source in the database with license, source URL, version/date, checksum, attribution text, and import run. Preferred sources:

- JMdict / KANJIDIC2 / related EDRDG data for dictionary and kanji metadata.
- KanjiVG for stroke order and component graphics.
- Tatoeba for example sentences where license and attribution requirements are satisfied.
- Project-authored Russian educational content for meanings, explanations, hints, and mnemonics.

Raw imported data and curated pedagogical content are different layers. Keep them separate.

## Chosen architecture

Use a TypeScript monorepo with pnpm workspaces.

Recommended structure:

- `apps/web`: Next.js web app with responsive mobile-first UI.
- `apps/api`: NestJS API service.
- `packages/db`: Prisma schema, migrations, database client, seed helpers.
- `packages/srs`: SRS scheduling engine, deterministic and thoroughly tested.
- `packages/japanese`: Japanese/Russian normalization, answer validation, token helpers.
- `packages/content-importers`: import pipelines for open data sources.
- `packages/shared`: shared types, DTOs, constants.
- `packages/ui`: reusable UI components if needed.
- `docs`: product, architecture, licensing, and task docs.
- `.codex/agents`: project-scoped custom subagents.

Primary runtime dependencies:

- PostgreSQL for persistent data.
- Redis/BullMQ for background jobs if/when needed.
- Prisma for database access.
- Vitest/Jest for unit tests.
- Playwright for browser flows.
- Docker Compose for local infrastructure.

Avoid adding new production dependencies unless they solve a clear problem. When adding dependencies, document why they are needed and check license compatibility.

## Domain invariants

- A `LearningCard` is the unit scheduled by SRS.
- A `LearningCard` points to a target such as component, kanji, word, or sentence and has a prompt type such as meaning, reading, recall, cloze, or recognition.
- A user’s SRS state belongs to a specific `LearningCard`, not directly to raw dictionary rows.
- User custom accepted answers are private, user-scoped, and never become global content automatically.
- Dictionary data may contain many meanings; a course card should expose a curated subset suitable for learning.
- Russian meanings, hints, mnemonics, and explanations are first-class content, not afterthought translations.
- Every imported row must be traceable to a source and import run.
- The app must work without any WaniKani import.

## SRS rules

The SRS engine must be package-local and framework-agnostic. It should not import NestJS, Next.js, Prisma, or React.

Default MVP SRS can use configurable stages roughly like:

- Apprentice 1: 4 hours
- Apprentice 2: 8 hours
- Apprentice 3: 1 day
- Apprentice 4: 2 days
- Guru 1: 7 days
- Guru 2: 14 days
- Master: 30 days
- Enlightened: 120 days
- Burned: no next review

Do not hardcode these intervals into UI or API business logic. Store stage definitions in config or database seed data.

Review result types should distinguish: correct, wrong, typo, reveal, manual ignore, and resurrect.

## Answer validation rules

Reading validation:

- Normalize whitespace.
- Convert katakana to hiragana for reading comparison where appropriate.
- Support multiple accepted readings.
- Provide meaningful feedback for wrong reading vs wrong meaning.

Russian meaning validation:

- Normalize case, whitespace, punctuation, `ё/е`, and common separators.
- Compare against global accepted answers plus user private accepted answers.
- Respect blocked answers: if a blocked answer matches, it must be rejected even if fuzzy matching would accept it.
- Typo tolerance must be conservative and tested.
- Do not treat semantically different near-answers as correct.

## UI principles

- Mobile-first responsive layout.
- Keyboard-first review flow on desktop.
- No WaniKani visual clone. Use original layout, naming, colors, and copy.
- UI language defaults to Russian.
- Japanese text must use readable fonts and proper line height.
- Reviews should be fast: prompt -> answer -> feedback -> continue.
- Lessons should explain component/kanji/word relationships clearly.

## Testing expectations

Run relevant tests before finishing a task. Add tests for every behavior change.

Minimum test coverage expectations:

- `packages/srs`: unit tests for all stage transitions, wrong-answer penalties, burned/resurrected behavior, and edge cases.
- `packages/japanese`: unit tests for kana normalization, Russian normalization, accepted answers, blocked answers, and typo tolerance.
- `packages/content-importers`: parser tests against small fixtures only; do not rely on external network in tests.
- `apps/api`: service/controller tests for review, lesson, deck, and item endpoints.
- `apps/web`: Playwright smoke tests for dashboard, lesson session, review session, item page, and custom answer saving.

## Working style for Codex

Before editing, inspect existing files and summarize the minimal plan.

Implement only the requested task. Do not opportunistically rebuild unrelated parts.

Prefer small, reviewable changes. Keep domain logic in packages, not hidden inside React components or controllers.

After implementation:

1. Run formatter/lint/typecheck/tests relevant to changed files.
2. Summarize changed files.
3. Report any tests that could not be run and why.
4. Call out data/license assumptions explicitly.

When a task is broad, use project subagents only when explicitly requested in the prompt.
