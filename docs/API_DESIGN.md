# API design direction

## Modules

- `AuthModule`
- `UsersModule`
- `ItemsModule`
- `CoursesModule`
- `LessonsModule`
- `ReviewsModule`
- `SrsModule`
- `DecksModule`
- `SearchModule`
- `OverridesModule`
- `AdminModule`
- `ImportsModule`

## Core endpoints

### Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Local auth uses stateless `Authorization: Bearer` session tokens signed with
`AUTH_TOKEN_SECRET` via HMAC-SHA256. This keeps the MVP API simple while
avoiding server-side session storage; logout is client-side token discard until
token revocation storage is introduced. Passwords are hashed with Node
`crypto.scrypt`; password hashes are never returned from API responses.

`User.role` is either `USER` or `ADMIN`. Authenticated endpoints require a valid
bearer token, and admin endpoints require `ADMIN`. Development demo users belong
only in the development seed path. The local seed account is
`demo@example.local` / `dev-password` and is skipped when `NODE_ENV=production`.

User settings include `locale`, `translationDisplayMode` (`ru`, `en`, or
`ru-en`), `timezone`, `dailyLessonLimit`, `reviewBudget`, and `strictMode`.

### Dashboard

- `GET /dashboard`
- due reviews count
- available lessons count
- burned card and leech candidate counts
- current course/level plus current-level completion progress
- timezone-aware review forecast buckets
- recent review stats
- translation display mode: `ru`, `en`, or `ru-en`

`GET /dashboard` returns a compact authenticated-user overview for the first
screen. Review counts come from `UserSrsState`, available lesson count reuses
the lesson-queue availability logic, course progress is based on started card
states inside the active enrollment, forecast buckets use the user's timezone,
and recent review stats aggregate review-session answers from the last seven
days.

### Kana lessons and assessment

- `GET /kana/assessment?script=hiragana|katakana`
- `POST /kana/assessment/answer`
- `GET /kana/lessons?script=hiragana|katakana`
- `POST /kana/lessons/answer`

The authenticated kana track covers 71 independent characters per script: 46
modern basic characters, 20 dakuten variants, and 5 handakuten variants. The
assessment response omits romaji until answer feedback. The lesson response
groups characters into sequential rows and includes readings for the teaching
step. Three correct answers complete a character; later mistakes reset the
current streak but not completed lesson progress. Kana does not create
`LearningCard` or `UserSrsState` records.

### Lessons

- `GET /lessons/queue`
- `POST /lessons/start`
- `POST /lessons/:sessionId/complete-item`
- `POST /lessons/:sessionId/finish`

`GET /lessons/queue` returns new learning items for the authenticated user's
active course enrollment. Availability uses the first incomplete course level,
item dependency thresholds, and the user's `dailyLessonLimit`. Completing a
lesson item creates initial `UserSrsState` rows for that item's cards using the
configured default SRS system. Lesson sessions are stored as `ReviewSession`
records with `LESSON_QUIZ` mode until a dedicated lesson-session table is
introduced.

### Reviews

- `GET /reviews/queue`
- `POST /reviews/start`
- `POST /reviews/:sessionId/answer`
- `POST /reviews/:sessionId/finish`

`GET /reviews/queue` returns due, non-burned `LearningCard` prompts for the
authenticated user and respects the user's `reviewBudget`. Queue cards expose
the Japanese prompt, reading where appropriate, item kind, due time, and SRS
summary, but they do not include accepted answers, blocked answers, or meaning
translations that would reveal the answer before submission.

`POST /reviews/:sessionId/answer` validates the submitted answer with global
answers plus the current user's private accepted answers, records a
`ReviewAnswer`, updates `UserSrsState` through `packages/srs`, and returns
feedback with the result, correct answers, blocked-answer reason if relevant,
and previous/next SRS summaries. Answers can be submitted only to the current
user's active review session.

### Items

- `GET /items/:id`
- `GET /kanji/:character`
- `GET /words/:id`
- `GET /search?q=`

Item detail responses return learning item summaries, cards, accepted and
blocked answers, hints, mnemonics, dependency summaries, source attribution
summaries, and current-user private overrides when the request includes a valid
bearer token. Normal learner responses expose attribution metadata only; raw
import records stay out of public item/search responses.

Component item details expose `translations` as the learnable component meaning
and a separate `componentDetails` object with bilingual `name` and
`shapeDescription` bundles. A visual label such as "horizontal stroke" must not
be returned as a dictionary meaning or accepted answer merely because it names
the component's shape.

Search supports kanji characters, Japanese expressions, readings, and
Russian/English meanings. Search responses are paginated with `page` and
`limit`.

### User overrides

- `GET /cards/:cardId/overrides`
- `POST /cards/:cardId/overrides`
- `DELETE /cards/:cardId/overrides/:overrideId`
- `PUT /items/:itemId/private-mnemonic`

Card overrides are private to the authenticated user. `POST
/cards/:cardId/overrides` stores a private accepted meaning or reading with
`answerKind`, `text`, optional `locale` (`ru-RU` or `en-US`), and optional
`note`. Override responses include the saved `note` and audit timestamps. Private
accepted answers participate in answer validation only for the owner. Global
blocked answers are checked first; if a submitted answer matches a global
blocked answer, it is rejected even when the same text exists as an exact private
accepted answer.

`PUT /items/:itemId/private-mnemonic` stores a private item mnemonic or note in
`body` with optional `mnemonicType` (`meaning`, `reading`, `story`) and optional
`locale`. Private mnemonics are returned from item detail only to their owner.

### Decks

- `POST /decks/from-text`
- `GET /decks`
- `GET /decks/:id`
- `POST /decks/:id/enroll`

`POST /decks/from-text` uses a local MVP tokenizer fallback: it splits contiguous
Japanese text runs, emits exact substrings up to eight characters, extracts kanji
characters, and matches those candidates to existing `Word` and `Kanji`
learning items. It does not call external APIs and is not intended to be perfect
Japanese morphological analysis.

### Admin

- `GET /admin/import-runs`
- `GET /admin/imported-candidates`
- `POST /admin/imported-candidates/promote`
- `POST /admin/imported-candidates/approve-translation`
- `GET /admin/items/review-queue`
- `PATCH /admin/items/:id`
- `PATCH /admin/cards/:id/answers`

`GET /admin/import-runs` lists recent import operations with source, license,
source version, source file name, checksum, status, stats, errors, timestamps,
and imported record count. Local-file imports are run through controlled CLI
commands documented in `docs/IMPORT_OPERATIONS.md`; the MVP API deliberately
does not expose a `POST /admin/import-runs` endpoint that accepts server file
paths.

`GET /admin/imported-candidates` ranks import-derived kanji and words that do
not yet have a `LearningItem`. Ranking is deterministic and explains its score
through source frequency/priority, JLPT or school-grade signals, bilingual
meaning coverage, reading availability, and KanjiVG stroke coverage. The score
is an editorial ordering aid, not a published curriculum level.

The endpoint considers up to 500 frequency-ordered kanji and 500 words, merges
their computed scores, applies stable tie-breakers, and returns the top 100.
JMdict `nfXX` tags are normalized to approximate 500-word frequency bands;
`ichi/news/spec/gai` tier 1 and tier 2 tags map to approximate ranks 1,000 and
10,000. Values below 500 from older imports are normalized on read until the
same source snapshot is re-imported with the corrected mapping. KANJIDIC2 still
uses the legacy four-level JLPT field, so candidate
suggestions map legacy 4 to N5, 3 to N4, 2 to N2, and leave legacy 1 outside the
current N5-N2 course scope. These mappings must remain visible as ranking
heuristics and must not be presented as official modern JLPT assignments.

The admin translation-review workspace uses the ranked candidates that contain
both Russian and English imported meanings. It never displays or persists
unsupported gloss languages. `POST /admin/imported-candidates/approve-translation`
requires reviewed RU and EN learning meanings plus at least one accepted answer
for each locale. In one transaction it creates or updates the `LearningItem`,
stores the reviewed meanings as `PROJECT_AUTHORED`, creates a bilingual meaning
card, and creates a reading card from the imported source reading when present.
The original imported meanings remain unchanged and traceable. The resulting
item stays in `needs-review` until the remaining quality gates are satisfied.
No reject action is exposed because rejected-candidate state is not yet stored.
Kanji meaning uniqueness includes `sourceKind`, allowing an imported meaning
and its separately reviewed project-authored counterpart to retain identical
wording without collapsing provenance.

## API rules

- Keep endpoints stable and typed.
- Use DTO schemas shared with web where possible.
- Return card translations in Russian, English, or both according to user settings/requested display mode.
- Never expose password hashes, raw secrets, or internal import errors to ordinary users.
