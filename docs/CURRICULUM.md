# Curriculum design

## Two modes

### Structured levels

A curated course from beginner through approximately N2.

Rules:

- Components unlock kanji.
- Kanji unlock vocabulary.
- Vocabulary unlocks sentence cards.
- A level is complete when a required percentage of its core cards reaches the configured threshold.
- Do not copy WaniKani level order.

### Dynamic decks / text mining

The user pastes Japanese text. The app tokenizes it, identifies known/unknown words and kanji, and creates a deck with prerequisites.

Rules:

- Prefer high-value unknown words from the text.
- Include prerequisite kanji/components when useful.
- Prefer i+1 sentences when possible.
- The deck must not break structured-course progress.

## N5 -> N2 path

Implementation should not require all N2 content at MVP. Design schema and UI for these course bands:

- Foundation: kana, basic components, first kanji, survival vocabulary.
- N5: basic kanji/vocab/sentences.
- N4: everyday vocabulary and more readings.
- N3: mixed readings, abstract words, longer sentences.
- N2: higher-frequency written vocabulary, compounds, reading-focused practice.

Each curated course, course level, and learning item can be assigned to one of these bands. Imported
dictionary or sentence candidates stay import-derived until an admin promotes the target into a curated
learning item with a band, title, and optional level hint.

Published structured-course content must pass quality gates:

- every card has at least one accepted answer;
- meaning cards have Russian and English accepted answers;
- the target has Russian and English learning meanings/translations;
- Russian and English mnemonic or note content is present;
- source attribution or project authorship is traceable;
- non-component items have valid prerequisite dependencies, and prerequisites are published.

The admin curriculum completeness report summarizes these gaps by band so expansion work can move
from Foundation through N2 without requiring the full corpus upfront.

## Main lesson flow

Component, kanji, vocabulary, and sentence lessons use small groups of at most
five new items. The learner studies every item in the group before retrieval
begins. The required quiz then asks every meaning and reading card independently.

The API, rather than the browser, validates the complete answer set against
global accepted answers, private user answers, and blocked answers. Failed cards
stay in the quiz and reveal the accepted Russian and/or English answers for the
user's display mode. An item enters the interval-based SRS only after all of its
lesson cards pass; incomplete or failed attempts create no SRS progress.

## Kana curriculum

Kana is a separate character-learning track and does not use `LearningCard` or
the interval-based SRS for components, kanji, vocabulary, and sentences.

The shared core contains 104 independent learning characters or combinations
per script:

- 46 modern basic characters;
- 20 voiced variants with dakuten;
- 5 semi-voiced variants with handakuten;
- 33 standard yoon combinations with small `ゃ`, `ゅ`, or `ょ`.

The track then teaches orthographic sound patterns as separate targets:

- 4 representative sokuon patterns per script, using small `っ` or `ッ` to
  double the following consonant;
- 7 hiragana long-vowel spellings: repeated vowels plus `えい` and `おう`;
- 5 katakana long-vowel spellings using the prolonged sound mark `ー`.

This produces 115 hiragana targets and 113 katakana targets. The counts differ
because the scripts express long vowels differently.

Modified sounds are separate units: for example, `ひ` (`hi`), `び` (`bi`), and
`ぴ` (`pi`) keep independent progress. Hiragana and katakana progress is also
independent. Yoon combinations such as `きゃ` (`kya`) and `しゃ` (`sha`) also
keep their own progress instead of inheriting mastery from their base symbol.

The character track is split into sequential row lessons. A lesson first shows
the character and its reading, then rotates six retrieval formats: typed
romaji, character-to-reading choice, reading-to-character choice, a three-pair
matching board, browser-generated Japanese listening, and stroke-order tracing
for single kana glyphs. Tracing checks stroke order, direction, endpoints, and
path proximity against KanjiVG guides. Combined targets continue to use the
other exercise formats.

Listening uses a context pair such as `かっか` for a leading sokuon target so
the doubled consonant is pronounceable. If speech synthesis or a tracing guide
is unavailable, the remaining formats continue without blocking the lesson.

Choice sets exclude duplicate readings so equivalent targets such as `じ` and
`ぢ` cannot create an ambiguous question. Every pair or answer is checked by the
API and affects the corresponding target's progress.

Three correct answers complete a target; completion is permanent, while the
current streak can still reset after a wrong answer. The free assessment remains
a separate mode for learners who already know some kana and can complete earlier
lessons.

## Lesson flow

1. Explain item.
2. Show components/relations.
3. Show readings and meanings in Russian, English, or Russian plus English according to user settings.
4. Show mnemonic/hint.
5. Mini-quiz.
6. Add cards to SRS.
