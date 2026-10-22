# Bounded Public Offline Fallback

This Task123 slice supplies a classic worker at `/sw.js` and a standalone Russian
error page. `OfflineShellRegistration` registers it only in production and secure
contexts, with root scope and `updateViaCache: "none"`. Unsupported workers,
rejected registration and storage-access exceptions leave online study intact.
There is no permission prompt, retry timer or forced worker update. This does
not prove OS installation, enable offline learning or complete Task123.

Cache `kanji-srs-public-offline-v1` has exactly two install precache paths:
`/offline.html` and `/icons/app-192.png`. Each uses a new Request with
`credentials: "omit"`, `cache: "no-store"`, `redirect: "error"` and
`referrerPolicy: "no-referrer"`. No token/cookie or user-storage reads are added.
One atomic `cache.addAll` populates both; any failure rejects installation. There
is no `skipWaiting`. Activation deletes only other caches under the
`kanji-srs-public-offline-` prefix, then claims clients; unrelated caches remain.

The only cache-first GETs are the two exact public asset paths without query or
fragment. Cache misses use the original network request without writing its
response to Cache Storage. Install is the only response-cache writer.

Known same-origin GET navigations use `fetch(request, {cache: "no-store"})`, never cached app
HTML. Only an actual rejected fetch can return the cached offline error page;
HTTP 401/403/404/500 responses are passed through unchanged. Missing fallback or
cache lookup errors return `Response.error()`, never invented success data.

Navigation paths are `/`, `/dashboard`, `/lessons`, `/reviews`, `/characters`,
`/kana`, `/search`, `/settings`, `/courses`, `/decks`, `/practice`,
`/practice/confusables`, `/login`, `/register` and `/items/<UUID>` only. The
worker deliberately leaves `/kanji/...` unknown. Same-origin query parameters on
otherwise allowed navigations are not cached or reflected into the fallback;
the Next `_rsc` query is excluded. API routes, cross-origin requests, non-GETs,
Authorization-bearing requests, RSC/prefetch traffic, other assets and unknown
routes are never intercepted. Next router/RSC header presence and standard
prefetch headers exclude even requests using otherwise allowed paths.

The offline HTML has no scripts, Next assets, forms, API calls, private content
or external resources. It uses only the existing project-authored 48px icon and
inline styles, a restrictive meta CSP and `no-referrer`. Its empty-href retry
link requests the current route again as navigation; it never replays a POST.
HTTP CSP headers must be compatible with the inline styles; meta CSP
cannot relax a stricter response header.

No app shell, authenticated queues, answers, schedules, session/token data or
private mnemonics are cached. There is no retry loop, write queue, background
sync, push, notification support or persistent draft storage. Existing loaded
pages may still require a live API; an offline error page is not a study session
and cannot confirm a lesson/review write. Browser cache eviction can remove the
fallback. New worker activation follows the browser lifecycle without forced
waiting-worker promotion.

VM unit tests execute only this repository's trusted worker source against mocked
events, Cache Storage and fetch; they make no network requests. They verify the
request boundary, install/activation contracts, public cache-only writes and
navigation/error behavior. Static HTML checks cover the bounded inert page.
The 39 focused VM cases passed, followed by 16 production-bundle desktop/mobile
browser cases across offline shell, manifest, review input and audio completion.
Both viewports verified the exact two cached public files, no cached API response
after authenticated GET/POST probes, a real offline navigation fallback with a
cached icon, no horizontal overflow, and fresh recovery without replaying writes.
Rejected/unsupported registration and a throwing storage-access getter kept the
login form usable. The browser tests also verified worker routing and
`Cache-Control: no-store` / `nosniff` headers on the local production server.
Screenshots are retained outside the repository. This is local production-bundle
evidence, not live-deployment offline or OS-install proof. No dependencies,
external artwork or licence changes are added.

When changing the worker's cached HTML/icon contract, increment `CACHE_NAME` so a
new installation cannot overwrite the active version's cache. Never broaden the
allowlist to private HTML or API routes. The lifecycle follows the platform's
[registration](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register)
and [worker lifecycle](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API/Using_Service_Workers)
contracts; unsupported environments retain network-only operation.

Focused checks:

```sh
npx vitest run apps/web/test/offline-shell.test.ts --no-cache --no-fsModuleCache --configLoader runner --maxWorkers=1
npx eslint apps/web/public/sw.js apps/web/test/offline-shell.test.ts --max-warnings=0
```
