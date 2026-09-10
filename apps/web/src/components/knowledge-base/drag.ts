/**
 * Drag transfer for the group composer.
 *
 * Only the item id crosses the wire — never a name, and never anything from
 * the source document. A drag payload is readable by any drop target on the
 * page, so it follows the same content-free rule as logs and URLs.
 */

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
