# ADR-0001: Languages and frameworks — FastAPI backend, Next.js frontend

- Status: Accepted (team direction ratified 2026-09-07; the v4 spec leaves the
  language decision to the Week 1 audit — this ADR is that ratification).
  Amended 2026-09-08: the frontend is Next.js on React 19, not Vite on React 18
  — see "Frontend framework (amended 2026-09-08)" below.
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
- **Frontend:** Node 20 LTS, TypeScript, React 19, Next.js (App Router) with
  the `@sarvam/tatva` design system. Server-side rendering is available but
  every Layer 1 surface is server-authoritative through the API, never through
  privileged server-side rendering (see Consequences).
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

### Frontend framework (amended 2026-09-08)

The original decision was Vite on React 18 with no SSR. It was amended to
Next.js on React 19 for one overriding reason: `@sarvam/tatva`, the design
system this project's surfaces are built from, targets React 18/19 and is
developed and consumed against Next.js. Building the same surfaces twice — once
here on a Vite shell, once in the Sarvam product frontends on Next.js — would
have meant maintaining two integrations of the same component library.

Consequences of the amendment:

- React 19, not 18. Next.js 16 requires it, and tatva supports `^18 || ^19`.
- `apps/web` is a Next.js App Router app. Routing, bundling and CSS pipeline
  come from Next; Tailwind stays at v3 because tatva ships a v3 preset.
- Tatva is proprietary and published to a private registry. This repository is
  public and carries no registry credential, so the package is vendored as a
  static tarball under `design-system/tatva/` and resolved through a `file:`
  specifier. See `design-system/tatva/README.md`.

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
- SSR is now technically available. It must not be used to make trust
  decisions: invariant 1 (the server-side state machine is authoritative) means
  a Next.js server component is still an untrusted client of `platform/core`,
  and may not read the database or hold privileged credentials.
- The frontend carries one vendored proprietary dependency, which is the single
  exception to the permissive-dependency allowlist recorded in `NOTICE`.
- The shared render contract (QST03-ATH-07 — preview, review, and
  accessibility must render identically) lives in the frontend as a Node
  package; the backend stores canonical content and never renders it.
- Python providers and the platform share the `mulyankan-spi` distribution so
  third parties can implement SPIs without importing the core.
