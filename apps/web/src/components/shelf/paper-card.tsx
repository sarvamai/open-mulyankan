'use client';

import { ItemCard } from './item-card';
import type { PreviewCardProps } from './item-card';
import { liveryFor } from './livery';

/**
 * What an exam paper's first page shows. Both surfaces that list papers map
 * their own row type onto this: the knowledge base's `KnowledgeItem` and the
 * exam paper page's `ExamPaper` carry different counts, so the two foot lines
 * arrive already worded.
 */
export interface PaperFace {
  name: string;
  subject: string;
  class: number;
  /** Second head line, e.g. the set a board paper belongs to. */
  meta?: string;
  /** Left foot of the head rule, e.g. "32 questions". */
  detail?: string;
  /**
   * Right foot of the head rule, set in the subject's accent — "80 marks" on
   * the exam paper page, a chapter count in the knowledge base, which does not
   * model marks.
   */
  highlight?: string;
  /**
   * Rendered first page of the source PDF. Nothing sets this until an ingest
   * API exists, so every sheet is typeset from the fields above — see
   * `BookFace.coverUrl`.
   */
  coverUrl?: string;
}

/**
 * Skeleton question rows, so the sheet reads as a printed paper at a glance.
 * A numbered row is a question, an unnumbered one its continuation or an
 * option beneath it; the widths are ragged so the block does not read as a
 * loading skeleton. Question numbers are structure, not content — no question
 * text reaches this client.
 */
const RULED_LINES = [
  { numbered: true, width: '88%' },
  { numbered: false, width: '62%' },
  { numbered: true, width: '80%' },
  { numbered: false, width: '54%' },
  { numbered: true, width: '84%' },
  { numbered: true, width: '72%' },
  { numbered: false, width: '48%' },
  { numbered: true, width: '82%' },
  { numbered: false, width: '58%' },
] as const;

/** Which question a numbered row is: the numbered rows counted so far. */
function numberOf(index: number): number {
  return RULED_LINES.slice(0, index + 1).filter((line) => line.numbered).length;
}

/**
 * The printed first page. The counterpart of a book's cover art: typeset
 * against the sheet's own width (`.paper__*` in `globals.css`) so it reads
 * the same on a shelf card as it does at thumbnail size in a group stack.
 *
 * A paper is printed on white stock in every theme — the sheet carries its
 * own ink, and takes only the accent colour from the shared livery, so a
 * subject is recognisable across the book shelf and the paper shelf.
 */
export function PaperPrint({ face }: { face: PaperFace }) {
  const art = liveryFor(face.subject || face.name);

  if (face.coverUrl) {
    return (
      // A scanned or rasterised page, not an optimisable asset — see
      // `ItemCover`.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={face.coverUrl}
        alt=""
        className="h-full w-full bg-tatva-background-secondary object-cover"
      />
    );
  }

  return (
    <div className="paper__print-frame">
      <div className="paper__print flex h-full w-full flex-col">
        <div className="flex flex-col items-center text-center">
          <span className="paper__eyebrow font-matter uppercase">
            Class {face.class} · {face.subject}
          </span>
          <span className="paper__title font-matter">{face.name}</span>
          {face.meta && <span className="paper__meta font-matter">{face.meta}</span>}
        </div>

        <span className={`paper__rule bg-current ${art.accent}`} />

        <div className="paper__head flex items-baseline justify-between">
          <span className="font-matter">{face.detail}</span>
          <span className={`font-matter ${art.accent}`}>{face.highlight}</span>
        </div>

        {/* Decorative: the rows stand in for question text, which never
         * leaves the server — no paper content reaches this client. */}
        <div className="paper__lines flex flex-col" aria-hidden="true">
          {RULED_LINES.map((line, index) => (
            <div key={index} className="paper__line flex items-baseline">
              <span className={`paper__number font-matter ${line.numbered ? art.accent : ''}`}>
                {line.numbered && `${numberOf(index)}.`}
              </span>
              <span className="paper__bar" style={{ width: line.width }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * A CSS 3D exam paper: the printed sheet over two leaves behind it, turned on
 * the same stage as the book so a shelf of either reads as one object. The
 * turn is mirrored — a paper's depth is the stack under it, not a spine, so
 * it leans the other way and shows its right edge.
 */
export function PaperObject({ face }: { face: PaperFace }) {
  return (
    <div className="paper">
      <div className="paper__leaf paper__leaf--back" aria-hidden="true" />
      <div className="paper__leaf paper__leaf--mid" aria-hidden="true" />
      <div className="paper__sheet">
        <PaperPrint face={face} />
        <div className="paper__glare" aria-hidden="true" />
      </div>
    </div>
  );
}

/**
 * The sheet on its own, for the group composer's drop previews and the group
 * card's stack — the counterpart of `MiniCover`. The height follows
 * `.paper__sheet`'s A4 aspect.
 */
export function MiniSheet({ face, width }: { face: PaperFace; width: number }) {
  return (
    <div className="paper__sheet shadow-tatva-l1" style={{ width }}>
      <PaperPrint face={face} />
      <div className="paper__glare" aria-hidden="true" />
    </div>
  );
}

/** One exam paper: the 3D sheet stack on the shared card. */
export function PaperCard({ face, ...card }: { face: PaperFace } & PreviewCardProps) {
  return <ItemCard preview={<PaperObject face={face} />} {...card} />;
}
