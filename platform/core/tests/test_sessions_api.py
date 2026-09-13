"""Session-monitoring API: the test client exercises ASR02-OBS-01 end to end."""

from fastapi.testclient import TestClient

from mulyankan_platform.core_api.main import create_app_from_mapping
from mulyankan_platform.sessions import MAX_PAGE_SIZE

OPERATOR_FIELDS = {
    "session_id",
    "actor",
    "status",
    "score",
    "registered_at",
    "last_heartbeat_at",
    "silent",
    "signal_count",
    "last_signal",
    "last_signal_at",
}


def _client() -> tuple[TestClient, str]:
    app = create_app_from_mapping({})
    client = TestClient(app)
    response = client.post("/v1/sessions", json={"actor": "author-001"})
    assert response.status_code == 201
    return client, response.json()["session_id"]


def test_asr02obs01_register_heartbeat_signal_roundtrip() -> None:
    app = create_app_from_mapping({})
    client = TestClient(app)

    registered = client.post("/v1/sessions", json={"actor": "author-001"})
    assert registered.status_code == 201
    session = registered.json()
    assert session["score"] == 100
    assert session["status"] == "active"
    assert session["silent"] is False
    session_id = session["session_id"]

    assert client.post(f"/v1/sessions/{session_id}/heartbeat").status_code == 200

    reported = client.post(
        f"/v1/sessions/{session_id}/signals", json={"signal": "copy"}
    )
    assert reported.status_code == 201
    assert reported.json()["score"] == 90

    # The security event is on the audit chain and the chain still verifies.
    events = app.state.audit_log.events
    assert events[-1].action == "session.signal.copy"
    assert events[-1].object_refs == (session_id,)
    assert app.state.audit_log.verify().ok

    view = client.get("/v1/integrity/sessions")
    assert view.status_code == 200
    (mine,) = (s for s in view.json()["sessions"] if s["session_id"] == session_id)
    assert mine["score"] == 90
    assert mine["signal_count"] == 1
    assert mine["last_signal"] == "copy"
    assert mine["last_signal_at"] == reported.json()["last_signal_at"]


def test_asr02obs01_operator_view_publishes_no_content_fields() -> None:
    client, _session_id = _client()
    sessions = client.get("/v1/integrity/sessions").json()["sessions"]

    assert len(sessions) == 1
    assert set(sessions[0]) == OPERATOR_FIELDS


def test_asr02obs01_operator_view_is_a_pure_read() -> None:
    """Polling the view must not touch the chain — it is the evidence itself."""
    app = create_app_from_mapping({})
    client = TestClient(app)
    client.post("/v1/sessions", json={"actor": "author-001"})
    before = len(app.state.audit_log.events)

    for _ in range(10):
        assert client.get("/v1/integrity/sessions").status_code == 200

    assert len(app.state.audit_log.events) == before
    assert app.state.audit_log.verify().ok


def test_asr02obs01_operator_view_is_filtered_and_bounded() -> None:
    app = create_app_from_mapping({})
    client = TestClient(app)
    ids = [
        client.post("/v1/sessions", json={"actor": f"author-{n:03d}"}).json()[
            "session_id"
        ]
        for n in range(3)
    ]
    assert client.post(f"/v1/sessions/{ids[0]}/close").status_code == 200

    def view(**params: object) -> list[dict]:
        response = client.get("/v1/integrity/sessions", params=params)
        assert response.status_code == 200
        return response.json()["sessions"]

    assert len(view()) == 3
    assert len(view(status="active")) == 2
    assert [s["session_id"] for s in view(status="closed")] == [ids[0]]
    assert len(view(limit=1)) == 1

    # The page is bounded by construction: no caller can ask for everything.
    assert (
        client.get(
            "/v1/integrity/sessions", params={"limit": MAX_PAGE_SIZE + 1}
        ).status_code
        == 422
    )
    assert client.get("/v1/integrity/sessions", params={"limit": 0}).status_code == 422
    assert (
        client.get("/v1/integrity/sessions", params={"status": "silent"}).status_code
        == 422
    )


def test_asr02obs01_signal_input_is_tight() -> None:
    client, session_id = _client()
    base = f"/v1/sessions/{session_id}/signals"

    # Extra fields are refused, so no text can be smuggled into the pipe.
    smuggled = client.post(base, json={"signal": "paste", "text": "question body"})
    assert smuggled.status_code == 422
    # The heartbeat gap is server-detected; clients cannot report it.
    assert client.post(base, json={"signal": "heartbeat_gap"}).status_code == 422
    assert client.post(base, json={"signal": "devtools"}).status_code == 422
    # Registration is equally tight.
    assert (
        client.post("/v1/sessions", json={"actor": "a", "role": "admin"}).status_code
        == 422
    )
    assert client.post("/v1/sessions", json={"actor": ""}).status_code == 422


def test_asr02obs01_unknown_and_closed_sessions_are_refused() -> None:
    client, session_id = _client()

    assert client.post("/v1/sessions/missing/heartbeat").status_code == 404

    assert client.post(f"/v1/sessions/{session_id}/close").status_code == 200
    assert client.post(f"/v1/sessions/{session_id}/heartbeat").status_code == 409
    closed_signal = client.post(
        f"/v1/sessions/{session_id}/signals", json={"signal": "copy"}
    )
    assert closed_signal.status_code == 409
    assert client.post(f"/v1/sessions/{session_id}/close").status_code == 409
