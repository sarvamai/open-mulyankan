/** Shared shape of a knowledge base entry, used by both tab views. */

import type { Status, StatusEvent } from '@/components/shelf/status';

export type { EventState, Status, StatusEvent } from '@/components/shelf/status';

export type Kind = 'textbook' | 'paper';

export interface KnowledgeItem {
  id: string;
  kind: Kind;
  name: string;
  meta: string;
  subject: string;
  class: number;
  pages: number;
  /**
   * Top-level entries in the document's own table of contents, or null when
   * it declares none. Null and zero are different answers: nothing has read
   * this book's chapters, as against a book with none.
   */
  chapters: number | null;
  createdAt: string;
  status: Status;
  history: StatusEvent[];
  /**
   * Rendered first page of the source PDF, used as the book cover — a small
   * lossy JPEG served by `GET /sources/{id}/cover`, never the page itself.
   * Absent until extraction has rendered one, and on mock rows, which fall
   * back to generated cover art.
   */
  coverUrl?: string;
  /**
   * What extraction found. Present only on rows that came from core-api;
   * mock rows have none. Counts only — never extracted text (DAT-01).
   */
  extraction?: ExtractionCounts;
}

/** Extraction's own report on a source, as `/sources` gives it. */
export interface ExtractionCounts {
  characterCount: number;
  imageCount: number;
  /**
   * Pages no deterministic extractor can read — no text layer, or a text
   * layer that decodes to unmappable glyphs. These are what the `ocr` SPI
   * will be given; until it exists they are simply reported.
   */
  pagesNeedingOcr: number;
  /** Content-free reason the job failed, or null. */
  error: string | null;
}

/**
 * A named collection of text books and exam papers, assembled by dragging
 * items into the group composer. Membership is stored as ids: the group never
 * copies item content.
 */
export interface Group {
  id: string;
  name: string;
  itemIds: string[];
  createdAt: string;
}

/** The three knowledge base views. Groups are not a `Kind` — they hold items. */
export type Tab = Kind | 'group';
