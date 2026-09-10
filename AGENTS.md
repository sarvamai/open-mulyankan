# Working in this repository

Layer 1 workflow core of a national exam content-authoring engine:
author → review → accessibility → translate → system seal → ready.
Python/FastAPI in `platform/`, Next.js in `apps/web`.

## The docs plan M6; the tree is at M0

`docs/` is written in the present tense about locations later milestones will
create. **The tree is the fact; the doc is the intent.** Before importing a
path you read in a doc, check it exists:

```bash
ls providers db contracts tests/conformance platform.yaml docs/canonicalization.md 2>&1
```

Every one of those is absent today. If a task needs one, create it explicitly
and say so — don't code as if it were already there.
`docs/provider-contracts.md` claims M0 ships a `kms` reference provider; only
the interface and conformance suite exist.

## Invariants (`docs/architecture.md` has all ten)

1. The server state machine is authoritative — never trust a client claim,
   including this repo's own React server components.
2. A state change and its audit event commit in one transaction.
3. Audit events are append-only, hash-chained, **content-free** — opaque refs
   and a payload hash, never plaintext.
4. No human seal control exists. Never add a path that seals, unseals, or
   reads sealed plaintext, for any role, administrators included.
5. No AI in the core. Models only *propose* via the `gateway` SPI; a human
   adopts before it becomes a draft.
6. Validation is deterministic — nothing probabilistic or external on a
   validation path.

Daily consequence: **no question content in logs, audit events, exception
strings, or URLs.**

## Commands

```bash
# Python (3.12+)
uv pip install -e platform/spi -e "platform/core[dev]"
python -m pytest platform/spi platform/core -q
python -m ruff check platform

# Web
cd apps/web && pnpm install && pnpm dev
```

`core_api` reads bindings from `platform.yaml` (`$MULYANKAN_PLATFORM_CONFIG`).
No such file is committed; with none, the app starts with zero bindings.

**CI's gate is the aggregate `ci` job** over `semgrep`, `gitleaks`, `trivy`,
`web` and `build-and-test`. The org-wide `shift-left-security` call is not
used here: this repository is public and `sarvamai/security-redirect` is
private, and GitHub does not let a public repository call a reusable workflow
that lives in a private one. `ci.yml` carries the call, commented out, and
says what restoring it needs. `build-and-test` is
still the template's `echo` placeholder, so the Python tests are local-only —
a green PR proves nothing about them. `Dockerfile` is likewise a placeholder.
`ruff` is unconfigured and unpinned (`>=0.6`); it reports findings in
pre-existing `platform/` code, so check `git stash`-clean output before
blaming your change.

Separately, commenting `/review` on a PR runs the `sarvam-code` reviewer
(`.github/workflows/pr-review.yml`, prompt and plumbing in `.github/review/`).
It is a reviewer, not a gate — its `Automated Code Review` status is not
required. Its prompt inlines the invariants above by lifting the
`## Invariants` section from this file and two sections from
`apps/web/AGENTS.md`, matched by heading text in
`.github/review/scripts/lib/cheat-sheet.js`: if you rename one of those
headings, update that file in the same PR or the reviewer silently falls back
to a shorter summary.

## Conventions

- Decisions become ADRs in `docs/adr/`. Amend in place with a dated note; see
  ADR-0001. Never leave a decision only in a PR description.
- Requirement-facing tests carry the requirement ID:
  `test_asrevd02_chain_verifies_after_appends`. IDs live in
  `docs/traceability.md`.
- `git commit -s` (DCO). One concern per PR.
- British spelling in prose (`licence`, `artefact`).

## Open questions — ask, don't pick

- **Which app serves which role.** `docs/architecture.md` maps all role
  surfaces to `apps/web`; ADR-0008 gives content roles a separate signed thin
  client meeting the server at `contracts/`. Neither exists.
- Pilot languages are deliberately unnamed (ADR-0006) — still pending for the
  platform. `apps/web` now carries a working list for its question language
  field (`apps/web/src/components/question-bank/languages.ts`: the Eighth
  Schedule's twenty-two plus English, at the repo owner's direction). It is one
  array in the client, standing in for `cycle.required_languages` until there
  is an API to read; the ADR's own status is unchanged, and nothing in
  `platform/` names a language.
- Canonicalization is `draft-v0.1`; `docs/canonicalization.md` is unwritten.
  Changing the byte format changes every audit hash.

## Keeping this file true

Update it in the same PR when you: create one of the absent paths above, add a
CI job, change a documented command, add or move a nested `AGENTS.md`, or
settle an open question. Nested `AGENTS.md` files own their own trees
(`platform/` and its packages, `apps/web/`, `design-system/`, `docs/`) — put
tree-specific rules in the deepest one that fits, not here. A stale line is
worse than no line: it is read as fact.
