# Dependency security review

Reviewed: 2026-10-21. Commands: `npm audit --omit=dev --json` and
`npm audit --json`. Counts describe this locked snapshot, not a permanent claim.

## Applied changes

The initial production audit had 12 entries: 2 critical, 9 high, 1 moderate.
Compatible updates fixed the HTTP/multipart and associated runtime chains.
Next.js 15 still pinned vulnerable PostCSS, so the web application was upgraded
to Next.js 16.4.2 with matching ESLint plugin. Existing async request parameters
already met the migration requirements. Webpack remains explicit in dev, build,
and browser testing. No cache or authentication policy was changed.

Vitest was upgraded to 5.0.5 to remove the vulnerable test-runtime chain; the
minimum Node version is now 22.12. The current local runtime is 22.22.0 and
deployment images/workflows use Node 22. Compatible development fixes also
removed the shell-quote/concurrently critical chain. Next build workers are
bounded to two. Generated next-env.d.ts stays ignored; a checked-in baseline
declaration keeps clean-checkout typechecks working. Next is prevented from
rewriting project agent instructions.

Configuration serialization now redacts database and Redis URLs as well as
the token signing secret. Runtime configuration still receives the original
values; no secret appears in this document or the committed diff.

## Remaining reviewed risks

Production audit: **0 critical, 3 high, 0 moderate**. The three entries represent
one underlying issue: `prisma -> @prisma/config -> deepmerge-ts`.

- Advisory: [GHSA-ggr8-5vv4-36mx](https://github.com/advisories/GHSA-ggr8-5vv4-36mx).
- Exploitation requires recursive JavaScript object graphs supplied to a merge.
  The application does not accept executable Prisma configurations from users;
  `prisma.config.ts` is a static repository-owned schema/migrations declaration.
  Plain request JSON cannot contain the required cycles. The request-serving
  code uses Prisma Client, not Prisma's CLI configuration loader.
- Upstream remediation requires a Prisma major migration. It is deferred to
  an explicit migration task with database adapter, generation, deploy, and
  rollback tests. Do not use `npm audit fix --force` or silently override the
  pinned configuration library with another major version.

Full audit: **0 critical, 7 high**. The four additional entries represent
`@next/eslint-plugin-next -> fast-glob -> micromatch -> braces`.

- Advisory: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- The reported issue concerns deeply nested glob patterns; lint configuration
  is repository-owned and no learner request is passed to this toolchain.
- No patched braces version was reported. npm proposes an incompatible ESLint
  plugin downgrade; it was not applied. Re-evaluate when upstream ships a fix.

These are recorded risk decisions, not a zero-vulnerability claim. Re-run both
audits before a production promotion or dependency change. Task 124 retains
its live migration, restore, observability, and deployment acceptance criteria.

## Verification

Next 16 production compilation and TypeScript checks pass. The item-page,
private-content failure/retry, and main registration/lesson/review/item browser
paths pass on desktop and mobile. Focused API security/configuration/progress
tests and DB content tests pass on Vitest 5. See the revalidation report for
the separately verified staging corpus and remaining product work.

Primary migration reference:
[Next.js 16 upgrade guide](https://nextjs.org/docs/app/guides/upgrading/version-16).
