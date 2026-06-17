# Full Codex task prompts

Copy one task at a time. Do not ask Codex to implement the whole project in one run.

## 00. Repository bootstrap

```text
Read AGENTS.md and docs/PROJECT_BRIEF.md before editing.

Create the initial pnpm TypeScript monorepo for the kanji SRS app.

Requirements:
- Create pnpm workspace.
- Add apps/web as a Next.js app with TypeScript.
- Add apps/api as a NestJS API with TypeScript.
- Add packages/db, packages/srs, packages/japanese, packages/content-importers, packages/shared, packages/ui.
- Add root TypeScript, ESLint, Prettier, and Vitest configuration.
- Add Docker Compose for PostgreSQL and Redis.
- Add root scripts: dev, build, lint, typecheck, test, format.
- Add .env.example files for web/api/db.
- Add README.md with local setup instructions.
- Do not implement product features yet.

Validation:
- pnpm install works.
- pnpm lint/typecheck/test either pass or have clear placeholder behavior.
- Monorepo package references are correct.

Summarize changed files and next recommended task.
```

## 01. Prisma schema and migrations

```text
Read AGENTS.md, docs/DATA_MODEL.md, docs/ARCHITECTURE.md, and packages/db/AGENTS.md before editing.

Implement the initial Prisma schema in packages/db.

Requirements:
- Add models for License, DataSource, ImportRun, ImportedRecord.
- Add models for Component, Kanji, KanjiReading, KanjiMeaning, KanjiComponent.
- Add models for Word, WordSense, Sentence.
- Add models for LearningItem, LearningCard, LearningAnswer, BlockedAnswer, Mnemonic, Hint, Dependency.
- Add models for User, UserSettings, UserItemOverride, UserMnemonic, UserEnrollment.
- Add models for Course, CourseLevel, CourseLevelItem, Deck, DeckItem.
- Add models for SrsSystem, SrsStage, UserSrsState, ReviewSession, ReviewAnswer.
- Use UUID primary keys for app-owned records.
- Use stable source IDs where needed.
- Add unique constraints and indexes for Japanese character, word expression/reading, locale, source IDs, due reviews, user/card state, and course ordering.
- Add a migration.
- Add a seed script with tiny legally safe handcrafted sample data only: a few components, kanji, words, cards, SRS stages, and one demo user if appropriate.

Validation:
- Prisma generate succeeds.
- Migration applies to local Postgres.
- Seed succeeds.
- Add basic tests or schema validation where practical.

Summarize schema choices and any tradeoffs.
```

## 02. SRS engine package

```text
Read AGENTS.md, docs/SRS.md, and packages/srs/AGENTS.md before editing.

Implement packages/srs as a framework-agnostic TypeScript package.

Requirements:
- Define types for SrsStage, UserSrsStateSnapshot, ReviewResult, SchedulingInput, SchedulingResult.
- Implement calculateNextReview(input).
- Implement default stage config with configurable intervals.
- Implement correct-answer advancement.
- Implement wrong-answer demotion.
- Implement typo/reveal/manual-ignore handling.
- Implement burned card behavior.
- Implement resurrectCard(input).
- Implement buildReviewForecast(input) grouped by hour/day.
- Keep functions deterministic by accepting `now` as input.
- Do not import Prisma, NestJS, Next.js, or React.

Tests:
- correct answer at every stage
- wrong answer at early and late stages
- typo behavior
- reveal behavior
- burned item stays burned unless resurrected
- resurrected item returns to configured stage
- forecast grouping
- timezone/date boundary behavior if implemented

Validation:
- pnpm test for packages/srs passes.
- pnpm typecheck passes for this package.

Summarize the public API.
```

## 03. Japanese/Russian/English normalization and answer validation

```text
Read AGENTS.md and packages/japanese/AGENTS.md before editing.

Implement packages/japanese for answer normalization and validation.

Requirements:
- normalizeKana(input)
- katakanaToHiragana(input)
- normalizeJapaneseReading(input)
- normalizeRussianMeaning(input)
- calculateStringDistance or conservative typo helper
- isReadingAccepted(input)
- isMeaningAccepted(input)
- validateAnswer(input) that supports reading vs meaning cards
- Support accepted answers, blocked answers, and user private accepted answers.
- Blocked answers must override fuzzy acceptance.
- Russian normalization should handle case, whitespace, punctuation, ё/е, and comma/semicolon-separated answer lists.
- English meaning normalization should support case, whitespace, punctuation, comma/semicolon-separated answer lists, accepted answers, blocked answers, and conservative typo tolerance.
- Typo tolerance must be conservative and configurable.

Tests:
- hiragana vs katakana readings
- whitespace normalization
- Russian case normalization
- English case normalization
- ё/е normalization
- accepted synonym
- user private accepted answer
- blocked answer rejection
- typo accepted for long answer
- typo rejected for short/ambiguous answer
- wrong meaning rejected

Validation:
- pnpm test for packages/japanese passes.
- pnpm typecheck passes for this package.

Summarize edge cases and known limitations.
```

## 04. Shared DTOs and API contracts

```text
Read AGENTS.md, docs/API_DESIGN.md, apps/api/AGENTS.md, and apps/web/AGENTS.md before editing.

Create packages/shared with DTOs and API contract types.

Requirements:
- Define shared types for ItemSummary, ItemDetails, LearningCardDto, ReviewQueueItem, ReviewAnswerRequest, ReviewAnswerResponse, LessonQueueItem, DashboardDto, UserOverrideDto, DeckDto.
- Include Russian/English translation fields and a translation display mode contract: `ru`, `en`, or `ru-en`.
- Add runtime validation using the chosen validation library only if already installed or clearly justified.
- Keep DTOs serializable and frontend-safe.
- Avoid leaking internal Prisma models directly to web.

Validation:
- Typecheck shared package.
- Add minimal unit tests or type tests where useful.

Summarize how web and api should import these types.
```

## 05. API foundation

```text
Read AGENTS.md, docs/API_DESIGN.md, apps/api/AGENTS.md, and packages/db/AGENTS.md before editing.

Build the NestJS API foundation.

Requirements:
- Add configuration module for environment variables.
- Add Prisma/database module using packages/db.
- Add health endpoint.
- Add auth skeleton with local email/password or dev auth, depending on current repo state.
- Add users module and current-user endpoint.
- Add global validation/error handling.
- Add structured logging basics.
- Do not implement all product modules yet.

Validation:
- API starts locally.
- Health endpoint works.
- Unit/e2e test for health endpoint.
- Typecheck passes.

Summarize endpoints and env vars.
```

## 06. Auth and user settings

```text
Read AGENTS.md and apps/api/AGENTS.md before editing.

Implement authentication and user settings.

Requirements:
- Register/login/logout/current user.
- Password hashing with a safe library.
- JWT or session strategy; document the choice.
- User role: USER, ADMIN.
- UserSettings with locale, translation display mode (`ru`, `en`, `ru-en`), timezone, daily lesson limit, review budget, strict mode.
- Protect API endpoints that require auth.
- Protect admin endpoints by role.
- Add seed/dev user only in development seed.

Tests:
- register success
- duplicate email rejection
- login success/failure
- current user protected endpoint
- admin guard rejects normal user

Validation:
- API tests pass.
- Typecheck passes.

Summarize security assumptions.
```

## 07. Items and search API

```text
Read AGENTS.md, docs/API_DESIGN.md, docs/DATA_MODEL.md, and apps/api/AGENTS.md before editing.

Implement item detail and search APIs.

Requirements:
- GET /items/:id returns LearningItem details with cards, answers, hints, mnemonics, dependencies, source attribution summary, and user-specific overrides if authenticated.
- GET /kanji/:character returns kanji details.
- GET /search?q= supports kanji character, Japanese expression, reading, and Russian/English meaning search.
- Keep raw source records out of normal user responses unless admin.
- Add pagination for search.

Tests:
- search by kanji
- search by Japanese word
- search by reading
- search by Russian/English meaning
- item details include user overrides only for the owner

Validation:
- API tests pass.
- Typecheck passes.
```

## 08. User private overrides

```text
Read AGENTS.md, packages/japanese/AGENTS.md, docs/API_DESIGN.md, and apps/api/AGENTS.md before editing.

Implement private user overrides for accepted answers and mnemonics.

Requirements:
- User can add private accepted meaning/reading for a learning card in Russian and/or English.
- User can remove private accepted answers.
- User can save private mnemonic/note for a learning item.
- Overrides affect only that user.
- Answer validation must include user overrides.
- Blocked global answers still override user fuzzy matching, but exact user overrides should be handled according to a documented rule.
- Add audit timestamps.

Tests:
- private accepted answer is correct for owner
- private accepted answer is not correct for another user
- deleted override no longer works
- private mnemonic is returned on item detail for owner only

Validation:
- API tests pass.
- Japanese package tests still pass.
```

## 09. Review API

```text
Read AGENTS.md, docs/SRS.md, docs/API_DESIGN.md, packages/srs/AGENTS.md, packages/japanese/AGENTS.md, and apps/api/AGENTS.md before editing.

Implement review queue and answer submission.

Requirements:
- GET /reviews/queue returns due learning cards for current user.
- POST /reviews/start creates ReviewSession.
- POST /reviews/:sessionId/answer validates answer, records ReviewAnswer, updates UserSrsState using packages/srs, and returns feedback.
- POST /reviews/:sessionId/finish closes the session.
- Queue should not expose accepted answers before submission.
- Feedback after submission should show correct answer, result, next review timing, and concise explanation.
- Use user private accepted answers during validation.

Tests:
- due queue returns due cards only
- correct answer advances stage
- wrong answer demotes stage
- user override accepted
- blocked answer rejected
- answers cannot be submitted to another user’s session
- burned card no longer appears in queue

Validation:
- API tests pass.
- SRS and Japanese tests pass.
```

## 10. Lessons API and unlock logic

```text
Read AGENTS.md, docs/CURRICULUM.md, docs/API_DESIGN.md, and apps/api/AGENTS.md before editing.

Implement lessons queue and basic unlock logic.

Requirements:
- GET /lessons/queue returns available new learning items/cards.
- Availability respects course enrollment, level order, dependencies, and daily lesson limit.
- POST /lessons/start creates a lesson session.
- Completing lesson items creates initial UserSrsState records for their cards.
- New kanji should require components or prerequisites according to dependency rules.
- New vocabulary should require related kanji or course unlock rule.
- Keep unlock policy configurable enough for later dynamic decks.

Tests:
- no lessons without enrollment
- first level lessons are available
- dependent item locked until prerequisite threshold
- completing lesson creates SRS states
- daily lesson limit respected

Validation:
- API tests pass.
```

## 11. Dashboard API

```text
Read AGENTS.md and docs/API_DESIGN.md before editing.

Implement GET /dashboard.

Requirements:
- Return due review count.
- Return available lesson count.
- Return current course and level progress.
- Return review forecast buckets.
- Return recent review stats.
- Return leech candidate count if available.
- Keep response fast with appropriate queries/indexes.

Tests:
- dashboard for new user
- dashboard with due reviews
- dashboard with completed lessons
- dashboard respects user timezone if forecast uses it

Validation:
- API tests pass.
```

## 12. Web foundation

```text
Read AGENTS.md, docs/WEB_UI.md, apps/web/AGENTS.md, and packages/shared before editing.

Build the Next.js web foundation.

Requirements:
- App shell with Russian UI and learning translation display mode setting (`ru`, `en`, `ru-en`).
- Responsive layout.
- API client wrapper.
- Auth pages or dev auth integration depending on current API state.
- Dashboard page consuming GET /dashboard.
- Error/loading states.
- Basic navigation: Dashboard, Lessons, Reviews, Search, Decks, Settings.
- No WaniKani visual clone.

Tests:
- Playwright smoke test loads dashboard.
- Component tests if setup exists.
- Typecheck passes.

Summarize UI structure.
```

## 13. Review session UI

```text
Read AGENTS.md, docs/WEB_UI.md, apps/web/AGENTS.md, packages/japanese/AGENTS.md, and packages/shared before editing.

Implement the review session UI.

Requirements:
- Fetch review queue.
- Start review session.
- Show one prompt at a time.
- Autofocus input.
- Submit with Enter.
- Show feedback after submission.
- Continue with Enter.
- Distinguish meaning and reading cards.
- Show correct answers only after submission.
- Add button/form to save a private accepted answer from feedback.
- Mobile layout with sticky input.
- Graceful empty queue state.

Tests:
- Playwright: complete one correct review.
- Playwright: wrong answer shows feedback.
- Playwright: add private answer and use it later if feasible with seed data.
- Typecheck passes.

Summarize UX decisions.
```

## 14. Lesson session UI

```text
Read AGENTS.md, docs/WEB_UI.md, docs/CURRICULUM.md, and apps/web/AGENTS.md before editing.

Implement the lesson flow UI.

Requirements:
- Fetch lesson queue.
- Start a lesson session.
- Show item explanation, readings/meanings, components/relations, mnemonic/hint in the selected translation display mode.
- Include mini-quiz before marking item learned.
- Complete lesson creates SRS state through API.
- Show progress within session.
- Mobile-friendly layout.
- Empty lesson state.

Tests:
- Playwright: start lesson and complete one item.
- Typecheck passes.
```

## 15. Item page and private notes UI

```text
Read AGENTS.md and docs/WEB_UI.md before editing.

Implement item detail pages.

Requirements:
- Show kanji/word/component/sentence details.
- Show readings, meanings, example sentences, dependencies, related vocabulary/kanji in the selected translation display mode.
- Show stroke order placeholder if KanjiVG data is not implemented yet.
- Show source attribution summary.
- Show global accepted answers and blocked-answer warnings only in a learner-friendly way.
- Let the user add/edit/delete private accepted answers and private mnemonics/notes.
- Keep private data visible only to the owner.

Tests:
- Playwright: open item page.
- Playwright: add private synonym.
- Playwright: edit private mnemonic.
```

## 16. Admin content curation UI

```text
Read AGENTS.md, docs/DATA_MODEL.md, docs/DATA_SOURCES_AND_LICENSING.md, and docs/WEB_UI.md before editing.

Implement minimal admin content curation screens.

Requirements:
- Admin-only routes.
- List learning items needing review.
- Edit Russian and English meanings, accepted answers, blocked answers, hints, and mnemonics.
- View source attribution and import run info.
- Publish/unpublish learning items.
- Keep audit timestamps.
- Do not build public community features.

Tests:
- normal user cannot access admin.
- admin can edit accepted answers.
- edited answer affects validation.
```

## 17. KANJIDIC2 importer fixture

```text
Read AGENTS.md, docs/DATA_SOURCES_AND_LICENSING.md, packages/content-importers/AGENTS.md, and packages/db/AGENTS.md before editing.

Implement the first KANJIDIC2 importer using a tiny fixture.

Requirements:
- Add a small XML fixture in data/fixtures with a few kanji records safe for tests.
- Parse character, stroke count, readings, meanings, grade/JLPT/frequency where present.
- Convert parsed rows into normalized import DTOs.
- Add a CLI command or package script that can read a local file path.
- Record DataSource, License, ImportRun, and ImportedRecord when writing to DB.
- Do not download from the internet inside tests.

Tests:
- parser extracts expected fields from fixture.
- DB write is idempotent for the same source IDs.
- import run records checksum/status.
```

## 18. JMdict importer fixture

```text
Read AGENTS.md and packages/content-importers/AGENTS.md before editing.

Implement a JMdict importer using a tiny fixture.

Requirements:
- Parse entries, kanji expressions, readings, senses, parts of speech, glosses, and priority tags where present.
- Normalize into Word and WordSense import DTOs.
- Keep raw source data traceable.
- Add local-file import command.
- Do not treat raw glosses as final Russian or English learning content.

Tests:
- parser handles one-kanji word, kana-only word, multiple senses, and multiple readings.
- DB write is idempotent.
- import run status/checksum recorded.
```

## 19. KanjiVG importer fixture and renderer support

```text
Read AGENTS.md, packages/content-importers/AGENTS.md, and docs/WEB_UI.md before editing.

Implement KanjiVG fixture parsing and item-page rendering support.

Requirements:
- Parse a small KanjiVG XML/SVG fixture.
- Store stroke paths or a normalized JSON representation linked to Kanji.
- Add source attribution.
- Add API field for stroke data on kanji item details.
- Add web component that renders stroke order data in a simple, accessible way.
- Keep renderer original; do not copy another app's UI.

Tests:
- parser test for stroke count/path count.
- API item details include stroke data.
- UI smoke test renders stroke section.
```

## 20. Tatoeba importer fixture

```text
Read AGENTS.md and docs/DATA_SOURCES_AND_LICENSING.md before editing.

Implement Tatoeba sentence importer using tiny fixtures.

Requirements:
- Parse Japanese sentences and Russian/English linked translations from local fixture files.
- Store sentence IDs, links, source attribution, and license info.
- Add simple quality filters: language, max length, has translation, not empty.
- Do not import audio in this task.
- Link sentences to known words only if existing tokenizer/matcher support is available; otherwise leave TODO with tests for parser only.

Tests:
- parser reads sentences and links.
- DB write records attribution.
- filters reject empty/too-long rows.
```

## 21. Course seed generator

```text
Read AGENTS.md, docs/CURRICULUM.md, docs/DATA_MODEL.md, and docs/DATA_SOURCES_AND_LICENSING.md before editing.

Implement a course seed generator for a small handcrafted starter course.

Requirements:
- Create 3-5 demo levels from legally safe, project-authored content.
- Include components, kanji, vocabulary, learning cards, accepted answers, blocked answers, and dependencies.
- Use original Russian and English meanings/mnemonics/hints.
- Do not copy WaniKani order or wording.
- Seed enough data for full lesson/review UI testing.

Tests:
- seed creates course and levels.
- dependencies are valid.
- no card without accepted answer.
- demo user can enroll and receive lessons.
```

## 22. Dynamic text deck MVP

```text
Read AGENTS.md, docs/CURRICULUM.md, and docs/API_DESIGN.md before editing.

Implement dynamic text deck MVP.

Requirements:
- User can paste Japanese text.
- App extracts candidate tokens using a lightweight tokenizer or a clearly documented fallback.
- App matches tokens to existing Word/Kanji records.
- App creates a Deck and DeckItems.
- Deck explains why each item was included: appears in text, prerequisite kanji, prerequisite component, high frequency.
- Do not require perfect Japanese NLP for MVP.
- Do not call external APIs.

Tests:
- paste text creates deck.
- known items are not duplicated unnecessarily.
- unknown words become deck items when present in DB.
- deck belongs only to owner.
```

## 23. Search and dictionary UI

```text
Read AGENTS.md and docs/WEB_UI.md before editing.

Implement search/dictionary UI.

Requirements:
- Search by kanji, Japanese word, reading, and Russian/English meaning.
- Show result type, primary meaning, reading, level/JLPT hints, and known/SRS state if authenticated.
- Click result opens item page.
- Mobile-friendly search.
- Empty and loading states.

Tests:
- Playwright search by kanji.
- Playwright search by Russian/English meaning.
```

## 24. Review forecast and workload controls

```text
Read AGENTS.md and docs/SRS.md before editing.

Implement review forecast and workload controls.

Requirements:
- Add forecast API using packages/srs.
- Add dashboard forecast UI.
- Add user settings for daily lesson limit, review budget, strict mode, timezone.
- Lesson queue should respect daily lesson limit.
- Review UI should show workload-friendly empty/completed states.

Tests:
- settings update affects lesson queue.
- forecast buckets display due counts.
- strict mode affects typo behavior if implemented.
```

## 25. Leech detection MVP

```text
Read AGENTS.md and docs/SRS.md before editing.

Implement leech detection MVP.

Requirements:
- Add leech score calculation based on wrongCount, recent wrong answers, and stage instability.
- Show leech candidates on dashboard or settings page.
- Item page should suggest reviewing mnemonic/notes for leeches.
- Do not create complex ML model.

Tests:
- repeated wrong answers increase leech score.
- correct streak lowers or stabilizes leech score according to documented rule.
```

## 26. Import/admin operations

```text
Read AGENTS.md, docs/DATA_SOURCES_AND_LICENSING.md, and docs/API_DESIGN.md before editing.

Implement admin import operations.

Requirements:
- Admin can view import runs.
- Admin can trigger local-file import only in safe/dev mode or through a controlled CLI command.
- Show import status, source, checksum, stats, and errors.
- Do not allow arbitrary server file reads from public API.
- Add clear documentation for running imports locally.

Tests:
- admin-only access.
- import run list renders.
- unsafe file paths rejected if API trigger exists.
```

## 27. CI pipeline

```text
Read AGENTS.md before editing.

Add CI configuration.

Requirements:
- Install dependencies with pnpm.
- Run lint.
- Run typecheck.
- Run unit tests.
- Run Prisma generate.
- Optionally run Playwright smoke tests if browser setup is feasible.
- Cache dependencies where appropriate.
- Do not require real production secrets.

Validation:
- CI file is syntactically valid.
- Local commands match README.
```

## 28. Production Docker build

```text
Read AGENTS.md before editing.

Add production-ready Dockerfiles and deployment docs.

Requirements:
- Dockerfile for apps/api.
- Dockerfile for apps/web.
- docker-compose for production-like local run.
- Environment variable documentation.
- Database migration command documentation.
- Healthcheck endpoints.
- Do not include secrets in repo.

Validation:
- Docker build succeeds if possible.
- Docs explain start/migrate/seed flow.
```

## 29. Security review and hardening

```text
Read AGENTS.md before editing.

Review and harden auth/security.

Spawn subagents: security_reviewer, db_reviewer, frontend_reviewer, and test_engineer. Wait for all results, then implement only the agreed high-priority fixes.

Focus areas:
- admin authorization
- user-private overrides isolation
- XSS risks in user notes/mnemonics/Japanese text
- password hashing and token storage
- unsafe import endpoints
- rate limiting for auth/review submissions
- secrets handling

Validation:
- Add regression tests for each fixed issue.
- Run relevant tests.
```

## 30. Data/license audit

```text
Read AGENTS.md and docs/DATA_SOURCES_AND_LICENSING.md before editing.

Perform a data/license audit.

Spawn licensing_auditor and content_quality_reviewer. Wait for both. Do not edit until they report. Then implement documentation/schema/test fixes only.

Audit areas:
- no WaniKani copied content
- every import has source/license/checksum/import run
- attributions visible in admin and item pages where needed
- raw datasets are not accidentally committed
- audio import disabled unless license tracked
- README/docs explain data-source obligations

Validation:
- Add tests or checks where possible.
- Update docs.
```

## 31. Frontend UX/accessibility review

```text
Read AGENTS.md and docs/WEB_UI.md before editing.

Review and improve learner UX.

Spawn frontend_reviewer and test_engineer. Wait for both. Implement targeted fixes only.

Focus areas:
- mobile review flow
- keyboard navigation
- loading/error/empty states
- Japanese text readability
- Russian UI copy clarity and Russian/English learning-content consistency
- review session speed
- not visually cloning WaniKani

Validation:
- Add/adjust Playwright tests.
- Typecheck and test.
```

## 32. N5-N2 curriculum expansion framework

```text
Read AGENTS.md and docs/CURRICULUM.md before editing.

Implement framework for expanding structured course content toward N2 without adding massive content yet.

Requirements:
- Course bands Foundation, N5, N4, N3, N2.
- Admin filters by band, JLPT level, status, missing accepted answers, missing mnemonics.
- Import-derived candidates can be promoted into curated learning items.
- Add quality gates: no published card without accepted answer, Russian/English locale coverage, source attribution, and dependency validation.
- Add CLI/admin report for content completeness by band.

Tests:
- quality gate rejects incomplete card.
- admin filters work.
- completeness report counts missing data.
```

## 33. Final MVP integration test

```text
Read AGENTS.md before editing.

Create an end-to-end MVP integration test path.

Scenario:
- Register/login as a user.
- Enroll in starter course.
- See dashboard.
- Start a lesson.
- Complete a lesson item.
- See card become reviewable through test time control or seeded due state.
- Start review.
- Answer correctly.
- Add a private accepted answer.
- Search for the item.
- Open item page.

Requirements:
- Prefer Playwright for web path.
- Use deterministic seed data.
- Do not rely on external network.
- Document how to run the test.
```
