'use client';

import { Badge, Box, Icon, Popover, Text } from '@sarvam/tatva';
import type { BadgeProps } from '@sarvam/tatva';

import type { EventState, Status, StatusEvent } from './status';

/**
 * A status and each of its events resolve to the same three tones, so the
 * mapping to `Badge` variants is written once. Nothing here restates the
 * design system's colours — an earlier version of this file mirrored
 * `Badge`'s token classes by hand, which is how the chip drifted out of step
 * with every other badge in the app.
 */
const TONE: Record<'ok' | 'busy' | 'bad', { variant: BadgeProps['variant']; icon: 'green' | 'yellow' | 'red' }> = {
  ok: { variant: 'green', icon: 'green' },
  busy: { variant: 'yellow', icon: 'yellow' },
  bad: { variant: 'red', icon: 'red' },
};

const STATUS: Record<Status, { tone: keyof typeof TONE; label: string }> = {
  ready: { tone: 'ok', label: 'Ready' },
  processing: { tone: 'busy', label: 'Processing' },
  failed: { tone: 'bad', label: 'Failed' },
};

const EVENT: Record<EventState, { tone: keyof typeof TONE; label: string }> = {
  completed: { tone: 'ok', label: 'Completed' },
  running: { tone: 'busy', label: 'Running' },
  failed: { tone: 'bad', label: 'Failed' },
};

function StatusHistory({ events }: { events: StatusEvent[] }) {
  return (
    <Box display="flex" direction="column" gap={5} w={150}>
      <Text variant="label-md">Status history</Text>
      {events.map((event) => (
        <Box key={event.label} display="flex" direction="column" gap={1}>
          <Box display="flex" align="center" justify="between" gap={4}>
            <Text variant="body-md">{event.label}</Text>
            <Badge variant={TONE[EVENT[event.state].tone].variant} size="sm">
              {EVENT[event.state].label}
            </Badge>
          </Box>
          <Text variant="body-xs" tone="tertiary">
            {event.window}
          </Text>
          <Text variant="body-xs" tone="tertiary">
            {event.ago}
          </Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Ingest status as a chip that opens the per-step history. One component for
 * every surface that shows it — the knowledge base's table and both card
 * shelves — and one rendering: a tatva `Badge`, so a status reads the same
 * wherever it sits, over a dark book cover or a pale exam paper.
 */
export function StatusChip({
  status,
  history,
  label,
  size = 'md',
  align = 'end',
}: {
  status: Status;
  history: StatusEvent[];
  /** Item name, for the trigger's accessible name only — never rendered. */
  label: string;
  size?: 'sm' | 'md';
  align?: 'start' | 'center' | 'end';
}) {
  const { tone, label: statusLabel } = STATUS[status];

  return (
    <Popover content={<StatusHistory events={history} />} align={align}>
      {/* `Badge`'s own click handler does nothing: the Popover's trigger
       * supplies the opening (Radix composes both handlers). Passing one is
       * what makes `Badge` render its interactive form — focusable, with the
       * design system's hover and focus ring — instead of a static span. */}
      <Badge
        variant={TONE[tone].variant}
        size={size}
        aria-label={`Status history for ${label}`}
        onClick={() => {}}
      >
        {statusLabel}
        <Icon name="chevron-down" size="xxs" tone={TONE[tone].icon} />
      </Badge>
    </Popover>
  );
}
