"""Layer 1 core-api entrypoint.

The health surface reports the provider bindings the registry resolved — the
smallest honest demonstration of the platform + provider architecture
(ADR-0003). The session-monitoring surface (ASR02-OBS-01) is the first domain
surface: register, 30-second heartbeat, close, client-reported signals, and
the Integrity Operator's content-free JSON view, which is a pure read — gap
signals are committed by the lifespan sweeper, never by a request.

M0 also carries `/sources`: uploading source material and reading what
deterministic extraction found in it. Nothing there touches the authoring
lifecycle — a source has no versions, no review, and no seal — so the state
machine still arrives with M1.

Identity validation arrives with the identity SPI (ADR-0004); until then
callers present a pseudonymous actor identifier and **nothing authenticates
these routes**. The `session_id` is the only bearer, and the operator view
publishes it, so anyone who can reach this surface can close another actor's
session or forge signals onto an append-only chain. See "Known limitations" in
`SECURITY.md`: this is a development surface until that slice lands.

Configuration, all optional:

    MULYANKAN_PLATFORM_CONFIG   provider bindings      (default platform.yaml)
    MULYANKAN_WORKSPACE         artefact directory     (default var/workspace)
    MULYANKAN_MAX_UPLOAD_MB     upload ceiling         (default 64)
    MULYANKAN_CORS_ORIGINS      comma-separated allow-list
                                (default http://localhost:3000)
    MULYANKAN_LOG_LEVEL         this package's log level (default INFO)
"""

from __future__ import annotations

import asyncio
import contextlib
import logging
import os
from collections.abc import AsyncIterator
from pathlib import Path
from typing import Literal

import yaml
from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from starlette.concurrency import run_in_threadpool

from mulyankan_platform.audit import AuditLog
from mulyankan_platform.core_api.routers.sources import router as sources_router
from mulyankan_platform.registry import ProviderRegistry
from mulyankan_platform.sessions import (
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    SWEEP_INTERVAL,
    SessionClosedError,
    SessionMonitor,
    UnknownSessionError,
)
from mulyankan_platform.sources.store import SourceStore

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = os.environ.get("MULYANKAN_PLATFORM_CONFIG", "platform.yaml")
DEFAULT_WORKSPACE = os.environ.get("MULYANKAN_WORKSPACE", "var/workspace")
DEFAULT_MAX_UPLOAD_MB = int(os.environ.get("MULYANKAN_MAX_UPLOAD_MB", "64"))
# The web app runs on a different origin in development. The allow-list is
# explicit: a wildcard would let any page on the machine call this API.
DEFAULT_CORS_ORIGINS = os.environ.get("MULYANKAN_CORS_ORIGINS", "http://localhost:3000")


def configure_logging() -> None:
    """Make this package's own log records visible under uvicorn.

    Without this, `logger.info` in the platform goes nowhere: uvicorn
    configures only its own loggers, and the root logger defaults to WARNING.
    Only `mulyankan_platform` is touched — the root logger stays the
    deployer's to configure — and an existing handler is left alone so a host
    that has already set logging up wins.
    """
    package = logging.getLogger("mulyankan_platform")
    package.setLevel(os.environ.get("MULYANKAN_LOG_LEVEL", "INFO").upper())
    if not package.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(
            logging.Formatter("%(levelname)s:     %(name)s - %(message)s")
        )
        package.addHandler(handler)
        # The handler above is the only one that should print these records.
        package.propagate = False


class RegisterSessionRequest(BaseModel):
    """Body of `POST /v1/sessions`; extra fields are refused, not ignored."""

    model_config = ConfigDict(extra="forbid")

    actor: str = Field(min_length=1, max_length=128)


class SignalReportRequest(BaseModel):
    """Body of `POST /v1/sessions/{id}/signals`; the gap is server-detected only."""

    model_config = ConfigDict(extra="forbid")

    signal: Literal["copy", "cut", "paste"]


async def _sweep_forever(monitor: SessionMonitor) -> None:
    """Drive the monitor's single writer; gap signals are committed only here.

    One sweeper per process. `sweep` is idempotent per silence episode, so a
    slow run overlapping the next tick cannot double-deduct, and a failure must
    never kill the loop — a monitor that silently stopped watching is worse
    than one that logged an error and carried on.
    """
    interval = SWEEP_INTERVAL.total_seconds()
    while True:
        await asyncio.sleep(interval)
        try:
            await run_in_threadpool(monitor.sweep)
        except Exception:  # the loop must outlive any single failure
            logger.exception("session sweep failed; continuing")


def build_app(
    registry: ProviderRegistry,
    *,
    workspace: str = DEFAULT_WORKSPACE,
    max_upload_mb: int = DEFAULT_MAX_UPLOAD_MB,
    cors_origins: str = DEFAULT_CORS_ORIGINS,
) -> FastAPI:
    """Build the FastAPI application around a resolved registry."""
    audit_log = AuditLog()
    monitor = SessionMonitor(audit_log)

    @contextlib.asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        sweeper = asyncio.create_task(_sweep_forever(monitor))
        try:
            yield
        finally:
            sweeper.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await sweeper

    app = FastAPI(
        lifespan=lifespan,
        title="open-mulyankan core-api",
        version="0.1.0",
        description="Layer 1 workflow core of the Content Authoring Engine",
    )
    app.state.registry = registry
    app.state.audit_log = audit_log
    app.state.sessions = monitor
    app.state.source_store = SourceStore(Path(workspace))
    app.state.max_upload_bytes = max_upload_mb * (1 << 20)
    #: Strong references to in-flight extraction jobs; see the sources router.
    app.state.jobs = set()

    origins = [origin.strip() for origin in cors_origins.split(",") if origin.strip()]
    if origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "PATCH", "DELETE"],
            allow_headers=["*"],
        )

    @app.get("/healthz")
    def healthz() -> dict:
        """Liveness plus the resolved provider bindings (content-free)."""
        return {"status": "ok", "providers": registry.describe()}

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

    app.include_router(sources_router, prefix="/sources")

    @app.exception_handler(UnknownSessionError)
    def unknown_session(request: Request, exc: UnknownSessionError) -> JSONResponse:
        """Refuse unknown sessions without echoing the identifier."""
        return JSONResponse(status_code=404, content={"detail": "unknown session"})

    @app.exception_handler(SessionClosedError)
    def closed_session(request: Request, exc: SessionClosedError) -> JSONResponse:
        """A closed session accepts no further writes."""
        return JSONResponse(status_code=409, content={"detail": "session is closed"})

    return app


def create_app_from_mapping(config: dict, **kwargs) -> FastAPI:
    """Build the app from an already-parsed configuration mapping."""
    return build_app(ProviderRegistry.from_mapping(config), **kwargs)


def create_app(config_path: str = DEFAULT_CONFIG_PATH, **kwargs) -> FastAPI:
    """Build the app from a `platform.yaml` file."""
    with open(config_path, encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}
    return create_app_from_mapping(config, **kwargs)


def _default_app() -> FastAPI:
    configure_logging()
    if not os.path.exists(DEFAULT_CONFIG_PATH):
        logger.warning(
            "platform config %s not found; starting with no provider bindings",
            DEFAULT_CONFIG_PATH,
        )
        return create_app_from_mapping({})
    return create_app(DEFAULT_CONFIG_PATH)


app = _default_app()
