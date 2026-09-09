# Contributing

Thanks for helping build Open Mulyankan. A few rules keep the project trustworthy.

Start with [AGENTS.md](AGENTS.md) — it records what actually exists in the tree
today, the invariants a change must not break, and how to run each stack. The
nested `AGENTS.md` files (`platform/`, `apps/web/`, `design-system/`, `docs/`)
carry the rules specific to those trees. It is written for coding agents and is
just as useful to a new human contributor.

## Ground rules

- **Small, meaningful PRs.** One concern per PR; the diff should be reviewable in one
  sitting.
- **Tests green before review.** Every behaviour change ships with tests, and
  requirement-facing tests carry the requirement ID in their name (see
  `docs/traceability.md`).
- **Design decisions as ADRs.** If a change settles a design question, add or amend an
  ADR under `docs/adr/` instead of burying the decision in a PR description.
- **Keep the agent context true.** If a change makes an `AGENTS.md` statement wrong —
  a path that now exists, a command that changed, a constraint that lifted — update it
  in the same PR. A stale one is worse than none: it is read as fact.
- **Confidentiality invariants are non-negotiable.** No question content in logs, audit
  events, or error messages; no human path to sealed plaintext; no AI in the core
  (ADR-0003).

## Process

1. Open an issue, or pick one.
2. Branch from `main` (or the relevant stacked branch) with a `pr<N>-<topic>` name.
3. Keep commits focused; the PR description states what changed and why.
4. Sign off your commits (`git commit -s`) — the Developer Certificate of Origin applies.

## Automated code review

Comment `/review` on a pull request and a reviewer runs the PR diff against this
repo's architectural invariants, then posts a summary review. It is **not** a gate:
it sets an `Automated Code Review` commit status that goes red on a critical
finding, but branch protection requires only `ci`. A model does not block a merge.

- What it is told to look for: `.github/review/prompt.md` — content leaks into
  logs, audit events or URLs; a trusted client; a state change split from its
  audit event; a seal path; AI or non-determinism on a core path.
- The invariants themselves are lifted straight out of the `AGENTS.md` files, so
  updating one there updates the reviewer.
- Findings you resolve, or reply to, are recorded in a hidden ledger comment and
  are not raised again on a re-review.
- Re-run it any time; each run covers the whole diff and supersedes the last.

Only owners, organisation members and collaborators can trigger it — on a public
repo an open trigger would let a passer-by spend the API key. It reads
`SARVAM_API_KEY` from a **repository** secret, so rotation is done here rather
than org-wide, and a leak costs this repo's key only. A fork PR is reviewed too, but
its tree is only ever read: the review scripts are re-fetched from the base repo
and no install, build or test step runs, so fork code never executes next to the
key. Draft PRs are skipped.

If findings look truncated, the run timed out — comment `/review` again.

## Security checks

Every PR is gated on the `ci` context, which aggregates:

- **`shift-left-security`** — the org-wide stage (`sarvamai/security-redirect`).
- **`semgrep`** — SAST over the committed source: OWASP Top Ten plus the Python and
  JS/TS/React rulepacks.
- **`gitleaks`** — secret detection across the whole git history.
- **`trivy`** — dependency CVEs, secrets and misconfiguration.
- **`web`** / **`build-and-test`** — lint, types, build.

None of these needs a credential. The one job that does is the `/review` reviewer
above, which reads the repository secret `SARVAM_API_KEY`. It is not part of `ci`, so
the gate itself stays credential-free and a fork PR's own workflow run never has a
secret in scope.

Draft PRs skip these jobs; marking a PR ready for review triggers them. Run all three
scans locally before pushing:

```
uvx semgrep scan --config p/owasp-top-ten --config p/python \
  --config p/javascript --config p/typescript --config p/react --error
gitleaks git --redact --config .gitleaks.toml .
trivy fs --severity HIGH,CRITICAL --ignore-unfixed --scanners vuln,secret,misconfig \
  --skip-dirs '**/node_modules' --exit-code 1 .
```

Semgrep on a PR fails only on findings the PR introduces; on `main` it scans the whole
tree, so `main` always has a clean full scan behind it. Gitleaks always scans every
commit — a credential committed months ago is still live.

Fix findings rather than silencing them. When a finding really is wrong, suppress it at
the narrowest scope, with a comment saying why, so the exception shows up in review:
`# nosemgrep: <rule-id>` or `# gitleaks:allow` on the line; then `.semgrepignore` /
`.gitleaksignore` / `.trivyignore` for anything broader. Trivy already ignores CVEs with
no released fix, so a `.trivyignore` entry means a fix exists and is being deferred —
say why, and say what would remove the entry.

`.pre-commit-config.yaml` runs Gitleaks, Trilochana, Trivy and Ruff before each commit;
install it with `./scripts/install-hooks.sh`. The hooks are a convenience, not the gate —
CI re-runs what matters, because hooks can be skipped with `--no-verify` and never run on
a fork's PR. (Trilochana is hook-only: it ships as source, so there is no cheap way to
run it in CI yet.)

### Supply-chain rules

- **Pin every GitHub Action to a full commit SHA**, version in a trailing comment. A
  mutable tag can be repointed by its owner — this is how the `trivy-action` and
  `kics-github-action` compromises spread — and Semgrep fails the build on one. Container
  images are pinned by digest for the same reason.
- **Dependency versions come from the committed lockfile**; CI installs with
  `--frozen-lockfile`. `apps/web/.npmrc` also sets `minimum-release-age`, so a version
  published in the last 7 days is not resolved at all and a compromised release has to
  survive a week of public scrutiny first.
- **Dependency build scripts stay blocked.** pnpm 10 does not run them unless a package
  is listed in `pnpm.onlyBuiltDependencies`. Add a package there only if the build
  genuinely fails without it; if it is blocked and everything still works, record that in
  `pnpm.ignoredBuiltDependencies` instead.

## Licence

By contributing, you agree that your contributions are licensed under Apache-2.0.
