'use client';

import { Icon } from '@sarvam/tatva';

import { CardShelf, GROUP_GRID } from '@/components/shelf/card-shelf';
import { ItemCard, renameDeleteOptions } from '@/components/shelf/item-card';
import { ItemThumb } from './item-face';
import type { Group, KnowledgeItem } from './types';

/** Member width in the group card's stack; each keeps its own aspect. */
const STACK_WIDTH = 68;

/** Up to three members, fanned like books and papers stood on a shelf. */
function GroupStack({ items }: { items: KnowledgeItem[] }) {
  if (items.length === 0) {
    return (
      <div className="flex h-tatva-60 items-center justify-center rounded-tatva-sm bg-tatva-background-secondary">
        <Icon name="folder-library" size="lg" tone="tertiary" />
      </div>
    );
  }

  return (
    <div className="flex h-tatva-60 items-center justify-center gap-tatva-3 rounded-tatva-sm bg-tatva-background-secondary px-tatva-6">
      {items.map((item) => (
        <div key={item.id}>
          <ItemThumb item={item} width={STACK_WIDTH} />
        </div>
      ))}
    </div>
  );
}

function GroupCard({
  group,
  items,
  onRename,
  onDelete,
}: {
  group: Group;
  /** Members resolved from ids — shorter than `itemIds` if one was deleted. */
  items: KnowledgeItem[];
  onRename: (group: Group) => void;
  onDelete: (group: Group) => void;
}) {
  const books = items.filter((item) => item.kind === 'textbook').length;
  const papers = items.length - books;

  return (
    <ItemCard
      preview={<GroupStack items={items.slice(0, 3)} />}
      title={group.name}
      /* Groups have no table to agree with — the counts are the whole of what
       * a group is, since membership is ids and nothing is modelled behind
       * them. */
      stats={[
        { label: 'Text books', value: String(books) },
        { label: 'Exam papers', value: String(papers) },
        { label: 'Members', value: String(items.length) },
        { label: 'Created', value: group.createdAt },
      ]}
      menuOptions={renameDeleteOptions(
        () => onRename(group),
        () => onDelete(group)
      )}
    />
  );
}

/**
 * The third knowledge base view: groups of text books and exam papers,
 * assembled in the composer. A group stores member ids only, so members are
 * resolved against the current rows on every render — a deleted item simply
 * drops out of its groups.
 */
export function GroupShelf({
  groups,
  itemsById,
  page,
  pageSize,
  totalRows,
  pageSizeOptions,
  onPageChange,
  onPageSizeChange,
  onRename,
  onDelete,
}: {
  groups: Group[];
  itemsById: Map<string, KnowledgeItem>;
  page: number;
  pageSize: number;
  totalRows: number;
  pageSizeOptions: number[];
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onRename: (group: Group) => void;
  onDelete: (group: Group) => void;
}) {
  return (
    <CardShelf
      grid={GROUP_GRID}
      emptyIcon="folder-library"
      emptyTitle="No groups yet"
      emptyDescription="Use “Create group”, then drag books and exam papers into it."
      page={page}
      pageSize={pageSize}
      totalRows={totalRows}
      pageSizeOptions={pageSizeOptions}
      unit="Groups"
      onPageChange={onPageChange}
      onPageSizeChange={onPageSizeChange}
    >
      {groups.map((group) => (
        <GroupCard
          key={group.id}
          group={group}
          items={group.itemIds
            .map((id) => itemsById.get(id))
            .filter((item): item is KnowledgeItem => item !== undefined)}
          onRename={onRename}
          onDelete={onDelete}
        />
      ))}
    </CardShelf>
  );
}
