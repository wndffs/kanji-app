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

## Kana onboarding

The Foundation path begins with a separate familiarity assessment for the 46
modern basic hiragana and 46 modern basic katakana. It records attempts and a
three-answer familiarity streak per user. Assessment mastery is diagnostic and
must not unlock course content by itself; unknown kana should later enter the
normal lesson and `LearningCard` SRS workflow.

## Lesson flow

1. Explain item.
2. Show components/relations.
3. Show readings and meanings in Russian, English, or Russian plus English according to user settings.
4. Show mnemonic/hint.
5. Mini-quiz.
6. Add cards to SRS.
