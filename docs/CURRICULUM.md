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

## Lesson flow

1. Explain item.
2. Show components/relations.
3. Show meanings/readings.
4. Show mnemonic/hint.
5. Mini-quiz.
6. Add cards to SRS.
