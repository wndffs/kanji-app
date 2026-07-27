# Licensed audio storage policy

## Scope

Listening cards may target published vocabulary or approved sentences. Components
and isolated kanji are not eligible because they do not have one deterministic
spoken reading.

Every listening card points to one `AudioAsset`. An eligible asset must:

- be `PUBLISHED`;
- have an immutable HTTPS `mediaUrl`;
- have a SHA-256 checksum and positive duration;
- identify its learning item, source, license, locale, attribution, and speaker
  or voice metadata where known;
- use a license that permits the intended deployment and redistribution.

`storageKey` records the object-store identity for a future same-origin media
proxy. It is not a playable fallback in the current implementation. Database
blobs, browser speech synthesis, transient signed URLs, and bulk audio without
per-file licensing are not graded listening sources.

## Hosting contract

Production audio should use immutable object keys derived from the checksum.
The media host must:

- allow `GET`, `HEAD`, and byte range requests;
- return `Accept-Ranges: bytes`, a correct audio `Content-Type`, stable
  `Content-Length`, and cache validators;
- permit CORS `GET`/`HEAD` from the deployed web origins;
- expose `Accept-Ranges`, `Content-Length`, `Content-Range`, and `ETag`;
- keep a published URL available for existing SRS cards or unpublish the asset
  before removal.

The web client treats `error`, aborted loading, and incomplete playback as a
recoverable state. It does not enable grading until the audio reaches `ended`.
Replay count is evidence only and never changes correctness or SRS penalties.

## Publication and removal

A listening card is publishable only when its linked asset is eligible and
belongs to the same vocabulary or sentence learning item. Queue reads also
enforce eligibility so stale cards with missing or unpublished media are not
scheduled.

Removing an asset requires first unpublishing it. Existing SRS state remains
card-local but the card is withheld until an eligible asset is restored.

No Tatoeba audio or other bulk source may be imported until each file's license,
speaker attribution, checksum, and redistribution rights have been verified.
