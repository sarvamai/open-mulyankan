"""Source material records: what was uploaded, and how extraction went.

A source is the document an author's questions will later draw on — a text
book or an exam paper. It is not an artefact of the authoring lifecycle: it
has no versions, no reviews, and no seal, so it does not touch the state
machine in `docs/architecture.md`.

`Source.status` is deliberately the three states the client already renders.
A job that has not started yet is `processing`: the stage list says what has
actually happened, and an empty list means nothing has.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal

from mulyankan_spi.extraction import OutlineEntry

SourceKind = Literal["textbook", "paper"]
SourceStatus = Literal["processing", "ready", "failed"]
StageState = Literal["running", "completed", "failed"]


@dataclass
class StageRun:
    """One pipeline stage, as it happened.

    Stages are appended when they start, so the list is a record rather than
    a plan — there is no pending state to render, and a failed job shows
    exactly how far it got.
    """

    id: str
    label: str
    state: StageState
    started_at: datetime
    ended_at: datetime | None = None

    @property
    def duration_ms(self) -> int | None:
        if self.ended_at is None:
            return None
        return int((self.ended_at - self.started_at).total_seconds() * 1000)


@dataclass
class ExtractionSummary:
    """Counts only — never text. Enough to say whether extraction worked."""

    page_count: int = 0
    pages_with_text: int = 0
    pages_without_text: int = 0
    #: Pages that *have* a text layer which decodes to unmappable glyphs —
    #: a PDF whose fonts carry no ToUnicode CMap. The characters extract, and
    #: mean nothing. Counted apart from `pages_without_text` because the two
    #: have the same remedy (OCR) but look nothing alike in the data.
    pages_with_unusable_text: int = 0
    character_count: int = 0
    image_count: int = 0
    outline: tuple[OutlineEntry, ...] = ()

    @property
    def pages_needing_ocr(self) -> int:
        """Pages no deterministic extractor can read: blank layer or garbled."""
        return self.pages_without_text + self.pages_with_unusable_text

    @property
    def chapter_count(self) -> int | None:
        """Top-level outline entries, or None when the PDF declares no outline.

        None and zero are different answers: None means the document carries
        no table of contents to read, and this slice does not infer one.
        """
        if not self.outline:
            return None
        return sum(1 for entry in self.outline if entry.level == 1) or len(self.outline)


@dataclass
class Source:
    """One uploaded document and the state of its extraction."""

    id: str
    kind: SourceKind
    name: str
    subject: str
    class_level: int
    meta: str  # medium for a text book, set for a paper
    filename: str
    byte_size: int
    created_at: datetime
    status: SourceStatus = "processing"
    summary: ExtractionSummary = field(default_factory=ExtractionSummary)
    stages: list[StageRun] = field(default_factory=list)
    cover_media_type: str | None = None
    #: Content-free reason the job failed; safe to show and to log.
    error: str | None = None

    def begin_stage(self, stage_id: str, label: str, *, now: datetime) -> StageRun:
        run = StageRun(id=stage_id, label=label, state="running", started_at=now)
        self.stages.append(run)
        return run
