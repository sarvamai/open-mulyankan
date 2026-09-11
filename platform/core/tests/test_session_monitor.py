"""Session monitor: lifecycle, signals, score, gap detection (ASR02-OBS-01)."""

import hashlib
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone

import pytest

from mulyankan_platform.audit import AuditEvent, AuditLog, canonical_bytes
from mulyankan_platform.sessions import (
    CLOSED_RETENTION,
    GAP_THRESHOLD,
    MAX_PAGE_SIZE,
    SIGNAL_DEDUCTION,
    SessionClosedError,
    SessionMonitor,
    UnknownSessionError,
)

# A canary that must never enter the monitoring pipe (no question content in
# audit events, logs, or exception strings).
QUESTION_TEXT = "What is the capital of India?"

START = datetime(2026, 9, 11, 10, 0, 0, tzinfo=timezone.utc)

# Enough live sessions that iterating them spans a thread switch; below this the
# race exists but hides behind the GIL and the test stops catching anything.
SEEDED_SESSIONS = 2000


class FakeClock:
    """Deterministic clock the monitor reads; tests advance it explicitly."""

    def __init__(self) -> None:
        self.moment = START

    def __call__(self) -> datetime:
        return self.moment

    def advance(self, seconds: float) -> None:
        self.moment += timedelta(seconds=seconds)


def _monitor() -> tuple[SessionMonitor, FakeClock, AuditLog]:
    clock = FakeClock()
    log = AuditLog()
    return SessionMonitor(log, now=clock), clock, log


def _gap_events(log: AuditLog) -> list[AuditEvent]:
    return [e for e in log.events if e.action == "session.signal.heartbeat_gap"]


def _iso(moment: datetime) -> str:
    return moment.isoformat(timespec="milliseconds").replace("+00:00", "Z")


def test_asr02obs01_registered_session_heartbeats() -> None:
    monitor, clock, _log = _monitor()
    session = monitor.register("author-001")
    assert session.status == "active"
    assert session.score == 100
    assert session.silent is False

    clock.advance(30)
    beaten = monitor.heartbeat(session.session_id)

    assert beaten.last_heartbeat_at > session.registered_at
    assert beaten.score == 100


def test_asr02obs01_signal_writes_content_free_audit_event() -> None:
    monitor, _clock, log = _monitor()
    session = monitor.register("author-001")

    after = monitor.report_signal(session.session_id, "copy")

    assert after.score == 100 - SIGNAL_DEDUCTION
    event = log.events[-1]
    assert event.action == "session.signal.copy"
    assert event.object_refs == (session.session_id,)
    # The event commits to the resulting score through the payload hash.
    assert (
        event.payload_hash
        == hashlib.sha256(canonical_bytes({"score": after.score})).hexdigest()
    )
    assert QUESTION_TEXT not in event.link_bytes().decode("utf-8")
    assert log.verify().ok


def test_asr02obs01_score_deducts_and_never_recovers() -> None:
    monitor, clock, _log = _monitor()
    session = monitor.register("author-001")
    monitor.report_signal(session.session_id, "copy")
    monitor.report_signal(session.session_id, "paste")

    after_third = monitor.report_signal(session.session_id, "cut")
    assert after_third.score == 100 - 3 * SIGNAL_DEDUCTION

    for _ in range(10):  # the score floors at zero and stays there
        monitor.report_signal(session.session_id, "copy")
    assert monitor.report_signal(session.session_id, "paste").score == 0

    clock.advance(1)
    assert monitor.heartbeat(session.session_id).score == 0


def test_asr02obs01_audit_timestamps_follow_the_session_clock() -> None:
    """Events are stamped from the monitor's clock, not `datetime.now()`.

    An audit record is evidence: its time has to be the time of the state
    change it describes, or the two cannot be reconciled later.
    """
    monitor, clock, log = _monitor()
    session = monitor.register("author-001")
    assert log.events[-1].ts == _iso(START) == session.registered_at

    clock.advance(5)
    signalled = monitor.report_signal(session.session_id, "copy")
    assert log.events[-1].ts == _iso(START + timedelta(seconds=5))
    assert signalled.last_signal_at == _iso(START + timedelta(seconds=5))

    clock.advance(5)
    monitor.close(session.session_id)
    assert log.events[-1].ts == _iso(START + timedelta(seconds=10))


def test_asr02obs01_integrity_view_is_a_pure_read() -> None:
    """Polling the operator view must never alter the evidence it reports.

    `silent` is derived from the clock, so a refresh, a retry, or an uptime
    prober sees the condition without deducting a score or touching the chain.
    """
    monitor, clock, log = _monitor()
    session = monitor.register("author-001")
    before = len(log.events)

    clock.advance(GAP_THRESHOLD.total_seconds() + 1)
    for _ in range(5):
        (mine,) = monitor.integrity_view()
        assert mine.silent is True
        assert mine.score == 100  # unchanged: the view commits nothing

    assert len(log.events) == before
    assert _gap_events(log) == []
    assert monitor.integrity_view()[0].session_id == session.session_id


def test_asr02obs01_sweep_signals_a_gap_once_per_silence() -> None:
    monitor, clock, log = _monitor()
    session = monitor.register("author-001")

    clock.advance(61)
    assert monitor.sweep() == 1
    (mine,) = monitor.integrity_view()
    assert mine.score == 100 - SIGNAL_DEDUCTION
    assert mine.last_signal == "heartbeat_gap"
    assert len(_gap_events(log)) == 1

    clock.advance(120)  # still the same silence: no second signal
    assert monitor.sweep() == 0
    assert len(_gap_events(log)) == 1

    monitor.heartbeat(session.session_id)  # revives and re-arms detection
    clock.advance(61)
    assert monitor.sweep() == 1
    assert len(_gap_events(log)) == 2


def test_asr02obs01_gap_event_carries_the_crossing_time() -> None:
    """The record says when the gap happened, not when the sweep noticed.

    A sweep delayed by an hour must not claim the student fell silent an hour
    later than they did.
    """
    monitor, clock, log = _monitor()
    monitor.register("author-001")

    clock.advance(3600)  # nobody swept for an hour
    monitor.sweep()

    (gap,) = _gap_events(log)
    assert gap.ts == _iso(START + GAP_THRESHOLD)
    assert gap.ts != _iso(clock.moment)


def test_asr02obs01_no_automatic_suspension() -> None:
    monitor, clock, _log = _monitor()
    session = monitor.register("author-001")
    for signal in ("copy", "cut", "paste"):
        monitor.report_signal(session.session_id, signal)
    clock.advance(61)
    monitor.sweep()

    assert monitor.heartbeat(session.session_id).status == "active"
    assert monitor.close(session.session_id).status == "closed"


def test_asr02obs01_close_is_terminal() -> None:
    monitor, _clock, log = _monitor()
    session = monitor.register("author-001")
    monitor.close(session.session_id)

    with pytest.raises(SessionClosedError):
        monitor.heartbeat(session.session_id)
    with pytest.raises(SessionClosedError):
        monitor.report_signal(session.session_id, "copy")
    with pytest.raises(SessionClosedError):
        monitor.close(session.session_id)
    with pytest.raises(UnknownSessionError):
        monitor.heartbeat("missing")

    assert log.events[-1].action == "session.closed"


def test_asr02obs01_closed_sessions_are_swept_and_then_evicted() -> None:
    """A closed session stays visible, then leaves; the chain keeps the record."""
    monitor, clock, log = _monitor()
    session = monitor.register("author-001")
    monitor.close(session.session_id)

    clock.advance(GAP_THRESHOLD.total_seconds() + 1)
    assert monitor.sweep() == 0  # closed sessions are never "silent"
    assert _gap_events(log) == []
    (mine,) = monitor.integrity_view()
    assert mine.status == "closed"
    assert mine.silent is False

    clock.advance(CLOSED_RETENTION.total_seconds() + 1)
    monitor.sweep()
    assert monitor.integrity_view() == []
    # Eviction is a storage concern; the audit chain still holds the history.
    assert [e.action for e in log.events] == ["session.registered", "session.closed"]


def test_asr02obs01_view_filters_by_status_and_bounds_the_page() -> None:
    monitor, _clock, _log = _monitor()
    sessions = [monitor.register(f"author-{n:03d}") for n in range(5)]
    monitor.close(sessions[0].session_id)

    assert len(monitor.integrity_view()) == 5
    assert len(monitor.integrity_view(status="active")) == 4
    assert [s.session_id for s in monitor.integrity_view(status="closed")] == [
        sessions[0].session_id
    ]
    # "Return everything" is not a shape that ports to a table.
    assert len(monitor.integrity_view(limit=2)) == 2

    with pytest.raises(ValueError):
        monitor.integrity_view(status="silent")


def test_asr02obs01_concurrent_registration_and_reads_are_safe() -> None:
    """Sync handlers run on the anyio threadpool: the map really is shared.

    Unlocked, a sweep or a view iterating the session map while a registration
    inserts into it raises `RuntimeError: dictionary changed size during
    iteration` — a 500 on an endpoint that is supposed to be evidence. The
    seeded population and the shortened switch interval are what make the
    window wide enough to hit every run rather than once in a hundred.
    """
    monitor = SessionMonitor(AuditLog())
    for seed in range(SEEDED_SESSIONS):
        monitor.register(f"seed-{seed:04d}")

    def register(n: int) -> None:
        for _ in range(50):
            monitor.register(f"author-{n:03d}")

    def read(_: int) -> None:
        for _ in range(50):
            monitor.integrity_view(limit=MAX_PAGE_SIZE)
            monitor.sweep()

    switch_interval = sys.getswitchinterval()
    sys.setswitchinterval(1e-6)
    try:
        with ThreadPoolExecutor(max_workers=8) as pool:
            futures = [pool.submit(register, n) for n in range(4)]
            futures += [pool.submit(read, n) for n in range(4)]
            for future in futures:
                future.result()  # re-raises anything a worker hit
    finally:
        sys.setswitchinterval(switch_interval)

    assert len(monitor.integrity_view(limit=MAX_PAGE_SIZE)) == MAX_PAGE_SIZE


def test_asr02obs01_concurrent_signals_deduct_exactly_once_each() -> None:
    """Concurrent signals on one session each deduct once, and only once.

    `_publish` read-modify-writes the score and the counter. CPython's GIL
    makes the interleaving window narrow enough that this assertion would
    usually hold even unlocked, so treat it as a guard on the invariant rather
    than a reproduction: the lock is what makes it guaranteed instead of
    likely, and what keeps it true when the store moves behind a transaction.
    """
    monitor = SessionMonitor(AuditLog())
    session = monitor.register("author-001")
    reports = 8

    with ThreadPoolExecutor(max_workers=reports) as pool:
        futures = [
            pool.submit(monitor.report_signal, session.session_id, "copy")
            for _ in range(reports)
        ]
        for future in futures:
            future.result()

    (mine,) = monitor.integrity_view()
    assert mine.signal_count == reports
    assert mine.score == 100 - reports * SIGNAL_DEDUCTION
