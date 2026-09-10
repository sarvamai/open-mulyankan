'use client';

import { ItemCard } from './item-card';
import type { PreviewCardProps } from './item-card';
import { liveryFor } from './livery';

/**
 * What a book cover shows. `KnowledgeItem` satisfies this structurally, so a
 * caller passes its item straight in; the face is declared separately because
 * the shelf must not depend on any one page's row type.
 */
export interface BookFace {
  name: string;
  subject: string;
  class: number;
  /** Second cover line, e.g. the medium a text book is printed in. */
  meta?: string;
  /**
   * Rendered first page of the source PDF, used as the cover. There is no
   * upload pipeline yet (`platform/core` has no ingest API), so nothing sets
   * this today and every card falls back to generated cover art.
   */
  coverUrl?: string;
}

/**
 * The cover face, shared with the group composer's drop previews and the
 * group card's stack. When the first page of the source PDF has been rendered
 * it is the cover; until the ingest pipeline exists there is nothing to
 * render, so a typographic cover stands in.
 *
 * The art's type and spacing scale with the cover's width (`.book__art*` in
 * `globals.css`) rather than sitting on the fixed px type scale, so the same
 * markup reads correctly from a 320px shelf card down to a 48px thumbnail.
 */
export function ItemCover({ face }: { face: BookFace }) {
  const art = liveryFor(face.subject || face.name);

  if (face.coverUrl) {
    return (
      // Covers are client-rendered PDF pages (blob/data URLs), which
      // next/image cannot optimise.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={face.coverUrl}
        alt=""
        className="h-full w-full bg-tatva-background-secondary object-cover"
      />
    );
  }

  return (
    <div className="book__art-frame">
      <div className={`book__art flex h-full w-full flex-col justify-between ${art.board}`}>
        <div className={`flex flex-col ${art.ink}`}>
          <span className="book__art-eyebrow font-matter uppercase opacity-80">
            Class {face.class}
          </span>
          <span className="book__art-title font-matter">{face.name}</span>
        </div>
        <div className={`flex flex-col ${art.ink}`}>
          <span className="book__art-rule bg-current opacity-50" />
          <span className="book__art-meta font-matter opacity-85">{face.subject}</span>
          {face.meta && <span className="book__art-meta font-matter opacity-70">{face.meta}</span>}
        </div>
      </div>
    </div>
  );
}

/**
 * A CSS 3D book: cover face plus a spine hinged out of the front plane, see
 * `globals.css`. The rotation is kept shallow so the cover stays readable;
 * hovering the card it sits on turns it a little further.
 */
export function BookObject({ face }: { face: BookFace }) {
  return (
    <div className="book">
      <div className="book__spine" aria-hidden="true" />
      <div className="book__cover">
        <ItemCover face={face} />
        <div className="book__hinge" aria-hidden="true" />
        <div className="book__glare" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * The cover face on its own, for the group composer's drop previews and the
 * group card's stack — the same object as the shelf's, only smaller. The art
 * scales itself (see `ItemCover`), so this is a plain box at the given width;
 * the height follows `.book__cover`'s 3/4 aspect.
 */
export function MiniCover({ face, width }: { face: BookFace; width: number }) {
  return (
    <div className="book__cover shadow-tatva-l1" style={{ width }}>
      <ItemCover face={face} />
      <div className="book__hinge" aria-hidden="true" />
      <div className="book__glare" aria-hidden="true" />
    </div>
  );
}

/** One text book: the 3D book on the shared card. */
export function BookCard({ face, ...card }: { face: BookFace } & PreviewCardProps) {
  return <ItemCard preview={<BookObject face={face} />} {...card} />;
}
