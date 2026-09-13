"""Layer 1 core-api entrypoint: assembly only.

The health surface reports the provider bindings the registry resolved — the
smallest honest demonstration of the platform + provider architecture
(ADR-0003). The domain surfaces live beside this file:

    routers/sessions.py   /v1/sessions…, /v1/integrity/sessions (ASR02-OBS-01)
    routers/sources.py    /sources — upload and deterministic extraction

Nothing here touches the authoring lifecycle — a source has no versions, no
review, and no seal — so the state machine still arrives with M1.

Identity validation arrives with the identity SPI (ADR-0004); until then
callers present a pseudonymous actor identifier and **nothing authenticates
these routes**. See "Known limitations" in `SECURITY.md`: this is a
development surface until that slice lands.

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

import yaml
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from mulyankan_platform.audit import AuditLog
from mulyankan_platform.core_api.routers.sessions import (
    register_exception_handlers,
)
from mulyankan_platform.core_api.routers.sessions import (
    register_routes as register_session_routes,
)
from mulyankan_platform.core_api.routers.sources import router as sources_router
from mulyankan_platform.registry import ProviderRegistry
from mulyankan_platform.sessions import SWEEP_INTERVAL, SessionMonitor
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

    register_session_routes(app, monitor)
    app.include_router(sources_router, prefix="/sources")
    register_exception_handlers(app)

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
