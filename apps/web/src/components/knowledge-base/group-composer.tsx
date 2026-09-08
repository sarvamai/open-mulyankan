'use client';

import { useState } from 'react';
import type { DragEvent, ReactNode } from 'react';
import { Box, Button, Icon, Input, Text, toast } from '@sarvam/tatva';

import { isItemDrag, readItemDrag } from './drag';
import { ItemThumb } from './item-face';
import type { KnowledgeItem } from './types';

/** Thumbnail width in the drop list; the height follows the object's aspect. */
const PREVIEW_WIDTH = 48;

/** The dropped item as it reads in the panel: the shelf cover, in miniature. */
function ItemPreview({ item, onRemove }: { item: KnowledgeItem; onRemove: () => void }) {
  return (
    <Box
      display="flex"
      align="center"
      gap={4}
      p={4}
      bg="surface-primary"
      borderColor="primary"
      rounded="sm"
    >
      <Box shrink={false}>
        <ItemThumb item={item} width={PREVIEW_WIDTH} />
      </Box>
      <Box display="flex" direction="column" gap={1} grow minW="0">
        <Text variant="label-sm" lineClamp={2}>
          {item.name}
        </Text>
        <Text variant="body-xs" tone="tertiary" lineClamp={1}>
          {[`Class ${item.class}`, item.subject, item.meta].filter(Boolean).join(' · ')}
        </Text>
      </Box>
      <Box shrink={false}>
        <Button
          variant="ghost"
          size="sm"
          icon="close"
          aria-label={`Remove ${item.name} from the group`}
          onClick={onRemove}
        />
      </Box>
    </Box>
  );
}

/**
 * The sliding rail the composer sits in, portalled into `PageShell`'s aside
 * slot so it spans the page frame top to bottom.
 *
 * Width carries the animation: the rail grows from 0, so the content column
 * narrows in step with it rather than jumping aside. The card itself fades
 * and slides the last few pixels behind that.
 *
 * Both read tatva's motion tokens straight off their CSS variables, so they
 * still collapse to 0ms under `prefers-reduced-motion`. The `reveal` duration
 * and the `in-out` curve are deliberate: they have no Tailwind utility in
 * this version, and the exposed `slow`/`emphasized` pair puts ~85% of a 320px
 * travel into its first 50ms, which reads as a snap rather than a slide.
 *
 * Below `xl` the rail overlays the page instead of squeezing it: 320px out
 * of a narrower frame would shrink the shelf past the point where a book
 * card still reads. Dragging needs a pointer in any case — HTML5 drag events
 * do not fire for touch.
 */
export function GroupComposerRail({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`absolute inset-y-0 right-0 z-40 shrink-0 overflow-hidden transition-[width] duration-[var(--tatva-motion-duration-reveal)] ease-[var(--tatva-motion-ease-in-out)] xl:static xl:z-auto ${
        open ? 'w-tatva-160' : 'w-0'
      }`}
      aria-hidden={!open}
      // Keeps the closed panel's inputs out of the tab order while it stays
      // mounted — it has to, or there would be nothing left to animate out.
      inert={!open}
    >
      <div
        // Padding matches the content column's, minus the left edge, so the
        // card lines up with the shelf once the rail is static at lg.
        className={`h-full w-tatva-160 p-tatva-8 transition-[opacity,transform] duration-[var(--tatva-motion-duration-reveal)] ease-[var(--tatva-motion-ease-in-out)] xl:py-tatva-14 xl:pr-tatva-14 xl:pl-0 ${
          open ? 'translate-x-0 opacity-100' : 'translate-x-tatva-6 opacity-0'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The group composer: the right-hand panel opened by "Create group". It is a
 * sibling of the browsing column rather than a `Sheet`, because the shelf has
 * to stay visible and draggable while the panel is open — the panel narrows
 * the page instead of covering it.
 *
 * Every drop carries an item id only (see `drag.ts`); the panel resolves it
 * against the rows the manager holds, so an item deleted mid-compose simply
 * leaves the draft.
 *
 * The draft lives here rather than in the manager so that a fresh `key` on
 * each open is all it takes to reset it — the rail stays mounted while
 * closed, and clearing on close would blank the card mid-slide.
 */
export function GroupComposer({
  itemsById,
  onSave,
  onCancel,
}: {
  itemsById: Map<string, KnowledgeItem>;
  onSave: (name: string, itemIds: string[]) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState('');
  // Membership in drop order.
  const [itemIds, setItemIds] = useState<string[]>([]);
  // Depth counter, not a boolean: dragging over a child fires `dragleave` on
  // the parent, which would otherwise flicker the highlight off.
  const [dragDepth, setDragDepth] = useState(0);
  const over = dragDepth > 0;

  const items = itemIds
    .map((id) => itemsById.get(id))
    .filter((item): item is KnowledgeItem => item !== undefined);

  function handleAdd(id: string) {
    const item = itemsById.get(id);
    if (!item) return;
    if (itemIds.includes(id)) {
      toast.info(`“${item.name}” is already in this group`);
      return;
    }
    setItemIds((ids) => [...ids, id]);
  }

  function handleDragEnter(event: DragEvent) {
    if (!isItemDrag(event)) return;
    setDragDepth((depth) => depth + 1);
  }

  function handleDragOver(event: DragEvent) {
    if (!isItemDrag(event)) return;
    // Preventing the default is what marks this element a valid drop target.
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }

  function handleDragLeave(event: DragEvent) {
    if (!isItemDrag(event)) return;
    setDragDepth((depth) => Math.max(0, depth - 1));
  }

  function handleDrop(event: DragEvent) {
    if (!isItemDrag(event)) return;
    event.preventDefault();
    setDragDepth(0);
    const id = readItemDrag(event);
    if (id) handleAdd(id);
  }

  return (
    <Box
      as="aside"
      aria-label="New group"
      h="full"
      display="flex"
      direction="column"
      gap={10}
      p={8}
      bg="surface-primary"
      borderColor="primary"
      rounded="md"
      shadow="l1"
    >
      <Box display="flex" align="start" gap={4} shrink={false}>
        <Box display="flex" direction="column" gap={1} grow minW="0">
          <Text variant="label-md">New group</Text>
          <Text variant="body-xs" tone="tertiary">
            {items.length === 0
              ? 'Nothing added yet'
              : `${items.length} item${items.length === 1 ? '' : 's'} added`}
          </Text>
        </Box>
        <Box shrink={false}>
          <Button
            variant="ghost"
            size="sm"
            icon="close"
            aria-label="Close the group composer"
            onClick={onCancel}
          />
        </Box>
      </Box>

      <Box shrink={false}>
        <Input
          label="Group name"
          placeholder="Class 10 revision set"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </Box>

      {/* One drop target around both the list and the prompt, so a drop lands
       * anywhere in the panel body rather than only on the empty placeholder. */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex min-h-0 flex-1 flex-col gap-tatva-6 overflow-y-auto rounded-tatva-md border border-dashed p-tatva-6 transition-colors duration-tatva-fast ${
          over
            ? 'border-tatva-brand bg-tatva-brand-secondary'
            : 'border-tatva-divider-primary bg-tatva-background-secondary'
        }`}
      >
        {items.length === 0 ? (
          <Box display="flex" direction="column" align="center" justify="center" gap={4} grow px={6}>
            <Icon name="drag-drop" size="lg" tone="tertiary" />
            <Text variant="body-sm" tone="secondary" textAlign="center">
              Drag any book or exam paper to put them in a group.
            </Text>
          </Box>
        ) : (
          <>
            <Box display="flex" direction="column" gap={4}>
              {items.map((item) => (
                <ItemPreview
                  key={item.id}
                  item={item}
                  onRemove={() => setItemIds((ids) => ids.filter((id) => id !== item.id))}
                />
              ))}
            </Box>
            <Box display="flex" align="center" justify="center" gap={2} py={4}>
              <Icon name="plus" size="sm" tone="tertiary" />
              <Text variant="body-xs" tone="tertiary">
                Drop another item here
              </Text>
            </Box>
          </>
        )}
      </div>

      <Box display="flex" align="center" justify="end" gap={4} shrink={false}>
        <Button variant="secondary" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          variant="primary"
          size="sm"
          disabled={!name.trim() || items.length === 0}
          onClick={() => onSave(name.trim(), itemIds)}
        >
          Save
        </Button>
      </Box>
    </Box>
  );
}
