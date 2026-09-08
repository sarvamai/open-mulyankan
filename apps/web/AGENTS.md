<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# `apps/web` — experience layer

Next.js 16 App Router · React 19 · Tailwind **3** · pnpm 9 · Node >= 20.9.
`pnpm dev | build | start | lint | check-types`. Root `AGENTS.md` has the
invariants; `design-system/AGENTS.md` covers the vendored tarball.

## What exists

`src/app/{layout,page,globals.css}`. `page.tsx` is a design-system smoke page.
No API client, auth, routing structure, store, tests, or Storybook yet — check
before importing, and don't copy structure from the sibling
`mulyankan-frontend` repo on the assumption it is here.

## This app is an untrusted client

The server state machine is authoritative (ADR-0001 amended, ADR-0008). A
React **server** component here is still a client of `platform/core`: no
database reads, no privileged credentials, no authorization decisions. A
client-side check is a courtesy; the server must refuse independently. No
question content in `console.log`, error messages, URLs, or telemetry.

Which roles this app serves is unsettled — see the root file's open questions.
Ask before building structure that assumes one reading.

## Four load-bearing wires

Break one and it looks like a component bug, not a config error:

| File | Why |
|---|---|
| `tailwind.config.ts` | `presets: [tatvaPreset]` gives the `tatva-*` tokens; the `content` glob over `node_modules/@sarvam/tatva/dist/**` is what generates tatva's own classes |
| `src/app/layout.tsx` | `@sarvam/tatva/styles.css` imported **before** `./globals.css` — tokens and fonts first, app utilities second |
| `next.config.ts` | `transpilePackages: ['@sarvam/tatva']` — the package ships untranspiled ESM |
| `.npmrc` | `strict-peer-dependencies=false` — tatva declares `sonner@^1.4`, this app tracks 2.x |

**No Tailwind 4** (tatva ships a v3 CommonJS preset). **No registry auth, no
`@hugeicons-pro`** — credential-free is the point.

## Writing UI

Compose tatva components; don't hand-roll what it covers. Its own rules are at
`node_modules/@sarvam/tatva/.agent/rules/tatva-frontend.mdc` — written for a
later release, so **verify every component and prop against the installed
version** rather than trusting those rules or your memory:

```bash
node -e "import('@sarvam/tatva').then(m=>console.log('AppShell' in m))"   # exports
grep -n "interface ButtonProps" -A 30 node_modules/@sarvam/tatva/dist/index.d.ts
```

Runtime beats types here: some components are re-exported from subpath modules
and never appear in `dist/index.d.ts`'s export list. `AppShell` is one thing
those rules recommend that this version does not have.

Constraints that cause type errors or silent breakage:

- **`Box` takes no `className`** — use its props (`p`, `gap`, `bg`, `rounded`,
  `shadow`, `w`, `h`, `display`, `direction`, `align`, `justify`, `overflow`).
- **Only `tatva-*` tokens**, never raw Tailwind (`p-4`, `text-gray-500`).
  Spacing is a 2px base (`p={8}` = 16px); three tiers only — `gap={2}` within
  one thing, `gap={10}` between fields, `gap={12}` between regions. Spacing is
  the parent's `gap`, never a child's margin.
- **Icon names are a closed set.** Never guess; read `iconNames`.
- `Text` uses `variant` + `tone`, not `size`/`color`.

`pnpm check-types && pnpm lint && pnpm build` — all three run in CI's `web`
job. The build is the real check: a wrong `content` glob or CSS order compiles
fine and renders unstyled.

## Keeping this file true

Update it when you add a real surface or dependency (the "what exists" list),
change any of the four wires, or bump the tatva version — component and prop
claims are version-specific, so re-verify them with the commands above.
