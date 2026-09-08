# ADR-0008: Zero Trust separation — thin task client and authoritative server

- Status: Accepted
- Date: 2026-09-07

## Context

The deployment model is distributed: one authoritative server (on LAN or
hosted) and many client installations on studio workstations. The team adopts
a Zero Trust posture — the client is an untrusted surface; the server is the
only authority. The v4 specification already requires server-side
authorization on every request (ARC-01), no local storage of artefacts
(QST03-ATH-10), and managed-workstation sign-in (FND04-CAP-11). The product
direction sharpens these into an architectural boundary.

## Decision

Two applications, one repository, separated by a versioned contract. Neither
side imports the other's code; they meet only at `contracts/`.

### Server (authoritative)

Used by oversight roles — coordinator/administrator, integrity operator,
auditor — through its web UI. Holds the question bank, generation, task
assignment, validation, similarity, sealing, readiness, telemetry ingest, and
the replay store. No other component holds state.

### Client (thin task surface)

A signed per-OS application for content roles — author, reviewer,
accessibility specialist, translator. It can do exactly four things:

1. **Authenticate** — author MFA plus machine attestation; the session binds
   (user × machine) and both pseudonymous identifiers are logged (DAT-02).
2. **Receive** — fetch exactly one assigned task: the question as structured
   data plus the operations the server permits for it.
3. **Act** — render the task and capture the user's response
   (approve / modify / suggest / return, per role).
4. **Report** — return the response and stream telemetry (mouse, keyboard
   timing, camera per cycle policy).

Everything else is denied: no question-bank browsing, no assignment
management, no arbitrary server API, no local storage, no offline mode. On
crash or refresh the client re-fetches task state — the server is the only
source of truth. "No ability to interact with the server" is read as: no
interaction beyond this narrow protocol.

### The contract

The client↔server protocol is a small, versioned, machine-readable surface —
authenticate, fetch task, submit response, telemetry stream, heartbeat —
defined under `contracts/` with conformance tests both sides must pass in CI.
The server supports N and N−1 client versions.

### The client renders; it never executes server UI

The client ships its own signed renderer (the shared render-contract package,
bundled at client build time). The server sends structured task data — never
HTML or JavaScript for the client to execute. A compromised server must not
gain code execution on studio machines.

### Role split follows separation of duties

Content roles work only in the client; oversight roles — who cannot view
artefact content per the v4 role table — work only in the server web UI.
Content never flows to oversight surfaces.

## Consequences

- **Machine identity becomes a first-class principal.** Device credentials
  are provisioned per studio workstation through an enrollment flow; sessions
  and audit events carry pseudonymous machine and user identifiers.
- The client enforces its own egress allowlist — the server endpoint only —
  complementing ARC-07's default-deny posture.
- The demo/eval edition (one machine running both) remains a packaging option
  without blurring the boundary.
- Candidate exam delivery remains out of scope (v4 §14.2): the client is the
  authoring workstation, not an exam-hall terminal.
- The build track gains a device-enrollment item ahead of client packaging.
