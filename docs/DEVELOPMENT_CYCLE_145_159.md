# UX Development Cycle 145-159

Baseline: `9f56f05` (verified runtime `419e97f`, Foundation V4 published).
User authorization, 2026-10-23: implement fifteen more tasks, commit each task
and push independently, check related changes in batches, then publish the new
application version and verify the server. The immediate priority is reducing
information overload and improving daily learning UX, not duplicating courses.

## Acceptance

| ID  | Scope                           | Required behavior                                                                                                                                          | State    |
| --- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| 145 | Navigation hierarchy            | Primary study destinations stay directly accessible; secondary destinations and account actions have a keyboard-operable menu; no wrapping navigation wall | Accepted |
| 146 | Focused study shell             | Active lesson/review uses a quiet header with explicit session exit; ordinary pages retain full navigation; reload does not lose session state             | Accepted |
| 147 | Dashboard next action           | Due reviews, available lessons and empty/vacation states produce one clear primary action and accurate counts, not competing equal actions                 | Accepted |
| 148 | Progressive dashboard analytics | Optional analytics can be expanded without changing saved widget order/visibility or hiding errors; ordinary first view is concise                         | Accepted |
| 149 | Course progress hierarchy       | Current level/pass progress is primary; per-type detail, unlock conditions and course switching remain discoverable without dominating the page            | Accepted |
| 150 | Recommended lesson start        | Recommended items and one start action are visible; manual selection/order controls open on demand and preserve selection/limits                           | Accepted |
| 151 | Lesson teaching hierarchy       | Japanese, meaning and taught kana reading have a clear hierarchy; no null JLPT/level facts or generic SRS explanatory card; quiz answers stay hidden       | Accepted |
| 152 | Lesson supporting content       | Relevant memory aid is visible; alternative hints, relations and context are grouped and expandable without deleting provenance or RU/EN content           | Accepted |
| 153 | Lesson quiz and completion      | Compact prompt/answer/feedback/continue and completion next action; retries, progress persistence and keyboard focus remain intact                         | Accepted |
| 154 | Review start                    | One start action and count; order settings and queue details open on demand; preview must not reveal answers                                               | Accepted |
| 155 | Review feedback hierarchy       | Result/correct answer/continue are primary; SRS diagnostics and private-answer editing are available on demand; corrections never schedule twice           | Accepted |
| 156 | Item information hierarchy      | Core learning details separated from personal editing, history and sources through explicit sections; all existing actions remain reachable                | Accepted |
| 157 | Kana learning hierarchy         | Character exercise is primary; script/mode selection, units and assessment remain navigable without competing walls of controls; kana remains outside SRS  | Accepted |
| 158 | Settings hierarchy              | Appearance, study workload, pronunciation and schedule are separate navigable groups; unsaved values/errors survive switching and save remains available   | Accepted |
| 159 | Responsive consistency          | Shared spacing/type/control hierarchy and content width across touched screens; desktop/mobile screenshots, keyboard checks and batch regression repairs   | Accepted |

Each row requires an independently reviewable behavioral change, not only a
renamed heading or a checkbox in this document. Fix/test/evidence commits do not
count as additional tasks. Preserve all SRS/card identities, private answers,
existing course seals and RU/EN/combined translation modes. No WaniKani content,
layout, CSS or assets are copied; the design and wording stay original.

## Checkpoints

- Development complete: 15/15.
- Acceptance passed: 15/15.
- Release threshold reached: yes; application release verified.
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

## Verified Application Release: 2026-10-23

Runtime revision: `46473414466d6199571846e8a685fe1b292907ae`.
Release tag: `cycle-145-159-ux`. Each of the fifteen tasks has its own feature
commit; supplementary acceptance/repair commits are not counted as tasks.

- Production web build, web types, changed-file ESLint, formatting and whitespace
  checks passed. Navigation/next-action unit batch: eight tests passed.
- Local production browser batch: 127 passed, four selector failures repaired
  and passed in the focused desktop/mobile rerun, one desktop case intentionally
  skipped because its assertions apply only to mobile. The initial development
  server run is not release evidence; final validation uses production builds.
- [CI 39965502594](https://github.com/wndffs/kanji-app/actions/runs/39965502594)
  passed full quality checks and **219 production browser cases**, with one
  intentional skip. [PostgreSQL study integrity 39965502559](https://github.com/wndffs/kanji-app/actions/runs/39965502559)
  also passed. This is the final runtime revision, including the compact RU+EN
  header label and the restored explicit feedback outcomes.
- [Remote smoke 39966452004](https://github.com/wndffs/kanji-app/actions/runs/39966452004)
  passed against existing Foundation V4 with exact web/API SHA matching. It used
  its own disposable audit account, not the user-requested test profile.
  Three samples per API route gave medians: dashboard 780 ms, lessons 2109 ms,
  reviews 197 ms, characters 503 ms, item 593 ms. **Lessons exceeded the 2000 ms
  warm target** (2087/2109 ms); other measured routes met it. This remains a
  performance follow-up, not a claim of full-scale latency or browser CWV.
  The new-account review queue was empty, so this HTTP audit did not grade a
  live review answer. Review grading/corrections are covered by browser fixtures
  and PostgreSQL integration checks, not by this particular remote sample.
- Live IAB verified the simplified dashboard, preserved existing V2 selection,
  item study/personal tabs with the existing private answer, and mobile kana at
  393x852 without horizontal page overflow. The full learner profile still had
  its existing 160 due cards. No course/progress migration or silent switch.
- The user-requested test profile was created with ordinary USER privileges;
  login was verified in IAB. It retains normal starter-demo enrollment. It was
  not automatically enrolled in or switched to V4. Credentials are deliberately
  excluded from source and documentation.
- Desktop/mobile screenshots cover dashboard, lessons, item, kana and settings;
  dark settings, keyboard tab/menu recovery, private draft retention, listening
  preview privacy and persisted session continuation are included in acceptance.
  These are representative browser checks, not an exhaustive real-device audit.

Educational content is unchanged: Foundation V4 still has 101 kanji, 120 words,
79 components and 521 cards across seven levels. This cycle publishes the
application UX, not a new V5 course or new Neon curation batches. No WaniKani
content/design/CSS was copied. The new icon dependency is `lucide-react` (ISC),
documented in `UI_DEPENDENCIES.md`; existing data attribution stays intact.

Temporary build output and local smoke servers were cleaned after verification;
browser viewport overrides were reset and unneeded IAB tabs closed. The final
documentation-only commit does not change the tested runtime revision.
