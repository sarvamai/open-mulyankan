# ADR-0007: Gateway slice in the MVP — proposals only, thin

- Status: Accepted
- Date: 2026-09-07

## Context

The architecture concept note amends v4 with: a Proposal entity carrying
provenance (model id, version, adapter version, material hash,
prompt-template hash, timestamp), a content-free gateway audit event enforced
by a build-failing test, and the rule that a model removed from the approved
list is refused on the next call. Layer 2 models themselves are out of scope
for Layer 1.

## Decision

Build the thin slice in M4:

- the `gateway` SPI with the provenance envelope schema in `mulyankan-spi`;
- the content-free gateway audit event, enforced by a build-failing test
  (the OBS-17 pattern);
- one reference adapter, `providers/gateway-openai-compat/` (any
  OpenAI-compatible endpoint), used for the demonstration.

Proposals are stored Restricted (DAT-01), never exported, and become drafts
only through explicit human adoption (QST03-ATH-13 extended). No validation,
review, accessibility, sealing, or readiness code path may call the gateway —
enforced by an architecture test that fails the build.

## Consequences

- The demonstration can show the full arc: model proposes → human checks →
  sealed → ready.
- Removing a model from the approved list is a configuration change; the next
  call is refused by the registry rule in ADR-0003.
- Vendors integrate by implementing the gateway SPI and passing its
  conformance suite, never by forking the core.
