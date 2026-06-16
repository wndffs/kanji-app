# Codex workflow

## Recommended flow

1. Create a Git branch for one task.
2. Paste the task prompt from `docs/CODEX_PROMPTS_FULL.md`.
3. Let Codex inspect files and propose a plan.
4. Keep the task scope narrow.
5. After implementation, ask Codex to run relevant tests.
6. Ask for a review with subagents on larger changes.
7. Commit only when tests and diff look clean.

## Standard task prefix

Use this at the start of most prompts:

```text
Read AGENTS.md and the relevant docs in /docs before editing. Implement only this task. Do not copy WaniKani content, level order, mnemonics, UI, or wording. Keep domain logic in packages. Add or update tests for every behavior change. Run the relevant formatter, typecheck, and tests. Summarize changed files and any tests that could not be run.
```

## Standard review prompt

```text
Review this branch against main. Spawn subagents for domain_architect, db_reviewer, srs_reviewer, licensing_auditor, security_reviewer, frontend_reviewer, and test_engineer where relevant. Wait for all subagents and consolidate findings by severity. Do not edit files during review. Focus on correctness, data/license safety, missing tests, and user progress integrity.
```

## When to use subagents

Use subagents for broad reviews, architecture decisions, data import/license work, SRS changes, auth/security, and large UI flows.

Do not use subagents for tiny typo fixes or one-file changes.
