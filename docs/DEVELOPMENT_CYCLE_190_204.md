# Development Cycle 190-204

Baseline: `1e86b77`. User-authorized fifteen-task development cycle, independent
feature commits and batched relevant checks, then push, application release and
live verification. Repair/test/documentation commits do not count as tasks.

| ID  | Scope                   | Acceptance                                                                                      | State      |
| --- | ----------------------- | ----------------------------------------------------------------------------------------------- | ---------- |
| 190 | Published syllabus API  | Authenticated read-only outline excludes draft courses/items and reports real level counts      | Local pass |
| 191 | Course explorer         | Dedicated owner-scoped screen with loading, login, missing course and retry states              | Local pass |
| 192 | Level materials API     | Stable 30-item pages hydrate only requested published items                                     | Local pass |
| 193 | Level material grid     | Read-only links to components/kanji/words with count and page navigation                        | Local pass |
| 194 | Material kind filters   | Course-level filtering before pagination, not by global levelHint                               | Local pass |
| 195 | Study-state filters     | New/learning/burned uses own complete eligible card sets before pagination                      | Local pass |
| 196 | Learning presentation   | Canonical kana and curated RU/EN/both meanings on material tiles                                | Local pass |
| 197 | Explorer URL lifecycle  | Reload/back/forward retain level, filters and page without stale results                        | Local pass |
| 198 | Level navigation        | Adjacent published levels and direct level selection reset item page deliberately               | Local pass |
| 199 | Course navigation links | Catalog/library/dashboard link to read-only course/level views without enrollment/switch writes | Local pass |
| 200 | Kana account boundary   | Account changes reset old learning drafts/results and fence old responses                       | Local pass |
| 201 | Adaptive kana isolation | Old reads/writes/401 cannot change newer exercise/session or clear newer login                  | Local pass |
| 202 | Kana deep links         | Unit/character links open only matching unlocked lessons, never mark learned                    | Local pass |
| 203 | Kana recovery           | In-place retry preserves route/script selection, no automatic answer replay                     | Local pass |
| 204 | Draft evidence workflow | Manual read-only source report against existing Neon imports, no curation/publication           | Local pass |

Course exploration does not unlock, enroll, select a course or change SRS. Kana
remains separate lessons/mastery, not SRS. Published educational content remains
V4 unless independent review and the existing strict publication gates pass;
draft07 remains a proposal, not an implicit upgrade. No new dependencies or
proprietary data are planned. Temporary artifacts stay outside the repository.

## Local Acceptance

Implementation: 15/15 independent functional commits. Local acceptance: 15/15.
Cloud CI and live release verification remain pending at this checkpoint.

Seventy-one relevant unit cases passed. Web/API/DB typechecks, changed-file
ESLint, formatting and the production web build passed. Sixty focused production
browser cases passed across desktop/mobile course, character and kana flows.
The first browser batch stopped on newly added selector/fixture issues: the
framework's second alert, labels containing option text and a missing saved
RU+EN setting. These were repaired without removing assertions or adding sleeps;
the complete affected batch then passed. JSX and UUID-return-link defects found
by earlier checks were fixed before the accepted build.

Syllabus metadata contains only published structured courses and published
placements. Level progress reads the selected level's lightweight card metadata,
with SRS states scoped to the authenticated user and the existing listening
eligibility rules. Kind and study state are filtered before stable pagination;
only the selected thirty item payloads are hydrated. Metadata itself scales with
one level, not a constant bound or a claimed whole-course SQL budget.

Task204 uses an aggregate-only alternative. The detailed JSON artifact proposal
was blocked by automatic risk review because external row-level data transfer
was not separately authorized. The committed workflow accepts no arbitrary input,
prints fixed numeric coverage and approval-false fields, uploads no artifact,
does no migration/seed/curation/publication, and keeps the secret out of dependency
installation. Detailed external artifacts remain excluded unless authorized.

There is no new dependency, dictionary import or curriculum publication. Published
V4 remains 101 kanji / 120 words. Draft07 still needs independent source/content
review; count-only evidence is not approval and does not reduce the content backlog.
