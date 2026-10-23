# Development Cycle 190-204

Baseline: `1e86b77`. User-authorized fifteen-task development cycle, independent
feature commits and batched relevant checks, then push, application release and
live verification. Repair/test/documentation commits do not count as tasks.

| ID | Scope | Acceptance | State |
| --- | --- | --- | --- |
| 190 | Published syllabus API | Authenticated read-only outline excludes draft courses/items and reports real level counts | In progress |
| 191 | Course explorer | Dedicated owner-scoped screen with loading, login, missing course and retry states | Planned |
| 192 | Level materials API | Stable 30-item pages hydrate only requested published items | Planned |
| 193 | Level material grid | Read-only links to components/kanji/words with count and page navigation | Planned |
| 194 | Material kind filters | Course-level filtering before pagination, not by global levelHint | Planned |
| 195 | Study-state filters | New/learning/burned uses own complete eligible card sets before pagination | Planned |
| 196 | Learning presentation | Canonical kana and curated RU/EN/both meanings on material tiles | Planned |
| 197 | Explorer URL lifecycle | Reload/back/forward retain level, filters and page without stale results | Planned |
| 198 | Level navigation | Adjacent published levels and direct level selection reset item page deliberately | Planned |
| 199 | Course navigation links | Catalog/library/dashboard link to read-only course/level views without enrollment/switch writes | Planned |
| 200 | Kana account boundary | Account changes reset old learning drafts/results and fence old responses | Planned |
| 201 | Adaptive kana isolation | Old reads/writes/401 cannot change newer exercise/session or clear newer login | Planned |
| 202 | Kana deep links | Unit/character links open only matching unlocked lessons, never mark learned | Planned |
| 203 | Kana recovery | In-place retry preserves route/script selection, no automatic answer replay | Planned |
| 204 | Draft evidence workflow | Manual read-only source report against existing Neon imports, no curation/publication | Planned |

Course exploration does not unlock, enroll, select a course or change SRS. Kana
remains separate lessons/mastery, not SRS. Published educational content remains
V4 unless independent review and the existing strict publication gates pass;
draft07 remains a proposal, not an implicit upgrade. No new dependencies or
proprietary data are planned. Temporary artifacts stay outside the repository.
