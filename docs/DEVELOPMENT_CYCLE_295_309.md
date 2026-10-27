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

| ID | Deliverable | Acceptance | State |
| --- | --- | --- | --- |
| 295 | Validated scope | Record actual gaps, acceptance and release boundaries | Complete |
| 296 | Bookmarkable kana groups | Group survives reload, tab changes and Back; invalid query defaults safely | Implemented |
| 297 | Precise resume destination | Hub continues the first available unfinished unit; all-complete and empty states are honest | Implemented |
| 298 | Visible prerequisites | Locked units identify their first unfinished predecessor without granting access | Implemented |
| 299 | Group-specific progress | Visible group counts use matching items, not the entire alphabet; no NaN on empty groups | Implemented |
| 300 | Map status filters | All/available/started/mastered filters combine with groups and retain URL state | Implemented |
| 301 | Finder availability filter | Learner can narrow to available/unfinished/mastered lessons and clear filters | Implemented |
| 302 | Focused finder previews | Group-filtered previews show matching symbols; original ordinals and full-unit mastery retained | Implemented |
| 303 | Teaching audio | Existing Japanese speech supports teaching, preference restrictions and cancellation | Implemented |
| 304 | Bilingual learning notes | Original short RU/EN notes explain basic/modified/combined/length patterns in RU/EN/RU+EN | Pending |
| 305 | Revisit teaching | Explicit explanation action during a quiz never submits or manufactures mastery | Pending |
| 306 | Unit completion checkpoint | Confirmed mastery shows a completion state with explicit next/repeat actions, not an automatic jump | Pending |
| 307 | In-place answer recovery | Failed POST keeps exercise/input; explicit retry only, no automatic write replay | Pending |
| 308 | Batched acceptance | Focused unit/browser tests, type/build/lint/format; light/dark phone/desktop captures | Pending |
| 309 | Release | Push/tag, deploy, exact revision health and live learner UI check, clean owned resources | Pending |

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

Batch kana grouping/query/route/copy tests and characters/kana browser cases;
dashboard count wording gets a focused dashboard smoke case. Build/typecheck the
web workspace and lint/format touched files. Use existing cloud CI for its broad
suite, not repeated full local runs. Check stale-account responses, locked
navigation, zero/full mastery, POST failures and pending-write controls. Keep
screenshots/logs outside Git and stop temporary servers/close used IAB tabs.
