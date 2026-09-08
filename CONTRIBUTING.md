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

## Licence

By contributing, you agree that your contributions are licensed under Apache-2.0.
