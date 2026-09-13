"""`/sources` — upload source material and read what extraction found.

Upload is job-shaped even though PyMuPDF returns in about a second: POST
registers the source and returns immediately, and the client polls until the
status settles. The shape is the point — when the `ocr` SPI lands, a scanned
book takes minutes, and nothing here or in the client changes.

Extracted text is Restricted source material (DAT-01). It leaves only through
`GET /sources/{id}/pages/{page}`, never in a list response, a log line, or an
error message, and every path addresses a source by an opaque id rather than
by its filename (DAT-03).

This app is an untrusted client (ADR-0008): every check the browser makes is
repeated here.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

from mulyankan_platform.ingestion.pipeline import run_extraction
from mulyankan_platform.registry import RegistryError
from mulyankan_platform.sources.models import Source
from mulyankan_platform.sources.store import SourceStore
from mulyankan_spi.extraction import ExtractionProvider

logger = logging.getLogger(__name__)

router = APIRouter(tags=["sources"])

#: A PDF must start with this. Checked here because the browser's `accept`
#: filter and the file extension are both client claims.
_PDF_MAGIC = b"%PDF-"

_READ_CHUNK = 1 << 20


class _Camel(BaseModel):
    """Responses speak camelCase; the client maps them field for field."""

    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class StageView(_Camel):
    id: str
    label: str
    state: Literal["running", "completed", "failed"]
    started_at: datetime
    ended_at: datetime | None = None
    duration_ms: int | None = None


class SourceView(_Camel):
    id: str
    kind: Literal["textbook", "paper"]
    name: str
    subject: str
    class_level: int
    meta: str
    created_at: datetime
    status: Literal["processing", "ready", "failed"]
    page_count: int
    #: None when the document declares no table of contents — not zero, which
    #: would claim the document has none.
    chapter_count: int | None
    character_count: int
    image_count: int
    pages_with_text: int
    #: Pages with no text layer at all.
    pages_without_text: int
    #: Pages whose text layer decodes to unmappable glyphs — extractable
    #: characters that mean nothing, from fonts with no ToUnicode CMap.
    pages_with_unusable_text: int
    #: The two above together: what the `ocr` SPI will be given.
    pages_needing_ocr: int
    has_cover: bool
    error: str | None
    stages: list[StageView]


class PageImageView(_Camel):
    index: int
    url: str


class PageView(_Camel):
    page: int
    text: str
    character_count: int
    has_text_layer: bool
    images: list[PageImageView]


class RenameRequest(_Camel):
    name: str = Field(min_length=1, max_length=200)


def _view(source: Source, *, has_cover: bool) -> SourceView:
    summary = source.summary
    return SourceView(
        id=source.id,
        kind=source.kind,
        name=source.name,
        subject=source.subject,
        class_level=source.class_level,
        meta=source.meta,
        created_at=source.created_at,
        status=source.status,
        page_count=summary.page_count,
        chapter_count=summary.chapter_count,
        character_count=summary.character_count,
        image_count=summary.image_count,
        pages_with_text=summary.pages_with_text,
        pages_without_text=summary.pages_without_text,
        pages_with_unusable_text=summary.pages_with_unusable_text,
        pages_needing_ocr=summary.pages_needing_ocr,
        has_cover=has_cover,
        error=source.error,
        stages=[
            StageView(
                id=stage.id,
                label=stage.label,
                state=stage.state,
                started_at=stage.started_at,
                ended_at=stage.ended_at,
                duration_ms=stage.duration_ms,
            )
            for stage in source.stages
        ],
    )


def _store(request: Request) -> SourceStore:
    return request.app.state.source_store


def _require(request: Request, source_id: str) -> Source:
    source = _store(request).get(source_id)
    if source is None:
        raise HTTPException(status_code=404, detail="No such source")
    return source


def _rendered(request: Request, source: Source) -> SourceView:
    return _view(source, has_cover=_store(request).cover_path(source.id).is_file())


async def _read_upload(file: UploadFile, limit: int) -> bytes:
    """Read at most `limit` bytes, refusing anything larger."""
    chunks: list[bytes] = []
    total = 0
    while chunk := await file.read(_READ_CHUNK):
        total += len(chunk)
        if total > limit:
            raise HTTPException(
                status_code=413,
                detail=f"File is larger than the {limit // (1 << 20)} MB limit",
            )
        chunks.append(chunk)
    return b"".join(chunks)


@router.post("", response_model=SourceView, status_code=202)
async def upload_source(
    request: Request,
    file: UploadFile,
    kind: Annotated[Literal["textbook", "paper"], Form()],
    name: Annotated[str, Form(min_length=1, max_length=200)],
    subject: Annotated[str, Form(min_length=1, max_length=100)],
    class_level: Annotated[int, Form(ge=1, le=12)],
    meta: Annotated[str, Form(max_length=100)] = "",
) -> SourceView:
    """Register a document and start extracting it. Returns before it finishes."""
    try:
        provider = request.app.state.registry.get_typed(
            "extraction", ExtractionProvider
        )
    except RegistryError as exc:
        # An unbound capability is refused at call time (ADR-0003, rule 1).
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    document = await _read_upload(file, request.app.state.max_upload_bytes)
    if not document:
        raise HTTPException(status_code=422, detail="File is empty")
    if not document.startswith(_PDF_MAGIC):
        raise HTTPException(status_code=422, detail="Only PDF files are accepted")

    store = _store(request)
    source = store.create(
        kind=kind,
        name=name.strip(),
        subject=subject.strip(),
        class_level=class_level,
        meta=meta.strip(),
        filename=file.filename or "",
        document=document,
    )
    logger.info(
        "source registered id=%s kind=%s bytes=%d", source.id, kind, len(document)
    )

    # Held on the app so the task is not garbage-collected mid-run.
    task = asyncio.create_task(run_extraction(source, store, provider))
    request.app.state.jobs.add(task)
    task.add_done_callback(request.app.state.jobs.discard)

    return _rendered(request, source)


@router.get("", response_model=list[SourceView])
def list_sources(request: Request) -> list[SourceView]:
    """Every source, newest first. Counts only — no extracted text."""
    return [_rendered(request, source) for source in _store(request).list()]


@router.get("/{source_id}", response_model=SourceView)
def get_source(request: Request, source_id: str) -> SourceView:
    """One source, including the stages its job has run so far."""
    return _rendered(request, _require(request, source_id))


@router.patch("/{source_id}", response_model=SourceView)
def rename_source(request: Request, source_id: str, body: RenameRequest) -> SourceView:
    """Rename a source. Extraction output is untouched."""
    source = _store(request).rename(source_id, body.name.strip())
    if source is None:
        raise HTTPException(status_code=404, detail="No such source")
    return _rendered(request, source)


@router.delete("/{source_id}", status_code=204)
def delete_source(request: Request, source_id: str) -> Response:
    """Remove a source and every artefact extracted from it."""
    _require(request, source_id)
    _store(request).delete(source_id)
    logger.info("source deleted id=%s", source_id)
    return Response(status_code=204)


@router.get("/{source_id}/cover")
def get_cover(request: Request, source_id: str) -> FileResponse:
    """The first page as a small, lossy JPEG — a card thumbnail, not the page."""
    source = _require(request, source_id)
    path = _store(request).cover_path(source_id)
    if not path.is_file():
        raise HTTPException(status_code=404, detail="No cover has been rendered")
    return FileResponse(
        path,
        media_type=source.cover_media_type or "image/jpeg",
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.get("/{source_id}/pages/{page}", response_model=PageView)
def get_page(request: Request, source_id: str, page: int) -> PageView:
    """The extracted text of one page, and links to its embedded images.

    The only route that returns source text. Pages are 1-based.
    """
    _require(request, source_id)
    store = _store(request)
    path = store.text_path(source_id, page)
    if page < 1 or not path.is_file():
        raise HTTPException(status_code=404, detail="No such page")
    text = path.read_text(encoding="utf-8")
    images = [
        PageImageView(
            index=int(image.stem.split("-")[1]),
            url=f"/sources/{source_id}/pages/{page}/images/{int(image.stem.split('-')[1])}",
        )
        for image in store.image_paths(source_id, page)
    ]
    return PageView(
        page=page,
        text=text,
        character_count=len(text),
        has_text_layer=bool(text.strip()),
        images=images,
    )


@router.get("/{source_id}/pages/{page}/images/{index}")
def get_page_image(
    request: Request, source_id: str, page: int, index: int
) -> FileResponse:
    """One image embedded in a page, in the encoding the document used."""
    _require(request, source_id)
    for path in _store(request).image_paths(source_id, page):
        if path.stem.endswith(f"-{index:03d}"):
            return FileResponse(path)
    raise HTTPException(status_code=404, detail="No such image")
