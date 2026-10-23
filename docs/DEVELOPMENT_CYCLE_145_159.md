# UX Development Cycle 145-159

Baseline: `9f56f05` (verified runtime `419e97f`, Foundation V4 published).
User authorization, 2026-10-23: implement fifteen more tasks, commit each task
and push independently, check related changes in batches, then publish the new
application version and verify the server. The immediate priority is reducing
information overload and improving daily learning UX, not duplicating courses.

## Acceptance

| ID  | Scope                           | Required behavior                                                                                                                                          | State       |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 145 | Navigation hierarchy            | Primary study destinations stay directly accessible; secondary destinations and account actions have a keyboard-operable menu; no wrapping navigation wall | Implemented |
| 146 | Focused study shell             | Active lesson/review uses a quiet header with explicit session exit; ordinary pages retain full navigation; reload does not lose session state             | Implemented |
| 147 | Dashboard next action           | Due reviews, available lessons and empty/vacation states produce one clear primary action and accurate counts, not competing equal actions                 | Implemented |
| 148 | Progressive dashboard analytics | Optional analytics can be expanded without changing saved widget order/visibility or hiding errors; ordinary first view is concise                         | Implemented |
| 149 | Course progress hierarchy       | Current level/pass progress is primary; per-type detail, unlock conditions and course switching remain discoverable without dominating the page            | Implemented |
| 150 | Recommended lesson start        | Recommended items and one start action are visible; manual selection/order controls open on demand and preserve selection/limits                           | Implemented |
| 151 | Lesson teaching hierarchy       | Japanese, meaning and taught kana reading have a clear hierarchy; no null JLPT/level facts or generic SRS explanatory card; quiz answers stay hidden       | Implemented |
| 152 | Lesson supporting content       | Relevant memory aid is visible; alternative hints, relations and context are grouped and expandable without deleting provenance or RU/EN content           | Implemented |
| 153 | Lesson quiz and completion      | Compact prompt/answer/feedback/continue and completion next action; retries, progress persistence and keyboard focus remain intact                         | Implemented |
| 154 | Review start                    | One start action and count; order settings and queue details open on demand; preview must not reveal answers                                               | Implemented |
| 155 | Review feedback hierarchy       | Result/correct answer/continue are primary; SRS diagnostics and private-answer editing are available on demand; corrections never schedule twice           | Implemented |
| 156 | Item information hierarchy      | Core learning details separated from personal editing, history and sources through explicit sections; all existing actions remain reachable                | Implemented |
| 157 | Kana learning hierarchy         | Character exercise is primary; script/mode selection, units and assessment remain navigable without competing walls of controls; kana remains outside SRS  | Implemented |
| 158 | Settings hierarchy              | Appearance, study workload, pronunciation and schedule are separate navigable groups; unsaved values/errors survive switching and save remains available   | Implemented |
| 159 | Responsive consistency          | Shared spacing/type/control hierarchy and content width across touched screens; desktop/mobile screenshots, keyboard checks and batch regression repairs   | Implemented |

Each row requires an independently reviewable behavioral change, not only a
renamed heading or a checkbox in this document. Fix/test/evidence commits do not
count as additional tasks. Preserve all SRS/card identities, private answers,
existing course seals and RU/EN/combined translation modes. No WaniKani content,
layout, CSS or assets are copied; the design and wording stay original.

## Checkpoints

- Development complete: 15/15.
- Acceptance passed: 0/15.
- Release threshold reached: implementation complete; batch acceptance pending.
- No new Neon content/course publication is needed for this UX-only cycle.
- Code commits may trigger automatic application deployment; the final release
  tag and exact-revision remote verification follow all fifteen accepted tasks.
- Run focused tests/types/lint after related batches, not the whole suite per edit.
- Capture representative responsive states and verify no answer leaks or lost
  private editing/session state. A compact view must not remove functionality.
- Test account creation is operational, not one of the fifteen tasks; credentials
  must never be committed. Do not automatically enroll/select V4 on that account.
- Close temporary browser tabs and owned test servers; keep scratch artifacts
  outside the repository and leave only intentional source/tests/docs.
