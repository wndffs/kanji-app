# Deployment Build Filters

Documentation/test-only pushes do not need a new application bundle. CI still
runs: deployment filtering never replaces tests or branch protection.

## Vercel

`vercel.json` invokes `scripts/ignore-web-build.mjs` before installing packages.
The script uses only Node built-ins and Git. Exit 0 means skip; exit 1 means
build, following the [Vercel ignoreCommand contract](https://vercel.com/docs/project-configuration/vercel-json#ignorecommand).

Only a diff from `VERCEL_GIT_PREVIOUS_SHA` to HEAD containing exclusively known
documentation and test paths can skip. Comparing only HEAD's immediate parent
would hide runtime changes from a previously failed or skipped deployment.
Missing/invalid base SHA, shallow history, non-ancestor base, malformed output,
unknown paths and Git errors all continue the build. An empty diff also builds,
so manually redeploying the current commit is not silently cancelled.

Set `KANJI_FORCE_DEPLOY=1` for an explicit build when necessary. Without a
previous successful SHA the conservative fallback is a build, not a skip.
Application code, public assets, database schema, dependencies and deployment
configuration always build. No secret or environment-value comparison is used.

This can save build work, but ignored deployments may still count against
Vercel deployment/concurrency limits; it is not a claim of zero platform cost.

## Render

`render.yaml` uses only `buildFilter.ignoredPaths`, never an exhaustive runtime
allowlist. Unknown/new code paths therefore still trigger deployment. The
known documentation/test paths match the Vercel policy. See the
[Render Blueprint reference](https://render.com/docs/blueprint-spec#buildfilter).

The Blueprint must be synced to the existing service before these settings
are effective; editing the file alone does not prove cloud configuration.
Manual deployments remain available. Check that a docs-only push is skipped
and a subsequent runtime push reaches Ready/Live before claiming rollout.

On 2026-10-22 a Blueprint sync did not populate the existing service's ignored
paths. The exact `render.yaml` ignored-path list was therefore saved directly in
that service's **Settings > Build Filters** and its persisted values were checked.
Evidence: `render-build-filters-2026-10-22.png`, outside the repository. This
confirms configuration, not yet a docs-only skip. A subsequent live API response
did expose the curated-meaning repair from `6c1e7ab`; a complete skip/build
acceptance pair still needs observation.
