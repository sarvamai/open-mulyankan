'use client';

import { Box, Button, Select, Text } from '@sarvam/tatva';

/**
 * The pager the card grids render for themselves — `Table` carries its own,
 * the shelves do not. Page state stays in the URL; the manager owns it.
 * Renders nothing while everything fits on one page.
 */
export function ShelfPager({
  page,
  pageSize,
  totalRows,
  pageSizeOptions,
  unit,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions: number[];
  /** Plural noun for the page-size label, e.g. "Books per page". */
  unit: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  if (totalRows <= pageSizeOptions[0]) return null;

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, totalRows);

  return (
    <Box display="flex" wrap="wrap" align="center" justify="between" gap={10}>
      <Box display="flex" align="center" gap={4}>
        <Text variant="body-xs" tone="tertiary">
          {unit} per page
        </Text>
        <Box w={46}>
          <Select
            size="sm"
            value={String(pageSize)}
            options={pageSizeOptions.map((size) => ({
              value: String(size),
              label: String(size),
            }))}
            onValueChange={(value) => onPageSizeChange(Number(value))}
          />
        </Box>
      </Box>
      <Box display="flex" align="center" gap={4}>
        <Text variant="body-xs" tone="tertiary">
          {first}–{last} of {totalRows}
        </Text>
        <Button
          variant="secondary"
          size="sm"
          icon="chevron-left"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        />
        <Button
          variant="secondary"
          size="sm"
          icon="chevron-right"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        />
      </Box>
    </Box>
  );
}
