# Working in this repository

Open Mulyankan is the **Layer 1 workflow core** of a national examination
content-authoring engine: authoring → review → accessibility check →
translation → system seal → ready. Two stacks in one repo — a Python/FastAPI
platform under `platform/`, and a Next.js web app under `apps/web`.

Read this file before writing code. It exists because the design record in
`docs/` describes the *whole* system while the tree currently holds only a
small part of it, and the gap is the single easiest thing to get wrong here.

## Milestone reality: M0

The repo is at **M0 — foundation**. What actually exists:

| Path | State |
|---|---|
| `platform/spi/` | `mulyankan-spi`: `ProviderDescriptor`, the `kms` Protocol, and the `kms` conformance suite. Zero runtime dependencies, by design. |
| `platform/core/` | `mulyankan-platform`: provider registry, in-memory hash-chained audit log + verifier, and a FastAPI app exposing **only** `GET /healthz`. |
| `apps/web/` | Next.js 16 App Router app with the `@sarvam/tatva` design system wired up and one smoke page. No real surfaces, no API client. |
| `design-system/tatva/` | The vendored tatva tarball. See `design-system/AGENTS.md`. |
| `docs/` | ADRs and the design record. Describes M0 through M6. |

### Paths the docs name that do NOT exist yet

Do not import from these, do not "restore" them, and do not assume a file is
missing from your context. As of this branch, none of them are in the tree:

`providers/` · `db/` · `contracts/` · `apps/web/packages/render` ·
`tests/conformance/` · `platform.yaml` · `docs/canonicalization.md`

`docs/architecture.md` and `docs/provider-contracts.md` are **plans**, written
in the present tense, mapping requirements onto locations that later
milestones will create. `docs/provider-contracts.md` even says M0 ships the
`kms` reference provider — it does not; only the interface and the conformance
suite are here. When a doc and the tree disagree, **the tree is the fact** and
the doc is the intent. Say so rather than coding to the doc.

If a task needs one of those paths, create it deliberately as part of the
task and say that you are creating it — don't pretend it was there.

## The invariants

`docs/architecture.md` lists ten numbered invariants; violating one is a
design bug, not a style preference. The ones most likely to be broken by a
plausible-looking change:

1. **The server-side state machine is authoritative.** Client claims are never
   trusted. This includes the web app's server components (ADR-0001 as
   amended, ADR-0008).
2. **A state change and its audit event commit in one transaction** (ARC-02).
3. **Audit events are append-only, hash-chained, and content-free** — opaque
   object references and a payload hash, never artefact plaintext.
4. **No human seal control exists.** The sealing worker is the only writer of
   sealed artefacts. Never add an endpoint, button, or admin path that seals,
   unseals, or reads sealed plaintext — for any role, administrators included.
5. **No AI in the core.** Models may only *propose* through the `gateway` SPI,
   and a human must adopt a proposal before it becomes a draft. Nothing in
   validation, review, accessibility, sealing, or readiness may call a model.
6. **Validation is deterministic** — no probabilistic or external services on
   any validation path.

Two consequences for everyday work: **never put question content in a log,
audit event, error message, exception string, or URL**, and never widen an
audit event to carry a payload instead of a payload hash.

## Running things

Python (requires 3.12+; the packages are `pip install -e`-able):

```bash
uv venv && source .venv/bin/activate     # or python3.12 -m venv .venv
uv pip install -e platform/spi -e "platform/core[dev]"
python -m pytest platform/spi platform/core -q   # 18 tests: 6 spi, 12 core
python -m ruff check platform
uvicorn mulyankan_platform.core_api.main:app --reload   # needs platform.yaml, see below
```

`platform/spi` must stay installable and testable on its own — provider
authors depend on it without the platform (ADR-0003).

The core-api reads provider bindings from `platform.yaml`, resolved from
`$MULYANKAN_PLATFORM_CONFIG` or the working directory. There is no such file
in the repo; with none present the app starts with zero bindings and says so
honestly. `docs/provider-contracts.md` shows the binding format.

Web app — see `apps/web/AGENTS.md`:

```bash
cd apps/web && pnpm install && pnpm dev
```

### What CI does and does not check

`.github/workflows/ci.yml` runs the org-wide security stage, a `web` job
(install → verify the tatva tarball's SHA-256 → lint → typecheck → build), and
a placeholder `build-and-test` job that only echoes. **The Python tests do not
run in CI yet.** Run them locally; don't infer from a green PR that they pass.

`ruff` has no configuration in either `pyproject.toml`, so it runs on
defaults, and the version floats (`ruff>=0.6`). Recent ruff reports 4 findings
in pre-existing `platform/` code (import sorting, `typing.Sequence`). They are
not yours — don't fold unrelated fixes into a feature change.

`Dockerfile` at the root is still the template placeholder (`FROM alpine`,
copies the README). It builds nothing real. It is kept because the security
stage scans it.

## Conventions that are actually enforced by review

- **Decisions become ADRs.** If your change settles a design question, add or
  amend an ADR in `docs/adr/` — never leave the decision only in a PR
  description or a commit message. Amend in place with a dated amendment note
  (see ADR-0001) rather than silently contradicting an accepted ADR.
- **Requirement-facing tests carry the requirement ID in the test name** —
  `test_asrevd02_chain_verifies_after_appends`. IDs come from
  `docs/traceability.md`, which is the requirement → component → test index
  and should be updated when a row's tests land.
- **Sign off commits** (`git commit -s`); the DCO applies. Branches are
  `pr<N>-<topic>` or `feat/<topic>`. One concern per PR.
- Prose in this repo — docs, ADRs, comments, commit messages — states what a
  thing is and why. Comments explain the reason a constraint exists, not what
  the line does. Match that register; don't add decorative comments.
- British spelling in prose (`licence`, `artefact`, `canonicalization` as
  written in existing docs). Code identifiers stay as they are.

## Where to look

| Question | File |
|---|---|
| Layers, state machine, invariants, trust boundaries | `docs/architecture.md` |
| Why a thing is the way it is | `docs/adr/` (0001 frameworks · 0002 licence · 0003 platform/provider · 0004 identity · 0005 greenfield · 0006 pilot languages · 0007 gateway slice · 0008 client/server) |
| How providers plug in and certify | `docs/provider-contracts.md` |
| Requirement → component → test | `docs/traceability.md` |
| Python packages | `platform/AGENTS.md` |
| Web app and the design system | `apps/web/AGENTS.md`, `design-system/AGENTS.md` |

## Ask, don't guess

Three questions are genuinely open in the design record. If a task depends on
one, ask instead of picking:

- **Which app is which.** `docs/architecture.md` maps all role surfaces to
  `apps/web`, while ADR-0008 splits content roles (author, reviewer,
  accessibility specialist, translator) into a separate signed per-OS thin
  client and leaves `apps/web` to oversight roles, the two meeting at a
  versioned `contracts/`. Neither the client nor `contracts/` exists. Don't
  resolve that split by inventing structure.
- **Pilot languages** are deliberately unnamed (ADR-0006).
- **Canonicalization** is `draft-v0.1` in code, and `docs/canonicalization.md`
  is referenced but unwritten. The canonical byte format is versioned; changing
  it changes every audit hash.
