# Observability — working specification

Status: draft for decision, 2026-09-09. Once the decisions in §2 are settled
this document stays as the working contract (the way `provider-contracts.md`
does for providers) and the decisions themselves move to an ADR.

Requirement group: ASR02-OBS (`traceability.md`). Related: ADR-0002 (licence
posture for AGPL services), ADR-0003 (the `telemetry` SPI row), ADR-0008 (the
other thing called "telemetry").

## 1. Scope and principles

**What this covers.** Operational observability of the Layer 1 core: traces,
metrics and logs from `platform/core` and from the server side of `apps/web`,
the pipeline that carries them, a self-contained local stack, and guidance for
observing the infrastructure the core will eventually run on.

**What this does not cover.** The client behavioural stream in ADR-0008
(mouse, keyboard timing, camera). That is Restricted integrity data carried by
the `contracts/` protocol into the server's replay store. It never enters the
pipeline described here. To keep the two apart in prose and code, this
document uses **observability** for OTel signals and **integrity telemetry**
for the ADR-0008 stream.

**Principles.**

1. **Open standards only, at every boundary.** Signals are OTLP; context is
   W3C Trace Context; attribute and metric names follow the OpenTelemetry
   semantic conventions; configuration uses the OTel SDK environment
   variables. Nothing in application code names a backend.
2. **The code is not tied to a stack.** The application talks only to an
   OpenTelemetry Collector. Grafana's all-in-one image is a local development
   convenience; the production backend is chosen much later and must be
   swappable by changing Collector configuration alone.
3. **Content-free is enforced in-process.** No question content in any
   span, metric, log record or exception string (root invariant, DAT-03,
   SEC). The application applies an attribute allowlist before export; a
   build-failing test proves it. Collector-side redaction is a second layer
   behind the guard.
4. **Observability never blocks the core.** Export is asynchronous and
   batched. The application starts and serves with no Collector reachable
   and with the SDK disabled. Sampling is never on a validation path
   (QST03-VAL-03 is unaffected: sampling decides what is *recorded*, never
   what is *valid*).
5. **Maximum value for minimal code.** Auto-instrumentation for every
   framework in use; hand-written code only for the four things
   auto-instrumentation cannot know: the content-free guard, content-free
   request logging, provider-call spans at the registry, and domain metrics.
6. **Pinned and permissive.** Every package is Apache-2.0 or MIT and pinned
   in the lockfile. Every container image is digest-pinned
   (`CONTRIBUTING.md` supply-chain rules). AGPL services run unmodified and
   separately (ADR-0002).

## 2. Decisions

Settled decisions are recorded as such; the rest carry a recommendation and
need an owner's yes. Unsettled rows block the milestone slice that needs
them, not the whole spec.

| # | Decision | Options | Recommendation | Status |
|---|---|---|---|---|
| D1 | Local backend | Grafana all-in-one (`grafana/otel-lgtm`) / pure Apache-2.0 set / SigNoz | Grafana all-in-one, dev only | Settled 2026-09-09: Grafana for local dev only; production vendor decided later; code adheres to OTel only |
| D2 | Own Collector in front of the backend | App → Collector → backend / App → backend's bundled Collector | Own `otelcol-contrib` with a committed config; the backend is one exporter in it | Recommended |
| D3 | The `telemetry` SPI (ADR-0003) | Define a Python Protocol in `mulyankan-spi` / adopt OTel as the SPI | Adopt OTel as the SPI. OTLP is the interface, the Collector is the provider, the OTel env vars are the binding, and OTel spec compliance plus the §7 sentinel test are the conformance suite. A project Protocol would only forward to the SDK. Amend ADR-0003 with a dated note saying the row is satisfied by an open standard rather than a project interface | Recommended |
| D4 | OTel packages in `platform/core` | Mandatory dependency / optional extra | Mandatory. The content-free guard is a security control, not a feature; `OTEL_SDK_DISABLED=true` is the off switch | Recommended |
| D5 | Python setup style | Programmatic setup in one module / zero-code `opentelemetry-instrument` launcher | Programmatic. The guard processors and log bridge need code anyway; the launcher adds a second, process-level way to configure | Recommended |
| D6 | OTLP transport | HTTP/protobuf / gRPC | HTTP/protobuf on both runtimes: fewer native dependencies, proxies and TLS terminate the same way as the API | Recommended |
| D7 | Next.js SDK | `@opentelemetry/sdk-node` in `instrumentation.ts` / `@vercel/otel` | Plain `sdk-node`. `@vercel/otel` is a vendor distribution, contrary to principle 2; its edge-runtime support is not needed | Recommended |
| D8 | Propagators | `tracecontext` only / `tracecontext,baggage` | `tracecontext` only, on all three tiers (browser, Next.js server, FastAPI). Baggage is copied onto every outgoing request; disabling it removes a leak path for free | Recommended |
| D9 | Health-check spans | Trace `/healthz` / exclude | Exclude. The FastAPI exclusion mechanism drops both the span and the metric sample; accept losing `/healthz` from the duration histogram | Recommended |
| D10 | `client.address` on spans and logs | Keep / drop / hash | Keep. It is operational security signal (ARC-07 posture) and not question content | Settled 2026-09-09: traceability takes precedence; the data is handled by a regulated entity |
| D11 | SQL text on database spans (from M1) | Keep parameterised statement / drop | Keep only if the instrumentation is configured never to inline parameters; otherwise drop. Verify against the M1 driver choice | Open until M1 |
| D12 | Trace id exposed to callers | `Server-Timing: traceparent` response header / nothing | Add it on FastAPI responses. Lets an operator copy the trace id from browser tools without any vendor UI. The browser-to-server page-load link uses a `<meta name="traceparent">` tag instead (§4.8), which is what the document-load instrumentation reads | Recommended |
| D13 | Browser-side instrumentation | Now / after the role-surface question is settled | Now. Traces must start in the browser to be followed end to end, and oversight roles use this web app in a browser whichever way the role-surface question lands, so the work is not wasted. Content roles' thin client (ADR-0008) gets its own instrumentation when it exists | Settled 2026-09-09 |
| D14 | CI Python job | Prerequisite PR / part of the first slice | Separate prerequisite PR. The sentinel test in §7 is worthless if it cannot fail a PR, and `build-and-test` is still an `echo` | Recommended |
| D15 | Where the local stack lives | New `deploy/dev/` / `platform/core/dev/` / repo root `compose.yaml` | `deploy/dev/`. It will hold the production Collector config later; the root `AGENTS.md` gains the path in the same PR | Open |
| D16 | How browser spans reach the Collector | Browser posts OTLP to a Next.js route handler that forwards to the Collector / browser posts to the Collector directly with CORS | Route handler. The browser then talks only to the web app's origin, which matches the egress posture (ARC-07) and keeps the Collector off the public surface. The handler forwards bytes unchanged and applies the same size and rate limits as any other route | Recommended |
| D17 | Identity on browser telemetry | Anonymous per-tab `session.id` only / `session.id` plus the DAT-02 pseudonymous workforce id / raw identity | `session.id` plus `enduser.pseudo.id`, the same pseudonymous workforce identifier the audit chain carries, set after sign-in; plus the ADR-0008 machine id when the thin client exists. Never a name, email or subject claim: the regulated entity holds the mapping. This makes every browser signal joinable to the audit chain and to the server span for the same actor | Settled 2026-09-09: traceability is paramount; the data is handled by a regulated entity |
| D18 | RUM capture boundaries | Spans, vitals, errors only / add session replay or input capture | Spans, vitals and errors only. No session replay, no DOM snapshots, no input values, no element text: each would capture question content. Interaction spans record the element's id or xpath; element text is excluded | Recommended |
| D19 | Logging framework | Python: stdlib `logging` / structlog / loguru. Node: pino / winston. Browser: none / a logger | Python: stdlib `logging`, with the message as a static event name and every value in `extra`; the OTel handler maps `extra` to attributes with no code, and uvicorn and FastAPI already log through it. structlog is nicer to write with, but its rendered event reaches the OTel handler as one string, so fields land in the body where the guard cannot filter them; revisit if `extra` proves clumsy. Node: pino with `@opentelemetry/instrumentation-pino`, which injects trace ids and forwards records to the OTel logs SDK. Browser: none; errors use the OTel logs SDK directly (§4.8). Not previously selected by the team | Recommended |

## 3. What gets instrumented

### 3.1 Frameworks in use and their auto-instrumentation

All listed packages are Apache-2.0. "Now" is the M0 tree; "planned" follows
ADR-0001 and arrives with the milestone that introduces the dependency.

| Runtime | Framework | Instrumentation | Signals | When |
|---|---|---|---|---|
| Python | FastAPI / Starlette | `opentelemetry-instrumentation-fastapi` (wraps `-asgi`) | Server spans; `http.server.request.duration` histogram with `OTEL_SEMCONV_STABILITY_OPT_IN=http` | Now |
| Python | stdlib `logging` | `opentelemetry-instrumentation-logging` handler (the SDK's own handler is deprecated) | Log records with trace/span ids | Now |
| Python | CPython process | `opentelemetry-instrumentation-system-metrics`, `process.*` instruments only | Runtime CPU, memory, GC, threads | Now |
| Python | `httpx` | `opentelemetry-instrumentation-httpx` | Client spans + context propagation | When the core first calls out |
| Python | SQLAlchemy 2.0 | `opentelemetry-instrumentation-sqlalchemy` | DB client spans (see D11) | M1 |
| Python | PostgreSQL driver | `-psycopg` or `-asyncpg`, whichever M1 picks | Driver-level spans | M1 |
| Node | Next.js 16 server | Built-in framework spans once `instrumentation.ts` registers a provider; `@opentelemetry/sdk-node`, OTLP HTTP exporters | Route render, server actions, middleware, outgoing `fetch` with `traceparent` | Now |
| Browser | The web app in the browser (RUM), started from Next.js's `instrumentation-client.ts` | `@opentelemetry/sdk-trace-web` with `instrumentation-fetch`, `instrumentation-document-load` and `instrumentation-user-interaction`; `sdk-metrics` and `sdk-logs` with their OTLP HTTP exporters; `context-zone`; the `web-vitals` library (Apache-2.0) as the vitals source | Page-load and navigation spans linked to the server render via `Server-Timing`; a span per `fetch` to core-api with `traceparent` injected; click spans; web vitals as metrics; JavaScript errors as log records | Now (D13) |

Uvicorn's access log is disabled (`--no-access-log`): it prints the raw path
and query string, which the request log in §4.3 replaces with the route
template.

### 3.2 Domain instruments (hand-written, small)

Names are namespaced `mulyankan.*`; attributes are low-cardinality and
content-free.

| Instrument | Kind | Attributes | Since |
|---|---|---|---|
| `mulyankan.audit.events` | counter | `action` | Now |
| `mulyankan.audit.append.duration` | histogram (s) | — | Now |
| `mulyankan.registry.bindings` | observable gauge | `spi`, `provider.name`, `provider.version` | Now |
| `mulyankan.observability.attributes_dropped` | counter | `signal` (`span`/`log`), `attribute` | Now |
| `mulyankan.workflow.transitions` | counter | `from_state`, `to_state` | M1 |
| `mulyankan.audit.durable.latency` | histogram (s), target ≤ 5 s | — | M1 |
| `mulyankan.outbox.lag` | observable gauge (s) | — | M1 |
| `mulyankan.web.vitals.lcp`, `.cls`, `.inp`, `.ttfb`, `.fcp` | histogram | `url.path` (the pathname; content-free by DAT-03), `browser.mobile` | Now |
| `mulyankan.web.errors` | counter | `exception.type`, `url.path` | Now |

The vitals names are project-namespaced because the OTel semantic
conventions for browser vitals are still experimental; they move to the
standard names when those stabilise, with a dated note here. The browser
does not know the route pattern for a page, so browser signals carry the
pathname; Next.js 16.3 exposes route patterns to the client hook, and the
attribute switches to `http.route` when the app moves to that version.

The non-functional targets in `architecture.md` (read ≤ 2 s, draft save
≤ 1.5 s, operator signal ≤ 3 s, durable audit ≤ 5 s, 99.5 % availability)
become SLOs over `http.server.request.duration` by `http.route` and over the
audit instruments above. Alert rules are deferred until the deployment
target is known; when written they should use the Prometheus rule format
and, for the objectives themselves, the OpenSLO specification so they stay
vendor-neutral.

## 4. Generic components

Everything below lives in `platform/core/src/mulyankan_platform/observability/`
unless stated. The whole package is expected to be a few hundred lines.

### 4.1 `setup.py` — bootstrap

One function, `configure(app)`, called from `build_app`. It reads only the
standard OTel environment variables (§5), builds the tracer, meter and logger
providers with OTLP HTTP exporters, registers the guard processors (§4.2),
installs the logging handler, instruments the FastAPI app, and registers
the domain instruments. If `OTEL_SDK_DISABLED=true` it installs nothing.
It never raises: a misconfigured endpoint logs one warning and the app
serves.

### 4.2 `guard.py` — the content-free guard

A `SpanProcessor` and a `LogRecordProcessor` that run before the batch
exporters. Each holds an allowlist of attribute keys. Any attribute not on
the list is removed and counted in
`mulyankan.observability.attributes_dropped`, so an instrumentation upgrade
that starts emitting a new attribute shows up in a metric.

Allowed on spans:

- HTTP server/client: `http.request.method`, `http.route`,
  `http.response.status_code`, `http.request.body.size`,
  `http.response.body.size`, `url.scheme`, `server.address`, `server.port`,
  `network.protocol.version`, `client.address` (D10).
- Exceptions: `exception.type`, `exception.stacktrace`. `exception.message`
  is dropped: the repo rule says exception strings are content-free, and the
  guard does not rely on that.
- Identity: `enduser.pseudo.id` (the DAT-02 pseudonymous workforce id),
  never `enduser.id`.
- Domain: `mulyankan.spi`, `mulyankan.provider.name`,
  `mulyankan.provider.version`, `mulyankan.audit.event_id`,
  `mulyankan.object_ref` (opaque ids only), `mulyankan.state.from`,
  `mulyankan.state.to`, `mulyankan.http.request.duration` (request log
  only).
- Database (M1): `db.system.name`, `db.operation.name`,
  `db.collection.name`; `db.query.text` per D11.

Always dropped, by name and as a matter of record: `url.full`, `url.path`,
`url.query`, `user_agent.original`, `http.request.header.*`,
`http.response.header.*`, and any `*.body`. Span names and log bodies are
not inspected; they are trusted to be static templates (§4.4).

Allowed on log records: the same set plus `code.function.name`,
`code.file.path`, `code.line.number`, and the trace/span ids the handler
injects.

Resource attributes are not filtered: they are set by the operator from
`OTEL_RESOURCE_ATTRIBUTES` and contain no request data.

### 4.3 `http.py` — request and response logging

An ASGI middleware installed by `configure`. It emits one structured log
record per request with: `http.request.method`, `http.route` (the
template), `http.response.status_code`, duration,
`http.request.body.size`, `http.response.body.size`, `enduser.pseudo.id`
when a session exists, and the trace and span ids. It never logs bodies,
headers, path parameters, or query strings. It also sets the `Server-Timing`
response header carrying `traceparent` (D12).

Uvicorn's access log is turned off so this is the only per-request line.

### 4.4 `logs.py` — structured logs

The framework is the standard library `logging` module (D19). The root
logger is configured once: a JSON formatter to stdout (for `filelog`
collection in any deployment, §6) and the OTel handler to OTLP, which also
picks up uvicorn's own loggers.

The calling convention is what makes logs content-safe:

```python
logger.info("draft.submitted", extra={"object_ref": ref, "seq": event.seq})
```

The message is a static event name in the same dotted style as audit
actions, and every value goes in `extra`, where the OTel handler turns it
into an attribute and the guard (§4.2) can allowlist or drop it. Values are
limited to opaque ids, counts, route templates and state names. The one
existing call in `core_api/main.py` is rewritten to this style. The guard
cannot inspect the message itself, so a value interpolated into the message
is a review finding, and the sentinel test in §7 is the backstop.

On the Node side (§4.7), pino is the logger and the pino instrumentation
adds trace and span ids and forwards records to the OTel logs SDK; the same
event-name-plus-fields convention applies.

### 4.5 `providers.py` — provider-call spans at the registry

`ProviderRegistry.get()` returns the provider wrapped in a thin proxy that
opens a span named `<spi>.<method>` around each public method call, with
`mulyankan.spi`, `mulyankan.provider.name` and
`mulyankan.provider.version` from the descriptor. Arguments and return
values are never recorded; the `kms` SPI in particular handles plaintext.
This is the observability counterpart of ADR-0003 rule 2: every provider
interaction is visible, content-free. The registry test double in
`tests/conftest.py` exercises it without a real provider.

### 4.6 Audit chain

`AuditLog.append` records `mulyankan.audit.events` and
`mulyankan.audit.append.duration`, and adds an `audit.appended` event to the
current span carrying `mulyankan.audit.event_id` (an event rather than an
attribute, because one request can append several). The link runs from the span to the audit event id and
never the reverse: adding a trace id to an audit event would change its
canonical bytes and therefore every hash (invariant 10,
`CANONICAL_SCHEMA_VERSION`).

### 4.7 `apps/web/src/instrumentation.ts`

The Next.js instrumentation hook. `register()` imports a Node-only module
when `NEXT_RUNTIME === 'nodejs'`, which starts `NodeSDK` with OTLP HTTP
exporters, the resource from environment, and `tracecontext` as the only
propagator. Next.js's built-in spans then cover route rendering, server
actions and outgoing `fetch`, and the `traceparent` header reaches
`platform/core`, so one page render and its API calls are one trace.
Per the `apps/web` rule, no question content in `console.log` or any
attribute. The Node side gets the same allowlist guard as Python, applied
by wrappers around the OTLP exporters, in the same slice. The guard also drops every span whose
route is the OTLP relay (§4.9): without that, each relayed batch would
produce a span, which would be relayed, which would produce a span.

The root layout renders `<meta name="traceparent">` from the active server
span. The browser's document-load instrumentation reads that tag, so the
page-load span becomes a child of the server render.

### 4.8 `apps/web/src/instrumentation-client.ts` — browser tracing and RUM

Next.js runs this file once per page load, after the document loads and
before hydration (a file convention since Next.js 15.3). It starts
`WebTracerProvider` with the fetch, document-load and user-interaction
instrumentations, the zone context manager, W3C `tracecontext` as the only
propagator, and OTLP HTTP exporters for traces, metrics and logs pointed at
the route handler in §4.9. The fetch instrumentation ignores the relay's
own URL so the exporter's POSTs are never traced. The resource carries `service.name=web-browser`,
`service.version`, `browser.mobile` and the D17 `session.id`. After sign-in
the tracer sets `enduser.pseudo.id` on every span and record, taken from
the session the server issued.

The fetch instrumentation is configured with `propagateTraceHeaderCorsUrls`
matching the core-api origin, so every call from the browser to FastAPI
carries `traceparent`. The document-load instrumentation reads the
`<meta name="traceparent">` tag the root layout renders (§4.7), so the
page-load span links to the server span that rendered the page. Attributes are filtered by the same allowlist
as §4.2 through the guarded exporters: `url.full` is replaced by scheme,
host and path with the query string removed, and nothing from request or
response bodies is recorded.

Real-user monitoring is four signal sources on top of the tracer:

- **Page loads and navigations.** The document-load instrumentation covers
  the first load. App Router navigations do not reload the document, so the
  file's exported `onRouterTransitionStart` hook, which Next.js calls on
  every client navigation, opens a `navigation` span carrying the target
  pathname and the navigation type.
- **User interactions.** The user-interaction instrumentation opens a span
  per click, recording the element's id or xpath. It is configured for
  `click` only; no keyboard, input or change events, since those carry what
  the user typed (D18).
- **Web vitals.** The `web-vitals` library reports LCP, CLS, INP, TTFB and
  FCP; each is recorded on the histograms in §3.2 with the pathname as the
  only attribute.
- **Errors.** `window.onerror` and `unhandledrejection` handlers emit a log
  record with `exception.type` and `exception.stacktrace` and increment
  `mulyankan.web.errors`. `exception.message` is dropped, as in §4.2, because
  JavaScript error messages routinely interpolate values.

Every RUM span and record carries the current trace context, so a slow
interaction, the fetch it triggered and the FastAPI span that served it
are one trace, and a vital or an error is joined to the same visit through
`session.id`.

### 4.9 `apps/web/src/app/api/otlp/v1/[signal]/route.ts` — the OTLP relay

A Next.js route handler for `traces`, `metrics` and `logs` that accepts
`POST` bodies and forwards them, with their `Content-Type`, unchanged to
the matching path under `OTEL_EXPORTER_OTLP_ENDPOINT` on the server side
(D16). The browser exporters send OTLP as JSON and the Python exporter sends
protobuf; the Collector's OTLP receiver accepts both. It does not parse or log the payload, enforces a body-size limit,
and returns the Collector's status. The browser therefore never learns the
Collector's address, and the Collector needs no CORS policy.

On the FastAPI side, the CORS configuration that will arrive with the first
real API must list `traceparent` and `tracestate` in the allowed request
headers and expose `Server-Timing` in the response, or the browser drops
them and the trace breaks at the boundary.

### 4.10 The trace, end to end

One user action produces one trace:

1. `web-browser`: document-load span, or a fetch span when the user acts on
   an already-loaded page. It carries the trace id from here on.
2. `web` (Next.js server): render and route-handler spans for the page,
   linked to the browser through the `traceparent` meta tag; any
   server-side `fetch` to core-api continues the same trace.
3. `core-api` (FastAPI): the server span from the FastAPI instrumentation,
   picking up `traceparent` from either the browser or the Next.js server.
4. Children of the core-api span: provider calls through the registry
   proxy (§4.5), audit appends (§4.6), and database spans from M1.

The pseudonymous actor id, `enduser.pseudo.id`, appears at every tier: set
in the browser from the server-issued session (D17), and set again at step
3 from the validated session, so a mismatch between the two is itself a
signal. The browser's `session.id` groups one visit's vitals, errors and
spans; joined with the workforce id it gives the regulated entity a full
per-actor, per-visit trail alongside the audit chain.

Because the pipeline now carries the same pseudonymous identifiers as the
audit chain, the observability store is subject to the same access rules
as the audit store (DAT-02): operator roles only, no content-role access,
and retention set by the regulated entity. That is a deployment
requirement recorded here so it is not lost when the backend is chosen.

## 5. Configuration contract

Application configuration is the OTel SDK environment specification.
Deployments differ only in these values.

| Variable | Local default | Notes |
|---|---|---|
| `OTEL_SERVICE_NAME` | `core-api` / `web` | One per process type; workers get their own (`outbox-relay`, `sealing-worker`) |
| `OTEL_RESOURCE_ATTRIBUTES` | `service.namespace=open-mulyankan,service.version=0.1.0,deployment.environment.name=local` | `service.version` from the package metadata in production images |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://otel-collector:4318` | Always the Collector, never a backend |
| `OTEL_EXPORTER_OTLP_PROTOCOL` | `http/protobuf` | D6 |
| `OTEL_PROPAGATORS` | `tracecontext` | D8 |
| `OTEL_TRACES_SAMPLER` | `parentbased_always_on` | Production: `parentbased_traceidratio` with `OTEL_TRACES_SAMPLER_ARG`; tail sampling belongs in the Collector |
| `OTEL_SEMCONV_STABILITY_OPT_IN` | `http` | Stable HTTP conventions and the `http.server.request.duration` metric |
| `OTEL_PYTHON_FASTAPI_EXCLUDED_URLS` | `healthz` | D9 |
| `OTEL_SDK_DISABLED` | unset | `true` turns everything off; tests assert the app still serves |
| `OTEL_LOG_LEVEL` | `info` | SDK's own diagnostics |

No `platform.yaml` key is needed: under D3 the OTel environment variables are the binding.

The browser cannot read environment variables, so its two settings are
build-time constants exposed by Next.js: the relay path from §4.9 and the
core-api origin for `propagateTraceHeaderCorsUrls`. Both are public by
nature and carry no secret.

## 6. Pipeline and the local stack

### 6.1 Topology

```
core-api ─┐
web ──────┼─ OTLP/HTTP ─▶ otel-collector (contrib, our config) ─▶ backend
workers ──┘                     ▲
                                └─ infra receivers (§6.3)
```

The Collector is the only component the application knows. Its
configuration is the portable artefact: the same file, with a different
`exporters:` block, is the production pipeline. Locally it exports to the
`grafana/otel-lgtm` image (D1); that image bundles its own Collector, which
is used only as an OTLP receiver.

### 6.2 `deploy/dev/` (D15)

- `compose.yaml`: `otel-collector` (`otel/opentelemetry-collector-contrib`,
  digest-pinned, OTLP on 4317 and 4318) and `lgtm` (`grafana/otel-lgtm`,
  digest-pinned, Grafana on 3000). The two applications run on the host
  with their usual dev commands and point at `localhost:4318`, which keeps
  hot reload and avoids a second container image per runtime. Only the
  Collector's OTLP ports and Grafana are published to the host.
- `otel-collector.yaml`: `otlp` receiver (HTTP and gRPC); processors
  `memory_limiter`, `batch`, `resourcedetection` (env, system),
  `redaction` as defence in depth with the same allowlist as §4.2 and
  `summary: debug` so a Collector-side drop is itself observable, and
  `filter` to drop the health-check route if D9 changes; exporters `otlphttp`
  to `lgtm:4318`; `health_check` and the Collector's own telemetry enabled.
- `.env.example`: the §5 variables. The Collector's OTLP receiver has no
  CORS block: browser traffic arrives through the web app's relay (§4.9).
- A `README.md` stating that Grafana is a local development tool, not a
  dependency of the project, and that no dashboard or alert committed here
  may be required for the system to function.

The `Dockerfile` remains a placeholder. Containerising the two
applications for the compose stack is a separate concern.

### 6.3 Infrastructure observability (deployment-neutral)

The deployment target is undecided. The following is how infrastructure
signals join the same pipeline whichever target is chosen; all are
Collector receivers, so none of it touches application code.

| Target | Collector placement | Receivers | Notes |
|---|---|---|---|
| Single host / VM (the "demo edition" in ADR-0008) | One Collector service on the host | `host_metrics` (CPU, memory, disk, filesystem, network, load), `filelog` on the applications' JSON stdout, `docker_stats` if containers | The dev compose already proves this shape |
| Docker Compose in production | Collector as a compose service with the Docker socket read-only | as above | Same config file as `deploy/dev` minus the LGTM exporter |
| Kubernetes | Collector as a DaemonSet (agent) plus one Deployment (gateway, tail sampling) | `kubeletstats`, `k8s_cluster`, `filelog` on container logs, `k8sattributes` processor for pod metadata | Agent → gateway is OTLP, so the split is invisible to applications |
| PostgreSQL (M1) | Gateway or host Collector | `postgresql` receiver | Read-only monitoring role; the receiver reads statistics, never table content |
| Keycloak (dev IdP, ADR-0004) | Gateway Collector | `prometheus` receiver scraping Keycloak's metrics endpoint | Keycloak also supports OTLP tracing natively |
| The Collector itself | — | Its own `service.telemetry` block | Queue length and export failures are the first alert to write |
| Edge / reverse proxy | — | `nginx`, `haproxy` or Envoy's native OTLP, whichever is chosen | Gives the "operator signal ≤ 3 s" target an outside-in measurement |

Trace propagation across the reverse proxy needs `traceparent` forwarded
unchanged; every mainstream proxy does so by default.

## 7. Testing

Tests use the SDK's in-memory exporters; nothing in the test suite talks to
a Collector. Requirement-facing names carry the ID.

- `test_asr02obs_no_content_reaches_any_exporter` (the standing DoD
  "no-Restricted-content-in-logs scan" from `traceability.md`): drive a
  request whose body, query string, header, path parameter and raised
  exception message all contain a sentinel; append an audit event whose
  payload contains it; call a provider through the registry with it as an
  argument. Assert the sentinel appears in no exported span, log record,
  metric attribute or resource.
- `test_asr02obs_request_log_uses_route_not_path`: the request log carries
  the template, and neither the concrete path nor the query string.
- `test_asr02obs_unknown_attributes_are_dropped_and_counted`.
- `test_asr02obs_app_serves_with_collector_unreachable` and
  `test_asr02obs_app_serves_with_sdk_disabled`.
- `test_asr02obs_provider_calls_are_spanned_content_free` against the
  `testkit_fake_provider` double.
- `test_asr02obs_audit_append_records_metrics_and_span_link`.
- Existing `test_healthz_*` unchanged: `/healthz` output does not grow.
- `apps/web`: a unit test that the relay forwards a body unchanged and
  rejects an oversized one, and a browser test (Playwright, when the app
  gains tests) that a page load followed by a fetch to a stub core-api
  yields one trace id across all three tiers.
- `apps/web`: a browser test that types a sentinel into a form field, clicks,
  and triggers an error whose message contains the sentinel, then asserts
  the sentinel appears in no exported span, metric or log record. This is
  the §7 content-free test for RUM.

Both requirement tests and the guard's allowlist are the artefacts an
auditor reads; keep the allowlist in one place with a comment per entry.

## 8. Repository changes when this is implemented

- `platform/core/pyproject.toml`: OTel API, SDK, OTLP HTTP exporter, FastAPI,
  logging and system-metrics instrumentations (D4), pinned.
- `platform/core/src/mulyankan_platform/observability/` as in §4;
  `build_app` calls `configure`; `registry.get` returns the proxy.
- `apps/web/package.json`, `src/instrumentation.ts` (§4.7),
  `src/instrumentation-client.ts` (§4.8), the OTLP relay route (§4.9), the
  `traceparent` meta tag in the root layout, and the `web-vitals`
  dependency.
- `deploy/dev/` as in §6.2.
- ADR-0009 (adopting OpenTelemetry as the telemetry SPI) and the dated
  amendment to ADR-0003 exist as of 2026-09-09. The remaining rows of §2 are
  working-contract decisions recorded here; any that turns out to change an
  architectural commitment gets its own ADR.
- `docs/traceability.md`: ASR02-OBS row gains the §7 test names.
- `AGENTS.md` (root): `deploy/` added to the paths that exist; the daily
  consequence line gains "or span attributes". `platform/core/AGENTS.md`:
  the observability package and the registry proxy. `apps/web/AGENTS.md`:
  the instrumentation file. `docs/AGENTS.md`: this file.
- CI: `build-and-test` runs the Python tests (D14, separate PR first).

## 9. Deferred

- A project-specific `telemetry` Protocol. Revisit only if a sink appears that cannot be reached over OTLP (D3).
- Instrumentation of the ADR-0008 thin client for content roles, once it
  exists. It will follow §4.8 with its own service name.
- Tail sampling, alert rules and dashboards committed to the repository;
  a dashboard is useful locally but must never become a dependency.
- Profiling (OTel profiles signal) once the SDKs are stable.
- Session replay of any kind. It is not deferred but excluded: a replay is
  a recording of question content (D18).
- Any correlation between observability and the integrity telemetry of
  ADR-0008. They stay in different stores with different retention and
  access rules.
