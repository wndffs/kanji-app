# Project brief

## Goal

Build a personal Russian-localized Japanese kanji/vocabulary SRS web application with WaniKani-like learning structure but independent data and original pedagogy.

## User decisions

- Project type: personal project.
- Learning model: hybrid; structured levels plus dynamic decks/text mining.
- Target audience: Russian-speaking beginners and continuing learners, aiming to support learning up to about JLPT N2.
- WaniKani import: not needed initially.
- Community content: no public community mnemonics in MVP.
- Personal overrides: user can save custom accepted answers/meanings/notes/mnemonics for private use.
- Stack: TypeScript monorepo, Next.js web app, NestJS API, PostgreSQL/Prisma.
- Mobile: responsive web app; no native mobile app in MVP.

## MVP learning scope

MVP should prove the learning loop, not cover all Japanese content.

Target MVP content:

- Kana check/onboarding.
- 10-15 starter levels.
- 300-500 kanji.
- 1,500-2,000 vocabulary words.
- A small set of curated example sentences.
- Russian UI and Russian curated meanings.
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
