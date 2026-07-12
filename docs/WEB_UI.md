# Web UI plan

## Pages

- `/`: landing or redirect to dashboard.
- `/login`, `/register`.
- `/dashboard`.
- `/kana` for authenticated hiragana/katakana row lessons and a separate free assessment mode.
- `/lessons` and `/lessons/session/[id]`.
- `/reviews` and `/reviews/session/[id]`.
- `/items/[id]`.
- `/kanji/[character]`.
- `/search`.
- `/decks` for creating, reopening, studying, archiving, and restoring personal text decks.
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

## Final MVP integration test

- Spec: `apps/web/e2e/mvp-integration.spec.ts`.
- The path mocks the API at `http://localhost:3001`, uses deterministic starter-course fixture data with a seeded active course enrollment, and does not need external network, a real API service, or a database.
- Run only this integration path from the repository root:

```powershell
npm run test:smoke --workspace @kanji-srs/web -- e2e/mvp-integration.spec.ts --workers=1
```

- Run the full web smoke suite from the repository root:

```powershell
$env:WEB_SMOKE_WORKERS = "4"
npm run test:smoke --workspace @kanji-srs/web
Remove-Item Env:WEB_SMOKE_WORKERS
```
