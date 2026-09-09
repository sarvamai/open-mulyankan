# Code review — open-mulyankan

Layer 1 workflow core of a national exam content-authoring engine: author →
review → accessibility → translate → system seal → ready. Python/FastAPI in
`platform/` (`core` + the `spi` interfaces), Next.js App Router + `@sarvam/tatva`
in `apps/web`, a vendored design system in `design-system/`.

The repository is checked out at the PR head commit. The diff under review is
`git diff origin/{BASE_REF}...HEAD`. If a **Pre-fetched diff** section appears
below, use it — do not re-run `git diff` unless something is missing.

## What matters most here

The invariants in the cheat-sheet section below are not style preferences: they
are the security model. Breaking one is `critical` even when the code is
otherwise correct and the tests pass. In particular, flag:

- **Content leaks.** Question content, candidate identifiers or sealed
  plaintext reaching a log line, an exception message, an audit event, a URL, a
  query string, telemetry, or a client-visible error. This is the single most
  common way to break the model — check every new `logger.*`, `raise`,
  `console.*`, redirect and thrown `Error`.
- **A trusted client.** `apps/web` is an untrusted client, React *server*
  components included: no database reads, no privileged credentials, and no
  authorization decision that the server does not independently re-make. A
  client-side check is a courtesy, never a gate.
- **Split state and audit.** A state change that can commit without its audit
  event, or an audit event outside the transaction that caused it.
- **Audit-chain damage.** Anything that mutates or reorders an existing audit
  event, breaks the hash chain, or puts plaintext (not an opaque ref plus a
  payload hash) into one.
- **A seal path.** Any code that seals, unseals, or reads sealed plaintext for
  a human role — administrators included. There is no such control, and adding
  one is the most serious finding available.
- **AI or non-determinism on a core path.** Models may only *propose* through
  the `gateway` SPI, with a human adopting the proposal. A validation path must
  be deterministic: no model call, no network fetch, no clock or random source
  deciding a result.
- **Canonicalization drift.** Changing the canonical byte format changes every
  audit hash already written. It needs an ADR, not a PR.

Then the ordinary review: correctness, security, operability, observability,
and the repo conventions — requirement IDs on requirement-facing tests
(`test_asrevd02_...`, IDs in `docs/traceability.md`), decisions recorded as
ADRs in `docs/adr/` rather than only in a PR description, error paths logged,
timeouts on outbound calls, tests for new logic.

Tatva design-system compliance applies when `apps/web` UI files changed; its
rules are in the cheat-sheet section, when present.

## Two things about this tree that produce false positives

Read these before flagging a missing path or a "broken" import:

- **`docs/` plans M6; the tree is at M0.** `providers/`, `db/`, `contracts/`,
  `tests/conformance/`, `platform.yaml` and `docs/canonicalization.md` are all
  absent today, though docs discuss them in the present tense. A PR that does
  not create one is not thereby broken — but a PR that *imports* one without
  creating it is.
- **Placeholders are known, not new.** `build-and-test` in `ci.yml` is still
  an `echo`, `Dockerfile` is a placeholder, and `ruff` is unpinned and reports
  findings in pre-existing `platform/` code. Do not raise these as findings of
  this PR; do raise it if the PR adds code that depends on them working.

## Skip

- Formatting, lint and type errors — `ci.yml` covers these (`semgrep`,
  `gitleaks`, `trivy`, `web`, `build-and-test`)
- Pre-existing `ruff` findings in code the PR did not touch
- Missing analytics instrumentation
- British-vs-American spelling in prose, unless the PR is documentation

## Categories

- `invariant` — one of the ten architectural invariants above
- `design-system` — Tatva violations in `apps/web`
- `general` — everything else

## Scope

- Focus on **changed files** in this PR
- At most **3** cross-file reads for convention checks (e.g. how a sibling
  handler logs a failure, or what an SPI interface actually declares)
- Do not dismiss an issue because the old code had the same gap, or because it
  is "not a regression"
- Use `critical` for an invariant breach or a live security or data-loss bug;
  `warning` for operability and convention gaps; `nit` for optional hardening
- If the PR touches an item under "Open questions" in `AGENTS.md` (which app
  serves which role, pilot languages, canonicalization), say so as a `warning`
  rather than assuming a reading

## Output

Your **final message must be ONLY** a raw JSON object — no markdown fences, no
prose before or after.

Emit JSON **once**, when your analysis is complete. Do not loop, re-litigate,
or emit multiple JSON objects.

If no issues:

{"summary":"No issues found.","findings":[]}

Otherwise:

{"summary":"One or two sentences on overall PR quality and risk","findings":[{"file":"relative/path/from/repo/root.py","line":42,"severity":"critical|warning|nit","category":"invariant|design-system|general","title":"short one-line summary","body":"markdown explanation and concrete fix"}]}

Rules:

- **Every issue you identify must appear in the `findings` array** — prose
  alone is not enough
- Prefer a line number from the diff; use line `0` if the finding is
  file-level only
- Flag issues evidenced in the diff or in files you read — do not require
  proving production is broken
- Never quote question content, candidate data, or anything that looks like
  sealed plaintext in a finding body; refer to it by file and line
