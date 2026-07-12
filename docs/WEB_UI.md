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

- Guide each item through the non-empty stages meaning, reading, and context;
  allow revisiting an earlier stage before the required quiz.
- Resume an unfinished server-confirmed lesson group at its current item and
  stage after reload. Do not persist typed quiz answers in browser storage.
- Let the learner leave an active lesson through an explicit confirmation
  dialog. Keep completed SRS cards and return unfinished items to the queue.
- Explain the item and its prerequisite relationships during the meaning stage.
- Show reading/meaning with translation display modes: Russian, English, or Russian plus English.
- Show curated Russian/English mnemonic and hint content for the selected
  translation mode, separated by purpose: meaning, reading, story, or usage.
  Label private user mnemonics separately without mixing their purpose with
  other lesson guidance.
- Show compact attributed usage examples when the lesson item has published
  bilingual sentence dependencies.
- Offer browser-native Japanese speech for the reading stage and Japanese
  example text. Use a `ja-JP` system voice when available; do not bundle or
  claim attribution for synthesized audio.
- Quick check.
- Derive quiz order independently and deterministically from the server session
  id, and keep the same remaining-item order after reload.
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
