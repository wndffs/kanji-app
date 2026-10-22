# Request Privacy

This is a bounded Task124 repair for API request logging and error responses, not
a claim that the complete production privacy/security audit is finished.

## Request Targets

The request logger and exception filter share a request-scoped context. A URL
parser derives its path from `originalUrl`, falling back to `url`. Only the
pathname is retained: query strings, fragments, credentials and the authority of
absolute HTTP(S) URLs are excluded. Invalid targets and unsupported URL schemes
produce `unknown`; raw input is never used as the fallback. Paths are not decoded.

Request targets reflected by Nest's route-not-found messages or other explicit
HTTP exception messages are replaced with their parsed paths. Existing status
codes, error labels, Russian feedback and validation-array shapes remain intact,
apart from this removal of URL details and the additive `requestId` field.

The `http.request` access event contains the method, safe path, status, duration
and request ID. The `api.error` event for HTTP 5xx responses contains the safe
path, status, request ID and a fixed generic message. It does not log arbitrary
exception messages, stacks, request bodies, query objects, headers, credentials,
answers or mined text. Existing logger serialization is unchanged.

## Correlation

Each request gets a new server-generated `crypto.randomUUID()` value. Incoming
`X-Request-ID` values and request properties named `requestId` are not trusted or
used. A private `WeakMap`, keyed by the server request object, keeps one context
across middleware and exception handling without retaining completed requests.

The same ID appears in the response `X-Request-ID` header, the access event, the
5xx error event and the error JSON's `requestId` field. The exception filter can
create the context when an error occurs before the request middleware. Such an
early error has an error event and response ID, but may not have an access event.
Access logging uses a one-shot response `finish` listener.

Both middleware and exception handling set `Cache-Control: no-store`. Successful
JSON response bodies are unchanged; the ID is provided in the response header.

## Boundaries

- Reverse proxies, hosting providers, database instrumentation and other log
  sinks must independently omit or redact query strings. This repair cannot
  sanitize logs emitted outside these API components or previously stored logs.
- The pathname remains observable. Clients must not put secrets or mined text in
  path segments. Encoded path characters are not interpreted as query strings.
- Controllers must keep explicit HTTP exception feedback free of private values.
  This filter removes reflected request targets, not arbitrary standalone values
  interpolated into domain messages. Unknown exceptions receive generic Russian
  feedback rather than their original text.
- Cross-origin JavaScript access to `X-Request-ID` would require the parent-owned
  CORS configuration to expose that header. Error JSON already carries the ID.
- No CSP, browser persistence, repository behavior or database schema is changed.

## Focused Verification

From the repository root:

```sh
node node_modules/vitest/vitest.mjs run apps/api/test/request-privacy.test.ts --no-cache --configLoader runner --maxWorkers=1
node node_modules/typescript/bin/tsc -p apps/api/tsconfig.json --noEmit --incremental false
node node_modules/eslint/bin/eslint.js apps/api/src/logging/request-privacy.ts apps/api/src/logging/request-logger.middleware.ts apps/api/src/http/api-exception.filter.ts apps/api/test/request-privacy.test.ts --max-warnings=0
```

The tests use local request/response fixtures, not a listening server or database.
They cover query secrets, absolute and malformed URLs, control characters,
untrusted incoming IDs, one generated ID across access/error paths, unknown
errors, reflected 404 URLs, existing Russian feedback and no-store headers.
No production dependency or external educational data is introduced.
