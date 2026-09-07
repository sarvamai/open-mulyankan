# ADR-0005: Baseline — greenfield in this repository

- Status: Accepted
- Date: 2026-09-07

## Context

The architecture concept note's window table says "v0.5 audited and refactored
against v4 Weeks 1–4", implying a prior codebase exists somewhere. The
`sarvamai/open-mulyankan` repository contained only the org CI template; no
v0.5 code has been supplied to this team.

## Decision

Build greenfield in this repository. If a prior v0.5 codebase surfaces, the
Week 1 audit treats it as a reference, not as imported code: components may be
ported only through the platform/provider structure, with their history,
tests, and provenance re-established here.

## Consequences

- The M1 walking skeleton is written fresh against the v4 requirements.
- No inherited licence or provenance risk from unaudited code.
- The "audit of v0.5" becomes an audit of this repository's first release
  candidate instead.
