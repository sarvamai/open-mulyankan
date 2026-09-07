"""Layer 1 core-api entrypoint.

M0 exposes only the health surface, which reports the provider bindings the
registry resolved — the smallest honest demonstration of the platform +
provider architecture (ADR-0003). Domain surfaces arrive with M1.
"""

from __future__ import annotations

import logging
import os

import yaml
from fastapi import FastAPI

from mulyankan_platform.registry import ProviderRegistry

logger = logging.getLogger(__name__)

DEFAULT_CONFIG_PATH = os.environ.get("MULYANKAN_PLATFORM_CONFIG", "platform.yaml")


def build_app(registry: ProviderRegistry) -> FastAPI:
    """Build the FastAPI application around a resolved registry."""
    app = FastAPI(
        title="open-mulyankan core-api",
        version="0.1.0",
        description="Layer 1 workflow core of the Content Authoring Engine",
    )
    app.state.registry = registry

    @app.get("/healthz")
    def healthz() -> dict:
        """Liveness plus the resolved provider bindings (content-free)."""
        return {"status": "ok", "providers": registry.describe()}

    return app


def create_app_from_mapping(config: dict) -> FastAPI:
    """Build the app from an already-parsed configuration mapping."""
    return build_app(ProviderRegistry.from_mapping(config))


def create_app(config_path: str = DEFAULT_CONFIG_PATH) -> FastAPI:
    """Build the app from a `platform.yaml` file."""
    with open(config_path, encoding="utf-8") as handle:
        config = yaml.safe_load(handle) or {}
    return create_app_from_mapping(config)


def _default_app() -> FastAPI:
    if not os.path.exists(DEFAULT_CONFIG_PATH):
        logger.warning(
            "platform config %s not found; starting with no provider bindings",
            DEFAULT_CONFIG_PATH,
        )
        return create_app_from_mapping({})
    return create_app(DEFAULT_CONFIG_PATH)


app = _default_app()
