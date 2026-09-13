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
"""

from __future__ import annotations

import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from mulyankan_platform.sources.models import Source, SourceKind


def _now() -> datetime:
    return datetime.now(timezone.utc)


class SourceStore:
    """In-memory index over on-disk artefacts. Single process only."""

    def __init__(self, root: Path) -> None:
        self._root = Path(root)
        self._root.mkdir(parents=True, exist_ok=True)
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
        self._sources[source_id] = source
        return source

    def get(self, source_id: str) -> Source | None:
        return self._sources.get(source_id)

    def list(self) -> list[Source]:
        """Newest first — the order the shelf shows them in."""
        return sorted(
            self._sources.values(), key=lambda item: item.created_at, reverse=True
        )

    def delete(self, source_id: str) -> bool:
        if self._sources.pop(source_id, None) is None:
            return False
        shutil.rmtree(self.directory(source_id), ignore_errors=True)
        return True
