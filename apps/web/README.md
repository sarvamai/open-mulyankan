# `apps/web` — Experience layer

Next.js 16 (App Router), React 19, TypeScript, Tailwind 3, and the
`@sarvam/tatva` design system. Per ADR-0001 this app is an untrusted client of
`platform/core`: it renders surfaces and calls the API, and it never reads the
database or makes a trust decision, server components included.

## Getting started

```bash
cd apps/web
pnpm install     # no registry credential needed — see below
pnpm dev         # http://localhost:3000
```

Other scripts: `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm check-types`.

Requires Node >= 20.9 and pnpm 9.

## The design system is vendored, not installed from a registry

`@sarvam/tatva` is proprietary and lives in a private Google Artifact Registry.
This repository is public and deliberately holds no registry secret, so the
package is committed as a static tarball and resolved locally:

```json
"@sarvam/tatva": "file:../../design-system/tatva/sarvam-tatva-0.0.34.tgz"
```

`pnpm install` therefore works for anyone who clones the repo, with no
`.npmrc` auth and no Hugeicons Pro token — tatva uses only the public
`@hugeicons/core-free-icons`. See [`design-system/tatva/README.md`](../../design-system/tatva/README.md)
for provenance, the SHA-256, and how to move to a newer version.

Four pieces of wiring make it work; changing any one of them breaks styling in
a way that is easy to misread as a component bug:

| File | What and why |
|---|---|
| `tailwind.config.ts` | `presets: [tatvaPreset]` supplies the `tatva-*` tokens, and `content` scans `node_modules/@sarvam/tatva/dist/**` so the utilities tatva's own compiled components reference actually get generated |
| `src/app/layout.tsx` | `import '@sarvam/tatva/styles.css'` **before** `./globals.css` — tokens and the bundled Matter/Season faces first, app utilities second so they can override |
| `next.config.ts` | `transpilePackages: ['@sarvam/tatva']` — the package ships untranspiled ESM |
| `.npmrc` | `strict-peer-dependencies=false` — tatva declares `sonner@^1.4` as a peer while this app tracks 2.x |

Tailwind stays on **v3**: tatva ships a v3 CommonJS preset, so `create-next-app`'s
Tailwind v4 option is not compatible with it.

## Writing UI

Tatva ships its own agent rules at
`node_modules/@sarvam/tatva/.agent/rules/tatva-frontend.mdc`. The essentials:

- Compose tatva components; don't hand-roll UI the design system already covers.
- Use `tatva-*` tokens only — no raw Tailwind values (`p-4`, `text-gray-500`).
- Spacing is the parent's `gap`, never a margin on the child. Three tiers:
  `gap={2}` (parts of one thing), `gap={10}` (sibling fields), `gap={12}` (regions).
- `Box` accepts no `className` — layout goes through its props (`p`, `gap`, `bg`,
  `rounded`, `shadow`, `w`, `h`, `overflow`).

Two things in those rules do not apply to the vendored 0.0.34: `AppShell` and
`AnimationProvider` do not exist in this version (they are from a later
release), and there is no MCP server wired up here.

`src/app/page.tsx` is a smoke page that exercises the wiring — tokens, fonts,
icons, client state, and a toast. Replace it with real surfaces.
