# Web Bundle Measurement

This is a bounded Task123 measurement helper, not a performance completion claim.
It reads local artifacts and reports **external initial JS/CSS references from
HTML** for exactly `/dashboard`, `/lessons`, `/reviews`, `/items/[id]`,
`/characters`, `/kana` and `/settings`. There is no route wildcard or arbitrary
route/file selection. `npm run measure:web:bundles -- --build-complete` exposes
the read-only CLI. CI runs only its focused synthetic guardrails alongside the
remote-smoke guardrails; a complete bundle measurement is not yet a CI gate.

## Confirmed Format And Limits

The current workspace has Next **16.4.2**, `next build --webpack`, and
`output: "standalone"`. The production smoke runner
`apps/web/scripts/run-playwright-smoke.mjs` copies static assets into the
standalone directory and starts a server. This helper does **neither**; it uses
the original `.next/static` files and does not invoke the smoke runner.

The installed build source confirms:

- `next/dist/export/routes/app-page.js` appends the generated HTML to
  `htmlFilepath`; `next/dist/export/index.js` handles route `.html` artifacts.
  The completed real build independently confirmed static HTML at
  `.next/server/app/{dashboard,lessons,reviews,characters,settings}.html`.
- `next/dist/server/app-render/get-layer-assets.js` emits script asset `src`
  URLs under `/_next/`; stylesheet references are emitted in the rendered HTML.
  These HTML attributes, not guessed chunk names, define the measured set.
- `next/dist/build/webpack/plugins/flight-manifest-plugin.js` emits executable
  `page_client-reference-manifest.js` assignments containing module/chunk and
  CSS mappings. A union of those mappings is **not proven to equal a route's
  initial assets**. This helper never imports, evaluates or executes emitted
  JavaScript, and does not infer an initial bundle from that private format.

HTML is parsed with the existing MIT-licensed parser bundled at
`next/dist/compiled/node-html-parser`, guarded to the reviewed installed version
16.4.2. This introduces no dependency or lockfile change. The parser path is an
explicit version-bound implementation dependency, not a promised stable Next API.
Other versions fail closed until reviewed; no future manifest compatibility is
assumed. Fixtures are synthetic HTML, not claimed real build output.

Extraction includes external executable `script[src]`, stylesheet links,
`preload` links with `as=script|style`, and `modulepreload`. Duplicate references
and bracket-encoded route filenames normalize to one asset per route. Inert
template/noscript contents, comments, inline bootstrap/RSC data, font/icon links
and prefetch links are excluded. Conditional/nomodule scripts are included if
referenced: this is a conservative static reference metric, not a simulation of
a particular browser's loading decisions. Inline CSS and unrecognized initial
URLs fail closed instead of being assigned zero bytes.

Only root-relative `/_next/static/chunks/...js|css` or
`/_next/static/css/...css` paths are read. Absolute/CDN URLs, queries/fragments,
unknown percent escapes, traversal, drive/backslash paths, hidden segments,
source maps and symlinks/junctions are rejected. A changed or incomplete artifact
cannot silently disappear from the measured set. Limits are 4 MiB per HTML,
16 MiB per asset, 128 unique assets per route and 64 MiB of distinct asset reads.

## Read-Only CLI

Only after the parent confirms a successful build exit and that its output is
not being changed, run from the repository root:

```sh
node scripts/measure-web-bundles.mjs --build-complete
```

`--build-dir DIR` optionally selects another build snapshot. The helper requires
explicit `--build-complete` (or `buildComplete: true` for the imported helper),
a bounded valid `BUILD_ID`, and `diagnostics/framework.json` identifying the
reviewed Next version. Build markers are rechecked after reading the assets.
Importing the module does not run measurement or the CLI.

`BUILD_ID` is written **before static generation** in this Next version; its
existence alone does not prove success. No observed artifact is an atomic build
success receipt. The explicit flag is an operator attestation, not automatic
build detection. Do not use it on an active, failed or partially replaced build;
do not measure concurrently with another build. Marker/file checks detect some
changes but cannot prove an atomic snapshot or exclude every concurrent mutation.

Dynamic routes may have no emitted HTML. An operator can instead supply local,
complete HTML captured from the same completed build, without this helper making
any request:

```sh
node scripts/measure-web-bundles.mjs --build-complete --html-dir /absolute/captured-html
```

That directory must contain exactly the selected fixed route filenames used by
the helper: `dashboard.html`, `lessons.html`, `reviews.html`, `items/[id].html`,
`characters.html`, `kana.html`, `settings.html`. The template filename hides any
real item identifier. Static and dynamic captures must be placed there by the
parent; the helper never creates captures, invents a dynamic page's HTML or
executes client-reference manifests. The parent must confirm capture provenance;
the helper cannot establish that a user-provided capture is current or complete
merely from its filename. Until valid captures exist, the missing routes remain
unmeasured and the overall result is **incomplete**, not a pass.

The CLI writes JSON only to stdout, never creates an artifact/report/cache, and
has no network/process/server/build/secret-loading behavior. It does not read
`.env`, required-server-files/private configuration, source maps or server JS.
Reports contain fixed routes, numeric sizes and sanitized error codes, not asset
contents, inline HTML/RSC, absolute paths, build IDs or native exception messages.
Unknown/repeated flags are rejected. There is no output-file argument.

Exit codes: **0** complete and within budgets; **1** complete but over budget;
**2** incomplete/unsupported/invalid input. Incomplete takes precedence even when
the measured subset is within budget. The imported `main()` returns the same
codes. A CI caller must honor the nonzero result, not check only `excess: []`.

## Metrics And Starting Budgets

`rawB` is the exact static file length. `gzipB` is each file independently
compressed by Node gzip at level 9, then summed. It is not server-selected
compression, Brotli, compressed concatenation, browser transfer size, headers,
cache reuse, parse/execute cost, network requests or a performance score.

Every route's `initial` counts each normalized file once, including shared
runtime/layout assets. Its `shared` field is a **subset**, identifying assets also
referenced by another measured route; do not add it again. `totalDistinct` counts
the union once across measured routes, while `sharedDistinct` counts the common
subset once. With incomplete coverage these are lower bounds over known routes,
not seven-route totals. Reports do not multiply common runtime files by seven.

Provisional starting ceilings, in bytes, checked independently for raw and gzip:

| Scope          | JS rawB | JS gzipB | CSS rawB | CSS gzipB |
| -------------- | ------: | -------: | -------: | --------: |
| Each route     | 1572864 |   358400 |   262144 |     40960 |
| Distinct union | 4194304 |  1048576 |   524288 |     81920 |

These are explicit initial guardrails, not claimed measured baselines or tuned
CWV targets. The initial JS gzip route ceiling is 350 KiB and CSS is 40 KiB;
the raw ceiling also catches a huge highly compressible bundle. Any exceeded
raw/gzip ceiling fails; a small gzip size cannot mask a raw overrun. Budgets are
not automatically inflated to make an existing build pass. The parent should
review them after all seven routes have real evidence, before integrating a gate.

## Observed Build: 2026-10-22

The parent reported its single production build exited 0 on 2026-10-22 and kept
the output stable. Read-only inspection confirmed framework version 16.4.2 and
the following bytes. The initial read-only pass covered five static routes;
the parent then briefly started that same standalone build on loopback port
3174 and captured complete HTML for `/items/<synthetic UUID>` and `/kana`.
Only public, unauthenticated HTML shells were requested, without API tokens,
browser interaction or educational writes. Static HTML was copied from the same
build into the OS-temporary capture directory. The capture directory was removed
and the owned server exited before the measurement command returned successfully.
No second build or additional dependency was needed.

| Route       | JS assets | JS rawB | JS gzipB | CSS rawB | CSS gzipB |
| ----------- | --------: | ------: | -------: | -------: | --------: |
| /dashboard  |        10 |  642825 |   196735 |    87060 |     13733 |
| /lessons    |        10 |  645495 |   199386 |    87060 |     13733 |
| /reviews    |        10 |  627390 |   193914 |    87060 |     13733 |
| /characters |        10 |  612183 |   189902 |    87060 |     13733 |
| /settings   |        10 |  619118 |   192091 |    87060 |     13733 |
| /items/[id] |        11 |  632647 |   194763 |    87060 |     13733 |
| /kana       |        10 |  633362 |   195731 |    87060 |     13733 |

The seven-route union contains **17 JS assets: 812390 rawB / 247590 gzipB**,
and **1 CSS asset: 87060 rawB / 13733 gzipB**. Nine shared JS assets contribute
600105 rawB / 185822 gzipB to each measured route; the CSS file is also shared.
Both dynamic routes have no prerender HTML; the local captures supplied their
missing evidence. Overall status is `passed`, coverage **7/7**, with no starting
ceiling overrun. This is a local static-reference budget pass, not a deployment
transfer-size, authenticated interaction or full performance acceptance result.

## Remaining Work And Tests

Future builds require fresh confirmed captures for both dynamic routes; the
temporary captures from this run are not retained or reused. API latency/query
budgets, runtime dynamic imports and actual browser Core Web Vitals
(LCP, INP, CLS), hydration/interaction cost, cold/warm navigation and authenticated
study flows remain separate measurements. This static helper does not measure
or approve any of them, and does not complete Task123.

Only the focused fixture suite is required for this slice:

```sh
npm exec -- vitest run scripts/measure-web-bundles.test.ts --no-cache --no-fsModuleCache
```

Fixtures live in OS temporary directories and are removed in `finally`, including
failed assertions. Tests cover HTML-only extraction, duplicate/shared assets,
inert/inline content, strict paths/routes, source-map/external URL refusal,
symlink escapes, completion/version guards, missing dynamic HTML/files,
raw/aggregate budget overruns and sanitized CLI failures. No repository fixture,
dataset, temporary output or new dependency is needed. The package script and
CI guardrail step do not create captures or treat five-route coverage as a pass.
