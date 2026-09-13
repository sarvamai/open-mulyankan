# `docs/` — the design record

This directory is the reason the project can claim the authority owns its
rules. Treat it as a record, not as notes: it is written to be read by a
reviewer, an auditor, and an implementer years from now.

Read the root `AGENTS.md` first.

## What each file is for

| File | Contract |
|---|---|
| `architecture.md` | Layers, the state machine, the ten numbered invariants, trust boundaries, non-functional targets. The invariants are the normative part. |
| `adr/NNNN-<slug>.md` | One accepted decision each, numbered sequentially. |
| `provider-contracts.md` | The working contract for provider authors: lifecycle, rules, SPI catalogue. |
| `traceability.md` | Requirement ID → component → milestone, plus the standing definition-of-done checks. |
| `code-practices.md` | The house style: folder rules, the five patterns, comment discipline, AGENTS.md practice. |

These documents describe the system through M6 and are written in the present
tense, so they name paths that do not exist yet (`providers/`, `db/`,
`contracts/`, `tests/conformance/`, `platform.yaml`). That is deliberate.
When you change code, do not "fix" a doc into describing only what exists
today — but do not code to the doc either. The root `AGENTS.md` lists the gap.

## Writing an ADR

Copy the shape of an existing one; do not invent a new template. The sections
are `Status` / `Deciders` / `Date`, then `## Context`, `## Decision`,
`## Rationale`, `## Alternatives considered`, `## Consequences`.

- **Alternatives considered is not a formality.** Every existing ADR names the
  real competing options and why each lost — including options that were
  better on some axis. An ADR with a straw-man alternative is worse than none.
- **Consequences includes the costs**, not just the benefits. ADR-0001 records
  that two runtimes now exist in CI; ADR-0003 records what pluggability costs.
- **Amend, never silently contradict.** When a decision changes, amend the ADR
  in place with a dated note in `Status` and a subsection explaining the
  change and its consequences — ADR-0001's Next.js amendment is the worked
  example. Supersede with a new ADR only when the whole decision is replaced.
- Requirement IDs (QST/ARC/SEC/DAT/INT/FND/ASR/RES) are cited inline where
  they apply. Don't invent an ID; if you need one that isn't in
  `traceability.md`, say so.

## Discipline that is easy to break

- **Never put question content, real candidate data, or anything Restricted in
  an example.** Examples use placeholders and opaque references — the same rule
  the audit chain enforces in code.
- Keep `traceability.md` honest: a row's `Closed in` milestone is a claim about
  evidence, not intent. Requirement-facing tests carry their requirement ID in
  the test name, and that name is the link between this file and the code.
- British spelling, as used throughout (`licence`, `artefact`, `behaviour`).
- Tables and prose over diagrams; there are no image assets except the logo in
  `assets/`.

## Keeping this file true

Update it when you add a document here, change the ADR template, or create a
planned file the root `AGENTS.md` still lists as absent.
