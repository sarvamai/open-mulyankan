# Vendored `@sarvam/tatva`

`sarvam-tatva-0.0.34.tgz` is the Sarvam design system, committed to this
repository as a static build artefact.

## Why a tarball and not a registry dependency

Tatva is published to a private Google Artifact Registry
(`asia-south1-npm.pkg.dev/saas-prod-457804/design-system`). Depending on it by
version would require an Artifact Registry credential in every clone and in CI.
This repository is public and deliberately carries no registry secret, so the
package is vendored instead: `apps/web` resolves it through a `file:` specifier
and `pnpm install` works offline, with no `.npmrc` auth, for anyone who clones
the repo.

No Hugeicons Pro token is needed either. Tatva's `dist` references only the
public `@hugeicons/core-free-icons` and `@hugeicons/react`; nothing in this
repository depends on `@hugeicons-pro/*`.

## How `apps/web` consumes it

`apps/web/package.json`:

```json
"@sarvam/tatva": "file:../../design-system/tatva/sarvam-tatva-0.0.34.tgz"
```

Three pieces of wiring are required and already in place:

| Where | What |
|---|---|
| `apps/web/tailwind.config.ts` | `presets: [tatvaPreset]` and `content` scanning the installed `@sarvam/tatva/dist/**/*.mjs`, so tatva's own utility classes are generated |
| `apps/web/src/app/layout.tsx` | `import '@sarvam/tatva/styles.css'` (tokens, base styles, and the bundled Matter/Season font faces) before `./globals.css` |
| `apps/web/next.config.ts` | `transpilePackages: ['@sarvam/tatva']` |

## Provenance

- Version: `0.0.34`
- Source: `https://asia-south1-npm.pkg.dev/saas-prod-457804/design-system/@sarvam/tatva/-/tatva-0.0.34.tgz`
- SHA-256: see `SHA256SUMS` (`shasum -a 256 -c SHA256SUMS` to verify)
- Contents: 55 files — identical to the published tarball's file list

## Refreshing to a new version

The tarball has to be produced on a machine that has Artifact Registry access.

```bash
# On a machine authenticated to the private registry:
npx google-artifactregistry-auth
npm pack @sarvam/tatva@<version>          # → sarvam-tatva-<version>.tgz

# Then, in this repository:
git rm design-system/tatva/sarvam-tatva-<old>.tgz
cp /path/to/sarvam-tatva-<version>.tgz design-system/tatva/
cd design-system/tatva && shasum -a 256 sarvam-tatva-<version>.tgz > SHA256SUMS

# Point apps/web at the new file and re-resolve the lockfile:
#   apps/web/package.json → "file:../../design-system/tatva/sarvam-tatva-<version>.tgz"
cd apps/web && pnpm install
```

Update the version, URL, and hash in the Provenance section above in the same
commit.

## Licence

Tatva is `UNLICENSED` and proprietary to Sarvam AI. It is redistributed here for
use by this project only; see `NOTICE` at the repository root.
