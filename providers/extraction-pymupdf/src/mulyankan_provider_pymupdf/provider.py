"""PyMuPDF implementation of the `extraction` SPI.

Reads only what the PDF already carries: the text layer, embedded raster
images, and the document's own outline. A scanned page has no text layer, so
this provider returns an empty string for it and reports `has_text_layer`
False — it never recognises characters. Routing such a page to OCR is the
pipeline's decision, made against the `ocr` SPI.

Deterministic: the same bytes give the same text, the same images in the same
order, and byte-identical thumbnails.

Nothing here logs page text, and `UnreadableDocument` messages name only the
failure — source material is Restricted (DAT-01, DAT-03).
"""

from __future__ import annotations

from types import TracebackType
from typing import Self

import pymupdf

from mulyankan_spi.descriptor import ProviderDescriptor
from mulyankan_spi.extraction import (
    DocumentInfo,
    ExtractedImage,
    OutlineEntry,
    PageExtraction,
    Thumbnail,
    UnreadableDocument,
)

_DEFAULT_MAX_EDGE = 512
_DEFAULT_QUALITY = 72

# PyMuPDF reports the encoding of an embedded image as a bare extension.
_MEDIA_TYPES = {
    "png": "image/png",
    "jpeg": "image/jpeg",
    "jpg": "image/jpeg",
    "jpx": "image/jp2",
    "jb2": "image/x-jb2",
    "bmp": "image/bmp",
    "gif": "image/gif",
    "tiff": "image/tiff",
    "webp": "image/webp",
}


def _media_type(extension: str) -> str:
    return _MEDIA_TYPES.get(extension.lower(), "application/octet-stream")


class PyMuPdfSession:
    """One open PDF. Not thread-safe; the pipeline opens a session per job."""

    def __init__(self, document: pymupdf.Document) -> None:
        self._document = document
        self._closed = False

    # ── lifecycle ─────────────────────────────────────────────────────────

    def close(self) -> None:
        if not self._closed:
            self._document.close()
            self._closed = True

    def __enter__(self) -> Self:
        return self

    def __exit__(
        self,
        exc_type: type[BaseException] | None,
        exc: BaseException | None,
        tb: TracebackType | None,
    ) -> None:
        self.close()

    def _page(self, page: int) -> pymupdf.Page:
        if self._closed:
            raise ValueError("session is closed")
        count = self._document.page_count
        if not 1 <= page <= count:
            raise IndexError(f"page {page} is outside 1..{count}")
        return self._document[page - 1]

    # ── contract ──────────────────────────────────────────────────────────

    def info(self) -> DocumentInfo:
        outline = tuple(
            OutlineEntry(level=level, title=title.strip(), start_page=start)
            for level, title, start in self._document.get_toc()
            # A TOC entry can point outside the page range in a malformed or
            # extracted-range PDF; such an entry describes nothing here.
            if 1 <= start <= self._document.page_count
        )
        return DocumentInfo(page_count=self._document.page_count, outline=outline)

    def extract_page(self, page: int) -> PageExtraction:
        target = self._page(page)
        text = target.get_text("text")

        images: list[ExtractedImage] = []
        seen: set[int] = set()
        for index, entry in enumerate(target.get_images(full=True)):
            xref = entry[0]
            # The same image placed twice on a page appears once per
            # placement; the bytes are identical, so it is stored once.
            if xref in seen:
                continue
            seen.add(xref)
            try:
                raw = self._document.extract_image(xref)
            except Exception:  # noqa: BLE001, S112 - one broken image is not
                # a broken page, and the exception cannot be logged: PyMuPDF
                # puts document detail in its messages (DAT-03).
                continue
            data = raw.get("image")
            if not data:
                continue
            images.append(
                ExtractedImage(
                    index=index,
                    width=int(raw.get("width", 0)),
                    height=int(raw.get("height", 0)),
                    media_type=_media_type(str(raw.get("ext", ""))),
                    data=data,
                )
            )

        return PageExtraction(page=page, text=text, images=tuple(images))

    def render_thumbnail(
        self,
        page: int,
        *,
        max_edge: int = _DEFAULT_MAX_EDGE,
        quality: int = _DEFAULT_QUALITY,
    ) -> Thumbnail:
        target = self._page(page)
        if max_edge < 1:
            raise ValueError("max_edge must be >= 1")
        if not 1 <= quality <= 100:
            raise ValueError("quality must be 1..100")

        rect = target.rect
        longest = max(rect.width, rect.height) or 1.0
        # Only ever downscale: a preview rendered above source resolution
        # costs bytes and adds nothing.
        scale = min(max_edge / longest, 1.0)
        pixmap = target.get_pixmap(matrix=pymupdf.Matrix(scale, scale), alpha=False)
        return Thumbnail(
            width=pixmap.width,
            height=pixmap.height,
            media_type="image/jpeg",
            data=pixmap.tobytes(output="jpeg", jpg_quality=quality),
        )


class PyMuPdfExtraction:
    """The `extraction` provider. Constructed by the registry from config."""

    def __init__(self, config: dict | None = None) -> None:
        self._config = config or {}

    def describe(self) -> ProviderDescriptor:
        return ProviderDescriptor(
            name="extraction-pymupdf",
            version="0.1.0",
            deterministic=True,
            data_handling=(
                "in-process; reads document bytes from memory, no network, "
                "no retention beyond the open session"
            ),
        )

    def open(self, document: bytes) -> PyMuPdfSession:
        if not document:
            raise UnreadableDocument("document is empty")
        try:
            opened = pymupdf.open(stream=document, filetype="pdf")
        except Exception as exc:
            raise UnreadableDocument(
                f"not a readable PDF: {type(exc).__name__}"
            ) from exc
        if opened.page_count < 1:
            opened.close()
            raise UnreadableDocument("PDF has no pages")
        if opened.needs_pass:
            opened.close()
            raise UnreadableDocument("PDF is password-protected")
        return PyMuPdfSession(opened)
