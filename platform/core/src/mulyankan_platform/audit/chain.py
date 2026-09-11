"""Append-only, hash-chained audit events.

Invariants (v4 §1.10, ARC-02, DAT-05):

- Events are append-only; nothing ever mutates or removes a stored event.
- The chain hash covers the previous event's hash plus the canonical bytes of
  this event, so any alteration or removal is detectable by `verify`.
- Events are content-free: they carry opaque object references and a payload
  hash, never artefact plaintext (ASR01-EVD-09, DAT-03).
- Canonical bytes follow `docs/canonicalization.md` (draft v0.1) and are
  versioned; the verifier refuses unknown schema versions.
- `append` is atomic. Reading the tail, numbering the event, and storing it is
  one indivisible step, so concurrent writers cannot mint two events with the
  same `seq` and `prev_hash` — a break `verify` reports and nothing can repair,
  the log being append-only. The database-backed store owes the same guarantee
  (a serialised sequence, not an advisory convention).
"""

from __future__ import annotations

import hashlib
import json
import threading
import uuid
from dataclasses import dataclass, replace
from datetime import datetime, timezone
from typing import Sequence

CANONICAL_SCHEMA_VERSION = "draft-v0.1"
GENESIS_HASH = "0" * 64


def canonical_bytes(document: dict) -> bytes:
    """Bit-stable canonical JSON per docs/canonicalization.md (draft v0.1)."""
    return json.dumps(
        document, sort_keys=True, separators=(",", ":"), ensure_ascii=False
    ).encode("utf-8")


@dataclass(frozen=True)
class AuditEvent:
    """One content-free audit record."""

    event_id: str
    seq: int
    ts: str  # RFC 3339 UTC
    actor: str  # pseudonymous workforce identifier (DAT-02)
    action: str  # e.g. "draft.created"
    object_refs: tuple[str, ...]  # opaque identifiers only — never content
    payload_hash: str  # sha256 over canonical payload bytes; "" when absent
    prev_hash: str
    hash: str

    def link_bytes(self) -> bytes:
        """Canonical bytes covered by this event's hash (hash field excluded)."""
        return canonical_bytes(
            {
                "canonical_schema_version": CANONICAL_SCHEMA_VERSION,
                "event_id": self.event_id,
                "seq": self.seq,
                "ts": self.ts,
                "actor": self.actor,
                "action": self.action,
                "object_refs": list(self.object_refs),
                "payload_hash": self.payload_hash,
                "prev_hash": self.prev_hash,
            }
        )


def compute_hash(event: AuditEvent) -> str:
    """Chain rule: sha256(prev_hash bytes || canonical event bytes)."""
    digest = hashlib.sha256()
    digest.update(bytes.fromhex(event.prev_hash))
    digest.update(event.link_bytes())
    return digest.hexdigest()


@dataclass(frozen=True)
class VerifyResult:
    """Outcome of a chain verification (ASR01-EVD-02/03)."""

    ok: bool
    events: int
    first_bad_seq: int | None = None
    reason: str | None = None


def verify(events: Sequence[AuditEvent]) -> VerifyResult:
    """Recompute the full chain; detect altered or removed events."""
    prev = GENESIS_HASH
    for index, event in enumerate(events):
        if event.seq != index:
            return VerifyResult(False, len(events), event.seq, "sequence gap")
        if event.prev_hash != prev:
            return VerifyResult(False, len(events), event.seq, "broken link")
        if compute_hash(event) != event.hash:
            return VerifyResult(False, len(events), event.seq, "hash mismatch")
        prev = event.hash
    return VerifyResult(True, len(events))


class AuditLog:
    """Append-only in-memory audit log.

    The M1 database-backed store must produce byte-identical events and the
    same verification results; `verify` works on either representation.
    """

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []
        # The core-api handlers are sync `def`, so Starlette runs them
        # concurrently on the anyio threadpool: appends really do race.
        self._lock = threading.Lock()

    def append(
        self,
        *,
        actor: str,
        action: str,
        object_refs: tuple[str, ...] | list[str] = (),
        payload: dict | None = None,
        event_id: str | None = None,
        ts: datetime | None = None,
    ) -> AuditEvent:
        """Append one event atomically; `payload` is hashed and discarded."""
        if payload is None:
            payload_hash = ""
        else:
            payload_hash = hashlib.sha256(canonical_bytes(payload)).hexdigest()
        moment = ts or datetime.now(timezone.utc)
        with self._lock:
            prev_hash = self._events[-1].hash if self._events else GENESIS_HASH
            event = AuditEvent(
                event_id=event_id or uuid.uuid4().hex,
                seq=len(self._events),
                ts=moment.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
                actor=actor,
                action=action,
                object_refs=tuple(object_refs),
                payload_hash=payload_hash,
                prev_hash=prev_hash,
                hash="",
            )
            event = replace(event, hash=compute_hash(event))
            self._events.append(event)
        return event

    @property
    def events(self) -> tuple[AuditEvent, ...]:
        """Read-only snapshot of the chain, consistent against live appends."""
        with self._lock:
            return tuple(self._events)

    def verify(self) -> VerifyResult:
        return verify(self.events)
