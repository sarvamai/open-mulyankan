"""The extraction pipeline: three stages over one uploaded document.

    Reading document → Extracting pages → Rendering cover

One pass, one open session. Text and images come out of the same
`extract_page` call, so they are one stage rather than two — splitting the
label would mean either a second pass or a stage that reports a duration it
did not spend.

Every stage is blocking CPU work and runs in a worker thread; the record is
mutated only on the event loop, so a reader polling the job never sees a
half-written stage.

The pipeline decides which pages have a text layer and which do not. That
decision is the platform's, not a provider's: it is what will route pages to
the `ocr` SPI when that slice lands, and it is taken **per page** rather than
per document, so a book with thirty scanned plates among three hundred
digital pages reports thirty pages needing OCR instead of being misread as
one kind of document.

Nothing here logs extracted text (DAT-03).
"""

from __future__ import annotations

import asyncio
import logging
import mimetypes
from datetime import datetime, timezone
from pathlib import Path

from mulyankan_spi.extraction import ExtractionProvider, UnreadableDocument

from mulyankan_platform.sources.models import ExtractionSummary, Source, StageRun
from mulyankan_platform.sources.store import SourceStore

logger = logging.getLogger(__name__)

#: Longest edge of the stored cover, in pixels, and its JPEG quality. A cover
#: is a thumbnail on a card — never a reproduction of the page — so it is
#: rendered small and lossy on purpose. At these values a typical A4 page
#: costs ~30 kB against ~1.5 MB for a full-resolution PNG.
COVER_MAX_EDGE = 512
COVER_QUALITY = 72


#: A PDF whose fonts declare no ToUnicode CMap still yields characters — they
#: are just the font's own glyph indices, landing in the dingbat and
#: private-use blocks. The text extracts and means nothing, so it is detected
#: and counted rather than reported as readable. Deterministic, and a
#: platform decision rather than a provider's: it is what routes a page to
#: the `ocr` SPI, exactly like a page with no text layer at all.
_UNMAPPABLE_RANGES = ((0x2700, 0x27BF), (0xE000, 0xF8FF))
_UNUSABLE_SHARE = 0.15


def text_is_usable(text: str) -> bool:
    """False when the text layer decodes mostly to unmappable glyphs."""
    meaningful = [character for character in text if not character.isspace()]
    if not meaningful:
        return False
    unmappable = sum(
        1
        for character in meaningful
        if character == "\ufffd"
        or any(low <= ord(character) <= high for low, high in _UNMAPPABLE_RANGES)
    )
    return unmappable / len(meaningful) <= _UNUSABLE_SHARE


class ExtractionFailed(Exception):
    """A stage failed. The message is content-free and safe to show."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _finish(run: StageRun, state: str) -> None:
    run.state = state  # type: ignore[assignment]
    run.ended_at = _now()


def _extension_for(media_type: str) -> str:
    return mimetypes.guess_extension(media_type) or ".bin"


def _write_pages(
    session, store: SourceStore, source_id: str, page_count: int
) -> ExtractionSummary:
    """Read every page once, writing text and images. Runs in a thread."""
    text_dir = store.directory(source_id) / "text"
    image_dir = store.image_dir(source_id)
    text_dir.mkdir(parents=True, exist_ok=True)
    image_dir.mkdir(parents=True, exist_ok=True)

    pages_with_text = 0
    pages_with_unusable_text = 0
    character_count = 0
    image_count = 0

    for page in range(1, page_count + 1):
        extraction = session.extract_page(page)
        store.text_path(source_id, page).write_text(extraction.text, encoding="utf-8")
        if extraction.has_text_layer:
            pages_with_text += 1
            if not text_is_usable(extraction.text):
                pages_with_unusable_text += 1
        character_count += extraction.character_count
        for image in extraction.images:
            suffix = _extension_for(image.media_type)
            name = f"{page:05d}-{image.index:03d}{suffix}"
            (image_dir / name).write_bytes(image.data)
            image_count += 1

    return ExtractionSummary(
        page_count=page_count,
        pages_with_text=pages_with_text,
        pages_without_text=page_count - pages_with_text,
        pages_with_unusable_text=pages_with_unusable_text,
        character_count=character_count,
        image_count=image_count,
    )


async def run_extraction(
    source: Source, store: SourceStore, provider: ExtractionProvider
) -> None:
    """Run the pipeline for `source`, updating it in place as stages finish."""
    document_path: Path = store.document_path(source.id)
    session = None
    try:
        document = await asyncio.to_thread(document_path.read_bytes)

        stage = source.begin_stage("read", "Reading document", now=_now())
        try:
            session = await asyncio.to_thread(provider.open, document)
            info = await asyncio.to_thread(session.info)
        except UnreadableDocument as exc:
            _finish(stage, "failed")
            raise ExtractionFailed(str(exc)) from exc
        source.summary = ExtractionSummary(
            page_count=info.page_count, outline=info.outline
        )
        _finish(stage, "completed")

        stage = source.begin_stage("pages", "Extracting pages", now=_now())
        try:
            summary = await asyncio.to_thread(
                _write_pages, session, store, source.id, info.page_count
            )
        except Exception as exc:
            _finish(stage, "failed")
            raise ExtractionFailed(
                f"page extraction failed: {type(exc).__name__}"
            ) from exc
        # The outline came from the previous stage; carry it forward.
        summary.outline = info.outline
        source.summary = summary
        _finish(stage, "completed")

        stage = source.begin_stage("cover", "Rendering cover", now=_now())
        try:
            thumbnail = await asyncio.to_thread(
                lambda: session.render_thumbnail(
                    1, max_edge=COVER_MAX_EDGE, quality=COVER_QUALITY
                )
            )
            await asyncio.to_thread(
                store.cover_path(source.id).write_bytes, thumbnail.data
            )
        except Exception as exc:
            _finish(stage, "failed")
            raise ExtractionFailed(
                f"cover rendering failed: {type(exc).__name__}"
            ) from exc
        source.cover_media_type = thumbnail.media_type
        _finish(stage, "completed")

        source.status = "ready"
        logger.info(
            "extraction complete source=%s pages=%d with_text=%d "
            "needing_ocr=%d images=%d",
            source.id,
            source.summary.page_count,
            source.summary.pages_with_text,
            source.summary.pages_needing_ocr,
            source.summary.image_count,
        )
    except ExtractionFailed as exc:
        source.status = "failed"
        source.error = str(exc)
        logger.warning("extraction failed source=%s reason=%s", source.id, exc)
    except Exception as exc:
        source.status = "failed"
        source.error = f"unexpected {type(exc).__name__}"
        logger.exception("extraction crashed source=%s", source.id)
    finally:
        if session is not None:
            await asyncio.to_thread(session.close)
