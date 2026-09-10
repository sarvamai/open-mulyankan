'use client';

import { Text } from '@sarvam/tatva';

/**
 * One labelled figure on a card. The label matters: a bare dot-joined line
 * ("Class 10 · English · 264 pages") leaves the reader to guess which value
 * is the subject and which the medium, and it silently drops whatever does
 * not fit.
 */
export interface CardStat {
  label: string;
  /** Already formatted for reading — the card does no arithmetic. */
  value: string;
}

/**
 * The stats block under a card's title: a two-column grid of label over
 * value, in the order given.
 *
 * A card and its page's table should never disagree about an item, so a page
 * builds this list and its table columns from one set of field definitions
 * rather than writing the card's line out by hand.
 */
export function CardStats({ stats }: { stats: CardStat[] }) {
  if (stats.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-x-tatva-6 gap-y-tatva-4">
      {stats.map(({ label, value }) => (
        <div key={label} className="flex min-w-0 flex-col">
          <Text variant="body-xs" tone="tertiary" lineClamp={1}>
            {label}
          </Text>
          {/* `title` carries the full value: a long subject or a set name is
           * clamped to the column, not wrapped. */}
          <Text variant="body-sm" lineClamp={1} title={value}>
            {value}
          </Text>
        </div>
      ))}
    </div>
  );
}
