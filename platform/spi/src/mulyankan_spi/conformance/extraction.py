"""Conformance suite for the `extraction` SPI.

Checks the contract in `mulyankan_spi.extraction`: descriptor completeness,
1-based page addressing, determinism, outline sanity, thumbnail downscaling,
and that a session closes idempotently.

The suite cannot invent a document — formats are the provider's business — so
the caller supplies one. Dependency-free, so a provider author runs it without
installing the platform.
"""

from mulyankan_spi.descriptor import ProviderDescriptor
from mulyankan_spi.extraction import (
    DocumentInfo,
    ExtractionProvider,
    PageExtraction,
    Thumbnail,
)


def run_extraction_conformance(
    provider: ExtractionProvider,
    *,
    document: bytes,
    expected_page_count: int | None = None,
) -> list[str]:
    """Run the full suite against `provider`; returns failure messages.

    `document` must be a readable document of at least one page in a format
    the provider supports. `expected_page_count` is checked when given.
    """
    failures: list[str] = []

    descriptor = provider.describe()
    if not isinstance(descriptor, ProviderDescriptor):
        failures.append("describe() must return a ProviderDescriptor")
        return failures
    if not descriptor.name:
        failures.append("describe().name must be non-empty")
    if not descriptor.version:
        failures.append("describe().version must be non-empty")
    if not descriptor.data_handling:
        failures.append("describe().data_handling must be a non-empty declaration")
    if not descriptor.deterministic:
        failures.append("extraction providers must declare deterministic=True")

    try:
        session = provider.open(document)
    except Exception as exc:  # noqa: BLE001 - suite reports, never raises
        failures.append(f"open() raised on a readable document: {exc}")
        return failures

    try:
        info = session.info()
        if not isinstance(info, DocumentInfo):
            failures.append("info() must return a DocumentInfo")
            return failures
        if info.page_count < 1:
            failures.append(f"info().page_count must be >= 1, got {info.page_count}")
            return failures
        if expected_page_count is not None and info.page_count != expected_page_count:
            failures.append(
                f"info().page_count is {info.page_count}, "
                f"expected {expected_page_count}"
            )

        for entry in info.outline:
            if entry.level < 1:
                failures.append(f"outline level must be >= 1, got {entry.level}")
            if not 1 <= entry.start_page <= info.page_count:
                failures.append(
                    f"outline entry start_page {entry.start_page} is outside "
                    f"1..{info.page_count}"
                )

        first = session.extract_page(1)
        if not isinstance(first, PageExtraction):
            failures.append("extract_page() must return a PageExtraction")
            return failures
        if first.page != 1:
            failures.append(
                f"extract_page(1).page must be 1 (pages are 1-based), got {first.page}"
            )
        if first.character_count != len(first.text):
            failures.append("character_count must equal len(text)")
        if first.has_text_layer != bool(first.text.strip()):
            failures.append("has_text_layer must report whether text is non-blank")
        for image in first.images:
            if not image.data:
                failures.append(f"image {image.index} carries no bytes")
            if not image.media_type.startswith("image/"):
                failures.append(
                    f"image {image.index} media_type must be an image/* type, "
                    f"got {image.media_type!r}"
                )
            if image.width < 1 or image.height < 1:
                failures.append(f"image {image.index} must report real dimensions")

        again = session.extract_page(1)
        if again.text != first.text:
            failures.append("extract_page must be deterministic for the same page")
        if len(again.images) != len(first.images):
            failures.append("extract_page must return the same images each call")

        last = session.extract_page(info.page_count)
        if last.page != info.page_count:
            failures.append("extract_page(page).page must echo the page asked for")

        for out_of_range in (0, -1, info.page_count + 1):
            try:
                session.extract_page(out_of_range)
            except Exception:  # noqa: BLE001, S110 - refusing is the pass case
                pass
            else:
                failures.append(
                    f"extract_page({out_of_range}) must raise; pages are "
                    f"1..{info.page_count}"
                )

        max_edge = 128
        thumbnail = session.render_thumbnail(1, max_edge=max_edge, quality=60)
        if not isinstance(thumbnail, Thumbnail):
            failures.append("render_thumbnail() must return a Thumbnail")
        else:
            if not thumbnail.data:
                failures.append("render_thumbnail() returned no bytes")
            if not thumbnail.media_type.startswith("image/"):
                failures.append(
                    "render_thumbnail().media_type must be an image/* type, "
                    f"got {thumbnail.media_type!r}"
                )
            if max(thumbnail.width, thumbnail.height) > max_edge:
                failures.append(
                    f"render_thumbnail must fit max_edge={max_edge}, got "
                    f"{thumbnail.width}x{thumbnail.height}"
                )
            bigger = session.render_thumbnail(1, max_edge=max_edge * 2, quality=60)
            if max(bigger.width, bigger.height) <= max(
                thumbnail.width, thumbnail.height
            ):
                failures.append("render_thumbnail must honour max_edge")

        session.close()
        try:
            session.close()
        except Exception as exc:  # noqa: BLE001 - suite reports, never raises
            failures.append(f"close() must be idempotent, second call raised: {exc}")
    finally:
        try:
            session.close()
        except Exception:  # noqa: BLE001, S110 - reported above if it matters
            pass

    with provider.open(document) as scoped:
        if scoped.info().page_count < 1:
            failures.append("a session used as a context manager must work")

    try:
        provider.open(b"not-a-document-at-all")
    except Exception:  # noqa: BLE001, S110 - refusing is the pass case
        pass
    else:
        failures.append("open() must raise UnreadableDocument on unreadable bytes")

    return failures
