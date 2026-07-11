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

## Corrected post-MVP sequence

1. Task 41: add standard yoon combinations as independent kana lesson units.
2. Task 42: add varied kana recognition, reverse-choice, matching, and typing exercises.
3. Task 43: add kana listening after selecting a legally compatible audio source.
4. Task 44: add kana tracing after selecting or authoring suitable stroke-path data.
5. Task 45: tighten the main lesson batch and required quiz flow before SRS entry.
6. Task 46: add learner-controlled lesson picking and interleaving within prerequisites.
7. Task 47: add optional recent-lesson, recent-mistake, and burned-item practice.
8. Task 48: expose workload balance and level progress without copying another dashboard.
