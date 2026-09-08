# `design-system/` — vendored design system

Holds `tatva/sarvam-tatva-0.0.34.tgz`: the published `@sarvam/tatva` tarball,
committed as a static build artefact, plus `SHA256SUMS` and a README covering
provenance and how to move to a newer version.

## Why it is a file and not a version

Tatva is proprietary and published to a private Google Artifact Registry.
Depending on it by version would require an Artifact Registry credential in
every clone and in CI. This repository is public and deliberately carries no
registry secret, so `apps/web` resolves the tarball through a `file:`
specifier and `pnpm install` works for anyone, offline, with no auth. No
Hugeicons Pro token either — tatva's `dist` uses only the public
`@hugeicons/core-free-icons`.

**Keeping this credential-free is the whole point.** Do not add an `.npmrc`
registry line, an auth token, a `google-artifactregistry-auth` step, or a
`@hugeicons-pro` dependency to make something easier. ADR-0001 records the
decision; `tatva/README.md` records the mechanics.

## Rules

- **The tarball is opaque.** Never unpack, patch, re-pack, or hand-edit it,
  and never commit an extracted `dist/`. If tatva needs a change, it is a
  change in the tatva repository followed by a new published version.
- **A new version is a deliberate three-part commit**: replace the `.tgz`,
  regenerate `SHA256SUMS` (`shasum -a 256 <file> > SHA256SUMS`), and update the
  `file:` specifier in `apps/web/package.json` plus the version and hash in
  `tatva/README.md`. Producing the tarball needs registry access —
  `npm pack @sarvam/tatva@<version>` on an authenticated machine. You cannot
  fetch it from here.
- CI verifies `shasum -a 256 -c SHA256SUMS` on every run, so a stale hash
  fails the build rather than passing quietly.
- The artefact is **proprietary and not Apache-2.0** — the single documented
  exception to this repository's dependency licence policy, recorded in
  `NOTICE` and ADR-0001. Don't relicense it, and don't add a second vendored
  proprietary dependency without an ADR.

For how to *use* tatva components (0.0.34 has no `AppShell` or
`AnimationProvider`, `Box` takes no `className`, icon names are a closed set),
see `apps/web/AGENTS.md`.
