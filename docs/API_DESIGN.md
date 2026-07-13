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
- workload balance for due reviews, the next 24 hours, the rest of the seven-day
  horizon, and today's lesson capacity
- timezone-aware review forecast buckets
- recent review stats
- translation display mode: `ru`, `en`, or `ru-en`

`GET /dashboard` returns a compact authenticated-user overview for the first
screen. Review counts come from `UserSrsState`, available lesson count reuses
the lesson-queue availability logic, course progress is based on started card
states inside the active enrollment, and reports item and card percentages
separately. Workload reuses the same forecast states and user-configured review
and lesson limits; it does not create an independent schedule. Forecast buckets
use the user's timezone, and recent review stats aggregate review-session answers
from the last seven days.

### Kana lessons and assessment

- `GET /kana/assessment?script=hiragana|katakana`
- `POST /kana/assessment/answer`
- `GET /kana/lessons?script=hiragana|katakana`
- `POST /kana/lessons/answer`
- `GET /api/kana-strokes/:character` (Next.js web route)

The authenticated kana track covers a 104-target shared core per script: 46
modern basic characters, 20 dakuten variants, 5 handakuten variants, and 33
standard yoon combinations. Four sokuon patterns and script-specific long-vowel
spellings extend that to 115 hiragana targets and 113 katakana targets. The
assessment response omits romaji until answer feedback. The lesson response
groups targets into sequential units and includes readings for the teaching
step. Typed, choice, reverse-choice, matching, listening, and tracing
interactions all submit the target character plus the selected romaji through
the same answer endpoints, so the server remains the correctness authority.
Speech generation and stroke validation are client-side and send no audio or
pointer data to the API. Three correct answers
complete a target; later mistakes reset the current streak but not completed
lesson progress. Kana does not create `LearningCard` or `UserSrsState` records.

The web stroke route accepts one hiragana or katakana codepoint, fetches the
matching SVG from the pinned KanjiVG `r20250816` release, and returns it with
shared-cache headers. The client extracts only ordered path data and validates
the user's strokes locally. A completed trace submits the normal romaji answer
endpoint; the stroke SVG itself is not persisted in kana progress.

### Lessons

- `GET /lessons/queue[?deckId=:ownedDeckId]`
- `GET /lessons/active`
- `POST /lessons/start` with optional `deckId` and an ordered `itemIds` group
- `POST /lessons/:sessionId/progress`
- `POST /lessons/:sessionId/complete-item`
- `POST /lessons/:sessionId/finish`
- `POST /lessons/:sessionId/abandon`

`GET /lessons/queue` returns new learning items for the authenticated user's
active course enrollment. Availability uses the first incomplete course level,
item dependency thresholds, and the user's `dailyLessonLimit`. The response
contains a recommended batch of at most five items in `items`, every currently
eligible item within today's remaining limit in `availableItems`, plus
`batchLimit` and `remainingToday` for workload display. The picker cannot expose
items that fail course-level or dependency checks.

Starting a session validates the ordered `itemIds` against the current source,
daily allowance, and five-item batch limit, then stores the group in
`ReviewSession.statsJson`. `GET /lessons/active` returns the latest unfinished
session with only its remaining available items, current item, study phase, and
server-derived completion counts. `POST /lessons/:sessionId/progress` accepts a
group-owned `currentItemId` and `meaning|reading|context|quiz` phase. It stores no
typed quiz answers; after a reload, an active quiz restarts at the first card of
the current item. Starting a new group finishes the previous active lesson only
after the replacement session has been created successfully.

`POST /lessons/:sessionId/abandon` closes only an active session owned by the
authenticated user and records an `abandoned` outcome in `statsJson`. Existing
SRS rows are retained; uncompleted selected items remain eligible for a later
lesson. Normal completion records a `completed` outcome.

Each queue item includes published Russian and English mnemonics and hints,
grouped by their educational purpose. Mnemonics distinguish meaning, reading,
and story content; hints distinguish meaning, reading, and usage content. The
repository selects the latest published version for each locale and purpose and
adds private `UserMnemonic` rows belonging only to the authenticated user. The
web lesson filters those bilingual groups by the current translation display
mode; private text is labelled separately and is never promoted to global
content.

The lesson repository also batch-loads up to three published bilingual example
sentences per queued item through reverse prerequisite dependencies. Examples
retain reading, difficulty, source name, and license attribution; the UI filters
only their displayed translation, never their attribution.

With `deckId`, the queue uses an active text deck owned by the authenticated
user instead of the structured course. Deck order, dependency thresholds,
existing SRS progress, and the same daily limit determine availability. The
lesson session stores the validated deck id in `ReviewSession.statsJson`; item
completion always reloads that source from the session, so a client cannot
switch to another deck or bypass prerequisites while submitting answers.

`POST /lessons/:sessionId/complete-item` accepts `itemId` and an `answers` array
with exactly one `{ cardId, answerType, answer }` entry for every card on the
item. The API revalidates global and private accepted answers and blocked
answers. It returns `passed: false`, per-card feedback, and no SRS rows when any
answer fails. Only a complete accepted set atomically creates initial
`UserSrsState` rows using the configured default SRS system. Lesson sessions are
stored as `ReviewSession` records with `LESSON_QUIZ` mode until a dedicated
lesson-session table is introduced.

### Reviews

- `GET /reviews/queue`
- `POST /reviews/start`
- `POST /reviews/:sessionId/answer`
- `POST /reviews/:sessionId/finish`
- `GET /reviews/practice/queue?source=recent-lessons|recent-mistakes|burned`
- `POST /reviews/practice/answer`

Practice queues contain at most 20 user-owned cards. Recent lessons use SRS
states created in the last 14 days, recent mistakes use distinct cards with a
wrong or revealed review in the last 30 days, and burned practice uses cards
whose SRS state has `burnedAt` set. Practice answer validation reuses global,
private, and blocked answer rules, but it creates no review session or answer
record and never invokes SRS scheduling.

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

When a rejected reading matches another KANJIDIC2 reading of the same kanji,
lesson, review, and practice feedback identify it as an alternative reading.
The diagnostic requests another answer without recording a review attempt,
changing SRS state, or incrementing practice errors.

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

Item details also return at most five published bilingual example sentences
whose sentence learning items depend on the requested material. Each example
keeps its reading, difficulty, Russian and English translations, and source
license attribution. Search summaries and nested dependency summaries do not
load examples.

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
- `PATCH /decks/:id/status`

`POST /decks/from-text` uses local dictionary longest matching: it splits
contiguous Japanese text runs, emits exact substrings up to eight characters,
and matches those candidates to existing `Word` and `Kanji` learning items.
Overlapping word matches are resolved left-to-right by longest surface form,
then frequency and stable id; distinct kanji matches remain available for the
prerequisite path. The response reports discarded overlaps. This process calls
no external API and does not claim to provide deinflection or full Japanese
morphological analysis.

`PATCH /decks/:id/status` accepts owner-scoped `{ status: "active" | "archived" }`.
Archiving is reversible and preserves deck items and SRS progress. Archived
decks remain readable in the personal library but cannot be used as a lesson
source until restored. A lesson session validated before archival may finish
its current quiz, so changing library status in another tab cannot strand an
in-progress session.

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
