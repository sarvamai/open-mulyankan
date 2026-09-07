# open-mulyankan — Content Authoring Engine, Layer 1 Workflow Core

The open-source workflow core for examination content authoring: it turns a
blank page into a sealed, ready question through four human jobs — **authoring,
review, accessibility check, translation** — under deterministic rules, a
hash-chained audit trail, and **no AI inside the core**.

Part of the National Examination Stack's three-layer architecture:

| Layer | What it is | Where it lives |
|---|---|---|
| 1 · Workflow core | The rules, the records, the seal, the export. Deterministic. | **This repository** (Apache-2.0) |
| 2 · Intelligence gateway | Models propose through a published interface; humans adopt. | Gateway adapters (planned) |
| 3 · Managed service | Tendered operation of Layers 1–2. | Commercial contract |

## Status

M0 — repository foundation. The milestone plan (M0–M6) tracks the Content
Creation MVP Requirements Specification v4 week-by-week plan; closure is
evidence, not demonstration. Architecture decisions are recorded as ADRs under
`docs/adr/` as they land.

## Licence

Apache-2.0 — see `LICENSE` and `NOTICE`. Dependencies are restricted to a
permissive allowlist enforced in CI; copyleft tools run as separate, unmodified
services.
