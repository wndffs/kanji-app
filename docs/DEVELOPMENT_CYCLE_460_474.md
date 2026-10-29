# Cycle 460–474: Everyday Actions and Time

## Contract

The starting published V6 contains 88 components, 112 kanji and 160 exact word/reading pairs across 12 levels. This is a foundation, not a complete N4 or N3 syllabus. Modern JLPT coverage remains unconfirmed; historical dictionary labels and priority markers are not a modern exam list or corpus frequency.

This cycle reserves one bounded twenty-word wave and five prerequisite kanji (知・使・作・帰・毎), with original bilingual teaching. Topics are communication, understanding, using/making things, returning, descriptions and calendar routines. Selection follows useful independent topics, not a competitor's level order. All candidate counts remain proposed until exact licensed source evidence and independent review pass.

Publish an additive, separately sealed V7 only after review, live source preflight and a read-only publication plan. Preserve all V1–V6 manifests, target/card identities, enrollments and learning progress. Do not migrate users automatically. No new SRS algorithm, grammar course, imported proprietary material or paid infrastructure.

## Tasks

| Task | Deliverable                                                    | State |
| ---- | -------------------------------------------------------------- | ----- |
| 460  | Re-audit actual coverage and bound this wave                   | Done  |
| 461  | Explicit topic selection and deferred follow-up                | Done  |
| 462  | Five kanji and visual prerequisites                            | Done  |
| 463  | Exact verb/adjective identities and selected senses            | Done  |
| 464  | Time/topic vocabulary with common-use evidence                 | Done  |
| 465  | Original RU teaching and blocked-answer distinctions           | Done  |
| 466  | Corresponding EN teaching                                      | Done  |
| 467  | Exact local source, pronunciation and special-reading evidence | Done  |
| 468  | Original context and full kana transcription review            | Done  |
| 469  | Two independent AI reviews and corrections                     | Done  |
| 470  | Manifest, graph and bounded-query acceptance                   | Done  |
| 471  | Read-only additive preview and immutable identity checks       | Done  |
| 472  | Publish only this approved teaching wave and V7                | Done  |
| 473  | Batch checks and actual course/source acceptance               | Done  |
| 474  | Deploy, server verification and measured release receipt       | Done  |

## Acceptance

- Twenty exact bilingual JMdict pairs, five KANJIDIC2 readings and five primary KanjiVG graphics; ambiguous/missing identities block publication.
- Original RU/EN meanings, conservative blocked distinctions, reading guidance and twenty original bilingual examples. No raw dictionary senses automatically become accepted answers.
- Separate component -> kanji -> vocabulary levels after V6; old levels and policies unchanged.
- Review findings integrated before sealing. AI review is not human certification.
- Curators validate the complete registry before mutation; selected wave only is applied. No full raw import or cache download unless necessary.
- Relevant checks batched, then CI and exact-revision live verification. Publish aggregate observations only; source reports, safety digests and screenshots stay outside Git.

## Release Receipt

Released as `cycle-460-474-everyday-vocabulary`. Web/API runtime is
`620c120c297d08a4a68db858a49525611b6a59e9`; green CI revision `67f28de` adds
only corrected test expectations after a documentation-only receipt. The final
release commits update documentation only; deployment filters intentionally
keep the identical verified runtime rather than rebuilding for receipts.

## Editorial Evidence

Verified the existing full official local snapshot, without redownload/import. Selected exact bilingual pairs 20/20; kanji readings 5/5; primary stroke graphics 5/5. Detailed observations are external; Git retains only aggregate counts and fingerprints in `lexical-wave09-review.ts`.

Independent AI reviewers Kierkegaard (readings/components) and Lovelace (meanings/context) reviewed and rechecked corrections. Fixed fuzzy collisions «сознавать», «возвращать», «возвращать домой», «в том месяце»; added promised RU/EN equivalents and natural kanji synonyms; narrowed English 知る to acquiring facts rather than studying; replaced an unnecessary generic book counter; clarified okurigana and real alternate readings. No outstanding findings in their bounded reviews. This is not human or licensing certification.

## Source-Only Acceptance

V7 validates without a database: 92 components, 117 kanji, 180 pairs, 389 items, 686 cards, 15 levels, 18 pinned sources. Canonical manifest SHA-256: `9bb436abf5afce6373f1ed60c71fe8a06992ed6f5560cbdd1394e8813ad3c9f2`. Publication-record UUID: `fa6b2ef5-d7c1-4fc7-a197-55be39dd194b` (not a course UUID).

All V1–V6 source seals still match. V7 preserves every V6 source/target and its first twelve level/policy objects, adding only levels 13–15. Source-only graph closure has zero issues and no pending-review material. New tests reject answer/block/reason/source/policy/slot/review tampering before database access and cover all 389 quality items in scopes of at most 100. Existing 4-wide all-registry preflight and 120-second publication bounds are unchanged; no additional full-corpus import, schema change or production dependency.

## Read-Only Live Preview

Before any writes, Neon confirmed 20/20 selected exact JMdict identities, 20/20 bilingual imported senses and 20/20 successful licensed sources. Selected-kanji read-only preflight [40927610690](https://github.com/wndffs/kanji-app/actions/runs/40927610690) passed on `620c120`: four new components and five kanji; vocabulary writes were explicitly skipped. Full vocabulary live preflight remains mandatory after its earlier kanji placements exist, before any word writes.

V7 adds 29 materials and 54 core cards without editing any of the 360 V6 materials or 632 V6 cards. An in-memory pre-write safety snapshot covers all eleven private-state tables and old finite courses/levels/placements/items/cards/answers/blocks. Baseline: 26 accounts, 162 SRS states, eight review sessions, five review answers, six kana-progress rows and five published finite courses. Physical database size: 161,021,952 bytes, not a measurement of Neon billable quota. No private rows or digests are stored in Git.

## Verified Publication

Selected application [40928757701](https://github.com/wndffs/kanji-app/actions/runs/40928757701) applied only kanji09/words09, reusing raw imports. Complete quality scan: 389 items, zero blockers, zero warnings. No old batch was reapplied. The all-registry word preflight passed before any word write.

Read-only V7 plan [40928899632](https://github.com/wndffs/kanji-app/actions/runs/40928899632) passed before explicit publication [40930432283](https://github.com/wndffs/kanji-app/actions/runs/40930432283). Live course UUID: `5755286f-fd0b-4d39-8353-08f4dbc44837`; content version: `c08f45572335859349f1f0840aed0238bf90af037fe053b7d0d1e64845725d72`. The publisher returned `enrolledUserId: null`. Main 60-level course remains DRAFT; the finite V7 is separately PUBLISHED.

After application, all eighteen protected table-set count/digest pairs matched the baseline exactly, including all eleven private-state tables and old finite courses/items/cards/answers/blocks. Physical database size then: 161,382,400 bytes. Final original-cohort comparison follows the isolated remote audit.

## Batch And Live Acceptance

- Relevant local tests, DB/source-tool typechecks, changed-source ESLint and formatting passed. Three outdated growing-registry expectations exposed by CI were corrected without altering frozen sources or proposal archives.
- [CI 40928026497](https://github.com/wndffs/kanji-app/actions/runs/40928026497): Quality passed (including all 749 DB tests); web smoke 483 passed, one existing skip.
- [Study integrity 40928026628](https://github.com/wndffs/kanji-app/actions/runs/40928026628): PostgreSQL 18 passed.
- [Remote V7 smoke 40931316113](https://github.com/wndffs/kanji-app/actions/runs/40931316113): passed against exact web/API revision `620c120c297d08a4a68db858a49525611b6a59e9`. Uses an isolated generated audit account, no lesson/review-answer submission and no original-account switching.
- Actual V7 browser/API coverage: 389 materials, 92 components, 117 kanji, 180 pairs and 686 core cards; 297/297 kanji/words have both meaning and reading cards, zero missing RU/EN/required readings. Modern JLPT unknown: 115 kanji, 179 words; N4–N3 exam coverage explicitly unconfirmed.
- After publication and the isolated audit, all eighteen original protected count/digest pairs matched. The original 26-account cohort, all progress tables and earlier finite course structures/answers/blocks are unchanged. Physical database size: 161,570,816 bytes; not Neon billing usage.
- Warm remote medians: dashboard 794 ms, lessons 582 ms, reviews 307 ms, characters 598 ms, item 798 ms. Only three samples per endpoint from the GitHub runner; these are not cold-start promises or local VPN latency measurements.

## UI And Remaining Scope

Built-in-browser verification opened V7 from the live catalogue without adding
or selecting it for the existing test profile. Actual level 15 contains all
twenty new words with visible teaching readings, meanings and earlier-kanji
requirements. Coverage totals and missing-answer counts agree with the
publisher. Desktop and mobile screenshots are stored outside Git; at a
390-pixel mobile viewport, client/scroll widths both measure 375 CSS pixels
(scrollbar excluded), with no horizontal page overflow. Screenshots were
visually inspected. No lesson/review answer or user preference was changed.

This batch proposed twenty pairs and five prerequisite kanji, independently
reviewed all of them and actually published the same twenty/five plus four
visual cues. 午前中 was excluded before authorship for missing RU source.
No advanced N3 wave or complete N4/N3 syllabus is claimed. Remaining long-term
volume: 2,183 kanji and 7,820 pairs, plus broader human editorial/audio and
representative learner acceptance. All six prior finite manifests remain
sealed; V3 remains an unpublished intermediate version.

Next reserved batch is 475–489 (separate kana and personal study tools), with
490–499 reserved for replacement/readiness acceptance: 25 tasks remain in this
roadmap. Those tasks are not completed and do not guarantee the long-term
content target. The catalogue still exposes older published finite courses;
clear latest-course naming/upgrade ergonomics remains a targeted UX follow-up,
not a silent migration in this content cycle. No task 475 was started.
