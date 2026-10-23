# Daily-use Development Cycle 160-174

Baseline: `b76c26d`, verified runtime `4647341`, Foundation V4 unchanged.
Continue the user-authorized fifteen-task batches with separate commits,
batched relevant checks, push, then application release and remote verification.
This cycle finishes the learner surfaces outside the previous seven-screen pass.
No proprietary content, copied layouts or new course publication. Kana stays
outside SRS; existing card identity, private content and learning progress stay intact.

| ID | Task | Acceptance | State |
| --- | --- | --- | --- |
| 160 | My courses | Enrolled courses and current selection visible alongside available catalog; adding never silently switches | Planned |
| 161 | Course switch confirmation | Explicit target confirmation, conflict recovery and no duplicate writes or progress reset | Planned |
| 162 | Character account boundary | Logout/switch drops old progress; late success/401 cannot replace a newer session; recoverable load error | Planned |
| 163 | Character navigation | Keyboard tabs with URL/back support and retained kanji filters across scripts | Planned |
| 164 | Kana chart hierarchy | Separate basic/modified/combined sounds without changing mastery; weak symbols and lessons remain reachable | Planned |
| 165 | Bounded kanji catalog | Filter first, render at most sixty rows per page; counts and all matches remain reachable | Planned |
| 166 | Search controls | Query primary, optional filters disclosed, applied filters visible and independently removable with URL/page reset | Planned |
| 167 | Search result hierarchy | Japanese, kana and translation primary; only real metadata, compact original rows and accessible navigation | Planned |
| 168 | Private deck boundary | Account switch clears text/drafts/results; stale create/archive/detail requests cannot affect new account | Planned |
| 169 | Deck library | Active/archive separation and title filtering, clear empty state, preserve archive/restore actions | Planned |
| 170 | Intentional deck creation | Builder opens on demand, draft retained while hidden, one submission, invalid limits rejected locally | Planned |
| 171 | Deck learning path | Filter items by type and new/started state without changing prerequisite ordering; optional technical reasons | Planned |
| 172 | Private practice boundary | Account change invalidates pending practice reads/writes and private feedback; newer login survives stale 401 | Planned |
| 173 | Focused practice | Quiet session shell, keyboard source selection, concise bilingual feedback and completion next action; no SRS mutation | Planned |
| 174 | Responsive completion | Consistent operational layouts, icons and mobile widths across the changed screens; screenshots and batched regression repair | Planned |

Implementation: 0/15. Acceptance: 0/15. Release: pending.

Each task requires working behavior and focused regression coverage. Tests and
repair-only commits do not count toward fifteen. Full corpus expansion, licensed
audio coverage and the previous lesson API warm-latency follow-up remain separate
open work; this cycle does not claim N2 content completion or faster DB queries.
No new dependencies are planned. Close owned processes/tabs and keep temporary
test output outside the repository.
