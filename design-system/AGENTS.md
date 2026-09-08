# `design-system/` — vendored design system

Holds `tatva/`: the published `@sarvam/tatva` tarball, committed as a static
build artefact. How to *use* its components is in `apps/web/AGENTS.md`.

## The tarball is read-only

- **Only the Sarvam team replaces the tarball.** Never unpack, patch,
  re-pack, or hand-edit the `.tgz`, and never commit an extracted `dist/`.
  A tatva change happens in the tatva repository and arrives here as a new
  published version — it is never produced from inside this repository.
- A new version is one coordinated change: the `.tgz`, `SHA256SUMS`,
  `README.md` provenance, and the `file:` specifier in
  `apps/web/package.json` all move together.
- CI runs `shasum -a 256 -c SHA256SUMS` on every push and PR, so a stale or
  mismatched hash fails the build rather than passing quietly.

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

The artefact is **proprietary and not Apache-2.0** — the single documented
exception to this repository's dependency licence policy, recorded in `NOTICE`
and ADR-0001. Don't relicense it, and don't add a second vendored proprietary
dependency without an ADR.

## Keeping this file true

Update it when the vendoring approach or its rationale changes.
