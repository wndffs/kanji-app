# Project brief

## Goal

Build a personal Russian-first Japanese kanji/vocabulary SRS web application with WaniKani-like learning structure but independent data and original pedagogy.

## User decisions

- Project type: personal project.
- Learning model: hybrid; structured levels plus dynamic decks/text mining.
- Target audience: Russian-speaking beginners and continuing learners, aiming to support learning up to about JLPT N2, with English learning translations stored alongside Russian.
- WaniKani import: not needed initially.
- Community content: no public community mnemonics in MVP.
- Personal overrides: user can save custom accepted answers/meanings/notes/mnemonics for private use in Russian and/or English.
- Stack: TypeScript monorepo, Next.js web app, NestJS API, PostgreSQL/Prisma.
- Mobile: responsive web app; no native mobile app in MVP.

## MVP learning scope

Historical MVP planning targets below describe an earlier phase, not verified
published counts. The current product target is at least **2,300 placed kanji
and 8,000 placed vocabulary expression-reading pairs across 60 independent
levels**, with reviewed RU/EN learning content. See
`TASK_SPECS_111_124.md` and `TASK_118_PUBLICATION_STATUS.md` for acceptance and
current evidence. Imported dictionary capacity is not published course content.

MVP was intended to prove the learning loop, not cover all Japanese content.

Target MVP content:

- Separate hiragana/katakana lessons and familiarity assessment.
- 10-15 starter levels.
- 300-500 kanji.
- 1,500-2,000 vocabulary words.
- A small set of curated example sentences.
- Russian UI by default, with learning-card translation display modes: Russian, English, or Russian plus English.
- Curated meanings, hints, explanations, and mnemonics should exist in Russian and English when published.
- SRS reviews and lessons.
- Personal custom accepted answers.
- Admin curation tools.

## Later scope

- Full N5 -> N2 structured courses.
- Dynamic text mining.
- More example sentences.
- Listening cards.
- Pitch accent display if a compatible source is selected.
- More advanced review forecasting and leech handling.
