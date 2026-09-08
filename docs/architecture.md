# Architecture — Layer 1 workflow core

Maps the v4 specification and the three-layer concept note onto this
repository. Requirement IDs (QST/ARC/SEC/DAT/INT/FND/ASR/RES) trace through
`docs/traceability.md`.

## The four jobs

Authoring → Review → Accessibility check → Translation (per required
language) → system seal → ready → downstream assembly (metadata only).
Each job is performed by a different person; none can be skipped.

## State machine (server-authoritative, v4 §3)

```
Draft → In Review → In Accessibility Check → Sealing → Sealed
```

- A return creates a new linked draft carrying findings; the returned version
  stays immutable.
- Sealing is a system action; no human seal control exists.
- Primary + all required languages sealed on one lineage ⇒ ready.
- Correction creates a new lineage and revokes readiness; variants are marked
  for revalidation.
- Downstream: Used → Archived, driven by signed notifications (QST06-LFC).

## Repository map

| Spec group | Repo location |
|---|---|
| Experience (role surfaces) | `apps/web` |
| Application (domain services) | `platform/core` (FastAPI) |
| Workers (protected jobs) | `platform/core` workers + `providers/*` |
| Data (PostgreSQL, audit store, object store) | `db/`, `providers/storage-*`, `providers/kms-*` |
| Provider interfaces | `platform/spi` (`mulyankan-spi`) |
| Provider implementations | `providers/` |

## Invariants (violating any of these is a design bug)

1. The server-side state machine is authoritative; client claims are never
   trusted (ARC-01).
2. A state change and its audit event commit in one database transaction
   (ARC-02).
3. Audit events are append-only, hash-chained, and content-free
   (ASR01-EVD-01/02/09).
4. Returns create linked drafts; submitted, returned, and sealed versions are
   immutable (SEC-08).
5. No human seal control exists; the sealing worker is the only writer of
   sealed artefacts and manifests (ARC-05, QST05-VLT-01).
6. Sealed plaintext is unreadable by any human role, including administrators
   (SEC-01).
7. No AI inside Layer 1; gateway proposals only, human adoption required
   (ARC-12 as amended).
8. Validation is deterministic: no probabilistic or external services in any
   validation path (QST03-VAL-03).
9. Domain and audit events leave via the transactional outbox, at-least-once,
   deduplicated by event id (ARC-03).
10. Canonicalization is bit-stable and versioned (DAT-05/06).

## Trust boundaries

- Browser → core-api: OIDC bearer token, TLS only, no content in URLs
  (DAT-03, INT-02).
- core-api → providers: in-process behind the registry; every interaction
  audited content-free.
- Workers → data: workload identity, least privilege (ARC-05, ARC-08).
- Downstream assembly → readiness API: mutual TLS with an audience-restricted
  workload token (ARC-06); metadata only, never content.

## Non-functional targets (v4 §9)

50 concurrent sessions · 100k artefacts · 500k versions · read ≤ 2s ·
draft save ≤ 1.5s · operator signal ≤ 3s · durable audit ≤ 5s ·
99.5% availability · RTO 4h / RPO 15min · WCAG 2.1 AA · Unicode end-to-end.
