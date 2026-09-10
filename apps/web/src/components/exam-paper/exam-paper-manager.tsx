'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import NextLink from 'next/link';
import { Box, Dialog, Filters, Icon, Input, Table, Text, toast } from '@sarvam/tatva';
import type { FilterCondition, FilterFieldConfig, TableColumn } from '@sarvam/tatva';

import { CardShelf } from '@/components/shelf/card-shelf';
import { renameDeleteOptions } from '@/components/shelf/item-card';
import { PaperCard } from '@/components/shelf/paper-card';
import type { PaperFace } from '@/components/shelf/paper-card';
import { ViewToggle, VIEWS } from '@/components/shelf/view-toggle';
import type { View } from '@/components/shelf/view-toggle';

interface ExamPaper {
  id: string;
  name: string;
  subject: string;
  class: number;
  questionCount: number;
  marks: number;
  createdAt: string;
}

type SeedRow = [
  name: string,
  subject: string,
  classLevel: number,
  questionCount: number,
  marks: number,
  createdAt: string,
];

function seed(rows: SeedRow[]): ExamPaper[] {
  return rows.map(([name, subject, classLevel, questionCount, marks, createdAt], index) => ({
    id: `paper-${index}`,
    name,
    subject,
    class: classLevel,
    questionCount,
    marks,
    createdAt,
  }));
}

// Mock seed — the platform API does not exist yet. 23 rows so the
// paginated footer is exercised (it renders once totalRows passes 20).
// The first row is the authored draft the editor mock renders.
const SEED: ExamPaper[] = seed([
  ['Biology Assessment', 'Biology', 8, 14, 30, '9 Sep 2026'],
  ['Mathematics — 2026 Board Paper', 'Mathematics', 10, 32, 80, '7 Sep 2026'],
  ['Science — 2026 Board Paper', 'Science', 10, 36, 80, '7 Sep 2026'],
  ['Physics — 2026 Board Paper', 'Physics', 12, 38, 70, '5 Sep 2026'],
  ['Chemistry — 2026 Board Paper', 'Chemistry', 12, 40, 70, '5 Sep 2026'],
  ['Mathematics — 2026 Board Paper', 'Mathematics', 12, 42, 80, '4 Sep 2026'],
  ['Biology — 2026 Board Paper', 'Biology', 12, 44, 70, '4 Sep 2026'],
  ['English — 2026 Board Paper', 'English', 10, 24, 80, '3 Sep 2026'],
  ['Social Science — 2026 Board Paper', 'Social Science', 10, 34, 80, '3 Sep 2026'],
  ['Mathematics — 2026 Specimen', 'Mathematics', 10, 28, 80, '2 Sep 2026'],
  ['Physics — 2026 Specimen', 'Physics', 10, 30, 80, '2 Sep 2026'],
  ['Chemistry — 2026 Specimen', 'Chemistry', 10, 30, 80, '1 Sep 2026'],
  ['Mathematics — 2025 Annual', 'Mathematics', 9, 26, 80, '31 Aug 2026'],
  ['Science — 2025 Annual', 'Science', 9, 30, 80, '31 Aug 2026'],
  ['Mathematics — 2026 Half-Yearly', 'Mathematics', 8, 22, 80, '31 Aug 2026'],
  ['Science — 2026 Half-Yearly', 'Science', 8, 24, 80, '31 Aug 2026'],
  ['English Core — 2026 Board Paper', 'English Core', 12, 26, 80, '24 Aug 2026'],
  ['Physics — 2025 Annual', 'Physics', 11, 32, 70, '24 Aug 2026'],
  ['Chemistry — 2025 Annual', 'Chemistry', 11, 34, 70, '24 Aug 2026'],
  ['Mathematics — 2025 Annual', 'Mathematics', 11, 36, 80, '17 Aug 2026'],
  ['Biology — 2026 Specimen', 'Biology', 10, 32, 80, '17 Aug 2026'],
  ['Hindi — 2026 Board Paper', 'Hindi', 10, 26, 80, '17 Aug 2026'],
  ['Mathematics — 2026 Annual', 'Mathematics', 6, 18, 50, '10 Aug 2026'],
]);

const PAGE_SIZES = [10, 20, 50];

/**
 * A row as the printed sheet wants it. Unlike the knowledge base — which
 * counts an ingested paper in pages and chapters — this page models the
 * question total and the marks, so those are what the head rule carries.
 */
function paperFace(paper: ExamPaper): PaperFace {
  return {
    name: paper.name,
    subject: paper.subject,
    class: paper.class,
    detail: `${paper.questionCount} questions`,
    highlight: `${paper.marks} marks`,
  };
}

/**
 * The fields a row shows, in the order both renderings show them — the same
 * arrangement the knowledge base uses, and for the same reason: a card and
 * the table are two views of one row, so neither writes its own summary.
 */
interface PaperField {
  id: keyof ExamPaper;
  label: string;
  value: (paper: ExamPaper) => string;
  /** Table column width; the card grid sizes itself. */
  size: number;
  sortable?: boolean;
}

const PAPER_FIELDS: PaperField[] = [
  { id: 'class', label: 'Class', value: (paper) => String(paper.class), size: 100, sortable: true },
  { id: 'subject', label: 'Subject', value: (paper) => paper.subject, size: 150, sortable: true },
  {
    id: 'questionCount',
    label: 'Questions',
    value: (paper) => String(paper.questionCount),
    size: 130,
    sortable: true,
  },
  { id: 'marks', label: 'Marks', value: (paper) => String(paper.marks), size: 100, sortable: true },
  { id: 'createdAt', label: 'Created', value: (paper) => paper.createdAt, size: 130 },
];

/** A card's stats block: every field the table has a column for. */
function statsFor(paper: ExamPaper) {
  return PAPER_FIELDS.map((field) => ({ label: field.label, value: field.value(paper) }));
}

interface FilterableField {
  id: string;
  label: string;
  options: { value: string; label: string }[];
  valueOf: (item: ExamPaper) => string;
}

const COLUMNS: TableColumn<ExamPaper>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    enableSorting: true,
    size: 360,
    cell: ({ row }) => (
      <Box display="flex" align="center" gap={4} minW="0">
        <Icon name="file" tone="secondary" aria-label="Exam paper" />
        <NextLink href={`/exam-paper/${row.original.id}`} className="min-w-0">
          <Text variant="body-md" tone="brand">
            {row.original.name}
          </Text>
        </NextLink>
      </Box>
    ),
  },
  ...PAPER_FIELDS.map(
    (field): TableColumn<ExamPaper> => ({
      id: field.id,
      header: field.label,
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
];

/**
 * Exam papers browser. The URL is the source of truth for filters and
 * pagination (mulyankan-frontend's usage-page pattern), so refresh, share
 * and back/forward restore the view. Search stays local.
 */
export function ExamPaperManager() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<ExamPaper[]>(SEED);
  const [search, setSearch] = useState('');
  const [renameTarget, setRenameTarget] = useState<ExamPaper | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExamPaper | null>(null);

  const requestedView = searchParams.get('view') as View | null;
  const view: View = requestedView !== null && VIEWS.includes(requestedView) ? requestedView : 'cards';
  const requestedPage = Math.max(1, Number(searchParams.get('page')) || 1);
  const requestedPageSize = Number(searchParams.get('pageSize')) || 10;
  const pageSize = PAGE_SIZES.includes(requestedPageSize) ? requestedPageSize : 10;

  const fields = useMemo<FilterableField[]>(() => {
    const optionsOf = (pick: (item: ExamPaper) => string) =>
      [...new Set(items.map(pick))].sort().map((value) => ({ value, label: value }));
    return [
      {
        id: 'subject',
        label: 'Subject',
        options: optionsOf((item) => item.subject),
        valueOf: (item) => item.subject,
      },
    ];
  }, [items]);

  const filterFields = useMemo<FilterFieldConfig[]>(
    () => fields.map(({ id, label, options }) => ({ id, label, type: 'select', options })),
    [fields]
  );

  // One condition per field; the operator is always equals, so `subject=Physics`
  // is the whole param.
  const activeFilters = useMemo<FilterCondition[]>(() => {
    const conditions: FilterCondition[] = [];
    for (const field of fields) {
      const raw = searchParams.get(field.id);
      if (raw && field.options.some((option) => option.value === raw)) {
        conditions.push({ id: field.id, field: field.id, operator: 'equals', value: raw });
      }
    }
    return conditions;
  }, [fields, searchParams]);

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

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        activeFilters.every((condition) => {
          const field = fields.find((entry) => entry.id === condition.field);
          return !field || field.valueOf(item) === condition.value;
        }) &&
        (!needle ||
          item.name.toLowerCase().includes(needle) ||
          item.subject.toLowerCase().includes(needle))
    );
  }, [items, activeFilters, fields, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const pageRows = useMemo(
    () => filtered.slice((page - 1) * pageSize, page * pageSize),
    [filtered, page, pageSize]
  );

  function handleFiltersChange(next: FilterCondition[]) {
    updateParams((params) => {
      for (const field of fields) params.delete(field.id);
      // One condition per field; re-adding a field replaces it.
      const byField = new Map(next.map((condition) => [condition.field, condition]));
      for (const condition of byField.values()) params.set(condition.field, condition.value);
      params.delete('page');
    });
  }

  function handleViewChange(next: View) {
    updateParams((params) => {
      if (next === 'cards') params.delete('view');
      else params.set('view', next);
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

  function openRename(item: ExamPaper) {
    setRenameTarget(item);
    setRenameName(item.name);
  }

  function handleRename() {
    if (!renameTarget) return;
    const name = renameName.trim();
    if (!name) return;
    setItems((rows) =>
      rows.map((row) => (row.id === renameTarget.id ? { ...row, name } : row))
    );
    setRenameTarget(null);
    toast.success(`Renamed to “${name}”`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setItems((rows) => rows.filter((row) => row.id !== id));
    // Clamp the page if the delete emptied it (e.g. last row of page 3).
    updateParams((params) => {
      const maxPage = Math.max(1, Math.ceil((filtered.length - 1) / pageSize));
      const current = Math.max(1, Number(params.get('page')) || 1);
      if (current > maxPage) {
        if (maxPage > 1) params.set('page', String(maxPage));
        else params.delete('page');
      }
    });
    setDeleteTarget(null);
    toast.success(`Deleted “${name}”`);
  }

  return (
    <>
      <Box display="flex" direction="column" gap={12}>
        <Box display="flex" wrap="wrap" align="center" gap={6}>
          <Box w={120}>
            <Input
              placeholder="Search exam papers..."
              icon="search"
              value={searchText}
              onChange={(event) => handleSearchInput(event.target.value)}
            />
          </Box>
          <Filters
            fields={filterFields}
            value={activeFilters}
            onChange={handleFiltersChange}
            showOperators={false}
          />
          <Box grow display="flex" justify="end">
            <ViewToggle view={view} onViewChange={handleViewChange} />
          </Box>
        </Box>
        {view === 'cards' && (
          <CardShelf
            emptyIcon="files-01"
            emptyTitle="No exam papers found"
            emptyDescription="Try a different search or filters."
            unit="Papers"
            page={page}
            pageSize={pageSize}
            totalRows={filtered.length}
            pageSizeOptions={PAGE_SIZES}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          >
            {pageRows.map((paper) => (
              <PaperCard
                key={paper.id}
                face={paperFace(paper)}
                title={paper.name}
                stats={statsFor(paper)}
                href={`/exam-paper/${paper.id}`}
                menuOptions={renameDeleteOptions(
                  () => openRename(paper),
                  () => setDeleteTarget(paper)
                )}
              />
            ))}
          </CardShelf>
        )}
        {view === 'table' && (
        <Table
          data={pageRows}
          columns={COLUMNS}
          variant="compact"
          getRowId={(row) => row.id}
          actions={(row) => [
            { label: 'Rename', icon: 'pencil-edit', onClick: () => openRename(row) },
            { label: 'Delete', icon: 'delete', onClick: () => setDeleteTarget(row) },
          ]}
          currentPage={page}
          pageSize={pageSize}
          totalRows={filtered.length}
          onPageChange={handlePageChange}
          pageSizeOptions={PAGE_SIZES}
          onPageSizeChange={handlePageSizeChange}
          emptyTitle="No items found"
          emptyDescription="Try a different search or filters."
        />
        )}
      </Box>

      <Dialog
        open={renameTarget !== null}
        onOpenChange={(open) => {
          if (!open) setRenameTarget(null);
        }}
        title="Rename item"
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
        title="Delete item"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed. This cannot be undone.`
            : undefined
        }
        submitButtonText="Delete"
        submitButtonVariant="destructive"
        onSubmit={handleDelete}
      />
    </>
  );
}
