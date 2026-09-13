# ADR-0012: Role-to-surface mapping and the on-prem deployment topology

- Status: Accepted
- Deciders: Product owner
- Date: 2026-09-11

## Context

`docs/architecture.md` mapped every role surface to `apps/web`, while
ADR-0008 gave content roles a signed thin client and ADR-0010 chose Tauri
for it. The root `AGENTS.md` carried the contradiction as an open question
("which app serves which role"). The product owner has now settled the
mapping, and with it the target deployment topology and the datastore.

## Decision

### Two clients, by role

- `apps/web` (Next.js) is the **oversight client** — coordinator,
  administrator, integrity operator, auditor. Browsers reach it over the
  admin network only.
- `apps/client` (Tauri 2) is the **content client** — author, reviewer,
  accessibility specialist, translator. It runs as a signed desktop app on
  studio laptops (ADR-0008, ADR-0010).

One role, one surface; no surface serves both. Content never flows to
oversight surfaces (ADR-0008).

### On-prem topology

One on-prem server runs Docker Compose behind a single TLS-terminating
proxy:

| Service | Built from | Serves |
|---|---|---|
| `proxy` | — | TLS; the only ingress; routes by network and host |
| `admin` | `apps/web` | the oversight web UI, admin network only |
| `backend` | `platform/core` | the API; the only service with database credentials and audit-chain access |
| `teacher-dist` | `apps/client` build | the signed installer and update channel for studio laptops — **not** a runtime UI |

PostgreSQL is the datastore. Studio laptops run the signed Tauri app on the
teacher LAN; it talks only to the backend through the proxy.

### Machine binding

Content-role sessions bind (user × machine) exactly as ADR-0008 requires:
a device credential per laptop, checked together with the user token.
Reaffirmed here as a deployment requirement, not a later option.

### API contract

Until ADR-0008's five-operation protocol is authored under `contracts/`,
the UIs consume the backend through typed clients generated from FastAPI's
OpenAPI document. `contracts/` remains the normative home when that
protocol lands.

## Rationale

- Separation of duties needs physically separate surfaces: an oversight
  account must not be one URL away from content.
- Distributing a signed package (never serving runtime UI to studio
  machines) keeps ADR-0008's compromised-server rule intact.
- One container per concern keeps the blast radius legible: only the
  backend can touch the chain, so a compromised UI container cannot forge
  evidence.

## Alternatives considered

- **One web app with role-based routes** — cheaper to run, but a routing
  bug or a shared bundle exposes one role's surface to the other, and it
  cannot host content roles at all without violating ADR-0008's
  server-serves-no-UI rule. Lost.
- **Browser as the content client** — no egress allowlist, no device
  credential, no signed renderer; contradicts ADR-0008 directly. Lost.
- **Single container for everything** — acceptable for the demo/eval
  edition, which ADR-0008 keeps as a packaging option; rejected for
  production because the public UI surface must not share a runtime with
  the chain writer. Lost for production.
- **SQLite** — no real server-side concurrency or replication; the audit
  chain's serialised-sequence guarantee needs a database that enforces it
  under concurrent writers. Lost.
- **MySQL or a proprietary RDBMS** — no advantage over PostgreSQL here, and
  a proprietary licence would sit badly beside the Apache-2.0 core. Lost.

## Consequences

- `apps/web` narrows to oversight surfaces. Its current mock pages
  (knowledge base, question bank, exam paper) depict content-role work and
  migrate to the Tauri client as real features replace them; at M0 they are
  mockups, so nothing moves yet.
- The root `AGENTS.md` open question closes; `docs/architecture.md`'s
  location table names both surfaces.
- `deploy/` gains the compose file and per-service Dockerfiles in the
  packaging phase; until then the root `Dockerfile` placeholder stays.
- PostgreSQL enters the dependency set with the database milestone. The
  in-memory stores remain the specification the database stores must match:
  byte-identical audit events, same session and source semantics.
- Two UI packages and a Rust toolchain are first-class, per ADR-0010.
