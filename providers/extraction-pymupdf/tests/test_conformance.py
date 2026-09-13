"""The pymupdf extraction provider must pass the SPI's own suite.

The suite needs a document, and this provider's format is PDF, so the fixture
is built here with PyMuPDF itself — a two-page PDF carrying text on both
pages. Building it rather than committing a binary keeps the fixture readable
and its page count self-evident.
"""

import pymupdf
import pytest
from mulyankan_provider_pymupdf import PyMuPdfExtraction
from mulyankan_spi.conformance.extraction import run_extraction_conformance
from mulyankan_spi.extraction import ExtractionProvider, UnreadableDocument


@pytest.fixture(scope="module")
def pdf_bytes() -> bytes:
    document = pymupdf.open()
    # Latin-1 only: the built-in base-14 fonts have no Devanagari glyphs.
    for line in ("évaluation page one", "page two"):
        page = document.new_page()
        page.insert_text((72, 96), line, fontsize=14, fontname="helv")
    data = document.tobytes()
    document.close()
    return data


def test_provider_satisfies_the_protocol() -> None:
    assert isinstance(PyMuPdfExtraction({}), ExtractionProvider)


def test_extraction_conformance(pdf_bytes: bytes) -> None:
    failures = run_extraction_conformance(
        PyMuPdfExtraction({}), document=pdf_bytes, expected_page_count=2
    )
    assert failures == []


def test_unreadable_bytes_are_refused_without_quoting_them() -> None:
    with pytest.raises(UnreadableDocument) as caught:
        PyMuPdfExtraction({}).open(b"%PDF-1.4 truncated and broken")
    assert "truncated" not in str(caught.value)


def test_thumbnail_is_smaller_than_the_page_it_previews(pdf_bytes: bytes) -> None:
    with PyMuPdfExtraction({}).open(pdf_bytes) as session:
        small = session.render_thumbnail(1, max_edge=128, quality=60)
        large = session.render_thumbnail(1, max_edge=512, quality=95)
    assert max(small.width, small.height) == 128
    assert len(small.data) < len(large.data)
    assert small.media_type == "image/jpeg"


def test_extraction_is_byte_identical_across_sessions(pdf_bytes: bytes) -> None:
    provider = PyMuPdfExtraction({})
    with provider.open(pdf_bytes) as first, provider.open(pdf_bytes) as second:
        assert first.extract_page(1).text == second.extract_page(1).text
        assert (
            first.render_thumbnail(1, max_edge=128, quality=60).data
            == second.render_thumbnail(1, max_edge=128, quality=60).data
        )
