"""Session lifecycle and the first monitoring signal (ASR02-OBS-01, issue #30).

The platform owns sessions — register, 30-second heartbeat, close — as a
platform concern, not an identity-provider concern (ADR-0004). One published
signal exists for M1: a client-reported copy/cut/paste event, or a
server-detected heartbeat gap. On a signal the monitor appends a content-free
security event to the audit chain and subtracts a fixed published amount from
the session's integrity score, which starts at 100 and never recovers
in-session. Automatic suspension stays off: a signal never closes a session.

The score is committed to the audit event through the payload hash; the
event's readable fields keep the content-free schema (opaque refs + payload
hash), so the canonical byte format is untouched.

Reading is separated from committing, and the split is the part that must
survive into the database-backed store:

- **Silence is derived, never stored.** `integrity_view` computes `silent` from
  the clock and the last heartbeat. It mutates nothing and appends nothing, so
  an operator refresh, a retry, or a health prober cannot alter the evidence.
  In the database store this is an indexed read, safe to serve from a replica.
- **`sweep` is the only writer.** It alone deducts the score and appends the
  gap event, and it is idempotent per silence episode (`gap_signalled`, which
  becomes a uniqueness constraint on the episode in the database store, so two
  replicas racing cannot double-write). One process drives it here; a
  single-writer guard — an advisory lock, or `FOR UPDATE SKIP LOCKED` — drives
  it there.
- **The event carries the crossing time**, `last_heartbeat_at + GAP_THRESHOLD`,
  not the moment the sweep noticed. An audit record is evidence; it has to say
  when the gap happened, not when someone got round to looking.

A consequence worth knowing: a session that falls silent and heartbeats again
between two sweeps publishes no gap event. `SWEEP_INTERVAL` well below
`GAP_THRESHOLD` keeps that window small, and `silent` on the view reports the
condition immediately regardless.

Per-signal history is not kept on the session record — the audit chain is the
durable, verifiable log of every signal, and the record carries only the
denormalised counters an operator reads. Closed sessions are evicted after
`CLOSED_RETENTION`; the database store replaces that with archival.

The in-memory store is M1 scaffolding. The database-backed store must keep a
state change and its audit event in one transaction (ARC-02) and produce
byte-identical events.

Not yet met: this surface is unauthenticated. See "Known limitations" in
`SECURITY.md` before exposing it anywhere an exam taker can reach.
"""

from __future__ import annotations

import threading
import uuid
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

from mulyankan_platform.audit import AuditLog

HEARTBEAT_INTERVAL = timedelta(seconds=30)
"""Published heartbeat cadence (ASR02-OBS-01)."""

GAP_THRESHOLD = HEARTBEAT_INTERVAL * 2
"""Silence longer than this publishes one heartbeat-gap signal per episode."""

SWEEP_INTERVAL = timedelta(seconds=10)
"""How often the single writer commits gap signals; well below the threshold."""

CLOSED_RETENTION = timedelta(hours=1)
"""A closed session stays visible this long, then is evicted."""

INITIAL_SCORE = 100
"""Every session starts at integrity score 100."""

SIGNAL_DEDUCTION = 10
"""Fixed published amount subtracted per signal; the score never recovers."""

CLIENT_SIGNALS = ("copy", "cut", "paste")
"""Signals the capture point reports; the heartbeat gap is server-detected."""

GAP_SIGNAL = "heartbeat_gap"
"""The one server-detected signal; clients cannot report it."""

DEFAULT_PAGE_SIZE = 100
MAX_PAGE_SIZE = 500
"""The operator view is a bounded page: "return everything" does not port to a
table, and the endpoint should not grow a new failure mode with the roll."""

VIEW_STATUSES = ("all", "active", "closed")


class UnknownSessionError(LookupError):
    """No session exists for the given identifier."""


class SessionClosedError(RuntimeError):
    """The session is closed; only reads of its final state remain."""


@dataclass(frozen=True)
class SessionSnapshot:
    """Content-free view of one session for the Integrity Operator."""

    session_id: str
    actor: str
    status: str
    score: int
    registered_at: str
    last_heartbeat_at: str
    silent: bool
    signal_count: int
    last_signal: str | None
    last_signal_at: str | None

    def as_dict(self) -> dict:
        """The exact JSON shape the operator view publishes — no other fields."""
        return {
            "session_id": self.session_id,
            "actor": self.actor,
            "status": self.status,
            "score": self.score,
            "registered_at": self.registered_at,
            "last_heartbeat_at": self.last_heartbeat_at,
            "silent": self.silent,
            "signal_count": self.signal_count,
            "last_signal": self.last_signal,
            "last_signal_at": self.last_signal_at,
        }


@dataclass
class _SessionState:
    """Mutable session record; snapshots are the read-only surface.

    Counters, not history: the audit chain already holds every signal, and a
    per-session list would duplicate it and grow without bound.
    """

    session_id: str
    actor: str
    registered_at: datetime
    last_heartbeat_at: datetime
    score: int = INITIAL_SCORE
    status: str = "active"
    closed_at: datetime | None = None
    signal_count: int = 0
    last_signal: str | None = None
    last_signal_at: datetime | None = None
    gap_signalled: bool = False  # one gap signal per silence episode


def _iso(moment: datetime) -> str:
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _iso_or_none(moment: datetime | None) -> str | None:
    return None if moment is None else _iso(moment)


class SessionMonitor:
    """Owns session state and publishes monitoring signals onto the audit chain.

    Every public method holds `_lock`. The core-api handlers are sync `def`, so
    Starlette runs them concurrently on the anyio threadpool — without it,
    `sweep` iterating the session map while `register` inserts into it raises
    `RuntimeError: dictionary changed size during iteration`, and two signals
    on one session can both read the score and both write the same deduction.
    The lock is what becomes the database transaction ARC-02 already requires.
    """

    def __init__(
        self,
        audit_log: AuditLog,
        *,
        now: Callable[[], datetime] | None = None,
    ) -> None:
        self._audit = audit_log
        self._now = now or (lambda: datetime.now(UTC))
        self._lock = threading.RLock()
        self._sessions: dict[str, _SessionState] = {}
        # The in-memory stand-in for an indexed `WHERE status = 'active'`: the
        # sweep must cost what is live, not what has ever existed.
        self._active_ids: set[str] = set()

    def register(self, actor: str) -> SessionSnapshot:
        """Open a session for a pseudonymous actor at integrity score 100."""
        moment = self._now()
        with self._lock:
            state = _SessionState(
                session_id=uuid.uuid4().hex,
                actor=actor,
                registered_at=moment,
                last_heartbeat_at=moment,
            )
            self._sessions[state.session_id] = state
            self._active_ids.add(state.session_id)
            # ARC-02: the state change and its audit event commit together; the
            # database-backed store keeps this a single transaction.
            self._audit.append(
                actor=actor,
                action="session.registered",
                object_refs=(state.session_id,),
                ts=moment,
            )
            return self._snapshot(state, moment)

    def heartbeat(self, session_id: str) -> SessionSnapshot:
        """Record liveness; re-arms heartbeat-gap detection for the session."""
        moment = self._now()
        with self._lock:
            state = self._active(session_id)
            state.last_heartbeat_at = moment
            state.gap_signalled = False
            return self._snapshot(state, moment)

    def report_signal(self, session_id: str, signal: str) -> SessionSnapshot:
        """Publish a client-reported signal (copy/cut/paste) for the session."""
        if signal not in CLIENT_SIGNALS:
            raise ValueError(f"unsupported signal: {signal!r}")
        moment = self._now()
        with self._lock:
            state = self._active(session_id)
            self._publish(state, signal, moment)
            return self._snapshot(state, moment)

    def close(self, session_id: str) -> SessionSnapshot:
        """Close the session; the terminal state, reached only explicitly."""
        moment = self._now()
        with self._lock:
            state = self._require(session_id)
            if state.status == "closed":
                raise SessionClosedError("session is already closed")
            state.status = "closed"
            state.closed_at = moment
            self._active_ids.discard(session_id)
            self._audit.append(
                actor=state.actor,
                action="session.closed",
                object_refs=(state.session_id,),
                ts=moment,
            )
            return self._snapshot(state, moment)

    def integrity_view(
        self,
        *,
        status: str = "all",
        limit: int = DEFAULT_PAGE_SIZE,
    ) -> list[SessionSnapshot]:
        """The Integrity Operator's list (ASR02-OBS-01): a pure, bounded read.

        Appends nothing and mutates nothing — `silent` is derived from the
        clock, so polling this cannot alter a session's score or the chain.
        """
        if status not in VIEW_STATUSES:
            raise ValueError(f"unsupported status filter: {status!r}")
        page = max(1, min(limit, MAX_PAGE_SIZE))
        moment = self._now()
        with self._lock:
            snapshots = []
            for state in self._sessions.values():  # registration order
                if status != "all" and state.status != status:
                    continue
                snapshots.append(self._snapshot(state, moment))
                if len(snapshots) == page:
                    break
            return snapshots

    def sweep(self) -> int:
        """Commit gap signals and evict expired sessions; the only writer.

        Idempotent per silence episode, so a retry, an overlapping run, or a
        second replica cannot double-deduct. Returns the number of gap signals
        published, which is what a caller would log or export as a metric.
        """
        moment = self._now()
        published = 0
        with self._lock:
            for session_id in tuple(self._active_ids):
                state = self._sessions[session_id]
                if state.gap_signalled or not self._is_silent(state, moment):
                    continue
                # The gap happened when the threshold elapsed, not when this
                # sweep noticed it; the audit record has to say so.
                self._publish(
                    state, GAP_SIGNAL, state.last_heartbeat_at + GAP_THRESHOLD
                )
                state.gap_signalled = True
                published += 1

            for session_id, state in tuple(self._sessions.items()):
                if (
                    state.closed_at is not None
                    and moment - state.closed_at > CLOSED_RETENTION
                ):
                    del self._sessions[session_id]
            return published

    def _require(self, session_id: str) -> _SessionState:
        state = self._sessions.get(session_id)
        if state is None:
            raise UnknownSessionError("unknown session")
        return state

    def _active(self, session_id: str) -> _SessionState:
        state = self._require(session_id)
        if state.status == "closed":
            raise SessionClosedError("session is closed")
        return state

    @staticmethod
    def _is_silent(state: _SessionState, moment: datetime) -> bool:
        """Derived, never stored: the read path's whole gap-detection logic."""
        if state.status != "active":
            return False
        return moment - state.last_heartbeat_at > GAP_THRESHOLD

    def _publish(self, state: _SessionState, signal: str, moment: datetime) -> None:
        """Deduct the score and append the security event as one step (ARC-02)."""
        state.score = max(0, state.score - SIGNAL_DEDUCTION)
        state.signal_count += 1
        state.last_signal = signal
        state.last_signal_at = moment
        self._audit.append(
            actor=state.actor,
            action=f"session.signal.{signal}",
            object_refs=(state.session_id,),
            payload={"score": state.score},
            ts=moment,
        )

    def _snapshot(self, state: _SessionState, moment: datetime) -> SessionSnapshot:
        return SessionSnapshot(
            session_id=state.session_id,
            actor=state.actor,
            status=state.status,
            score=state.score,
            registered_at=_iso(state.registered_at),
            last_heartbeat_at=_iso(state.last_heartbeat_at),
            silent=self._is_silent(state, moment),
            signal_count=state.signal_count,
            last_signal=state.last_signal,
            last_signal_at=_iso_or_none(state.last_signal_at),
        )
