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
