# App Installation Metadata

This bounded Task123 slice adds a public, static Next.js manifest with a stable
origin-relative app identity, standalone display and `/dashboard` launch URL.
Normal authentication still applies at launch; the manifest contains no account
IDs, credentials, private routes with identifiers or API URLs.

The 192/512-pixel PNGs and 180-pixel Apple icon are rasterizations of the existing
project-authored `apps/web/src/app/icon.svg`. Their opaque blue backgrounds and
centered mark fit the maskable safe area. No external artwork, dataset, licence
change or production dependency is added. To regenerate intentionally:

```sh
node apps/web/scripts/generate-app-icons.mjs
```

The generator uses the image codec already installed with Next. It is not a
runtime step. Generated icons are committed. The later public offline shell
registers a production-only service worker caching exactly `/offline.html` and
the 192-pixel icon; see `OFFLINE_SHELL.md`. No authentication/queue/schedule
response is cached. Installation metadata and a public error page are not
offline lesson/review support. Network errors must still leave writes unconfirmed.

Chrome's current [installation criteria](https://web.dev/articles/install-criteria)
include HTTPS, manifest metadata and 192/512 icons; the browser also controls
engagement heuristics and promotion. The implementation uses Next's
[manifest file convention](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/manifest).
It does not create a custom install prompt or claim uniform browser/platform
support. No app is automatically installed on the user's computer.

Focused unit and production-bundle desktop/mobile browser tests check manifest
discovery/MIME, safe identity/launch fields, PNG sizes, Apple metadata, an intact
login page. Separate worker tests cover only the public offline fallback and
registration failures, not device installation. Actual OS installation,
standalone relaunch, device-specific masks and the full offline/reminder matrix
remain manual acceptance before Task123 can be called complete.

On 2026-10-22 Vercel marked commit `4a5a8b3` deployed successfully. Its live
`/manifest.webmanifest` exposed the expected static metadata, and the in-app
browser decoded `/icons/app-512.png` as 512 by 512 pixels. This verifies the
published files, not OS installation. The local production build passed both
desktop/mobile installation-metadata cases and all three focused unit cases.
