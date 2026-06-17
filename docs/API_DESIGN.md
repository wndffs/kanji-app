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
- current course/level
- review forecast
- recent activity
- translation display mode: `ru`, `en`, or `ru-en`

### Lessons

- `GET /lessons/queue`
- `POST /lessons/start`
- `POST /lessons/:sessionId/complete-item`
- `POST /lessons/:sessionId/finish`

### Reviews

- `GET /reviews/queue`
- `POST /reviews/start`
- `POST /reviews/:sessionId/answer`
- `POST /reviews/:sessionId/finish`

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

Search supports kanji characters, Japanese expressions, readings, and
Russian/English meanings. Search responses are paginated with `page` and
`limit`.

### User overrides

- `GET /cards/:cardId/overrides`
- `POST /cards/:cardId/overrides`
- `DELETE /cards/:cardId/overrides/:overrideId`

### Decks

- `POST /decks/from-text`
- `GET /decks`
- `GET /decks/:id`
- `POST /decks/:id/enroll`

### Admin

- `GET /admin/import-runs`
- `POST /admin/import-runs`
- `GET /admin/items/review-queue`
- `PATCH /admin/items/:id`
- `PATCH /admin/cards/:id/answers`

## API rules

- Keep endpoints stable and typed.
- Use DTO schemas shared with web where possible.
- Return card translations in Russian, English, or both according to user settings/requested display mode.
- Never expose password hashes, raw secrets, or internal import errors to ordinary users.
