# Deployment Revision Checks

Task124 health responses now expose only `revision: <full 40-hex SHA> | null`.
API `/health` reads the validated `RENDER_GIT_COMMIT` from its configuration
snapshot; web `/api/health` reads `VERCEL_GIT_COMMIT_SHA` in a forced-dynamic
server route. Both responses are `Cache-Control: no-store`. No database query,
Git process, source checkout or additional secret is needed.

These are provider-documented commit identities:
[Render defaults](https://render.com/docs/environment-variables#render_git_commit)
and [Vercel system variables](https://vercel.com/docs/environment-variables/system-environment-variables#vercel_git_commit_sha).
Missing or malformed metadata yields null, never a guessed local HEAD or a raw
environment value. Only complete hexadecimal identities are normalized and
exposed; URLs, tokens, branch names and short SHAs are rejected. This is the
deployment's declared source identity, not signed binary/build attestation.

## Manual Smoke Gate

The manual remote workflow accepts optional `expected_web_revision` and
`expected_api_revision` inputs. Use independently confirmed **full** SHAs for
the two actual deployments. Do not automatically set both to the runner's HEAD:
build filters can legitimately leave the two services on different commits.
Blank workflow inputs skip matching; an explicitly empty CLI environment value
is invalid rather than an implicit expected revision.

Equivalent CLI variables are `STAGING_EXPECTED_WEB_REVISION` and
`STAGING_EXPECTED_API_REVISION`. Any nonempty expectation must be a full SHA;
invalid configuration fails before requests without printing its value. A
different, missing or null observed revision fails with `DEPLOYMENT_MISMATCH`
at the corresponding public health step, **before database readiness, account
registration, enrollment or study requests**. No retry or forced redeploy occurs.

The sanitized report and `REMOTE_MEASUREMENTS` output add:

```json
{
  "deployments": {
    "web": { "revision": null, "verified": false },
    "api": { "revision": null, "verified": false }
  }
}
```

`verified` is true only after an explicitly supplied expectation matched that
service. A well-formed observed SHA without an expectation stays unverified.
Legacy endpoints with no field are accepted as unknown only when matching was
not requested. A malformed non-null response field is always rejected without
echoing it. Reports never include arbitrary environment or response content.

## Verification

The focused shared/API/web/runner suites passed **153 cases**. They cover invalid
metadata privacy, null defaults, exact independent matches, mismatches before
account writes, legacy compatibility and no-store/dynamic health contracts.
Scoped lint and shared/API/web typechecks passed. Both live public health routes
then reported `ec537ac6f3d8432efb3e562f7f3055ee8b6a2192`.
[Remote run 39830339138](https://github.com/wndffs/kanji-app/actions/runs/39830339138)
passed with that independently observed full SHA supplied for both services;
its report marks both revisions `verified: true`. It also exercised the V2
pilot, kana, settings, bounded search and repeated study reads. This establishes
the metadata match for that run, not browser performance, later deployments or
binary attestation. Passing local tests alone does not establish a live match.
