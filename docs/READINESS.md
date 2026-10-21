# API liveness and database readiness

## Endpoints

`GET /health` remains the existing process-liveness endpoint. It reports the API
service, environment, and auth mode without contacting PostgreSQL or Redis. A
successful liveness response does not mean the database is available.

`GET /ready` is an unauthenticated, on-demand database-connectivity diagnostic
for post-deployment or dependency checks. It is not a continuous monitoring or
hosting-platform health-check endpoint. It returns HTTP 200 with:

```json
{
  "service": "kanji-srs-api",
  "status": "ready",
  "database": "available"
}
```

A failed or timed-out probe returns HTTP 503 with:

```json
{
  "service": "kanji-srs-api",
  "status": "unavailable",
  "database": "unavailable"
}
```

Both responses use `Cache-Control: no-store`. The endpoint never includes driver
errors, connection URLs, credentials, or stack traces. Redis is optional and
unused by this check; a missing Redis service does not make the API unready.

## Bounds and caching

The check executes `SELECT 1` inside a Prisma interactive transaction. It first
sets a transaction-local PostgreSQL `statement_timeout` of 1,500 ms, so the
setting cannot leak onto a pooled connection. Prisma transaction options limit
acquisition wait to 500 ms and transaction execution to 2,000 ms. The HTTP-facing
probe result has a separate 3,000 ms deadline, including connection-startup delays.

Successes and failures are cached in memory for 7,500 ms from the response result.
The cache is per API process, not shared across instances. Concurrent requests
share one probe. If its HTTP deadline expires, requests receive the safe 503
result, but no new probe starts until the original transaction and its query
callback have both settled. Even after cache expiry, a still-pending probe does
not create additional database queries. A late success does not replace a timed-out
result; recovery is checked by the next probe once the failed cache has expired.

An unresponsive driver can therefore keep readiness unavailable without creating
an accumulating query backlog. The application does not claim that a JavaScript
timer cancels database work. Neon wake-up latency may temporarily produce a 503;
later probes can recover after the failure cache expires and the in-flight work
has settled. The response deadline is shorter than the connection/pool timeout,
so a first cold-start diagnostic can return 503 while the original connection
attempt continues. A later diagnostic after the 7.5-second failure cache can
succeed once Neon is awake; it must not start a second concurrent probe.

## Deployment use and limitations

`render.yaml` deliberately keeps `/health` as its `healthCheckPath`. Continuous
database probes would keep Neon awake and consume its free compute allowance.
Do not configure Render, uptime monitors, or periodic polling to call `/ready`.
The 7.5-second cache limits short bursts but does not prevent frequent probes
from keeping the database awake. Use `/health` for continuous process monitoring
and call `/ready` only when a database-dependent diagnostic is needed, such as
an on-demand post-deployment check.

Readiness verifies database connectivity only. `SELECT 1` does not verify schema
or migration compatibility, application-table permissions, content completeness,
SRS correctness, authentication, background jobs, or end-to-end user workflows.
A ready response is not a claim of full production readiness. Apply required
schema migrations before deploying runtime code that uses them.
