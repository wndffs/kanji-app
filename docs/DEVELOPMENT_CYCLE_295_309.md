# Clear Kana Learning Path 295-309

Baseline: `292c520`. The user requested correct kana count labels, then the next
15 tasks with individual commits, checkpoint pushes, batched checks and a final
deployment/server inspection. The separate label correction is `fe53095`.

## Findings And Contract

The same total currently mixes 46 basic signs, 25 modified signs, 33 combinations
and 11 hiragana / 9 katakana practice patterns. These are learning elements, not
115/113 distinct alphabet signs. Count actual server items; never invent 46 for
an incomplete/empty fixture. Category mastery comes from item.mastered only.

Group state in the character hub is local and disappears on navigation. The
generic Continue link does not identify the next lesson. Locked map units have
no prerequisite explanation. Finder results show every character even when a
group narrows the search. The teaching step has neither audio nor an explanatory
note. Completing a unit silently jumps to the next one. An answer transport
error currently discards the entire workspace.

Keep the original quiet interface: compact unframed summaries, consistent lesson
rows, one study prompt and one primary next action. Reuse Lucide and existing
speech/preferences components. No copied competitor data, wording, CSS or media.

## Tasks

| ID  | Deliverable                | Acceptance                                                                                           | State    |
| --- | -------------------------- | ---------------------------------------------------------------------------------------------------- | -------- |
| 295 | Validated scope            | Record actual gaps, acceptance and release boundaries                                                | Complete |
| 296 | Bookmarkable kana groups   | Group survives reload, tab changes and Back; invalid query defaults safely                           | Complete |
| 297 | Precise resume destination | Hub continues the first available unfinished unit; all-complete and empty states are honest          | Complete |
| 298 | Visible prerequisites      | Locked units identify their first unfinished predecessor without granting access                     | Complete |
| 299 | Group-specific progress    | Visible group counts use matching items, not the entire alphabet; no NaN on empty groups             | Complete |
| 300 | Map status filters         | All/available/started/mastered filters combine with groups and retain URL state                      | Complete |
| 301 | Finder availability filter | Learner can narrow to available/unfinished/mastered lessons and clear filters                        | Complete |
| 302 | Focused finder previews    | Group-filtered previews show matching symbols; original ordinals and full-unit mastery retained      | Complete |
| 303 | Teaching audio             | Existing Japanese speech supports teaching, preference restrictions and cancellation                 | Complete |
| 304 | Bilingual learning notes   | Original short RU/EN notes explain basic/modified/combined/length patterns in RU/EN/RU+EN            | Complete |
| 305 | Revisit teaching           | Explicit explanation action during a quiz never submits or manufactures mastery                      | Complete |
| 306 | Unit completion checkpoint | Confirmed mastery shows a completion state with explicit next/revisit actions, not an automatic jump | Complete |
| 307 | In-place answer recovery   | Failed POST keeps exercise/input; explicit retry only, no automatic write replay                     | Complete |
| 308 | Batched acceptance         | Focused unit/browser tests, type/build/lint/format; light/dark phone/desktop captures                | Complete |
| 309 | Release                    | Push/tag, deploy, exact revision health and live learner UI check, clean owned resources             | Complete |

## Boundaries

No new dependency, schema/migration/seed, course/corpus publication in Neon,
account/progress reset, SRS stage or answer-validation-policy change. Kana stays
outside SRS. Backend responses remain authoritative for grading/mastery. URL
filters never unlock lessons or alter the independent course order. No private
tokens/content in reports; only aggregate deployment evidence belongs in Git.

The existing 2,300-kanji / 8,000-word content programme is not silently marked
complete by this UX cycle. This cycle improves the actual kana route and related
catalogue, not unrelated administration, mining or scheduling subsystems.

## Checks

Teaching notes are short project-authored RU/EN explanations, not imported rows.
Basic rules were cross-checked against the Japan Foundation kana charts and
[MLC's own kana worksheet](https://www.mlcjapanese.co.jp/Download/HiraganaKatakanaWorksheetAnswer.pdf).
No text, worksheet graphics or audio was copied; no external dataset was published.

Batch kana grouping/query/route/copy tests and characters/kana browser cases;
dashboard count wording gets a focused dashboard smoke case. Build/typecheck the
web workspace and lint/format touched files. Use existing cloud CI for its broad
suite, not repeated full local runs. Check stale-account responses, locked
navigation, zero/full mastery, POST failures and pending-write controls. Keep
screenshots/logs outside Git and stop temporary servers/close used IAB tabs.

## Local Acceptance

Tasks 295-307 are implemented. No course, source import, account reset or SRS
change occurred. UI totals now distinguish 46 basic signs, 25 modified signs,
33 combinations and 11/9 exercises, derived from loaded items. Small fixtures
and empty paths do not pretend to contain 46 signs. Category details are always
visible in the catalogue and optional below the active exercise in lessons.

- Five relevant unit files: 20 cases passed.
- Web production build and its TypeScript pass completed; changed-file ESLint
  and Prettier checks passed. No full local monorepo suite was run.
- The 54-case browser batch covered characters, kana and the dashboard newcomer
  guide on desktop/phone: 46 initially passed, eight failed across four scenarios.
  Two failures were ambiguous locators, one lacked a settings PATCH fixture, and
  the phone bilingual note pushed the primary action under navigation. Corrected
  semantic locators/mocks, moved optional counts after the exercise and composed
  the phone glyph/reading side by side. All eight focused repair cases passed.
- Existing late-owner/late-script isolation, speech cancellation, adaptive mixed
  practice and exercise rotation passed. New checks cover filtered previews,
  original ordinals, URL reload/Back, pending POST guards, retained answer input,
  explicit retry and both next-lesson/all-complete checkpoints. No write occurs
  merely from opening explanations, selecting filters or advancing a checkpoint.
- Light/dark desktop/phone screenshots were inspected outside Git. The phone
  primary action is fully in the viewport above the navigation bar.

An unconfirmed POST is not reported as saved. The retained workspace offers a
GET progress refresh before a deliberate retry; there is no claim that a lost
response proves the server did not record the original answer.

Task 309 records deployment evidence after the checkpoint push and server check.

## Release Candidate

Code acceptance commit: `f84914f`. Release tag: `cycle-295-309-kana`.
Push the complete checked cycle together; the existing Vercel integration deploys
the web runtime. Verify its full SHA through `/api/health` and inspect real
authenticated kana data, without submitting learning answers or resetting the
existing test account. Check API liveness independently; this cycle changes no
backend code and does not require a database publication or migration.

## Released Version

All 295-309 delivered. Next unused task number: **310**.
Published web revision: `a09059c1a112deaefcf0f2176d40f0bd1a5063de`, confirmed by
the public `/api/health` and Vercel's successful deployment status.

The independent API liveness check returned healthy with revision
`292c52020440af9345087065debb9ff4fe36a393`. This is expected for this web-only
cycle; backend code and migrations are unchanged. The initial 25-second API
probe timed out; a subsequent probe returned healthy. No exact cause or cold
start duration was inferred from those two attempts.

Live authenticated IAB checks confirmed 46/25/33/11 in hiragana and 46/25/33/9
in katakana, a concrete unlocked resume URL and the real katakana teaching step
with an original Russian note. No horizontal overflow, answer submission,
course switch, profile reset or preference save occurred. Phone and both-theme
checks are local production browser tests, not a claimed live mobile audit.

[CI 40521770684](https://github.com/wndffs/kanji-app/actions/runs/40521770684)
Quality passed. The broader cloud Web smoke job was still installing its browser
at the last snapshot; it is not reported as passed here. Both triggered Study
integrity runs passed, including
[40521770726](https://github.com/wndffs/kanji-app/actions/runs/40521770726).

Screenshots are outside Git in the task visualization folder, `cycle-295-309/`.
Used IAB tabs are closed and temporary local test servers have exited. This
final documentation-only update does not replace the verified runtime revision.
