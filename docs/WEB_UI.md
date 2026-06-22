# Web UI plan

## Pages

- `/`: landing or redirect to dashboard.
- `/login`, `/register`.
- `/dashboard`.
- `/lessons` and `/lessons/session/[id]`.
- `/reviews` and `/reviews/session/[id]`.
- `/items/[id]`.
- `/kanji/[character]`.
- `/search`.
- `/decks` and `/decks/new/text`.
- `/settings`.
- `/admin`.

## MVP review UX

- Prompt area.
- Item type badge.
- Input box with autofocus.
- Submit with Enter.
- Feedback panel.
- Continue with Enter.
- Show accepted answer after wrong answer.
- Add private synonym/meaning from feedback panel.
- Preserve keyboard flow.

## Lesson UX

- Explain the item.
- Show relationships.
- Show reading/meaning with translation display modes: Russian, English, or Russian plus English.
- Show mnemonic/hint.
- Quick check.
- Add to SRS.

## Mobile requirements

- Single-column layout.
- Large tap targets.
- Sticky answer input in reviews.
- Avoid hover-only UI.
- Keep text readable for Japanese, Russian, and English.

## Web testing

- `@playwright/test` is a dev-only dependency for browser smoke tests. It is Apache-2.0 licensed.
- The dashboard smoke test starts the Next.js web app, loads `/dashboard`, and checks the Russian app shell on desktop and mobile profiles.
