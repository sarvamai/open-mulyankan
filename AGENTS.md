# Working in this repository

Layer 1 workflow core of a national exam content-authoring engine:
author → review → accessibility → translate → system seal → ready.
Python/FastAPI in `platform/`, Next.js in `apps/web`, a Tauri thin
client in `apps/client/`.

## The docs plan M6; the tree is at M0

`docs/` is written in the present tense about locations later milestones will
create. **The tree is the fact; the doc is the intent.** Before importing a
path you read in a doc, check it exists:

```bash
ls providers db contracts tests/conformance platform.yaml docs/canonicalization.md 2>&1
```

`providers/` now exists — one package, `extraction-pymupdf`, with its own
`AGENTS.md`. So does `platform.yaml.example`; `platform.yaml` itself is
gitignored, and `core_api` starts with zero bindings when there is none.
`db/`, `contracts/`, `tests/conformance/` and `docs/canonicalization.md` are
still absent. If a task needs one, create it explicitly and say so — don't
code as if it were already there.
`docs/provider-contracts.md` claims M0 ships a `kms` reference provider; only
the interface and conformance suite exist. The one reference provider that
does exist implements `extraction`, an SPI that post-dates that document and
ADR-0003's table — see ADR-0009.

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
uv pip install -e platform/spi -e "platform/core[dev]" \
               -e "providers/extraction-pymupdf[dev]"
python -m pytest platform providers -q
python -m ruff check platform providers

# core-api — the web app expects it on :8000
cp platform.yaml.example platform.yaml
python -m uvicorn mulyankan_platform.core_api.main:app --port 8000

# Web
cd apps/web && pnpm install && pnpm dev
```

The knowledge base's text books read `/sources` from core-api; with it down,
that tab reports so and the other tabs carry on with their mock rows. Set
`NEXT_PUBLIC_MULYANKAN_API` to point the client elsewhere.

`core_api` reads bindings from `platform.yaml` (`$MULYANKAN_PLATFORM_CONFIG`).
No such file is committed; with none, the app starts with zero bindings.

**CI's gate is the aggregate `ci` job** over `semgrep`, `gitleaks`, `trivy`,
`web` and `build-and-test`. The org-wide `shift-left-security` call is not
used here: this repository is public and `sarvamai/security-redirect` is
private, and GitHub does not let a public repository call a reusable workflow
that lives in a private one. `ci.yml` carries the call, commented out, and
says what restoring it needs. `build-and-test` runs the real Python gate:
ruff over `platform` and `providers`, then `pytest platform providers`.
`Dockerfile` is still a placeholder. `ruff` is pinned (`>=0.16,<0.17`) and
configured by the root `pyproject.toml` — which is a lint config only, not
a package; it carries no `[project]` table.

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

- Code, comment, and test practices live in
  [`docs/code-practices.md`](docs/code-practices.md) — read it before your
  first PR; it is the house style.
- Decisions become ADRs in `docs/adr/`. Amend in place with a dated note; see
  ADR-0001. Never leave a decision only in a PR description.
- Requirement-facing tests carry the requirement ID:
  `test_asrevd02_chain_verifies_after_appends`. IDs live in
  `docs/traceability.md`.
- `git commit -s` (DCO). One concern per PR.
- British spelling in prose (`licence`, `artefact`).

## Open questions — ask, don't pick

- **Which app serves which role — SETTLED (ADR-0011).** `apps/web` is the
  oversight client (coordinator, administrator, integrity operator, auditor);
  `apps/client` (Tauri) is the content client (author, reviewer,
  accessibility specialist, translator). The client still serves no role
  until its real surfaces replace the mock ones; deployment topology and the
  Postgres datastore are recorded in ADR-0011.
- Pilot languages are deliberately unnamed (ADR-0006) — still pending for the
  platform. `apps/web` now carries a working list for its question language
  field (`apps/web/src/components/question-bank/languages.ts`: the Eighth
  Schedule's twenty-two plus English, at the repo owner's direction). It is one
  array in the client, standing in for `cycle.required_languages` until there
  is an API to read; the ADR's own status is unchanged, and nothing in
  `platform/` names a language.
- Canonicalization is `draft-v0.1`; `docs/canonicalization.md` is unwritten.
  Changing the byte format changes every audit hash.
- **How source material is classified.** `/sources` treats extracted text as
  Restricted (DAT-01) — out of logs, exception strings and list responses,
  reachable only through `GET /sources/{id}/pages/{page}` — but the spec does
  not classify source material, only artefacts. ADR-0009 records the reading
  taken.
- **Ingestion is not audited yet, deliberately.** A state change and its audit
  event must commit in one transaction (invariant 2), and `sources` has no
  transaction because it has no database. Writing to the chain from it would
  produce a chain that cannot be trusted. This is owed with `db/`, not
  forgotten — see `mulyankan_platform.sources.store` and ADR-0009.

## Keeping this file true

Update it in the same PR when you: create one of the absent paths above, add a
CI job, change a documented command, add or move a nested `AGENTS.md`, or
settle an open question. Nested `AGENTS.md` files own their own trees
(`platform/` and its packages, `apps/web/`, `apps/client/`,
`design-system/`, `docs/`) — put tree-specific rules in the deepest one
that fits, not here. A stale line is worse than no line: it is read as
fact.
