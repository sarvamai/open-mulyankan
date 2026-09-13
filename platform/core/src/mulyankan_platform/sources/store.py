"""Where sources and their extracted artefacts live, for this slice.

The index is a dictionary in this process and the artefacts are files under a
workspace directory. That is a deliberate stand-in, not a design: there is no
`db/` yet, so restarting the API forgets every source, and running more than
one worker gives each its own index. Both go away when the sources table
lands — `SourceStore` is the only thing that has to change.

Because there is no transaction, this slice writes **no audit events**. An
audit event must commit with the state change it records (invariant 2), and
appending to the chain from a store with no transaction would produce a
chain that cannot be trusted. Ingestion becomes auditable in the same change
that gives it a database.

Every public method holds `_lock`. The core-api handlers are sync `def`, so
Starlette runs them concurrently on the anyio threadpool — without it,
`list` sorting while `create` inserts raises
`RuntimeError: dictionary changed size during iteration`, the same race
`SessionMonitor` documents. The lock is what becomes the database
transaction.

The lock also makes check-then-write **atomic**, which is what keeps a
delete from racing the extraction job: every artefact write goes through
`write_if_live`, which re-checks the record under the lock before touching
disk. An artefact is therefore either written while the record was live
(and `delete`'s `rmtree` removes it) or refused after the delete — a deleted
source can never be resurrected on disk. `get` returns the live record, not
a copy: the pipeline mutates it only on the event loop and field writes are
GIL-atomic, so a reader sees a stage boundary, never a half-written one —
the discipline the database store inherits.
"""

from __future__ import annotations

import shutil
import threading
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from typing import TypeVar

from mulyankan_platform.sources.models import Source, SourceKind

_T = TypeVar("_T")


def _now() -> datetime:
    return datetime.now(UTC)


class SourceStore:
    """In-memory index over on-disk artefacts. Single process only."""

    def __init__(self, root: Path) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._sources: dict[str, Source] = {}

    # ── layout ────────────────────────────────────────────────────────────

    @property
    def root(self) -> Path:
        return self._root

    def directory(self, source_id: str) -> Path:
        return self._root / source_id

    def document_path(self, source_id: str) -> Path:
        return self.directory(source_id) / "source.pdf"

    def cover_path(self, source_id: str) -> Path:
        return self.directory(source_id) / "cover.jpg"

    def text_path(self, source_id: str, page: int) -> Path:
        return self.directory(source_id) / "text" / f"{page:05d}.txt"

    def image_dir(self, source_id: str) -> Path:
        return self.directory(source_id) / "images"

    def image_paths(self, source_id: str, page: int) -> list[Path]:
        directory = self.image_dir(source_id)
        if not directory.is_dir():
            return []
        return sorted(directory.glob(f"{page:05d}-*"))

    # ── records ───────────────────────────────────────────────────────────

    def create(
        self,
        *,
        kind: SourceKind,
        name: str,
        subject: str,
        class_level: int,
        meta: str,
        filename: str,
        document: bytes,
    ) -> Source:
        """Register a source and write its document to the workspace."""
        source_id = uuid.uuid4().hex
        directory = self.directory(source_id)
        directory.mkdir(parents=True, exist_ok=True)
        self.document_path(source_id).write_bytes(document)

        source = Source(
            id=source_id,
            kind=kind,
            name=name,
            subject=subject,
            class_level=class_level,
            meta=meta,
            filename=filename,
            byte_size=len(document),
            created_at=_now(),
        )
        with self._lock:
            self._sources[source_id] = source
        return source

    def get(self, source_id: str) -> Source | None:
        with self._lock:
            return self._sources.get(source_id)

    def exists(self, source_id: str) -> bool:
        """Whether the record is still live; cheap pre-flight for the pipeline."""
        with self._lock:
            return source_id in self._sources

    def list(self) -> list[Source]:
        """Newest first — the order the shelf shows them in."""
        with self._lock:
            return sorted(
                self._sources.values(), key=lambda item: item.created_at, reverse=True
            )

    def rename(self, source_id: str, name: str) -> Source | None:
        """Set the display name; mutation belongs to the store, not a router."""
        with self._lock:
            source = self._sources.get(source_id)
            if source is not None:
                source.name = name
            return source

    def delete(self, source_id: str) -> bool:
        with self._lock:
            if self._sources.pop(source_id, None) is None:
                return False
        shutil.rmtree(self.directory(source_id), ignore_errors=True)
        return True

    # ── guarded artefact writes ───────────────────────────────────────────

    def write_if_live(
        self, source_id: str, path: Path, write: Callable[[Path], _T]
    ) -> _T | None:
        """Run `write(path)` only while the record is live.

        The existence check and the write happen under one lock hold, so a
        concurrent `delete` either runs entirely before (the write is
        refused) or entirely after (its `rmtree` removes the artefact).
        `path` comes from the layout methods above — pure computation, safe
        to resolve before the call. Returns `None` when the source was
        deleted.
        """
        with self._lock:
            if source_id not in self._sources:
                return None
            return write(path)

    def write_document_if_live(self, source_id: str, document: bytes) -> bool:
        """Store the uploaded document; False when the source was deleted."""
        written = self.write_if_live(
            source_id,
            self.document_path(source_id),
            lambda path: path.write_bytes(document),
        )
        return written is not None

    def write_text_if_live(self, source_id: str, page: int, text: str) -> bool:
        """Store one page's extracted text; False when the source was deleted."""
        written = self.write_if_live(
            source_id,
            self.text_path(source_id, page),
            lambda path: (
                path.parent.mkdir(parents=True, exist_ok=True),
                path.write_text(text, encoding="utf-8"),
            ),
        )
        return written is not None

    def write_image_if_live(
        self, source_id: str, page: int, index: int, data: bytes, suffix: str
    ) -> bool:
        """Store one embedded image; False when the source was deleted."""
        name = f"{page:05d}-{index:03d}{suffix}"
        written = self.write_if_live(
            source_id,
            self.image_dir(source_id) / name,
            lambda path: (
                path.parent.mkdir(parents=True, exist_ok=True),
                path.write_bytes(data),
            ),
        )
        return written is not None

    def write_cover_if_live(self, source_id: str, data: bytes) -> bool:
        """Store the rendered cover; False when the source was deleted."""
        written = self.write_if_live(
            source_id,
            self.cover_path(source_id),
            lambda path: path.write_bytes(data),
        )
        return written is not None
