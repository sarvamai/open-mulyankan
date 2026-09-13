# `apps/client` — the content client (Tauri 2)

Vite + React 19 + TypeScript + `@sarvam/tatva` (vendored `file:` tarball) ·
Tauri 2 Rust shell · pnpm 10 (pinned in `package.json` `packageManager`) ·
Node >= 20.9 · Rust toolchain for the shell.

```bash
pnpm install
pnpm dev          # webview only, in a browser tab — fast UI iteration
pnpm tauri dev    # the real desktop app (needs cargo; starts vite on :1420)
pnpm build        # tsc && vite build — the type check lives here
pnpm tauri build  # per-OS bundle (unsigned until the packaging phase)
```

## What this app is

**The content client** — author, reviewer, accessibility specialist,
translator (ADR-0012 settled the mapping; `apps/web` is the oversight
client — never build a content-role surface there). ADR-0008 limits it to
exactly four operations: **authenticate, receive one assigned task, act,
report**. Everything else is denied by design: no question-bank browsing,
no arbitrary server API, no local storage, no offline mode. On crash or
refresh the client re-fetches task state — the server is the only source
of truth.

## What exists (honest inventory)

- `src/App.tsx` — the sign-in screen, ported from mulyankan-frontend's
  login surface. **Every control is a placeholder**: submitting shows
  "Authentication arrives with the contracts slice" — nothing is wired to
  any server. The OIDC flow runs through the identity SPI (ADR-0004) when
  that slice lands.
- `src/auth/` — the sign-in layout components (`AuthShellSplit`,
  `AuthHeader`, `SocialButtons`, …). Presentation only.
- `src/stitch/` — the interactive tatva "stitch cloth" demo ported during
  the scaffold (ADR-0010's build step 2). **Demo asset, not product** —
  the first real surface replaces it.
- `src-tauri/src/lib.rs` — a stock `Builder::default()`. **No Tauri
  commands are registered**, no device credential, no egress allowlist
  yet. ADR-0010 assigns all of that to the Rust shell; treat the webview
  as an untrusted surface.
- No tests, no CI job (the repo's `build-and-test` is still a placeholder
  and no workflow builds this app), no state management, no router.

## Load-bearing wires

Break one and it looks like a component bug, not a config error:

| File | Why |
|---|---|
| `src-tauri/tauri.conf.json` `security.csp` | `connect-src` is `'self' ipc: http://ipc.localhost` — **no http(s) origin**. Server calls must go through Tauri IPC (Rust), never `fetch` from the webview. Adding an http origin to this CSP is a security decision, not a fix — it is how ADR-0008's egress allowlist gets bypassed |
| `src-tauri/tauri.conf.json` `build` | `beforeDevCommand: pnpm dev`, `devUrl :1420`, `frontendDist: ../dist` — vite and the shell are coupled through these three values |
| `vite.config.ts` | port **1420 `strictPort: true`** (tauri expects it fixed) and `watch` ignores `src-tauri/**` — remove that and Rust rebuilds loop the dev server |
| `pnpm-workspace.yaml` | pnpm 11 reads settings from here, not `package.json`. The `packages: [.]` entry works around pnpm/pnpm#9361 (settings-only file breaks every `pnpm run`); `overrides` pin patched `jsondiffpatch`/`linkify-it` arriving via tatva (same posture as apps/web); `blockExoticSubdeps` / `minimumReleaseAge` / `trustPolicy` are the supply-chain gate the SAST job requires — do not relax them to make an install succeed |
| `package.json` | `@sarvam/tatva` resolves from the vendored tarball `design-system/tatva/sarvam-tatva-0.0.34.tgz` — no registry auth, credential-free is the point |

## Constraints that cause type errors or silent breakage

- Compose tatva components; don't hand-roll what it covers. Verify props
  against the **installed** tarball, not memory or the design-system rules
  (written for a later release):
  `grep -n "interface ButtonProps" -A 30 node_modules/@sarvam/tatva/dist/index.d.ts`
- Only `tatva-*` tokens, never raw Tailwind utilities; spacing is the
  parent's `gap` (2px base), never a child's margin.
- `Button` takes `isLoading`, not `loading`; `Text` uses `variant`+`tone`.
- The webview is the OS one (WKWebView / WebView2 / WebKitGTK), not a
  pinned Chromium — rendering varies per OS by construction (ADR-0010's
  accepted cost). Don't rely on engine-specific CSS.
- **No local persistence.** No localStorage/IndexedDB for task data —
  ADR-0008 forbids it; state lives on the server.

## Keeping this file true

Update it when you add a real surface or dependency, register a Tauri
command, touch the CSP or the egress allowlist, or change the build
coupling. The "what exists" list is the map an agent trusts — a stale
entry there is worse than none.
