# ADR-0010: The thin client is a Tauri application

- Status: Accepted
- Deciders: Product owner
- Date: 2026-09-10

ADR-0009 (the `extraction` SPI) is in flight on a parallel branch; this
record takes 0010 so numbering stays stable when both land.

## Context

ADR-0008 decides a signed per-OS thin client for content roles but names no
stack, and ADR-0001's frontend decision covers only the server's web UI
(`apps/web`). The client is a different animal: a local application with no
server to render it, forbidden from executing server-served UI, required to
enforce its own egress allowlist and to hold a device credential. Its
binding constraints are ADR-0008's four operations, no local storage,
WCAG 2.1 AA (UI-13), and identical rendering across preview, review and
accessibility (QST03-ATH-07).

## Decision

The client is a Tauri 2 application living in `apps/client/`, beside
`apps/web`.

- **Frontend (`src/`):** Vite + React 19 + TypeScript + `@sarvam/tatva`,
  vendored through the same `file:` tarball specifier `apps/web` uses. No
  Next.js and no SSR — the client is bundled locally and ships its own
  renderer, as ADR-0008 requires.
- **Shell (`src-tauri/`):** Rust owns everything security-critical — the
  egress allowlist (the server origin and nothing else), the device keypair
  and certificate, and later the signed update channel. The webview is
  treated as an untrusted surface, like every other client in this system.
- **Contract-first:** the client speaks to `platform/core` only through the
  versioned protocol that will live in `contracts/`; its TypeScript client
  is generated from that artifact, never hand-written against the server.
  Neither side imports the other's code (ADR-0008).

The build order, each step leaving the app runnable: scaffold → strip the
demo and wire tatva → egress allowlist → `contracts/` and the five
operations → device enrollment and telemetry.

## Alternatives considered

- **Electron** — one pinned Chromium on every OS, so rendering is identical
  everywhere by construction, and per-OS signing is well-trodden. It
  remains the stronger choice if render identity ever becomes the binding
  constraint. It lost here on install size and memory footprint: the owner
  preferred a ~10 MB artifact over a ~100 MB one on studio workstations.
- **A locally served web harness** — fastest to start, but it cannot enforce
  an egress allowlist or hold a device certificate, and a server-served UI
  violates ADR-0008's compromised-server rule outright.

## Consequences

- **Rendering is engine-dependent per OS.** Tauri uses the platform webview
  — WKWebView on macOS, WebView2 on Windows, WebKitGTK on Linux — so
  QST03-ATH-07's identical-rendering bar is no longer free, as it would be
  under Electron's single Chromium. The render package carries per-OS
  screenshot fixtures in CI; if the variance ever bites hard, this
  decision is revisited with that evidence.
- **Rust enters the toolchain.** CI gains a third runtime (Python, Node,
  Rust) and `cargo` becomes a developer prerequisite for running and
  building the app; the scaffold itself needs no Rust.
- **Signing is deferred.** Per-OS signing and notarisation (Authenticode,
  macOS notarisation) arrive as a later phase; development builds are
  unsigned until then, and the signed-app guarantee of ADR-0008 is not yet
  met.
- The client adds a second frontend package with its own lockfile, matching
  the per-app pattern `apps/web` already follows.

## Not decided here

- The shape of `contracts/` — the five operations, versioning, and the
  N/N−1 rule get their own record when authored.
- Telemetry transport and camera policy (ADR-0008 defers camera to cycle
  policy).
- The device-attestation mechanism behind enrollment; a client-certificate
  stand-in is the first rung.
