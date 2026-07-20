# Product pattern benchmark

This project studies established learning mechanics while keeping its content,
curriculum order, interface, wording, and implementation independent.

## WaniKani patterns to adopt

- Build a visible prerequisite path from components to kanji and from kanji to
  useful vocabulary.
- Separate study from retrieval: explain a small batch, run a required lesson
  quiz, and only then schedule the item in SRS.
- Ask for kanji and vocabulary meaning and reading separately, with feedback
  that distinguishes a wrong answer from a valid but currently untaught
  reading.
- Make workload visible. Show lesson availability, due reviews, SRS spread, and
  level progress so the learner can decide whether to add more lessons.
- Keep optional practice outside SRS. Recent lessons, recent mistakes, and
  burned items can be practised without changing scheduled progress.
- Let experienced users choose or interleave available lesson batches without
  bypassing prerequisites.
- Keep item pages relational: components, selected learning meaning and
  reading, vocabulary usage, examples, attribution, and private notes.

Primary references:

- [WaniKani lesson flow](https://knowledge.wanikani.com/getting-started/first-lessons/)
- [WaniKani lesson picker](https://knowledge.wanikani.com/getting-started/lesson-picker/)
- [WaniKani SRS stages](https://knowledge.wanikani.com/wanikani/srs-stages/)
- [WaniKani extra study](https://knowledge.wanikani.com/widgets/extra-study/)
- [WaniKani public level page](https://www.wanikani.com/level/1)

## Duolingo patterns to adopt

- Keep writing-system study in a dedicated character track rather than mixing
  it into the main vocabulary SRS.
- Show an interactive reference chart with progress attached to every symbol
  or sound.
- Teach in short sessions that mix new and previously seen characters.
- Rotate exercise direction and interaction: character-to-sound, sound-to-
  character, matching, spelling, listening, and tracing where reliable assets
  are available.
- Introduce characters in small visually distinguishable groups, then add
  modified and combined sounds.
- Keep optional pronunciation support visible during teaching and removable
  during recall.

Primary references:

- [Duolingo Japanese character lessons](https://blog.duolingo.com/learning-to-read-japanese-characters/)
- [Duolingo writing-system exercise patterns](https://blog.duolingo.com/covering-all-the-bases-duolingos-approach-to-reading-skills/)
- [Duolingo Japanese writing systems](https://blog.duolingo.com/japanese-writing-systems/)

## Independent implementation boundaries

Do not copy proprietary mnemonics, explanations, examples, level order, answer
lists, datasets, audio, illustrations, CSS, colors, layout composition, or UI
wording. Public pages are used to understand interaction and information
architecture only.

The implementation must continue to use project-authored Russian and English
learning content plus legally reusable dictionary, sentence, and stroke data.
All imported content remains source-traceable.

## Authenticated product audit

A read-only audit of the signed-in web products on 2026-07-11 confirmed and
refined the public-document findings without copying account data or protected
learning content:

- Duolingo keeps Hiragana, Katakana, and Kanji as tabs in one character area,
  shows progress per target, and separates basic kana, dakuon/handakuon, yoon,
  small `っ`, and long-vowel patterns.
- WaniKani's dashboard makes the next 24 hours of reviews, recent mistakes,
  level progress, active-item spread, and optional practice visible together.
- WaniKani's lesson picker groups available items by level and type and supports
  learner selection, generated batches, and optional interleaving.

Only those general product mechanics inform this plan. User progress, item
content, copy, visual styling, and proprietary curriculum order are excluded.

## Corrected post-MVP sequence

1. Task 41: add standard yoon combinations as independent kana lesson units.
2. Task 42: add small `っ` and script-appropriate long-vowel lesson units.
3. Task 43: add varied kana recognition, reverse-choice, matching, and typing exercises.
4. Task 44: add kana listening through platform speech synthesis without bundling third-party audio.
5. Task 45: add single-glyph kana tracing with pinned, attributed KanjiVG paths.
6. Task 46 (completed): tighten the main lesson batch and required quiz flow before SRS entry.
7. Task 47 (completed): add learner-controlled lesson picking and interleaving within prerequisites.
8. Task 48 (completed): add optional recent-lesson, recent-mistake, and burned-item practice.
9. Task 49 (completed): expose workload balance and level progress without copying another dashboard.
10. Task 50 (completed): make saved text decks visible and reopenable after creation.
11. Task 51 (completed): run owned text decks through the prerequisite-safe lesson flow.
12. Task 52 (completed): remove overlapping substring noise with dictionary longest matching.
13. Task 53 (completed): add reversible archive management for personal text decks.
14. Task 54 (completed): show bilingual curated and private mnemonic content in lessons.
15. Task 55 (completed): populate item pages with bilingual attributed example sentences.
16. Task 56 (completed): show compact bilingual attributed examples during lessons.
17. Task 57 (completed): separate lesson mnemonics and hints by educational purpose.
18. Task 58 (completed): guide each lesson item through meaning, reading, and context stages.
19. Task 59 (completed): add browser-native Japanese speech to lesson readings and examples.
20. Task 60 (completed): resume server-confirmed lesson groups and stages after reload.
21. Task 61 (completed): safely abandon an active lesson without rolling back SRS progress.
22. Task 62 (completed): use a stable shuffled order for required lesson quizzes.
23. Task 63 (completed): check lesson cards immediately and requeue missed cards.
24. Task 64 (completed): distinguish alternative kanji readings and retry them without penalty.
25. Task 65 (completed): verify full production corpus imports with database counts.
26. Task 66 (completed): resume corpus imports without rewriting sources whose checksum already succeeded.
27. Task 67 (completed): reuse verified local and CI source snapshots without repeated downloads.
28. Task 68 (completed): expose bounded progress for long-running open-data imports.
29. Task 69 (completed): measure corpus readiness for the 2,300-kanji and 8,000-word course targets.
30. Task 70 (completed): build an independent prerequisite-safe candidate plan for full course scale.
31. Task 71 (completed): cache versioned candidate plans for stable, inexpensive pagination.
32. Task 72 (completed): expose corpus readiness and versioned candidate pages in the admin workspace.
33. Task 73 (completed): expose traceable bilingual source details for every planned candidate.
34. Task 74 (completed): connect every planned candidate to the bilingual curation workspace.
35. Task 75 (completed): allow reviewed RU/EN curation when an imported locale is missing.
36. Task 76 (completed): safely stage a versioned candidate-plan page for editorial review.
37. Task 77 (completed): confirm, stage, and refresh candidate-plan pages in the admin workspace.
38. Task 78 (completed): paginate the editorial review queue with stable cursors.
39. Task 79 (completed): keep the editorial queue synchronized after curation saves.
40. Task 80 (completed): persist reversible imported-candidate rejection decisions.
41. Task 81 (completed): manage candidate rejection and restoration in the admin workspace.
42. Task 82 (completed): search the full versioned candidate plan from the admin workspace.
43. Task 83 (completed): filter the versioned candidate plan by course band and data coverage.
44. Task 84 (completed): selectively stage candidates from a filtered plan page.
45. Task 85 (completed): explicitly curate accepted readings before creating reading cards.
46. Task 86 (completed): curate inferred component and kanji prerequisite links.
47. Task 87 (completed): place published curated items into course levels safely.
48. Task 88 (completed): seed a non-destructive 60-level structured course shell.
49. Task 89 (completed): preview balanced prerequisite-safe allocation across course levels.
50. Task 90 (completed): transactionally apply an explicitly confirmed, versioned course allocation.
51. Task 91 (completed): audit versioned full-course publication readiness without changing learner state.
52. Task 92 (completed): publish only a readiness-approved main-course version without enrolling learners.
53. Task 93 (completed): preview a privacy-preserving add-only learner enrollment rollout without writes.
54. Task 94 (completed): apply an explicitly confirmed add-only enrollment rollout without changing progress.
55. Task 95 (completed): enroll new learners in the starter course and the published main course without overwriting existing enrollment status.
56. Task 96 (completed): persist one current course and keep dashboard and lesson availability isolated to that enrollment.
57. Task 97 (completed): switch the current active course from the dashboard with resilient loading and lesson-conflict feedback.

## Viable-product roadmap after task 97

The MVP and full-course publishing infrastructure are complete, but matching
the usefulness of a mature daily learning product requires another pass over
learner visibility, control, content completion, and presentation. The
remaining sequence keeps functional and data work ahead of the final visual
refresh:

Detailed product, engineering, legal, and acceptance requirements for Tasks
111-124 are maintained in [TASK_SPECS_111_124.md](./TASK_SPECS_111_124.md).

58. Task 98 (completed): show the current card spread by configured SRS stage and learning-item type.
59. Task 99 (completed): break current-level progress down by item type and learning state.
60. Task 100 (completed): populate recent mistakes, unlocks, and burned items with direct item and practice links.
61. Task 101 (completed): aggregate daily study activity for streaks, completed reviews, and a calendar heat map.
62. Task 102 (completed): persist dashboard widget visibility, ordering, and compact or expanded presentation.
63. Task 103 (completed): persist lesson batch size, daily lesson pace, and interleaving preferences.
64. Task 104 (completed): add review ordering presets without changing due dates or bypassing SRS rules.
65. Task 105 (completed): add an end-of-review summary and clear per-answer SRS transition feedback.
66. Task 106 (completed): resume optional practice queues and progress without changing scheduled SRS state.
67. Task 107 (completed): add a vacation mode that shifts future availability without corrupting review history.
68. Task 108 (completed): persist speech voice, speed, autoplay, and sound-feedback preferences.
69. Task 109 (completed): persist lesson-only pronunciation aids for kana, furigana, and optional romaji.
70. Task 110 (completed): guide a new learner through kana readiness, first lessons, and the first review cycle.
71. Task 111 (completed): explain level completion, newly unlocked material, and the next prerequisite path.
72. Task 112: add next review, SRS history, composition, vocabulary usage, and related-item navigation to item pages.
73. Task 113: add side-by-side practice for visually or semantically confusable kanji.
74. Task 114: build adaptive kana practice from weak symbols and repeatedly confused sounds.
75. Task 115: unify Hiragana, Katakana, and Kanji progress in a character hub while keeping kana outside SRS.
76. Task 116: add listening cards backed only by project-owned or legally reusable audio sources.
77. Task 117: research and integrate optional pitch-accent data only after a compatible source and attribution policy are approved.
78. Task 118: publish and verify bilingual curated coverage for at least 2,300 kanji and 8,000 vocabulary items.
79. Task 119: automate editorial quality checks for readings, meanings, prerequisites, examples, and source traceability.
80. Task 120: persist interface theme, density, motion, and study-surface display preferences.
81. Task 121: apply an original visual design system and refresh the dashboard, lessons, reviews, characters, search, and item pages.
82. Task 122: complete mobile, tablet, keyboard, screen-reader, contrast, and reduced-motion quality passes.
83. Task 123: improve route performance, installability, offline-safe application shell behavior, and optional review reminders.
84. Task 124: run production-scale migration, content, smoke, observability, backup, and deployment readiness checks.

At task 124 the intended result is an independent Russian-first product with
WaniKani-comparable structured kanji and vocabulary mechanics, a
Duolingo-inspired but independently designed character-learning area, and
first-class Russian, English, and combined card display. Similarity refers to
coverage of proven learning workflows, not copied content, curriculum order,
wording, or visual design.
