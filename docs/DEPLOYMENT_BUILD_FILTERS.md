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

Live acceptance on 2026-10-22: runtime commit `4a5a8b3` reached
[successful deployment](https://vercel.com/windoffs2-8315s-projects/kanji-app/E7TdovuZABB3tM8UbtMzP2H6yA97),
and the browser loaded its new public manifest/icon. The subsequent docs-only
commit `68a701a` was
[cancelled by the ignored build step](https://vercel.com/windoffs2-8315s-projects/kanji-app/9Jvi7VBxYugRBSiBVUoHbWqahy8H)
with a successful GitHub status. This is the observed skip/runtime pair, not
only a passing local decision-script test.

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
confirms configuration, not yet an explicit docs-only skip event. The service's
Deploys page subsequently showed `4a5a8b3` as **Live**, deployment
`dep-dbd22ijncjis73bf0990`; the screenshot `render-runtime-live-2026-10-22.png`
records that runtime rollout. No deployment of the later docs-only `68a701a`
appeared in the observed Deploys/Events lists, but absence alone is not certified
skip evidence. The explicit Render skip side of the pair remains unverified.
