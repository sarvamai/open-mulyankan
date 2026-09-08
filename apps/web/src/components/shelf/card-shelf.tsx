'use client';

import { Box, Icon, Text } from '@sarvam/tatva';
import type { IconName } from '@sarvam/tatva';
import type { ReactNode } from 'react';

import { ShelfPager } from './shelf-pager';

/**
 * Column counts come from the viewport, not from `auto-fill` on the
 * container: the composer rail animates the container's width, and auto-fill
 * would cross a track threshold part-way through and jump every card to a new
 * cell at once. A fixed count per breakpoint keeps the grid still and lets the
 * cards glide narrower instead. The counts match what `minmax(12rem, 1fr)`
 * used to produce at each width.
 */
export const ITEM_GRID = 'grid grid-cols-2 gap-tatva-10 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5';

/** Group cards carry a stack of three covers, so they need a wider cell. */
export const GROUP_GRID =
  'grid grid-cols-1 gap-tatva-10 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4';

/**
 * A shelf of cards: the grid, its empty state, and the pager the card grids
 * render for themselves — `Table` carries its own, a grid does not. Page
 * state stays in the URL; the manager owns it.
 *
 * Shared by the text book, exam paper and group shelves. What differs between
 * them is the cards inside and the wording when there are none.
 */
export function CardShelf({
  children,
  grid = ITEM_GRID,
  emptyIcon,
  emptyTitle,
  emptyDescription,
  page,
  pageSize,
  totalRows,
  pageSizeOptions,
  unit,
  onPageChange,
  onPageSizeChange,
}: {
  children: ReactNode;
  /** One of the exported grid class strings. */
  grid?: string;
  emptyIcon: IconName;
  emptyTitle: string;
  emptyDescription: string;
  page: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions: number[];
  /** Plural noun for the page-size label, e.g. "Books per page". */
  unit: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalRows === 0) {
    return (
      <Box
        display="flex"
        direction="column"
        align="center"
        justify="center"
        gap={10}
        py={40}
        bg="surface-primary"
        borderColor="primary"
        rounded="md"
      >
        <Icon name={emptyIcon} size="lg" tone="tertiary" />
        <Box display="flex" direction="column" align="center" gap={2}>
          <Text variant="label-md">{emptyTitle}</Text>
          <Text variant="body-xs" tone="tertiary">
            {emptyDescription}
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box display="flex" direction="column" gap={12}>
      <div className={grid}>{children}</div>

      <ShelfPager
        page={page}
        pageSize={pageSize}
        totalRows={totalRows}
        pageSizeOptions={pageSizeOptions}
        unit={unit}
        onPageChange={onPageChange}
        onPageSizeChange={onPageSizeChange}
      />
    </Box>
  );
}
