# Automated code review

Comment `/review` on a pull request; `.github/workflows/pr-review.yml` runs the
`sarvam-code` CLI over the PR diff and posts a summary review plus an
`Automated Code Review` commit status.

It is a **reviewer, not a gate.** Branch protection requires only the `ci`
context from `ci.yml`. The status here goes red on a critical finding to make
one visible — it is deliberately not a required check, because a model must not
be able to block a merge on its own.

Contributor-facing notes (who can trigger it, what it looks for, the ledger)
are in `CONTRIBUTING.md`. This file is for changing it.

## What it is told

`prompt.md` is the whole instruction. It leads with this repo's architectural
invariants — content leaks, a trusted client, a state change split from its
audit event, a seal path, AI or non-determinism on a core path — and then the
ordinary review.

The invariants are not restated here. `scripts/lib/cheat-sheet.js` lifts them
out of the real `AGENTS.md` files by **heading text**, so there is one copy and
updating `AGENTS.md` updates the reviewer. That match is the fragile part:
rename a heading and the slice returns nothing, the prompt quietly falls back
to a shorter summary, and the review gets thinner with nothing to show it.
`scripts/check-cheat-sheet.js` (a pre-commit hook) fails on exactly that, and
`build-review-prompt.js` emits a `::warning::` if it happens in CI anyway.

`prompt.md` also carries the two false-positive traps in this tree: `docs/`
describes M6 paths that do not exist yet, and `build-and-test`, `Dockerfile`
and `ruff` are known placeholders. Without those the reviewer reports the
repo's roadmap as bugs in every PR.

## Pipeline

Steps hand off through `/tmp`, not stdout, so any one can be re-run alone
after a failed job.

| Script | Reads | Writes |
|---|---|---|
| `prepare-diff.js` | `origin/$BASE_REF...HEAD` | `/tmp/filtered-diff.patch`, `/tmp/diff/*.patch`, `/tmp/diff-manifest.json`, `/tmp/full-file-list.json`, `/tmp/changed-lines.json`; `tier` + `skip` step outputs |
| `build-review-prompt.js` | `prompt.md`, the `/tmp` diff files, `AGENTS.md` | `/tmp/review-prompt.txt` |
| `run-native-review.sh` | `/tmp/review-prompt.txt` | `/tmp/native-review.txt`, `.log`, `/tmp/review-metrics.json` |
| `parse-native-review.js` | the review output and logs | `/tmp/review-parsed.json`; `has_critical` + `decision` step outputs |
| `post-review.js` | `/tmp/review-parsed.json` | the PR review, via `github-script` |

`lib/ledger.js` keeps a hidden ledger comment of findings a human resolved or
replied to, so a re-review does not raise them again. `lib/json-utils.js` and
`recover-native-output.js` exist because a timed-out run leaves truncated JSON
that is still worth salvaging — findings recovered that way are labelled as
such in the posted summary.

`prepare-diff.js` drops lockfiles, generated files and the vendored tatva
tarball, then sizes the PR into a tier. `trivial`/`lite` inline the diff and
the changed files into the prompt and use a 10-minute timeout; larger tiers let
the agent read the tree itself and get 30 minutes.

## Changing it

- **The rules the reviewer applies** → the relevant `AGENTS.md`, not `prompt.md`.
- **What counts as critical, or a new false-positive trap** → `prompt.md`.
- **Which `AGENTS.md` sections are inlined, and when** → `SECTIONS` in
  `scripts/lib/cheat-sheet.js`; each entry has a `when` predicate over the
  changed-file list so UI rules only ship on UI PRs.
- **Model or effort** → repository variables `REVIEW_MODEL`,
  `REVIEW_REASONING_EFFORT`, `REVIEW_TIMEOUT_SEC`. No commit needed.
- **The output schema** → `prompt.md` *and* the validator in
  `parse-native-review.js`, including `TEMPLATE_PLACEHOLDERS`, which drops the
  finding a model produces when it copies the schema instead of filling it in.

Test the pipeline without a PR — everything up to the CLI call runs locally:

```bash
GITHUB_OUTPUT=/tmp/gho.txt BASE_REF=main node .github/review/scripts/prepare-diff.js
TIER=$(grep '^tier=' /tmp/gho.txt | cut -d= -f2) PR_TITLE=test PR_NUMBER=0 \
  node .github/review/scripts/build-review-prompt.js
less /tmp/review-prompt.txt
```

Then, to check parsing and rendering, write a findings JSON to
`/tmp/native-review.txt` and run `parse-native-review.js` over it.

## Do not add a build step

On a fork PR the checked-out head tree is untrusted, and `issue_comment` runs
with a write-scoped token and the API key in scope. What keeps that safe is
that the tree is only ever *read*: the scripts are re-fetched from the base
repo at the workflow commit, the agent runs `sandbox_mode=read-only`, and
nothing installs, builds or tests. Adding any of those executes fork code next
to the key.
