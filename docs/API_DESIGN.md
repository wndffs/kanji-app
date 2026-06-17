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
