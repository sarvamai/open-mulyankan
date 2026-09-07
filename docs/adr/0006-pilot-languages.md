# ADR-0006: Pilot languages — primary plus two variants, names pending

- Status: Accepted (structure) · Pending (language names)
- Date: 2026-09-07

## Context

v4 §11.2 and the Week 4 closure evidence require one primary plus two language
variants to reach readiness; the architecture note's window table mentions
"one pilot language" for the September demonstration. Unicode end-to-end is a
hard non-functional requirement (§9).

## Decision

The platform treats required languages as cycle configuration
(`cycle.required_languages`), never as code. The MVP target is primary + two
variants; the demonstration may run with fewer if the authority directs. The
specific pilot languages are the authority's decision and will be recorded
here when named.

## Consequences

- No language-specific logic anywhere in the core; every script flows through
  Unicode end-to-end tests.
- Translation, structural and equivalence checks, and variant sealing are
  language-agnostic by construction.
- Changing the pilot languages is a configuration change, not a release.
