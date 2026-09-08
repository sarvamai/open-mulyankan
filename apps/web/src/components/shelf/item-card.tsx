'use client';

import NextLink from 'next/link';
import { Box, Icon, Menu, Text } from '@sarvam/tatva';
import type { MenuOption } from '@sarvam/tatva';
import type { DragEvent, ReactNode } from 'react';

import { CardStats } from './card-stats';
import type { CardStat } from './card-stats';

/**
 * The card every shelf is built from: a preview object on a 3D stage, the
 * metadata the table used to carry in columns, and the row's actions menu.
 *
 * Only the preview differs between shelves — a text book's turned 3D book
 * (`book-card.tsx`), an exam paper's printed sheet (`paper-card.tsx`), a
 * group's fanned stack of member covers. Everything around it is this file,
 * so the three shelves stay one object visually.
 *
 * The card is deliberately unaware of what it holds: it takes strings and
 * nodes, not an item, because the knowledge base's `KnowledgeItem` and the
 * exam paper page's own row type are different shapes.
 */
export interface ItemCardProps {
  /** The object on the stage. Sizes itself; the stage only centres it. */
  preview: ReactNode;
  title: string;
  /**
   * The item's figures, labelled, under the title. A page derives these from
   * the same field definitions as its table columns, so the two cannot
   * disagree — see `card-stats.tsx`.
   */
  stats: CardStat[];
  /** Rides the preview's top-right corner — a `StatusChip`, typically. */
  badge?: ReactNode;
  /** Detail route, when the item has one. Both preview and title link to it. */
  href?: string;
  menuOptions: MenuOption[];
  /** Set while the group composer is open — the card becomes a drag source. */
  draggable?: boolean;
  onDragStart?: (event: DragEvent) => void;
}

/**
 * What a card taking a preview of its own — `BookCard`, `PaperCard` — passes
 * through untouched.
 */
export type PreviewCardProps = Omit<ItemCardProps, 'preview'>;

export function ItemCard({
  preview,
  title,
  stats,
  badge,
  href,
  menuOptions,
  draggable = false,
  onDragStart,
}: ItemCardProps) {
  // The stage carries the perspective the preview's transforms are read in,
  // and is padded so a drop shadow and a turn have room.
  const stage = (
    /* A badge gets a row of its own above the object: the object is only a
     * little narrower than the card, so a corner badge with a long label
     * ("Processing") would otherwise still clip the cover it is meant to sit
     * clear of. Cards without a badge keep the tighter top. */
    <div
      className={`card-stage flex justify-center px-tatva-3 pb-tatva-3 ${
        badge ? 'pt-tatva-14' : 'pt-tatva-1'
      }`}
    >
      <div className="w-tatva-80 max-w-full">{preview}</div>
    </div>
  );

  return (
    /* The drag wrapper is outside the card: `Box` takes no DOM drag props, and
     * the whole card — not just the preview — should be the grab target. It is
     * also the badge's positioning context, so the badge sits in the card's
     * corner rather than on the object standing on the stage. */
    <div
      draggable={draggable}
      onDragStart={draggable ? onDragStart : undefined}
      className={`relative ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
    >
      {/* The card's own top-right corner, inset by its padding — clear of the
       * book's cover and the paper's sheet, and outside any link wrapping the
       * stage, since the badge is a popover trigger of its own.
       *
       * No plate behind it: a drop shadow here reads as nothing over a dark
       * book cover and as a white background behind the chip over a pale exam
       * paper, which made one badge look like two components. */}
      {badge && <div className="absolute right-tatva-6 top-tatva-6 z-10">{badge}</div>}
      <Box
        as="article"
        display="flex"
        direction="column"
        gap={6}
        p={6}
        bg="surface-primary"
        borderColor="primary"
        rounded="md"
      >
        {/* `group` covers the whole card so the preview turns whenever the
         * card is hovered, not only the preview itself. */}
        <div className="group flex flex-col gap-tatva-6">
          {/* The stage and the title link separately: one link around the
           * whole card would swallow the badge's popover trigger and the
           * actions menu. */}
          {href ? (
            <NextLink href={href} aria-label={title} tabIndex={-1}>
              {stage}
            </NextLink>
          ) : (
            stage
          )}

          <Box display="flex" direction="column" gap={6}>
            <Box display="flex" align="start" gap={2}>
              {/* `grow` is load-bearing: a `lineClamp`ed Text renders as
               * `display: -webkit-box`, which gives its parent no intrinsic
               * width, so a shrink-to-fit column collapses to a few
               * characters. */}
              <Box display="flex" direction="column" gap={1} grow minW="0">
                {href ? (
                  <NextLink href={href}>
                    <Text variant="label-md" tone="brand" lineClamp={2}>
                      {title}
                    </Text>
                  </NextLink>
                ) : (
                  <Text variant="label-md" lineClamp={2}>
                    {title}
                  </Text>
                )}
              </Box>
            {/* Menu wraps its trigger in a `w-full` div, so it needs a fixed,
             * non-shrinking box or it eats the title's row. That wrapper — not
             * our button — carries `data-state`, so the open menu keeps the
             * button visible via `:focus` rather than a data-state variant. */}
              <Box w={8} shrink={false}>
                <Menu align="end" options={menuOptions}>
                  <button
                    type="button"
                    aria-label={`Actions for ${title}`}
                    className="inline-flex h-tatva-8 w-tatva-8 cursor-pointer items-center justify-center rounded-tatva-sm opacity-0 outline-none transition-opacity duration-tatva-fast hover:bg-tatva-background-secondary focus:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Icon name="more-horizontal" size="sm" tone="tertiary" />
                  </button>
                </Menu>
              </Box>
            </Box>

            <CardStats stats={stats} />
          </Box>
        </div>
      </Box>
    </div>
  );
}

/** The rename / delete pair every shelf card carries, in one place. */
export function renameDeleteOptions(onRename: () => void, onDelete: () => void): MenuOption[] {
  return [
    { value: 'rename', label: 'Rename', icon: 'pencil-edit', onClick: onRename },
    { value: 'delete', label: 'Delete', icon: 'delete', onClick: onDelete },
  ];
}
