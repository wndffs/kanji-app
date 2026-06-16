# apps/web/AGENTS.md

This app is the user-facing responsive web client.

## Responsibilities

- Russian UI by default.
- Dashboard, lessons, reviews, item pages, dictionary/search, deck builder, settings, and admin screens.
- Mobile-first responsive layout.
- Keyboard-first review flow.

## Boundaries

- Do not put SRS scheduling logic in React components.
- Do not put answer validation logic in React components.
- Use `packages/shared` DTOs and API client types.
- Do not hardcode imported content in components except tiny fixtures/stories.

## UI requirements

- Keep review pages fast and distraction-free.
- Show Japanese text with furigana support where available.
- Show source/attribution on item detail pages when relevant.
- User custom answers must be editable from item pages and review feedback.
- Use accessible labels, focus states, and keyboard navigation.
