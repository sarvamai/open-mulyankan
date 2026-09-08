# ADR-0003: Platform and provider architecture — deterministic core, pluggable edges

- Status: Accepted
- Date: 2026-09-07

## Context

The product direction requires a platform design in which many solutions can
plug in. The v4 specification simultaneously demands that the workflow core be
deterministic, auditable, and free of AI (ARC-12 as amended), that validation,
review, accessibility, sealing and readiness never call a model, and that
switching any environmental component — identity, storage, keys, models — must
not change Layer 1 code (architecture note: "Switching costs nothing in the
core").

## Decision

Every component belongs to exactly one of two classes.

### The core (non-pluggable, in `platform/`)

The lifecycle state machine and its guards; the authorization engine
(permission matrix, capability registry, separation of duties); the
hash-chained audit store and verifier; the transactional outbox; the sealing
orchestrator; the readiness calculator; expected-evidence assertions; the API
surface and event schemas. These embody the invariants the authority must own.
They are versioned, never swapped at runtime, and no provider can alter their
decisions.

### Providers (pluggable, in `providers/`)

Implementations of versioned service-provider interfaces (SPIs) defined in
`mulyankan-spi`:

| SPI | Purpose | Consumer | Deterministic |
|---|---|---|---|
| identity | OIDC sign-in, MFA, device posture, zone claims | sign-in, every request | n/a (human) |
| storage | object store for assets and sealed artefacts | assets, sealing | yes |
| kms | encrypt/decrypt/sign under managed keys | sealing, export | yes |
| sanitize | quarantine, malware scan, re-encode, strip metadata | asset upload | yes |
| similarity | deterministic duplicate detection | validation (QST03-VAL-06) | yes |
| render | reference rendering contract | preview, review, accessibility | yes |
| gateway | model proposals with provenance (Layer 2) | authoring resources only | no (proposals only) |
| notify | signed outbound notifications to downstream | lifecycle events | yes |
| telemetry | OTLP sink for metrics, traces, logs | observability | n/a |
| export | portable export profile (QTI 3.0 candidate) | readiness handoff | yes |

### Rules that make pluggability safe

1. The platform never imports a provider directly. Bindings live in
   per-environment configuration (`platform.yaml`) and are resolved by the
   provider registry at startup. A capability with no binding is refused at
   call time — the same rule as a model removed from the approved list.
2. Providers cannot mutate workflow state, write audit events, or bypass
   validation. They receive inputs and return outputs; the platform records
   each interaction as a content-free audit event.
3. SPIs on the validation/sealing path (sanitize, similarity, kms, storage,
   export) must be deterministic; the bound provider's name and version are
   recorded in manifests and the audit chain.
4. Every SPI ships a conformance suite in `mulyankan-spi`. A provider is
   certifiable only when its suite passes in CI; results are publishable —
   the Layer 2 conformance-harness pattern applied to every seam.
5. The `gateway` SPI may only return proposals carrying the provenance
   envelope (model id, version, adapter version, material hash,
   prompt-template hash, timestamp). Proposals never reach review without a
   human submission, and nothing in validation, review, accessibility,
   sealing, or readiness may call it.

## Rationale

This applies the architecture note's Layer 2 pattern — published interface,
adapter kit, conformance harness — to every seam of Layer 1, while keeping the
lock-in-prone part (the rules, the records, the seal, the export) inside the
core the authority owns.

## Consequences

- Third parties integrate by implementing an SPI package and passing its
  conformance suite; they never fork the core.
- The reference provider in this repository (`providers/kms-local/`)
  demonstrates the full path: SPI implementation, conformance test,
  configuration binding.
- Provider distributions depend only on `mulyankan-spi`, never on the platform
  core, keeping the dependency arrow pointing outward.
- SPIs are added in the milestone that first consumes them, so interfaces are
  designed against real callers rather than speculation.
