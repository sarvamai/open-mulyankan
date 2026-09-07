# ADR-0001: Languages and frameworks — FastAPI backend, Node/React frontend

- Status: Accepted (team direction ratified 2026-09-07; the v4 spec leaves the
  language decision to the Week 1 audit — this ADR is that ratification)
- Deciders: Product owner, technical lead
- Date: 2026-09-07

## Context

The v4 specification (§12, Week 1) requires the language and framework
decision to be closed before build work, and the architecture concept note
lists tool choices as proposals. Constraints from the spec: machine-readable
interface definitions (INT-01), a transactional outbox (ARC-03), workers under
their own workload identity (ARC-05), WCAG 2.1 AA surfaces (§9), and a
five-week window with no float.

## Decision

- **Backend:** Python 3.12, FastAPI, Pydantic v2, SQLAlchemy 2.0 + Alembic on
  PostgreSQL 16.
- **Frontend:** Node 20 LTS, TypeScript, React 18, Vite. No server-side
  rendering.
- **Contracts:** the FastAPI OpenAPI schema is the machine-readable interface
  definition (INT-01); the TypeScript API client is generated from it.

## Rationale

- FastAPI emits typed, validated request/response models and produces the
  versioned OpenAPI definition directly from code — INT-01 with no extra
  tooling.
- Pydantic models double as the canonical schemas for domain events and the
  gateway provenance envelope.
- Async-first fits the outbox relay, sealing worker, and readiness calculator
  as separate worker processes sharing the same domain packages.
- React has the strongest accessibility tooling (React Aria, axe) for the
  WCAG 2.1 AA bar that applies to every surface (UI-13).

## Alternatives considered

- **Java/Spring Boot** — strongest fit for enterprise estates and long-term
  institutional maintenance, but slower to build inside the five-week window
  and not the ratified team direction.
- **Node end-to-end (NestJS)** — one language across the stack, but the team
  ratified FastAPI for the backend.
- **Django** — batteries included, but its ORM coupling makes the
  transactional outbox and hash-chained audit patterns harder to keep
  explicit and testable.

## Consequences

- Two runtimes in CI and in the operator's install story.
- The shared render contract (QST03-ATH-07 — preview, review, and
  accessibility must render identically) lives in the frontend as a Node
  package; the backend stores canonical content and never renders it.
- Python providers and the platform share the `mulyankan-spi` distribution so
  third parties can implement SPIs without importing the core.
