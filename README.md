# shift-left-security-template

Base template for sarvamai repos with the org-wide **shift-left security** CI
wired in by default.

## Shift-left flow

```
<your repo> ──> sarvamai/security-redirect ──> sarvamai/security-workflows
   (CI)            (reusable @v2)                 (central security stage)
```

Your repo only maintains the thin trigger workflow in
`.github/workflows/ci.yml`. It calls the org's reusable `security-redirect`
workflow (pinned to `@v2`), which runs the centrally-maintained security
stage (Trivy image + filesystem scanning, SARIF upload to the Security tab,
PR findings as comments). Security logic is upgraded centrally — repos get it
for free by staying on the pinned version.

## What's included

| File | Purpose |
|------|---------|
| `.github/workflows/ci.yml` | Trigger-only CI: runs `shift-left-security`, then `build-and-test`. |
| `Dockerfile` | Placeholder image that the Trivy scan targets. Replace with your service's real image. |

## Using it

1. Create a new repo from this template (**Use this template**), or copy the
   two files above into an existing repo.
2. Point `dockerfile_path` in `ci.yml` at your Dockerfile if it isn't at the
   repo root (e.g. `tools/Dockerfile`).
3. Fill in the real `Build` / `Test` steps in the `build-and-test` job.

## Defaults & knobs

- `trivy_fs_enabled: true` — dependency/filesystem scanning is **on** by
  default. Flip to `false` only with a documented reason.
- Permissions follow least privilege: top-level is `contents: read`; the
  security job adds `security-events: write`, `actions: read`, and
  `pull-requests: write` (needed to post scan findings on PRs).
