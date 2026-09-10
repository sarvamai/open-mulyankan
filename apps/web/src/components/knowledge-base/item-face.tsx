'use client';

import { MiniCover } from '@/components/shelf/book-card';
import type { BookFace } from '@/components/shelf/book-card';
import { MiniSheet } from '@/components/shelf/paper-card';
import type { PaperFace } from '@/components/shelf/paper-card';
import type { KnowledgeItem } from './types';

/**
 * A knowledge base row as the shelf objects want it. The shelf declares its
 * own face shapes rather than depending on this page's row type, so the
 * mapping lives here — one place that decides what an item's cover and its
 * printed sheet say.
 */

export function bookFace(item: KnowledgeItem): BookFace {
  return {
    name: item.name,
    subject: item.subject,
    class: item.class,
    meta: item.meta,
    coverUrl: item.coverUrl,
  };
}

/**
 * The knowledge base does not model marks or duration — an ingested paper is
 * counted in pages and chapters like a book — so the head rule carries those.
 * The exam paper page, which does have a mark total, words its own.
 */
export function paperFace(item: KnowledgeItem): PaperFace {
  return {
    name: item.name,
    subject: item.subject,
    class: item.class,
    meta: item.meta,
    detail: `${item.pages} pages`,
    highlight: `${item.chapters} chapters`,
    coverUrl: item.coverUrl,
  };
}

/**
 * An item in miniature — a book's cover or a paper's first page, whichever it
 * is — for the group composer's drop list and the group card's stack. Both
 * footprints follow their own aspect, so a stack of mixed kinds reads as a
 * shelf rather than a grid of equal tiles.
 */
export function ItemThumb({ item, width }: { item: KnowledgeItem; width: number }) {
  return item.kind === 'textbook' ? (
    <MiniCover face={bookFace(item)} width={width} />
  ) : (
    <MiniSheet face={paperFace(item)} width={width} />
  );
}
