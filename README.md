<p align="center">
  <img src="docs/assets/open-mulyankan-logo.png" alt="open-mulyankan logo" width="180">
</p>

<h1 align="center">open-mulyankan</h1>

<p align="center">
  An open-source <strong>question paper authoring system</strong> built for
  <strong>confidentiality</strong> and <strong>control</strong>.
</p>

<p align="center">
  <a href="https://github.com/sarvamai/open-mulyankan/actions/workflows/ci.yml"><img src="https://github.com/sarvamai/open-mulyankan/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache-2.0"></a>
  <img src="https://img.shields.io/badge/Python-3.12%2B-3776AB?logo=python&logoColor=white" alt="Python 3.12+">
  <img src="https://img.shields.io/badge/Node-20-339933?logo=nodedotjs&logoColor=white" alt="Node 20">
  <img src="https://img.shields.io/badge/core-deterministic%20%C2%B7%20AI%20free-2EA44F" alt="Deterministic, AI-free core">
</p>

---

**Open Mulyankan** turns a blank page into a sealed, exam-ready question — through four
human jobs, under rules the examining authority owns.

Subject experts author. Independent reviewers check. Accessibility specialists verify that
every candidate can read and answer the question. Translators produce language variants
that are exactly as hard as the original. When every job is done, **the system seals the
question into an encrypted repository that no human — not even an administrator — can
reopen**, and reports it ready for paper assembly.

## Why it is different

- **Confidentiality by construction.** Sealed questions are unreadable to any human role.
  The audit trail is append-only and hash-chained — tampering is detectable — and carries
  no question content. Logs, traces, and error messages never see plaintext.
- **Humans decide; rules verify.** Every judgement is made by a qualified person or a
  published, deterministic rule. The core contains **no AI**: models may only *propose*
  through a gateway, and a human must adopt every proposal before it becomes a draft.
- **The authority owns the core.** The rules, the records, the seal, and the export are
  open source under Apache-2.0 — no enterprise edition, no private fork.
- **No lock-in.** Identity, storage, keys, and models plug in behind versioned,
  conformance-tested provider interfaces. Switching any of them is a configuration
  change, not a rewrite.

## How it works

```
Author → Review → Accessibility check → Translation (per language) → Seal → Ready
```

Each job is performed by a different person, and none can be skipped. A return never
edits the returned version — it creates a new linked draft, and the original stays as
immutable evidence. The server-side state machine is authoritative; clients are never
trusted.

## Status

M0 — foundation. The milestone ladder tracks the MVP specification's week-by-week plan;
closure is evidence, not demonstration.

| Milestone | Scope |
|---|---|
| M0 | Repository foundation, design record, provider interfaces |
| M1 | Identity, cycle & taxonomy, audit chain, walking skeleton |
| M2 | Authoring workspace: editor, validation, similarity check, submission |
| M3 | Review + accessibility gates, operator surface |
| M4 | Translation, sealing, readiness, downstream handoff |
| M5 | Hardening: production install, penetration test, WCAG audit |
| M6 | Production acceptance and handover pack |

## Documentation

| Document | Purpose |
|---|---|
| [`docs/architecture.md`](docs/architecture.md) | Layers, state machine, invariants, trust boundaries |
| [`docs/adr/`](docs/adr/) | Architecture decision records |
| [`docs/provider-contracts.md`](docs/provider-contracts.md) | How providers plug in and certify |
| [`docs/traceability.md`](docs/traceability.md) | Requirement → component → test index |
| [`docs/as-built.md`](docs/as-built.md) | What exists today: as-is vs target, the gap, limitations |
| [`docs/code-practices.md`](docs/code-practices.md) | How code is written here: structure, patterns, comments |
| [`apps/web/README.md`](apps/web/README.md) | Web app: running it, and the vendored design system |

## Contributing

Small, meaningful PRs; tests green before review; design decisions recorded as ADRs.
See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security

Confidentiality is this system's reason to exist. If you find a way to read sealed
content, bypass separation of duties, or tamper with the audit chain, please report it
privately — see [SECURITY.md](SECURITY.md).

## Licence

Apache-2.0 — see [LICENSE](LICENSE) and [NOTICE](NOTICE). One vendored build
artefact, the `@sarvam/tatva` design system under `design-system/tatva/`, is
proprietary and sits outside that licence; `NOTICE` records the exception.
