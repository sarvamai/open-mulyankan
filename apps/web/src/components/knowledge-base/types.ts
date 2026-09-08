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
  chapters: number;
  createdAt: string;
  status: Status;
  history: StatusEvent[];
  /**
   * Rendered first page of the source PDF, used as the book cover. There is no
   * upload pipeline yet (`platform/core` has no ingest API), so nothing sets
   * this today and every card falls back to generated cover art.
   */
  coverUrl?: string;
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
