'use client';

/**
 * Drag transfer for the group composer.
 *
 * Only the item id crosses the wire — never a name, and never anything from
 * the source document. A drag payload is readable by any drop target on the
 * page, so it follows the same content-free rule as logs and URLs.
 */

import { useCallback, useEffect, useRef } from 'react';
import type { DragEvent } from 'react';

/** Lower case: the DataTransfer type list is normalised to lower case. */
export const ITEM_DRAG_MIME = 'application/x-mulyankan-item';

export function startItemDrag(event: DragEvent, id: string) {
  event.dataTransfer.setData(ITEM_DRAG_MIME, id);
  event.dataTransfer.effectAllowed = 'copy';
}

/**
 * Whether a drag carries one of our items. `getData` returns '' during
 * `dragover` (protected mode), so the type list is the only thing a drop
 * target can inspect before the drop itself.
 */
export function isItemDrag(event: DragEvent): boolean {
  return event.dataTransfer.types.includes(ITEM_DRAG_MIME);
}

export function readItemDrag(event: DragEvent): string | null {
  return event.dataTransfer.getData(ITEM_DRAG_MIME) || null;
}

/**
 * Attribute a table row's own cell renders to carry its item id. Read at
 * dragstart rather than mapping by row order, because `Table` sorts on the
 * client: the DOM reorders without this module hearing about it, so anything
 * index-based would hand over the wrong item.
 */
export const ITEM_ID_ATTR = 'data-item-id';

/**
 * Makes every row of a tatva `Table` a drag source, not just one cell.
 *
 * `Table` renders its own `<tr>` and accepts no row-level props, so
 * `draggable` has to be set on the DOM afterwards. The MutationObserver
 * re-applies it because the table replaces its rows on sort, filter and page
 * changes without the calling component re-rendering.
 *
 * `dragstart` bubbles, so one handler on the wrapper serves every row.
 */
export function useRowDragSource(enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;

    const apply = () => {
      for (const row of root.querySelectorAll('tbody tr')) {
        (row as HTMLElement).draggable = enabled;
      }
    };
    apply();

    // `childList` only: `apply` writes an attribute, which this never sees,
    // so there is no way for it to feed itself.
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [enabled]);

  const onDragStart = useCallback(
    (event: DragEvent) => {
      if (!enabled) return;
      const row = (event.target as HTMLElement | null)?.closest?.('tr');
      const id = row?.querySelector(`[${ITEM_ID_ATTR}]`)?.getAttribute(ITEM_ID_ATTR);
      if (id) startItemDrag(event, id);
    },
    [enabled]
  );

  return { ref, onDragStart };
}
