# Subagent prompts

Codex subagents should be used deliberately, not for every small task.

## Full branch review

```text
Review this branch against main. Spawn subagents for:
- domain_architect: architecture and package boundaries
- db_reviewer: Prisma schema, migrations, indexes, query risks
- srs_reviewer: SRS correctness and edge cases
- licensing_auditor: data-source and WaniKani-boundary risks
- security_reviewer: auth, authorization, XSS, secrets, user isolation
- frontend_reviewer: responsive UX, accessibility, review flow
- test_engineer: missing or weak tests

Wait for all subagents. Consolidate findings by severity: Critical, High, Medium, Low. Do not edit files during this review. Include file paths and concrete reproduction/validation steps where possible.
```

## SRS-specific review

```text
Review the SRS implementation. Spawn srs_reviewer and test_engineer. Wait for both. Do not edit files. Focus on scheduling determinism, stage transitions, wrong-answer penalties, burned/resurrected behavior, time boundaries, and missing tests. Return a prioritized fix list.
```

## Data importer review

```text
Review the importer changes. Spawn licensing_auditor, db_reviewer, and test_engineer. Wait for all. Do not edit files. Focus on attribution, import idempotency, checksum/version tracking, parser correctness, fixture coverage, and accidental proprietary-content risks.
```

## UI review

```text
Review the web UI changes. Spawn frontend_reviewer and test_engineer. Wait for both. Do not edit files. Focus on mobile layout, keyboard flow, accessibility, loading/error states, Russian copy, Russian/English learning-content display modes, and Playwright coverage.
```

## Security review before deployment

```text
Review deployment readiness and security. Spawn security_reviewer, db_reviewer, and domain_architect. Wait for all. Do not edit files. Focus on auth/session safety, admin protection, private user data isolation, safe import operations, migrations, env vars, Docker configs, and production footguns.
```
