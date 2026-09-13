"""Ingestion: the deterministic pipeline that turns an upload into artefacts."""

from mulyankan_platform.ingestion.pipeline import (
    COVER_MAX_EDGE,
    COVER_QUALITY,
    ExtractionFailed,
    run_extraction,
)

__all__ = ["COVER_MAX_EDGE", "COVER_QUALITY", "ExtractionFailed", "run_extraction"]
