# ADR-0009: OpenTelemetry is the telemetry SPI

- Status: Proposed
- Date: 2026-09-09

## Context

ADR-0003 lists `telemetry` among the service-provider interfaces: "OTLP sink
for metrics, traces, logs", consumer "observability", scheduled for M1 in
`docs/provider-contracts.md`. Every other row in that table names a seam for
which no open standard exists, so the project must define the interface, the
binding and the conformance suite itself.

Telemetry is the exception. OpenTelemetry (OTel) is a vendor-neutral CNCF
specification that already defines all three: an API and SDK for producing
signals, the OTLP wire protocol for carrying them, and an environment-variable
configuration contract for binding a process to a sink. Open source and
commercial backends alike accept OTLP.

Official OpenTelemetry libraries exist for both runtimes this project uses:
`opentelemetry-api`, `opentelemetry-sdk` and the contrib instrumentations for
Python, and `@opentelemetry/api`, `@opentelemetry/sdk-node` and the
instrumentation packages for Node. They are maintained by the OpenTelemetry
project itself, released under Apache-2.0, and already provide the separation
an SPI is meant to create: application code targets the API, the SDK is the
in-process implementation, and the exporter is the swappable edge. The
switching cost ADR-0003 exists to eliminate is already zero at this seam.

The requirement group is ASR02-OBS. Two constraints from the invariants bear
on the decision: no question content may appear in logs, traces, metrics or
error strings (DAT-03, SEC), and nothing on a validation path may be
probabilistic or external (QST03-VAL-03).

## Decision

The project adopts OpenTelemetry as the telemetry SPI. No Python `Protocol`
is defined in `mulyankan-spi` for it, and no `platform.yaml` binding exists.
The parts of an SPI map as follows.

| ADR-0003 element | Telemetry |
|---|---|
| Interface | The OpenTelemetry API, and OTLP on the wire |
| Provider | An OpenTelemetry Collector, and whatever it exports to |
| Binding | The OpenTelemetry SDK environment variables (`OTEL_EXPORTER_OTLP_ENDPOINT` and the rest) |
| Conformance | Compliance with the OpenTelemetry specification, plus the project's content-free sentinel test |
| Descriptor | Resource attributes (`service.name`, `service.version`, `deployment.environment.name`) |

Rules that follow:

1. Application code depends on the OpenTelemetry API and SDK only. It never
   names or imports a backend; the only endpoint it knows is a Collector.
2. Attribute and metric names follow the OpenTelemetry semantic conventions;
   project instruments are namespaced `mulyankan.*`. Context propagation is
   W3C Trace Context; baggage propagation is disabled.
3. The content-free rule is enforced in-process by an attribute allowlist
   applied before export, and proven by a build-failing test that plants a
   sentinel in every input and asserts it reaches no exporter. Collector-side
   redaction is a second layer behind that guard.
4. Telemetry never blocks or fails the core. Export is asynchronous; the
   application starts and serves with no Collector reachable and with
   `OTEL_SDK_DISABLED=true`. This is the one seam where ADR-0003's "no binding
   is refused at call time" rule does not apply: an unconfigured sink drops
   signals and the request still serves.
5. Sampling is an observability decision and never touches a validation
   outcome, so QST03-VAL-03 is unaffected.
6. The official OTel libraries are the base layer. Project layers go on top
   of them as they are needed: the content-free guard in rule 3 is the first,
   and a domain metrics facade or a setup entry point for worker processes
   would follow the same pattern. Such layers depend on the OTel API and SDK
   only, never on a backend, so the seam can evolve without this decision
   changing. Each is recorded in `docs/observability.md`; it needs its own
   ADR only if it changes what an operator must configure.

The working contract, decisions table, component design and local stack are
in `docs/observability.md`.

## Rationale

- An SPI exists to make switching a configuration change. OTel already makes
  the backend a Collector configuration change, and the Collector a one-line
  environment change. A project `Protocol` could only forward to the OTel SDK
  and would add a layer with no decision in it.
- The conformance suite pattern (ADR-0003 rule 4) is meant to let third
  parties certify against the seam. Third parties certify against OTel
  already; the project's only additional requirement is content-freedom,
  which is a property of the *emitting* code, so it belongs in the core's
  test suite rather than in a provider suite.
- The descriptor pattern (name, version, data handling) is served by OTel
  resource attributes, which every backend indexes.
- Building on the official libraries keeps the project's own code to the
  layers that carry a project decision. Generic parts are upstream's to
  maintain; parts specific to this system sit on top and can be replaced
  independently.

## Alternatives considered

- **A Python `Protocol` in `mulyankan-spi` wrapping the OTel SDK.** Keeps the
  ADR-0003 table uniform. Lost because every implementation would be the
  same forwarding shim, `mulyankan-spi` has zero runtime dependencies and
  could not even name the OTel types, and providers of it would have nothing
  to conform to beyond "calls the SDK".
- **A thin `Protocol` describing only the sink** (endpoint, TLS material,
  resource attributes) with the SDK wired in the core. Honest and small, and
  the better of the two `Protocol` options. Lost because it re-specifies the
  OTel environment variables in Python with no gain, and adds a second,
  project-specific way to configure the same thing.
- **Per-signal tooling without OTel**: Prometheus exposition for metrics, a
  vendor logging agent for logs, no tracing. Fewer dependencies today. Lost
  because it hard-codes a pull model and per-signal formats into the core,
  gives no trace correlation across `apps/web` and `platform/core`, and is
  exactly the vendor coupling ADR-0003 forbids.
- **A vendor OTel distribution** (for example `@vercel/otel` or a backend
  vendor's Python distro). Less setup code. Lost because distributions carry
  vendor defaults and exporters; the plain SDK with standard environment
  variables is the stack-neutral choice, and the setup code saved is a few
  dozen lines.

## Consequences

- `platform/core` gains the OpenTelemetry API, SDK, OTLP HTTP exporter and
  the instrumentations for its frameworks as mandatory dependencies, all
  Apache-2.0 and pinned. The content-free guard is a security control, so it
  cannot be an optional extra.
- `apps/web` gains the OpenTelemetry Node SDK, registered through the
  Next.js instrumentation hook, and the OpenTelemetry web SDK in the
  browser for tracing and real-user monitoring (page loads, interactions,
  web vitals, errors). Framework spans and `traceparent` on outgoing `fetch`
  come with them, so a trace starts in the browser and ends in a provider
  call. Session replay is excluded: it would record question content.
- The Collector configuration becomes a versioned artefact in this
  repository. Backends are chosen per environment by editing its exporters.
  For local development the backend is Grafana's all-in-one image, run as a
  separate unmodified AGPL service per ADR-0002 and never a dependency of
  the system.
- ADR-0003's `telemetry` row is amended to point here, and
  `docs/provider-contracts.md` drops `mulyankan_spi.telemetry` from the
  catalogue. If a sink ever appears that cannot be reached over OTLP, this
  decision is revisited rather than worked around. Adding a layer on top of
  the libraries stays within this decision. Replacing the libraries would
  revise it.
- The naming collision with ADR-0008, which uses "telemetry" for the client's
  behavioural stream, is resolved in prose and code as **observability**
  (this ADR) versus **integrity telemetry** (ADR-0008). The two never share a
  pipeline or a store.
- Cost: the core carries a runtime dependency on a large, fast-moving SDK
  whose logs module still makes no compatibility promise, so versions are
  pinned and upgrades are deliberate. Cost: the content-free property of log
  *messages* cannot be enforced by the allowlist and stays a review rule
  backed by the sentinel test.
