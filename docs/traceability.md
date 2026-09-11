# Traceability — requirement ID → component → test

Every v4 requirement ID lands in a named component and at least one automated
test. Tests carry the requirement ID in their name (for example
`test_arc02_audit_commits_with_state_change`). This file is the index; each
row gains its test list at the milestone that closes it.

| Requirement group | Component | Closed in |
|---|---|---|
| QST01-CFG (cycle, syllabus, taxonomy) | configuration services | M1 |
| FND04-CAP (capability, identity) | authz engine, identity SPI | M1 |
| ASR01-EVD (evidence, audit) | `platform/core` audit chain | M1 |
| ASR02-OBS (observability, integrity) | telemetry SPI, operator surface | M1/M3 |
| QST03-ATH (authoring) | web editor, artefact services | M2 |
| QST03-VAL (validation, similarity) | validation services, similarity SPI | M2 |
| QST03-REV (review) | review workspace, decisions service | M3 |
| QST04-ACC (accessibility) | accessibility workspace, render contract | M3 |
| QST04-TRN (translation, equivalence) | translation workspace, equivalence checks | M4 |
| QST05-VLT (sealing, vault) | sealing worker, kms/storage SPIs | M4 |
| QST07-RDY (readiness, handoff) | readiness calculator + machine API | M4 |
| RES06-COR (correction, supersession) | correction service | M4 |
| QST06-LFC (downstream states) | lifecycle states, notify SPI | M4 |
| ARC-01..12 (architecture) | cross-cutting | per milestone |
| SEC-01..14, DAT-01..08, INT-01..11 | cross-cutting | per milestone |

## ASR02-OBS-01 — session heartbeat and first monitoring signal (M1)

Implemented in `platform/core` (issue #30): platform-owned session
register/heartbeat/close, the copy/cut/paste and heartbeat-gap signal, the
content-free security event on the audit chain, and the Integrity Operator's
JSON view. Every test in these modules carries the requirement ID:

- `platform/core/tests/test_session_monitor.py`
- `platform/core/tests/test_sessions_api.py`

**Not yet closed.** The surface is unauthenticated: nothing validates a caller,
and the operator view publishes the `session_id` that is the bearer for every
write, so signals and closures can be forged onto an append-only chain. The row
closes when the identity SPI (ADR-0004) validates tokens server-side. Until
then the surface is development-only — see "Known limitations" in `SECURITY.md`.

## Standing DoD checks (v4 §11)

Implemented as conformance tests under `tests/conformance/` and kept green
from the milestone that introduces them: chain verification and tamper
detection, no-Restricted-content-in-logs scan, separation-of-duties refusal
(UI and API), sealed-plaintext denial for every human role, readiness
token-audience enforcement, and evidence-completeness blocking.
