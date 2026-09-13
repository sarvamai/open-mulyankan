"""`/sources`: upload, extraction, and what the surface refuses to say.

Extraction runs as a background task, so these tests poll for a settled
status exactly as the client does. Asserting straight after POST would be
asserting on a race.
"""

import time

import pymupdf
import pytest
from fastapi.testclient import TestClient

from mulyankan_platform.core_api.main import create_app_from_mapping

CONFIG = {
    "providers": {
        "extraction": {"provider": "mulyankan_provider_pymupdf:PyMuPdfExtraction"}
    }
}

FORM = {
    "kind": "textbook",
    "name": "Science",
    "subject": "Science",
    "class_level": "10",
    "meta": "English",
}


def _pdf(pages: int = 2, *, blank_last: bool = False) -> bytes:
    """A small PDF with text on every page but, optionally, the last.

    The text is non-ASCII so the extraction and storage path is proved to be
    Unicode-clean, but it stays inside Latin-1: PyMuPDF's built-in base-14
    fonts carry no Devanagari glyphs, so a Devanagari fixture would test the
    font rather than the pipeline.
    """
    document = pymupdf.open()
    for index in range(pages):
        page = document.new_page()
        if blank_last and index == pages - 1:
            continue
        page.insert_text(
            (72, 96), f"évaluation page {index + 1}", fontsize=14, fontname="helv"
        )
    data = document.tobytes()
    document.close()
    return data


@pytest.fixture()
def client(tmp_path) -> TestClient:
    app = create_app_from_mapping(CONFIG, workspace=str(tmp_path / "workspace"))
    with TestClient(app) as running:
        yield running


def _upload(client: TestClient, document: bytes | None = None, **overrides) -> dict:
    response = client.post(
        "/sources",
        files={"file": ("book.pdf", document or _pdf(), "application/pdf")},
        data={**FORM, **overrides},
    )
    assert response.status_code == 202, response.text
    return response.json()


def _settled(client: TestClient, source_id: str, timeout: float = 10.0) -> dict:
    """Poll until the job reaches a terminal status, as the client does."""
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        source = client.get(f"/sources/{source_id}").json()
        if source["status"] != "processing":
            return source
        time.sleep(0.02)
    raise AssertionError(f"source {source_id} never settled: {source}")


def _upload_and_settle(
    client: TestClient, document: bytes | None = None, **overrides
) -> dict:
    return _settled(client, _upload(client, document, **overrides)["id"])


def test_upload_extracts_text_images_and_a_cover(client: TestClient) -> None:
    source = _upload_and_settle(client)

    assert source["status"] == "ready"
    assert source["pageCount"] == 2
    assert source["pagesWithText"] == 2
    assert source["pagesWithoutText"] == 0
    assert source["characterCount"] > 0
    assert source["hasCover"] is True
    assert [stage["id"] for stage in source["stages"]] == ["read", "pages", "cover"]
    assert all(stage["state"] == "completed" for stage in source["stages"])


def test_page_text_round_trips_non_ascii(client: TestClient) -> None:
    created = _upload(client)
    _settled(client, created["id"])
    page = client.get(f"/sources/{created['id']}/pages/1").json()

    assert "évaluation" in page["text"]
    assert page["hasTextLayer"] is True
    assert page["characterCount"] == len(page["text"])


def test_a_page_with_no_text_layer_is_counted_not_hidden(client: TestClient) -> None:
    created = _upload(client, _pdf(3, blank_last=True))
    source = _settled(client, created["id"])

    assert source["pageCount"] == 3
    assert source["pagesWithText"] == 2
    # The page still extracted — it is reported as needing OCR, not dropped.
    assert source["pagesWithoutText"] == 1
    assert source["status"] == "ready"
    assert (
        client.get(f"/sources/{created['id']}/pages/3").json()["hasTextLayer"] is False
    )


def test_cover_is_a_small_lossy_jpeg(client: TestClient) -> None:
    created = _upload(client)
    _settled(client, created["id"])
    response = client.get(f"/sources/{created['id']}/cover")

    assert response.status_code == 200
    assert response.headers["content-type"] == "image/jpeg"
    assert response.content.startswith(b"\xff\xd8\xff")
    # A thumbnail, not the page: an A4 page at source resolution is megabytes.
    assert len(response.content) < 200_000


def test_list_never_carries_extracted_text(client: TestClient) -> None:
    _upload_and_settle(client)
    body = client.get("/sources").text

    assert "évaluation" not in body
    assert "text" not in client.get("/sources").json()[0]


def test_chapter_count_is_null_when_the_pdf_declares_no_outline(
    client: TestClient,
) -> None:
    # None, not 0: this slice reads a document's own table of contents and
    # infers nothing when there is none.
    assert _upload_and_settle(client)["chapterCount"] is None


def test_outline_is_read_when_the_pdf_has_one(client: TestClient) -> None:
    document = pymupdf.open()
    for index in range(3):
        document.new_page().insert_text((72, 96), f"p{index}", fontname="helv")
    document.set_toc([[1, "Chapter One", 1], [1, "Chapter Two", 3]])
    data = document.tobytes()
    document.close()

    assert _upload_and_settle(client, data)["chapterCount"] == 2


def test_non_pdf_upload_is_refused(client: TestClient) -> None:
    response = client.post(
        "/sources",
        files={"file": ("book.pdf", b"GIF89a not a pdf", "application/pdf")},
        data=FORM,
    )
    assert response.status_code == 422
    assert "PDF" in response.json()["detail"]


def test_oversized_upload_is_refused_by_the_server(tmp_path) -> None:
    app = create_app_from_mapping(
        CONFIG, workspace=str(tmp_path / "workspace"), max_upload_mb=0
    )
    with TestClient(app) as client:
        response = client.post(
            "/sources",
            files={"file": ("book.pdf", _pdf(), "application/pdf")},
            data=FORM,
        )
    assert response.status_code == 413


def test_upload_is_refused_when_no_extraction_provider_is_bound(tmp_path) -> None:
    app = create_app_from_mapping({}, workspace=str(tmp_path / "workspace"))
    with TestClient(app) as client:
        response = client.post(
            "/sources",
            files={"file": ("book.pdf", _pdf(), "application/pdf")},
            data=FORM,
        )
    # An unbound capability is refused at call time (ADR-0003, rule 1).
    assert response.status_code == 503
    assert "extraction" in response.json()["detail"]


def test_unreadable_pdf_fails_the_job_without_quoting_the_document(
    client: TestClient,
) -> None:
    response = client.post(
        "/sources",
        files={"file": ("book.pdf", b"%PDF-1.7 truncated", "application/pdf")},
        data=FORM,
    )
    assert response.status_code == 202
    source = _settled(client, response.json()["id"])

    assert source["status"] == "failed"
    assert "truncated" not in source["error"]
    assert source["stages"][0]["state"] == "failed"


def test_rename_and_delete(client: TestClient) -> None:
    created = _upload_and_settle(client)
    renamed = client.patch(f"/sources/{created['id']}", json={"name": "Physics"})
    assert renamed.json()["name"] == "Physics"

    assert client.delete(f"/sources/{created['id']}").status_code == 204
    assert client.get(f"/sources/{created['id']}").status_code == 404
    assert client.get("/sources").json() == []


def test_rename_of_an_unknown_source_is_a_404(client: TestClient) -> None:
    response = client.patch("/sources/deadbeef", json={"name": "Physics"})

    assert response.status_code == 404


def test_deleting_a_queued_source_does_not_zombie_the_directory(
    client, tmp_path
) -> None:
    """A delete racing the job must not resurrect the source's directory.

    The job is queued when POST returns; deleting before it runs used to
    leave the pipeline recreating the directory and writing artefacts for a
    record that no longer exists. The workspace must end clean.
    """
    created = _upload(client)
    source_id = created["id"]

    assert client.delete(f"/sources/{source_id}").status_code == 204

    # Wait for the queued job itself to finish (the 404-ing source cannot be
    # polled), then the workspace must hold nothing for it.
    jobs = client.app.state.jobs
    deadline = time.monotonic() + 10
    while jobs and time.monotonic() < deadline:
        time.sleep(0.02)
    assert not jobs, "extraction job never finished"

    workspace = tmp_path / "workspace"
    leftovers = [path for path in workspace.rglob("*") if source_id in path.parts]
    assert leftovers == [], f"deleted source left artefacts: {leftovers}"


def test_healthz_still_reports_the_binding(client: TestClient) -> None:
    body = client.get("/healthz").json()
    descriptor = body["providers"]["extraction"]["descriptor"]

    assert descriptor["name"] == "extraction-pymupdf"
    assert descriptor["deterministic"] is True


def test_readable_pages_are_not_flagged(client: TestClient) -> None:
    source = _upload_and_settle(client)

    assert source["pagesWithUnusableText"] == 0
    assert source["pagesNeedingOcr"] == 0


def test_no_extracted_text_or_filename_reaches_the_logs(
    client: TestClient, caplog
) -> None:
    """The daily consequence of invariant 3, checked rather than trusted.

    Source material is Restricted (DAT-01): a log line may carry the opaque
    id and counts, never the text, and not the uploaded filename either.
    """
    with caplog.at_level("INFO", logger="mulyankan_platform"):
        _upload_and_settle(client)

    emitted = "\n".join(record.getMessage() for record in caplog.records)

    assert "évaluation" not in emitted
    assert "book.pdf" not in emitted
    # It did log — otherwise this test passes by saying nothing at all.
    assert "source registered" in emitted
    assert "extraction complete" in emitted
