# Remote Performance Sidecar

This is an on-demand Task123/124 source sample, not production acceptance or a
whole-app installation/reminder implementation. No live run was performed while
authoring it. A maintainer reviews and manually dispatches `Manual Remote Study
Smoke`. There is no scheduled trigger, polling, automatic retry or paid service.

The workflow uses fixed public web/API origins and a strict manual `v1`/`v2`
choice (default `v1`), mapped only to the corresponding published finite pilot
slug. Selecting an unpublished pilot fails closed; it never publishes it.
It needs Node 22, no dependencies or secrets.
`npm run smoke:remote` remains the CLI entry. Both `STAGING_WEB_URL` and
`STAGING_API_URL` must explicitly name an HTTPS origin or exact loopback HTTP
origin (`localhost`, `127.0.0.1`, `[::1]`, optional port). Credentials, query,
fragment, non-root paths, alternate loopback spellings and redirects are rejected.
Origins and response/exception content are never printed.

Each manual generated-profile run retains one disposable audit account with a
cryptographically random email/password. It does not delete that account or save
its credentials. Registration can auto-enroll default courses via the existing
API. An explicit `STAGING_SMOKE_COURSE_SLUG` searches at most five 20-entry keyset
catalog pages, enrolls that generated profile and selects it with
`PATCH /courses/current {courseId}`. No seed, reset, import, global publication,
settings, answer, session completion or schedule writes occur. The runner also
reads the public reminder preferences, verifies the generated profile is opted
out at hour 9 with no private timestamp exposed, and submits one empty disabled
reminder claim. It must return exactly `{shouldNotify:false}`; this must not
create a claim timestamp or notification. No permission or enablement is requested.

Supplying both `STAGING_SMOKE_EMAIL` and `STAGING_SMOKE_PASSWORD` switches to
**login only**. Missing/empty halves and any explicit course slug in this mode
fail before requests. Existing accounts are never registered, enrolled or modified.
They must already have a current course and a nonempty lesson queue.
Their public preference shape is validated, but a reminder is never claimed for
a configured account, even when its existing preference is enabled.

The runner checks web/API health and API database readiness once, authenticates
once, then sequentially samples dashboard, lesson queue, review queue, character
hub and a UUID-validated first lesson item endpoint. Each authenticated study GET
has three samples by default; `STAGING_SMOKE_SAMPLES` permits only 1, 2 or 3.
Every response is streamed with a 2 MiB decoded-body byte cap. Each request has a
75-second deadline including body consumption; the whole API run has a five-minute
deadline. Timeout/error paths abort requests, cancel readers and clear timers.
The workflow has a separate ten-minute job ceiling.

## Initial Targets

Initial targets are **2,000 ms per warm sample** for each of dashboard, lessons,
reviews, characters and item. These are explicit starting targets, not measured
baselines or demonstrated production budgets. Each endpoint reports individual
`elapsedMs`/`bytes`, plus elapsed min/median/max. Samples after the first are
compared with the target; `warmExceeded` records any excess, not a rewritten
threshold. A run can pass response checks while exceeding the target. Consumers
must inspect that flag. With one sample there is no warm measurement.

Timings include fetch and complete body decoding/JSON parsing, not rendering.
The first sample is not a proven cold start; subsequent samples are only repeated
requests, not evidence of any particular cache state. Three samples cannot support
p95 estimates. This finite pilot source sample has empty reviews for a fresh
profile and does not represent a populated backlog, full course, browser CWV,
route bundles, SQL counts, query optimization or concurrent learner traffic.

## Sanitized Report

Set `STAGING_SMOKE_REPORT_PATH` to an absolute JSON destination outside the repo.
The parent directory must exist; the writer resolves its real path and creates
the file exclusively (`wx`, mode 0600), never replacing an existing artifact.
The workflow uses exactly `${RUNNER_TEMP}/remote-study-smoke.json`. Only a
successful report write by this invocation sets `report_ready=true`; upload uses
that flag even for failed smoke checks, and uploads only that exact JSON path.
No wildcard, raw response, token, email, password, UUID or private body is emitted.
Reports contain fixed step labels, numeric timings/bytes, aggregates and optional
fixed failure code/step/status. Status 0 means no HTTP status was obtained.
CLI output is a fixed success marker followed by the same sanitized samples and
aggregates, or a fixed failure code/step/status. No raw response is printed.

Mock-only unit tests cover URL safety, request/body deadlines, redirects, privacy,
response validation, bounded reads/catalog traversal, exclusive report writes and
account write guards. These tests do not contact the deployment, database or live
accounts. Real deployment behavior and measured target attainment remain for a
maintainer's reviewed manual dispatch. No external data or licence changes apply.

## Verified Pilot Sample: 2026-10-22

[Manual run 39811129567](https://github.com/wndffs/kanji-app/actions/runs/39811129567)
at commit `cd10aa4` passed all response checks on the fixed Vercel/Render targets.
It created one disposable profile, explicitly enrolled/selected the published
100-item Foundation pilot, and made three sequential requests per study endpoint.
Its [sanitized artifact](https://github.com/wndffs/kanji-app/actions/runs/39811129567/artifacts/12439592538)
contains all fifteen samples; no credentials or raw payloads were uploaded.

| Endpoint   | Min / Median / Max, ms | Response bytes | Repeated samples above 2,000 ms |
| ---------- | ---------------------- | -------------- | ------------------------------- |
| Dashboard  | 480 / 514 / 1,251      | 6,127          | 0 of 2                          |
| Lessons    | 686 / 893 / 900        | 24,407         | 0 of 2                          |
| Reviews    | 190 / 193 / 220        | 60             | 0 of 2                          |
| Characters | 285 / 291 / 321        | 69,820         | 0 of 2                          |
| Item       | 709 / 812 / 1,016      | 14,365         | 0 of 2                          |

These are GitHub-hosted-runner-to-deployment measurements, not the user's network
latency. Reviews were empty and the first lesson target was a component. This
does not cover a populated backlog, a full 2,300-kanji course, audio playback,
mobile rendering, browser CWV, p95, load tests or proven cold starts. The runtime
deployment SHA is not asserted by this runner; the commit identifies the runner
source, not an independent runtime-version attestation. Task123 remains open.
