"""Audit chain: verification, tamper detection, content-freedom (ASR01-EVD)."""

from concurrent.futures import ThreadPoolExecutor
from dataclasses import replace

from mulyankan_platform.audit import (
    AuditLog,
    canonical_bytes,
    verify,
)


def _log_with_three_events() -> AuditLog:
    log = AuditLog()
    log.append(
        actor="author-001",
        action="draft.created",
        object_refs=("artefact-a1",),
        payload={"stem_len": 42},
    )
    log.append(
        actor="author-001",
        action="draft.submitted",
        object_refs=("artefact-a1", "version-v1"),
        payload={"content_hash": "ab" * 32},
    )
    log.append(
        actor="reviewer-002", action="review.approved", object_refs=("version-v1",)
    )
    return log


def test_asrevd02_chain_verifies_after_appends() -> None:
    log = _log_with_three_events()
    result = log.verify()
    assert result.ok is True
    assert result.events == 3
    assert result.first_bad_seq is None


def test_asrevd03_tampered_event_detected() -> None:
    log = _log_with_three_events()
    tampered = list(log.events)
    tampered[1] = replace(tampered[1], action="review.approved")
    result = verify(tampered)
    assert result.ok is False
    assert result.first_bad_seq == 1
    assert result.reason == "hash mismatch"


def test_asrevd03_removed_event_detected() -> None:
    log = _log_with_three_events()
    with_removed = list(log.events)
    del with_removed[1]
    result = verify(with_removed)
    assert result.ok is False
    assert result.reason == "sequence gap"


def test_events_are_content_free() -> None:
    log = _log_with_three_events()
    payload = {"stem": "What is the capital of India?"}
    event = log.append(
        actor="author-001",
        action="draft.autosaved",
        object_refs=("artefact-a1",),
        payload=payload,
    )
    stored = log.events[-1]
    assert stored is event
    # The payload itself must not appear anywhere on the event.
    assert "stem" not in event.link_bytes().decode("utf-8")
    assert event.payload_hash != ""
    assert len(event.payload_hash) == 64


def test_hashing_is_deterministic_and_unicode_stable() -> None:
    payload = {"question": "मूल्यांकन ☺", "n": 3}
    first = canonical_bytes(payload)
    second = canonical_bytes(dict(reversed(list(payload.items()))))
    assert first == second  # key order never changes the canonical form


def test_asrevd02_concurrent_appends_keep_the_chain_verifiable() -> None:
    """The core-api handlers are sync `def`, so appends really do race.

    Without an atomic append, two writers read the same tail and mint two
    events sharing a `seq` and a `prev_hash`. The log is append-only, so that
    break is permanent — `verify` reports it forever and nothing can repair it.
    """
    log = AuditLog()
    writers, per_writer = 8, 50

    def write(worker: int) -> None:
        for _ in range(per_writer):
            log.append(actor=f"author-{worker}", action="draft.autosaved")

    with ThreadPoolExecutor(max_workers=writers) as pool:
        for future in [pool.submit(write, worker) for worker in range(writers)]:
            future.result()

    events = log.events
    assert len(events) == writers * per_writer
    assert [event.seq for event in events] == list(range(writers * per_writer))
    assert len({event.prev_hash for event in events}) == len(events)
    assert log.verify().ok
