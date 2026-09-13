'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';
import { createPortal } from 'react-dom';
import { usePathname, useSearchParams } from 'next/navigation';
import type { ReadonlyURLSearchParams } from 'next/navigation';
import { Box, Dialog, Filters, Icon, Input, Table, Tabs, Text, toast } from '@sarvam/tatva';
import type { FilterCondition, FilterFieldConfig, IconName, TabItem, TableColumn } from '@sarvam/tatva';

import { BookCard } from '@/components/shelf/book-card';
import { CardShelf } from '@/components/shelf/card-shelf';
import { renameDeleteOptions } from '@/components/shelf/item-card';
import { PaperCard } from '@/components/shelf/paper-card';
import { StatusChip } from '@/components/shelf/status-chip';
import { ViewToggle, VIEWS } from '@/components/shelf/view-toggle';
import type { View } from '@/components/shelf/view-toggle';
import { usePageAside } from '@/components/shell/page-shell';
import { startItemDrag } from './drag';
import { GroupComposer, GroupComposerRail } from './group-composer';
import { GroupShelf } from './group-shelf';
import { bookFace, paperFace } from './item-face';
import { MOCK_ITEMS } from './mock-items';
import { useSources } from './use-sources';
import type { Group, Kind, KnowledgeItem, Tab } from './types';

export type { Kind, Tab } from './types';

// `book-03` and `folder-library` come from the app's extended icon registry,
// not tatva's built-in set — see `shell/icon-registry.tsx`.
const TABS: TabItem[] = [
  { value: 'textbook', label: 'Text Books', icon: 'book-03' },
  { value: 'paper', label: 'Exam Paper', icon: 'file' },
  { value: 'group', label: 'Groups', icon: 'folder-library' },
];

const TABS_ORDER = ['textbook', 'paper', 'group'] as const;

const SEARCH_PLACEHOLDER: Record<Tab, string> = {
  textbook: 'Search text books...',
  paper: 'Search exam papers...',
  group: 'Search groups...',
};

const KIND_ICON: Record<Kind, IconName> = { textbook: 'audio-book', paper: 'file' };

/** Empty-state and pager wording for the card shelf, per kind. */
const SHELF_COPY: Record<Kind, { icon: IconName; empty: string; unit: string }> = {
  textbook: { icon: 'audio-book', empty: 'No text books found', unit: 'Books' },
  paper: { icon: 'files-01', empty: 'No exam papers found', unit: 'Papers' },
};

const STATUS_OPTIONS = [
  { value: 'ready', label: 'Ready' },
  { value: 'processing', label: 'Processing' },
  { value: 'failed', label: 'Failed' },
];

const PAGE_SIZES = [10, 20, 50];

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');

/**
 * Today as the seed rows write it — "9 Sep 2026". Spelled out rather than
 * taken from `toLocaleDateString('en-GB')`, which renders September as
 * "Sept" and so would not match the rows beside it.
 */
function today(): string {
  const now = new Date();
  return `${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
}

interface FilterableField {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  valueOf: (item: KnowledgeItem) => string;
}

const STATUS_FIELD: FilterableField = {
  id: 'status',
  label: 'Status',
  options: STATUS_OPTIONS,
  valueOf: (item) => item.status,
};

const FIELDS: FilterableField[] = [STATUS_FIELD];

const FILTER_FIELDS: FilterFieldConfig[] = FIELDS.map(({ id, label, options }) => ({
  id,
  label,
  type: 'select',
  options,
}));

/** Reads a validated query param — falls back when absent or unknown. */
function param<T extends string>(
  searchParams: ReadonlyURLSearchParams,
  key: string,
  allowed: readonly T[],
  fallback: T
): T {
  const value = searchParams.get(key) as T | null;
  return value !== null && allowed.includes(value) ? value : fallback;
}

/**
 * The fields a row shows, in the order both renderings show them. One
 * definition, two views: `columnsFor` turns it into table columns and
 * `statsFor` into a card's stats block, so the shelf and the table cannot
 * disagree about an item — they did while the card wrote its own summary
 * line, which labelled nothing, dropped the chapter count, and dropped the
 * subject whenever it repeated the title.
 *
 * `meta` is the medium a text book is printed in and the set a paper belongs
 * to, so its label follows the kind.
 */
interface ItemField {
  id: keyof KnowledgeItem;
  label: (kind: Kind) => string;
  value: (item: KnowledgeItem) => string;
  /** Table column width; the card grid sizes itself. */
  size: number;
  sortable?: boolean;
}

const ITEM_FIELDS: ItemField[] = [
  { id: 'class', label: () => 'Class', value: (item) => String(item.class), size: 90, sortable: true },
  { id: 'subject', label: () => 'Subject', value: (item) => item.subject, size: 150, sortable: true },
  {
    id: 'meta',
    label: (kind) => (kind === 'textbook' ? 'Medium' : 'Set'),
    value: (item) => item.meta || '—',
    size: 110,
    sortable: true,
  },
  { id: 'pages', label: () => 'Pages', value: (item) => String(item.pages), size: 100, sortable: true },
  {
    id: 'chapters',
    // Null means the PDF declares no table of contents and nothing has
    // inferred one — an em dash, not a zero, which would be a claim.
    label: () => 'Chapters',
    value: (item) => (item.chapters === null ? '—' : String(item.chapters)),
    size: 110,
    sortable: true,
  },
  { id: 'createdAt', label: () => 'Created', value: (item) => item.createdAt, size: 130 },
];

/** A card's stats block: every field the table has a column for. */
function statsFor(item: KnowledgeItem) {
  return ITEM_FIELDS.map((field) => ({
    label: field.label(item.kind),
    value: field.value(item),
  }));
}

/**
 * Table columns: the name, then one column per `ITEM_FIELDS` entry, then the
 * status. `draggable` is set while the group composer is open — `Table` has
 * no row-level DOM props, so the name cell doubles as the row's drag handle.
 *
 * `meta` has a column of its own now rather than riding under the name, which
 * is what lets a card label it ("Medium", "Set") the same way.
 */
function columnsFor(kind: Kind, draggable: boolean): TableColumn<KnowledgeItem>[] {
  return [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    enableSorting: true,
    size: 300,
    cell: ({ row }) => (
      <div
        draggable={draggable}
        onDragStart={draggable ? (event) => startItemDrag(event, row.original.id) : undefined}
        className={draggable ? 'cursor-grab active:cursor-grabbing' : undefined}
      >
      <Box display="flex" align="center" gap={4} minW="0">
        <Icon
          name={KIND_ICON[row.original.kind]}
          tone="secondary"
          aria-label={row.original.kind === 'textbook' ? 'Text book' : 'Exam paper'}
        />
        <Text variant="body-md">{row.original.name}</Text>
      </Box>
      </div>
    ),
  },
  ...ITEM_FIELDS.map(
    (field): TableColumn<KnowledgeItem> => ({
      id: field.id,
      header: field.label(kind),
      accessorKey: field.id,
      enableSorting: field.sortable,
      size: field.size,
      cell: ({ row }) => (
        <Text variant="body-md" tone={field.id === 'createdAt' ? 'secondary' : 'default'}>
          {field.value(row.original)}
        </Text>
      ),
    })
  ),
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    size: 160,
    cell: ({ row }) => (
      <StatusChip
        status={row.original.status}
        history={row.original.history}
        label={row.original.name}
      />
    ),
  },
  ];
}

/**
 * What a rename / delete dialog is pointing at. Items and groups share both
 * dialogs — only the wording and the list being edited differ.
 */
interface Target {
  type: 'item' | 'group';
  id: string;
  name: string;
}

/**
 * Knowledge base browser. The URL is the source of truth for the tab,
 * filters and pagination (mulyankan-frontend's usage-page pattern), so
 * refresh, share and back/forward restore the view. Search stays local.
 *
 * The group composer is a sibling column rather than an overlay: the shelf
 * has to stay visible and draggable while a group is being assembled, so the
 * panel narrows the browsing column instead of covering it.
 */
export function KnowledgeBaseManager({
  onTabChange,
  composing = false,
  composeSession = 0,
  onComposingChange,
  uploadedAt = 0,
}: {
  onTabChange?: (tab: Tab) => void;
  /** Whether the group composer panel is open — the header owns the toggle. */
  composing?: boolean;
  /** Bumped by the header on every open; keys a fresh composer draft. */
  composeSession?: number;
  onComposingChange?: (composing: boolean) => void;
  /** Bumped by the header when an upload is accepted; forces a re-read. */
  uploadedAt?: number;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const asideNode = usePageAside();

  // Text books come from core-api; exam papers have no ingest route yet, so
  // they stay on the mock rows until one exists.
  const sources = useSources();
  const [mockPapers, setMockPapers] = useState<KnowledgeItem[]>(() =>
    MOCK_ITEMS.filter((item) => item.kind === 'paper'),
  );
  const items = useMemo(
    () => [...sources.items, ...mockPapers],
    [sources.items, mockPapers],
  );
  const sourceIds = useMemo(
    () => new Set(sources.items.map((item) => item.id)),
    [sources.items],
  );
  const [groups, setGroups] = useState<Group[]>([]);
  const [search, setSearch] = useState('');
  const [renameTarget, setRenameTarget] = useState<Target | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Target | null>(null);

  const tab = param(searchParams, 'tab', TABS_ORDER, 'textbook');
  // Groups have no table — nothing is modelled behind them to put in columns —
  // so the toggle is hidden there and the param ignored.
  const view = param<View>(searchParams, 'view', VIEWS, 'cards');
  // Only the text book tab reads core-api; the other two are local, so
  // neither waits on it. Both gates require an empty list, so a poll that
  // fails after a good read keeps showing the rows it already has.
  const noSources = tab === 'textbook' && sources.items.length === 0;
  const awaitingSources = noSources && sources.loading && !sources.error;
  // With core-api unreachable the shelf has nothing to say. Its empty state
  // would say the wrong thing — offering to change filters that are not the
  // reason — so the banner above is the whole message.
  const sourcesUnavailable = noSources && sources.error !== null;

  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const requestedPageSize = Number(searchParams.get('pageSize')) || 10;
  const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : 10;

  // Reports the URL-derived tab so the header's actions can follow it.
  useEffect(() => {
    onTabChange?.(tab);
  }, [tab, onTabChange]);

  // A new upload is not visible until the list is re-read; waiting for the
  // next poll would leave the shelf a beat behind the dialog closing.
  const refreshSources = sources.refresh;
  useEffect(() => {
    if (uploadedAt > 0) refreshSources();
  }, [uploadedAt, refreshSources]);

  // One condition per field; the operator is always equals, so `status=failed`
  // is the whole param.
  const activeFilters = useMemo<FilterCondition[]>(() => {
    const conditions: FilterCondition[] = [];
    for (const field of FIELDS) {
      const raw = searchParams.get(field.id);
      if (raw && field.options.some((option) => option.value === raw)) {
        conditions.push({ id: field.id, field: field.id, operator: 'equals', value: raw });
      }
    }
    return conditions;
  }, [searchParams]);

  // Pushes param updates, omitting defaults so URLs stay clean. Next 16.2
  // silently drops router.push() calls that only change search params on
  // prerendered routes, so drive the History API directly; the App Router
  // syncs useSearchParams from it.
  const updateParams = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(window.location.search);
      mutate(params);
      const query = params.toString();
      const next = query ? `${pathname}?${query}` : pathname;
      if (next !== `${window.location.pathname}${window.location.search}`) {
        window.history.pushState({}, '', next);
      }
    },
    [pathname]
  );

  // Local search input; the needle is applied debounced and resets the page.
  const [searchText, setSearchText] = useState('');
  const searchTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(searchTimer.current), []);

  function handleSearchInput(value: string) {
    setSearchText(value);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setSearch(value);
      updateParams((params) => params.delete('page'));
    }, 300);
  }

  const itemsById = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

  const filteredGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((group) => group.name.toLowerCase().includes(needle));
  }, [groups, search]);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        item.kind === tab &&
        activeFilters.every((condition) => {
          const field = FIELDS.find((entry) => entry.id === condition.field);
          return !field || field.valueOf(item) === condition.value;
        }) &&
        (!needle ||
          [item.name, item.meta, item.subject, String(item.class)].some((value) =>
            value.toLowerCase().includes(needle)
          ))
    );
  }, [items, tab, activeFilters, search]);

  // One pager over whichever collection the active tab shows.
  const totalRows = tab === 'group' ? filteredGroups.length : filtered.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );
  const pageGroups = useMemo(
    () => filteredGroups.slice((page - 1) * pageSize, page * pageSize),
    [filteredGroups, page, pageSize]
  );

  // Nothing on the Groups tab can be dragged into a group, so opening the
  // composer from there lands on the text book shelf.
  useEffect(() => {
    if (!composing || tab !== 'group') return;
    updateParams((params) => {
      params.delete('tab');
      params.delete('page');
    });
  }, [composing, tab, updateParams]);

  function handleTabChange(value: string) {
    updateParams((params) => {
      if (value === 'textbook') params.delete('tab');
      else params.set('tab', value);
      params.delete('page');
    });
  }

  function handleViewChange(next: View) {
    updateParams((params) => {
      if (next === 'cards') params.delete('view');
      else params.set('view', next);
    });
  }

  function handleFiltersChange(next: FilterCondition[]) {
    updateParams((params) => {
      for (const field of FIELDS) params.delete(field.id);
      // One condition per field; re-adding a field replaces it.
      const byField = new Map(next.map((condition) => [condition.field, condition]));
      for (const condition of byField.values()) params.set(condition.field, condition.value);
      params.delete('page');
    });
  }

  function handlePageChange(next: number) {
    updateParams((params) => {
      if (next > 1) params.set('page', String(next));
      else params.delete('page');
    });
  }

  function handlePageSizeChange(size: number) {
    updateParams((params) => {
      if (size !== PAGE_SIZES[0]) params.set('pageSize', String(size));
      else params.delete('pageSize');
      params.delete('page');
    });
  }

  function openRename(target: Target) {
    setRenameTarget(target);
    setRenameName(target.name);
  }

  async function handleRename() {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    const { type, id } = renameTarget;
    if (type === 'item') {
      // A real source is renamed on the server; a mock paper only here.
      if (sourceIds.has(id)) {
        try {
          await sources.rename(id, name);
        } catch (caught) {
          toast.error(caught instanceof Error ? caught.message : 'Rename failed');
          return;
        }
      } else {
        setMockPapers((rows) =>
          rows.map((row) => (row.id === id ? { ...row, name } : row)),
        );
      }
    } else {
      setGroups((rows) => rows.map((row) => (row.id === id ? { ...row, name } : row)));
    }
    setRenameTarget(null);
    toast.success(`Renamed to “${name}”`);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const { type, id, name } = deleteTarget;
    if (type === 'item') {
      // A group holds ids, not copies, so a deleted item leaves its groups —
      // and the open draft — by itself; both resolve ids on every render.
      if (sourceIds.has(id)) {
        try {
          // Deletes the extracted text, images and cover with it.
          await sources.remove(id);
        } catch (caught) {
          toast.error(caught instanceof Error ? caught.message : 'Delete failed');
          return;
        }
      } else {
        setMockPapers((rows) => rows.filter((row) => row.id !== id));
      }
    } else {
      setGroups((rows) => rows.filter((row) => row.id !== id));
    }
    // Clamp the page if the delete emptied it (e.g. last row of page 3).
    updateParams((params) => {
      const maxPage = Math.max(1, Math.ceil((totalRows - 1) / pageSize));
      const current = Math.max(1, Number(params.get('page')) || 1);
      if (current > maxPage) {
        if (maxPage > 1) params.set('page', String(maxPage));
        else params.delete('page');
      }
    });
    setDeleteTarget(null);
    toast.success(`Deleted “${name}”`);
  }

  function itemTarget(item: KnowledgeItem): Target {
    return { type: 'item', id: item.id, name: item.name };
  }

  function groupTarget(group: Group): Target {
    return { type: 'group', id: group.id, name: group.name };
  }

  function closeComposer() {
    onComposingChange?.(false);
  }

  function handleSaveGroup(name: string, itemIds: string[]) {
    if (!name || itemIds.length === 0) return;
    const group: Group = {
      // Mock ids until the platform mints them; `crypto.randomUUID` is only
      // called from a click handler, so it never runs during SSR.
      id: `group-${crypto.randomUUID()}`,
      name,
      itemIds,
      createdAt: today(),
    };
    setGroups((rows) => [group, ...rows]);
    closeComposer();
    // Land on the view the group was just added to.
    updateParams((params) => {
      params.set('tab', 'group');
      params.delete('page');
    });
    toast.success(`Group “${name}” created`);
  }

  return (
    <>
      <Box display="flex" direction="column" gap={12}>
        <Tabs tabs={TABS} value={tab} onValueChange={handleTabChange} />
        {/* Text books are the only tab reading core-api, so its trouble is
         * reported once, here, rather than as an empty shelf that looks like
         * a filter with no matches. */}
        {sources.error && tab === 'textbook' ? (
          <Box p={8} bg="secondary" rounded="sm" display="flex" direction="column" gap={2}>
            <Text variant="label-sm" tone="danger">
              Text books could not be loaded
            </Text>
            <Text variant="body-xs" tone="tertiary">
              {`${sources.error}. Start it with: uvicorn mulyankan_platform.core_api.main:app --port 8000`}
            </Text>
          </Box>
        ) : null}
        <Box display="flex" wrap="wrap" align="center" gap={6}>
          <Box w={120}>
            <Input
              placeholder={SEARCH_PLACEHOLDER[tab]}
              icon="search"
              value={searchText}
              onChange={(event) => handleSearchInput(event.target.value)}
            />
          </Box>
          {/* Status is an ingest property of an item; a group has none. */}
          {tab !== 'group' && (
            <Filters
              fields={FILTER_FIELDS}
              value={activeFilters}
              onChange={handleFiltersChange}
              showOperators={false}
            />
          )}
          {tab !== 'group' && (
            <Box grow display="flex" justify="end">
              <ViewToggle view={view} onViewChange={handleViewChange} />
            </Box>
          )}
        </Box>
        {/* Until the first `/sources` response lands there is nothing to say
         * about the shelf — and an empty state would say the wrong thing,
         * offering to change filters that are not the reason. */}
        {awaitingSources ? (
          <Box py={12} display="flex" justify="center">
            <Text variant="body-sm" tone="tertiary">
              Loading text books…
            </Text>
          </Box>
        ) : null}
        {!awaitingSources && !sourcesUnavailable && tab !== 'group' && view === 'cards' && (
          <CardShelf
            emptyIcon={SHELF_COPY[tab].icon}
            emptyTitle={SHELF_COPY[tab].empty}
            emptyDescription="Try a different search or filters."
            unit={SHELF_COPY[tab].unit}
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          >
            {pageRows.map((item) => {
              // One card, two objects: the shelves differ only in what stands
              // on the stage.
              const card = {
                title: item.name,
                stats: statsFor(item),
                badge: (
                  <StatusChip
                    status={item.status}
                    history={item.history}
                    label={item.name}
                    size="sm"
                  />
                ),
                menuOptions: renameDeleteOptions(
                  () => openRename(itemTarget(item)),
                  () => setDeleteTarget(itemTarget(item))
                ),
                draggable: composing,
                onDragStart: (event: DragEvent) => startItemDrag(event, item.id),
              };
              return item.kind === 'textbook' ? (
                <BookCard key={item.id} face={bookFace(item)} {...card} />
              ) : (
                <PaperCard key={item.id} face={paperFace(item)} {...card} />
              );
            })}
          </CardShelf>
        )}
        {!awaitingSources && !sourcesUnavailable && tab !== 'group' && view === 'table' && (
          <Table
            data={pageRows}
            columns={columnsFor(tab, composing)}
            variant="compact"
            getRowId={(row) => row.id}
            actions={(row) => [
              {
                label: 'Rename',
                icon: 'pencil-edit',
                onClick: () => openRename(itemTarget(row)),
              },
              { label: 'Delete', icon: 'delete', onClick: () => setDeleteTarget(itemTarget(row)) },
            ]}
            currentPage={page}
            pageSize={pageSize}
            totalRows={totalRows}
            onPageChange={handlePageChange}
            pageSizeOptions={PAGE_SIZES}
            onPageSizeChange={handlePageSizeChange}
            emptyTitle="No items found"
            emptyDescription="Try a different search or filters."
          />
        )}
        {tab === 'group' && (
          <GroupShelf
            groups={pageGroups}
            itemsById={itemsById}
            page={page}
            pageSize={pageSize}
            totalRows={totalRows}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            onRename={(group) => openRename(groupTarget(group))}
            onDelete={(group) => setDeleteTarget(groupTarget(group))}
          />
        )}
      </Box>

      {/* The rail is a sibling of the whole scrolling column, so it spans the
       * page frame top to bottom. It stays mounted while closed — that is
       * what gives it something to animate out. */}
      {asideNode !== null &&
        createPortal(
          <GroupComposerRail open={composing}>
            {/* Keyed on the open: each press of "Create group" mounts a fresh
             * composer, which is the whole of the draft reset. */}
            <GroupComposer
              key={composeSession}
              itemsById={itemsById}
              onSave={handleSaveGroup}
              onCancel={closeComposer}
            />
          </GroupComposerRail>,
          asideNode
        )}

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title={renameTarget?.type === 'group' ? 'Rename group' : 'Rename item'}
        description={renameTarget ? `Rename “${renameTarget.name}”.` : undefined}
        submitButtonText="Rename"
        submitButtonDisabled={!renameName.trim()}
        onSubmit={handleRename}
      >
        <Box py={4}>
          <Input
            label="Name"
            value={renameName}
            onChange={(event) => setRenameName(event.target.value)}
          />
        </Box>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={deleteTarget?.type === 'group' ? 'Delete group' : 'Delete item'}
        description={
          deleteTarget
            ? deleteTarget.type === 'group'
              ? `“${deleteTarget.name}” will be removed. The books and exam papers in it are not deleted.`
              : `“${deleteTarget.name}” will be removed. This cannot be undone.`
            : undefined
        }
        submitButtonText="Delete"
        submitButtonVariant="destructive"
        onSubmit={handleDelete}
      />
    </>
  );
}
