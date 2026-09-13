"""`/v1/sessions` — the session-monitoring surface (ASR02-OBS-01).

Register, 30-second heartbeat, close, client-reported signals, and the
Integrity Operator's content-free JSON view. The domain rules live in
`mulyankan_platform.sessions.monitor`; this router is the HTTP edge —
validate the body, call the monitor, map its errors to status codes.

Identity validation arrives with the identity SPI (ADR-0004); until then
**nothing authenticates these routes** and the `session_id` is the only
bearer. See "Known limitations" in `SECURITY.md`.
"""

from __future__ import annotations

from typing import Literal

from fastapi import Query, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field

from mulyankan_platform.sessions import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    SessionClosedError,
    SessionMonitor,
    UnknownSessionError,
)


class RegisterSessionRequest(BaseModel):
    """Body of `POST /v1/sessions`; extra fields are refused, not ignored."""

    model_config = ConfigDict(extra="forbid")

    actor: str = Field(min_length=1, max_length=128)


class SignalReportRequest(BaseModel):
    """Body of `POST /v1/sessions/{id}/signals`; the gap is server-detected only."""

    model_config = ConfigDict(extra="forbid")

    signal: Literal["copy", "cut", "paste"]


def register_routes(app, monitor: SessionMonitor) -> None:
    """Attach the session endpoints to `app` around `monitor`."""

    @app.post("/v1/sessions", status_code=201)
    def register_session(body: RegisterSessionRequest) -> dict:
        """Open a session (ASR02-OBS-01); identity validation lands with the SPI."""
        return monitor.register(body.actor).as_dict()

    @app.post("/v1/sessions/{session_id}/heartbeat")
    def heartbeat(session_id: str) -> dict:
        """Record liveness; re-arms heartbeat-gap detection for the session."""
        return monitor.heartbeat(session_id).as_dict()

    @app.post("/v1/sessions/{session_id}/close")
    def close_session(session_id: str) -> dict:
        """Close the session; the terminal state, reached only explicitly."""
        return monitor.close(session_id).as_dict()

    @app.post("/v1/sessions/{session_id}/signals", status_code=201)
    def report_signal(session_id: str, body: SignalReportRequest) -> dict:
        """Publish a client-reported signal; deducts the score, audits the event."""
        return monitor.report_signal(session_id, body.signal).as_dict()

    @app.get("/v1/integrity/sessions")
    def integrity_sessions(
        status: Literal["all", "active", "closed"] = "all",
        limit: int = Query(default=DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    ) -> dict:
        """The Integrity Operator's JSON list (ASR02-OBS-01); no content fields.

        A pure read: `silent` is derived from the clock, and gap signals are
        committed by the sweeper, so polling this never alters the evidence.
        """
        page = monitor.integrity_view(status=status, limit=limit)
        return {"sessions": [snapshot.as_dict() for snapshot in page]}


def register_exception_handlers(app) -> None:
    """Map domain errors to status codes at the edge, content-free."""

    @app.exception_handler(UnknownSessionError)
    def unknown_session(request: Request, exc: UnknownSessionError) -> JSONResponse:
        """Refuse unknown sessions without echoing the identifier."""
        return JSONResponse(status_code=404, content={"detail": "unknown session"})

    @app.exception_handler(SessionClosedError)
    def closed_session(request: Request, exc: SessionClosedError) -> JSONResponse:
        """A closed session accepts no further writes."""
        return JSONResponse(status_code=409, content={"detail": "session is closed"})
