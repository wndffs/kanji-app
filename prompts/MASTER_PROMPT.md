# Master prompt for Codex

Use this at the start of a new Codex session:

```text
Read AGENTS.md and docs/PROJECT_BRIEF.md first. You are working on a personal Russian-first Japanese kanji/vocabulary SRS web app with Russian and English learning translations.

Hard boundaries:
- Do not copy WaniKani content, mnemonics, level order, radical names, UI, CSS, audio, or wording.
- Use only legally reusable data sources and project-authored Russian/English content.
- No public community content in MVP.
- User custom accepted answers and mnemonics are private to that user.
- Web app must be mobile-responsive; no native mobile app.

Architecture:
- TypeScript monorepo.
- Next.js web app.
- NestJS API.
- PostgreSQL/Prisma.
- Separate packages for SRS, Japanese/Russian/English answer validation, importers, DB, shared types, and UI.

Work style:
- Implement only the requested task.
- Keep domain logic in packages.
- Add tests for behavior changes.
- Run relevant lint/typecheck/tests.
- Summarize changed files and remaining risks.
```
