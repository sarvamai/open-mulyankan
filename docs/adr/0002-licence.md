# ADR-0002: Licence — Apache-2.0

- Status: Accepted
- Date: 2026-09-07

## Context

The architecture concept note requires a permissive licence for all Layer 1
code (MIT or Apache-2.0), a licence scan that fails the pipeline on any
dependency outside the allowlist, and copyleft services used unmodified and
separately deployed. The steward model means unknown third parties —
operators, model vendors, state boards — will build on and deploy this code.

## Decision

**Apache-2.0** for all project code and interface definitions. A `NOTICE` file
carries attribution. Dependency allowlist: MIT, Apache-2.0, BSD, MPL-2.0, the
PostgreSQL licence, and equivalent permissive licences. Copyleft tools (ClamAV,
Grafana, Wazuh) run as separate, unmodified services — the core never links to
them.

## Rationale

The explicit patent grant matters for a national examination system in which
operators and vendors may litigate; MIT does not carry one. MeitY's 2015
Policy on Adoption of Open Source Software is satisfied either way, and the
architecture note's licensing map lists Apache-2.0 for interface definitions.

## Consequences

- CI runs a licence scan that fails the build on any dependency outside the
  allowlist.
- Contributions are accepted under the same licence (DCO sign-off); the
  steward holds trademark and contributor agreements outside this repository.
