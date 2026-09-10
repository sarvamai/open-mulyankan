'use client';

import { Box, Button, Tooltip } from '@sarvam/tatva';
import type { IconName } from '@sarvam/tatva';

export interface SegmentedOption<T extends string> {
  value: T;
  /** Visible label. With `iconOnly` it becomes the accessible name instead. */
  label: string;
  icon?: IconName;
  /** Shown on hover. Always worth setting when `iconOnly` hides the label. */
  tooltip?: string;
}

/**
 * A small switch between two or three mutually exclusive views: a bordered
 * strip of buttons where the current one is filled and the rest are ghosts.
 *
 * This is the app's one segmented control. It is not tatva's `Tabs` with
 * `variant="segmented"`, which stretches to its container's width and reads
 * as navigation — the cards/table toggle and the question bank's source
 * switch are both controls that should take only the room their labels need,
 * so they share this instead.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  iconOnly = false,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Drops the labels, leaving the icons — for toolbar-sized switches. */
  iconOnly?: boolean;
}) {
  return (
    // `w="fit"` is load-bearing: a flex child stretches to its parent's cross
    // axis by default, which is what made the segmented `Tabs` span the whole
    // column.
    <Box
      display="inline-flex"
      w="fit"
      align="center"
      gap={2}
      p={1}
      borderColor="primary"
      rounded="sm"
    >
      {options.map((option) => {
        const selected = option.value === value;
        const button = (
          <Button
            variant={selected ? 'secondary' : 'ghost'}
            size="sm"
            icon={option.icon}
            aria-label={iconOnly ? option.label : undefined}
            aria-pressed={selected}
            onClick={() => onChange(option.value)}
          >
            {iconOnly ? undefined : option.label}
          </Button>
        );

        return (
          <div key={option.value}>
            {option.tooltip ? <Tooltip content={option.tooltip}>{button}</Tooltip> : button}
          </div>
        );
      })}
    </Box>
  );
}
