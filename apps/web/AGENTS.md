<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# `apps/web` — Open Mulyankan experience layer

Read the root `AGENTS.md` first (invariants, M0 reality) and
`design-system/AGENTS.md` before writing UI.

Next.js 16 App Router · React 19 · TypeScript · Tailwind **3** · pnpm 9 ·
Node >= 20.9. Scripts: `pnpm dev`, `build`, `start`, `lint`, `check-types`.

## What is actually here

`src/app/{layout,page,globals.css}` and nothing else. `page.tsx` is a smoke
page that exercises the design-system wiring — tokens, fonts, icons, client
state, a toast. There is **no** API client, auth, routing structure, state
management, test setup, or Storybook in this app yet. Don't import from paths
that would imply otherwise, and don't copy structure from the sibling
`mulyankan-frontend` repo on the assumption it exists here.

## This app is an untrusted client

ADR-0001 (as amended) and ADR-0008: the server-side state machine is
authoritative. A React **server** component here is still a client of
`platform/core` — it may not read a database, hold a privileged credential, or
make an authorization decision. Render surfaces, call the API, show what the
server says. Never re-implement a workflow guard in the browser and treat it
as enforcement; a client-side check is a courtesy, and the server must refuse
independently.

Also inherited from the root invariants: no question content in
`console.log`, in an error boundary's message, in a URL, or in telemetry.

Which roles this app serves is genuinely unsettled — `docs/architecture.md`
maps all role surfaces here, ADR-0008 gives content roles a separate signed
thin client and leaves oversight roles to this web UI. Ask before building
structure that assumes one reading.

## The design system is vendored — four load-bearing wires

`@sarvam/tatva` is proprietary, resolved from a committed tarball via
`file:../../design-system/tatva/sarvam-tatva-0.0.34.tgz`. Break any of these
four and the failure looks like a broken component rather than a config error:

| File | Why it matters |
|---|---|
| `tailwind.config.ts` | `presets: [tatvaPreset]` supplies the `tatva-*` tokens; the `content` glob over `node_modules/@sarvam/tatva/dist/**` is what makes tatva's own utility classes get generated |
| `src/app/layout.tsx` | `import '@sarvam/tatva/styles.css'` **before** `./globals.css` — tokens and font faces first, app utilities second so they can override |
| `next.config.ts` | `transpilePackages: ['@sarvam/tatva']` — the package ships untranspiled ESM |
| `.npmrc` | `strict-peer-dependencies=false` — tatva declares `sonner@^1.4` while this app tracks 2.x |

**Do not migrate to Tailwind 4.** Tatva ships a v3 CommonJS preset. Do not add
a private registry, an `.npmrc` auth token, or a Hugeicons Pro dependency:
staying credential-free is the reason the tarball is vendored (ADR-0001,
`design-system/tatva/README.md`).

## Writing UI

Compose tatva components; don't hand-roll what the design system covers. The
package's own rules are at
`node_modules/@sarvam/tatva/.agent/rules/tatva-frontend.mdc` — read them, with
two corrections for the **0.0.34** that is vendored here:

- `AppShell` **does not exist** in this version, though those rules call it the
  preferred shell — it is from a later release. `AnimationProvider`,
  `SidebarProvider` and `Sidebar` do exist and are already or should be used.
  Verify before using: `node -e "import('@sarvam/tatva').then(m => console.log('X' in m))"`
  is authoritative, because a few components are re-exported from subpath
  modules and so do not appear in `dist/index.d.ts`'s final export list.
- There is no tatva MCP server wired up in this repo, so `list_components` /
  `get_component_docs` are unavailable. `dist/index.d.ts` is the source of
  truth for props; read it instead of guessing.

Hard constraints that produce type errors or silent visual breakage:

- **`Box` accepts no `className`.** Layout goes through its props: `p`, `px`,
  `gap`, `bg`, `rounded`, `shadow`, `w`, `h`, `display`, `direction`, `align`,
  `justify`, `overflow`. Same for other tatva components — prefer props, and
  put spacing on the parent's `gap`, never a margin on the child.
- **Only `tatva-*` utility tokens**, never raw Tailwind values (`p-4`,
  `text-gray-500`, `rounded-lg`). Spacing is a 2px base: `p={8}` is 16px.
  Three tiers only — `gap={2}` (parts of one thing), `gap={10}` (sibling
  fields), `gap={12}` (regions).
- **Icon names are a closed set** in this version (~88 built-ins). Never guess
  one; list them from `dist/index.mjs` (`iconComponents`) or use `iconNames`.
- `Text` uses `variant` (`heading-lg`, `body-sm`, `label-md`, …) and `tone`,
  not `size`/`color`.

Verify with `pnpm check-types && pnpm lint && pnpm build` — all three are in
CI's `web` job. The build is the real check: a missing `content` glob or a
wrong CSS import order compiles fine and renders unstyled.
