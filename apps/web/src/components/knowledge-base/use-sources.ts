'use client';

import { useCallback, useEffect, useState } from 'react';

import {
  ApiError,
  coverUrl,
  deleteSource,
  listSources,
  renameSource,
  type SourceRow,
  type SourceStage,
} from '@/lib/sources-api';
import type { KnowledgeItem, StatusEvent } from './types';

/** How often to re-read the list while any source is still being extracted. */
const POLL_MS = 1200;

const TIME = new Intl.DateTimeFormat('en-IN', {
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

const DATE = new Intl.DateTimeFormat('en-IN', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function seconds(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const total = Math.round(ms / 1000);
  if (total < 60) return `${total}s`;
  return `${Math.floor(total / 60)}m ${total % 60}s`;
}

function ago(iso: string): string {
  const elapsed = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(elapsed / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

/**
 * One stage as the status drawer wants it. A stage that is still running has
 * no end and so no duration — the window says it started and nothing more,
 * rather than inventing a finish.
 */
function stageEvent(stage: SourceStage): StatusEvent {
  const started = TIME.format(new Date(stage.startedAt));
  const window =
    stage.endedAt && stage.durationMs !== null
      ? `${started} – ${TIME.format(new Date(stage.endedAt))} (${seconds(stage.durationMs)})`
      : `${started} – running`;
  return {
    label: stage.label,
    state: stage.state,
    window,
    ago: ago(stage.startedAt),
  };
}

/**
 * A `/sources` row as the knowledge base's shelves and table want it.
 *
 * `chapters` stays null when the PDF declares no table of contents. Zero
 * would be a claim about the book; null is the truth, which is that nothing
 * has read its chapters yet.
 */
export function toKnowledgeItem(row: SourceRow): KnowledgeItem {
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    meta: row.meta,
    subject: row.subject,
    class: row.classLevel,
    pages: row.pageCount,
    chapters: row.chapterCount,
    createdAt: DATE.format(new Date(row.createdAt)),
    status: row.status,
    history: row.stages.map(stageEvent),
    coverUrl: row.hasCover ? coverUrl(row.id) : undefined,
    extraction: {
      characterCount: row.characterCount,
      imageCount: row.imageCount,
      pagesNeedingOcr: row.pagesNeedingOcr,
      error: row.error,
    },
  };
}

export interface SourcesState {
  items: KnowledgeItem[];
  /** True only until the first response; a poll must not blank the shelf. */
  loading: boolean;
  /** Set when core-api cannot be reached or refuses; null while healthy. */
  error: string | null;
  refresh: () => void;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/**
 * The knowledge base's text books, read from core-api and kept current.
 *
 * Extraction runs as a background job, so the list is polled while any source
 * is still processing and left alone once every one has settled. Nothing here
 * holds extracted text: the rows carry counts, and page text is fetched only
 * when someone opens a page.
 */
export function useSources(): SourcesState {
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Bumped to force a read outside the polling rhythm (after an upload, say).
  const [nonce, setNonce] = useState(0);
  const busy = rows.some((row) => row.status === 'processing');

  // One effect owns every read: the first one on mount, and the repeats
  // while a job is running. State is set in the promise's callbacks rather
  // than in the effect body, so a read that resolves after unmount — or
  // after a newer read superseded it — lands nowhere.
  useEffect(() => {
    const controller = new AbortController();

    const read = () =>
      listSources(controller.signal)
        .then((fetched) => {
          setRows(fetched);
          setError(null);
        })
        .catch((caught: unknown) => {
          if (controller.signal.aborted) return;
          setError(
            caught instanceof ApiError ? caught.message : 'Could not load sources',
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });

    void read();
    // Only poll while something is actually being extracted; a settled list
    // does not change on its own.
    const timer = busy ? setInterval(() => void read(), POLL_MS) : undefined;

    return () => {
      controller.abort();
      if (timer !== undefined) clearInterval(timer);
    };
  }, [busy, nonce]);

  const refresh = useCallback(() => setNonce((value) => value + 1), []);

  const rename = useCallback(async (id: string, name: string) => {
    const updated = await renameSource(id, name);
    setRows((current) => current.map((row) => (row.id === id ? updated : row)));
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteSource(id);
    setRows((current) => current.filter((row) => row.id !== id));
  }, []);

  return { items: rows.map(toKnowledgeItem), loading, error, refresh, rename, remove };
}
