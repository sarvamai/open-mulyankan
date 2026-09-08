"""Hash-chained, content-free audit (ASR01-EVD-01/02/09).

M0 ships the in-memory log and verifier that the M1 database-backed store
must reproduce bit-for-bit: same canonicalization, same chain rule, same
verification semantics (ARC-02: state change and audit event commit in one
transaction — enforced at the persistence layer in M1).
"""

from mulyankan_platform.audit.chain import (
    CANONICAL_SCHEMA_VERSION,
    GENESIS_HASH,
    AuditEvent,
    AuditLog,
    VerifyResult,
    canonical_bytes,
    compute_hash,
    verify,
)

__all__ = [
    "CANONICAL_SCHEMA_VERSION",
    "GENESIS_HASH",
    "AuditEvent",
    "AuditLog",
    "VerifyResult",
    "canonical_bytes",
    "compute_hash",
    "verify",
]
