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

## Admin curriculum workflow

The curriculum plan pages can open any selected kanji or vocabulary candidate
in the bilingual curation workspace, including candidates outside the older
ranked top-100 queue. The workspace loads imported RU/EN meanings, all source
readings, license attribution, source record, import run, file version, and
checksum on demand. Missing Russian or English learning content remains blank
for explicit editorial input. The form separately shows all source readings
and requires the accepted reading set, with the first line treated as the
primary taught reading. Approval creates the normal needs-review course item
and refreshes the current plan instead of publishing automatically.
The selected curation item also has a prerequisite editor. It lists published
components inferred for kanji and published kanji inferred from word spelling,
keeps current links selected, and allows an optional numeric SRS threshold.
Saving replaces the selected prerequisite set and uses the normal queue and
completeness reconciliation flow.
Published items also expose a course-placement editor grouped by course. Each
course offers one selected level or an unassigned state; saving preserves an
existing position and appends a new placement to the selected level. The
control remains read-only until the material is published.
The admin planning area includes a read-only main-course allocation preview.
It shows complete totals and per-band counts, then bounded assignment and
conflict tables. Existing and proposed placements are visually distinguished;
the apply action is available only for a non-empty plan without conflicts.
Applying requires a keyboard-accessible confirmation, preserves every existing
placement, reports the number of additions, and refreshes the preview. If the
version changed, the stale confirmation is rejected and the panel reloads the
current calculation before another attempt.
Below allocation, the publication-readiness panel presents the eight server
checks as a compact pass/blocker list with current and required counts. It
updates after allocation or curation changes and makes the 2,300-kanji and
8,000-word gaps explicit. Publication remains disabled until every check
passes. The enabled action opens a keyboard-contained confirmation and sends
the exact audited version; a stale version reloads before another attempt.
Success marks the course published and states explicitly that no learner was
enrolled or migrated and no existing progress changed.
The following learner-rollout panel is also read-only. It shows the add-only
impact as aggregate learner, new enrollment, active main-course, preserved
paused/completed, and active starter-course counts. It becomes apply-ready only
for a currently readiness-approved published course. No learner identifiers are
shown, and no apply control is present until the separate confirmed rollout
workflow exists.
After an item or card save, the queue restarts from its first cursor page under
the active filters. It keeps the saved item selected when it still matches and
otherwise opens the next available item, while a post-save refresh failure is
shown separately from the successful write.
The same workspace can reject the currently inspected imported candidate only
after an explicit confirmation with a constrained reason and optional note.
Rejected targets disappear from active candidate queues immediately and remain
visible in a dated decision list with their Japanese text, reading, reason, and
a restore action. Restoration refreshes the candidate queues and plan without
requiring a browser reload.
The full candidate-plan panel searches its retained snapshot by Japanese text,
kana reading, or target id before pagination. The active query survives item
type switches, page navigation, and plan refreshes, while reset returns to the
unfiltered versioned plan. Empty search results are distinct from an exhausted
unfiltered page.
Course-band and data-coverage selects share the same explicit apply/reset flow.
Applied filters survive item-type switches, pagination, plan refreshes, and
staging refreshes. The panel distinguishes a filtered empty result from a plan
with no remaining candidates.
Each loaded candidate page starts fully selected. Page and row checkboxes let
the admin narrow the batch, show the selected count before staging, and disable
the action for an empty selection. The confirmation dialog and request use that
exact selected subset; unselected candidates remain in the plan after refresh.

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
- Check each quiz card immediately, pause on explicit feedback, and move a
  failed card behind the remaining cards before retrying it.
- Distinguish an alternative kanji reading from an unrelated wrong answer while
  still showing the reading expected by the current card. Retry it immediately
  without advancing the queue or counting an error.
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
