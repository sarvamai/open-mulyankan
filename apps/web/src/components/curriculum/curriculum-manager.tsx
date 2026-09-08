'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  Dialog,
  FileUpload,
  Input,
  Select,
  Table,
  Text,
  toast,
} from '@sarvam/tatva';
import type { QuickFilterConfig, TableColumn } from '@sarvam/tatva';

type CurriculumStatus = 'draft' | 'published';

interface Curriculum {
  id: string;
  name: string;
  /** Blank until a parsing pipeline fills them in — uploads start bare. */
  board: string;
  classLevel: string;
  subjects: number;
  chapters: number;
  updated: string;
  status: CurriculumStatus;
}

/**
 * Mock seed. The platform API does not exist yet, so the manager runs on
 * client state alone; swap the seed for a fetch when the workflow core
 * serves curriculums.
 */
const SEED_CURRICULUMS: Curriculum[] = [
  {
    id: 'cur-math-10',
    name: 'Mathematics — Class 10 (2026 syllabus)',
    board: 'CBSE',
    classLevel: 'Class 10',
    subjects: 1,
    chapters: 15,
    updated: '2 Sep 2026',
    status: 'published',
  },
  {
    id: 'cur-sci-10',
    name: 'Science — Class 10 (2026 syllabus)',
    board: 'CBSE',
    classLevel: 'Class 10',
    subjects: 4,
    chapters: 28,
    updated: '28 Aug 2026',
    status: 'published',
  },
  {
    id: 'cur-math-9',
    name: 'Mathematics — Class 9',
    board: 'ICSE',
    classLevel: 'Class 9',
    subjects: 1,
    chapters: 12,
    updated: '15 Aug 2026',
    status: 'draft',
  },
];

const STATUS_BADGE: Record<CurriculumStatus, { variant: 'default' | 'green'; label: string }> = {
  draft: { variant: 'default', label: 'Draft' },
  published: { variant: 'green', label: 'Published' },
};

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'published', label: 'Published' },
];

const ACCEPTED_TYPES: Record<string, string[]> = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function stripExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.slice(0, dot) : filename;
}

const COLUMNS: TableColumn<Curriculum>[] = [
  {
    id: 'name',
    header: 'Curriculum',
    accessorKey: 'name',
    enableSorting: true,
    size: 320,
    cell: ({ row }) => {
      const meta = [row.original.board, row.original.classLevel].filter(Boolean).join(' · ');
      return (
        <Box display="flex" direction="column" gap={1} minW="0">
          <Text variant="body-md">{row.original.name}</Text>
          {meta && (
            <Text variant="body-xs" tone="tertiary">
              {meta}
            </Text>
          )}
        </Box>
      );
    },
  },
  {
    id: 'subjects',
    header: 'Subjects',
    accessorKey: 'subjects',
    enableSorting: true,
    size: 110,
  },
  {
    id: 'chapters',
    header: 'Chapters',
    accessorKey: 'chapters',
    enableSorting: true,
    size: 110,
  },
  {
    id: 'updated',
    header: 'Updated',
    accessorKey: 'updated',
    enableSorting: true,
    size: 140,
    cell: ({ row }) => (
      <Text variant="body-md" tone="secondary">
        {row.original.updated}
      </Text>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    accessorKey: 'status',
    size: 130,
    cell: ({ row }) => (
      <Badge variant={STATUS_BADGE[row.original.status].variant} size="sm">
        {STATUS_BADGE[row.original.status].label}
      </Badge>
    ),
  },
];

/** Curriculum list with upload, delete, and manage flows (client-side only). */
export function CurriculumManager() {
  const [curriculums, setCurriculums] = useState<Curriculum[]>(SEED_CURRICULUMS);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Curriculum | null>(null);
  const [manageTarget, setManageTarget] = useState<Curriculum | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');

  const [manageName, setManageName] = useState('');
  const [manageStatus, setManageStatus] = useState<CurriculumStatus>('draft');

  // Dialog fields are (re)seeded in the open handlers, not effects — a
  // dialog reopened after a cancel must start empty, not hold whatever was
  // typed and abandoned last time.
  function openUpload() {
    setFile(null);
    setUploadName('');
    setUploadOpen(true);
  }

  function openManage(row: Curriculum) {
    setManageTarget(row);
    setManageName(row.name);
    setManageStatus(row.status);
  }

  // Stable identity is required: Table re-runs its debounced-search effect
  // whenever this callback changes, so an inline arrow would reset it on
  // every render.
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
  }, []);

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return curriculums.filter((curriculum) => {
      const matchesSearch =
        !needle || curriculum.name.toLowerCase().includes(needle);
      const matchesStatus = !statusFilter || curriculum.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [curriculums, search, statusFilter]);

  const quickFilters: QuickFilterConfig[] = useMemo(
    () => [
      {
        id: 'status',
        label: 'Status',
        placeholder: 'Status',
        options: STATUS_OPTIONS,
        value: statusFilter,
        onChange: setStatusFilter,
      },
    ],
    [statusFilter]
  );

  function handleUpload() {
    const name = uploadName.trim();
    if (!file || !name) return;
    const uploaded: Curriculum = {
      id: crypto.randomUUID(),
      name,
      board: '',
      classLevel: '',
      subjects: 0,
      chapters: 0,
      updated: 'Just now',
      status: 'draft',
    };
    setCurriculums((rows) => [uploaded, ...rows]);
    setUploadOpen(false);
    toast.success(`Uploaded “${name}”`);
  }

  function handleDelete() {
    if (!deleteTarget) return;
    const { id, name } = deleteTarget;
    setCurriculums((rows) => rows.filter((row) => row.id !== id));
    setDeleteTarget(null);
    toast.success(`Deleted “${name}”`);
  }

  function handleManageSave() {
    if (!manageTarget) return;
    const name = manageName.trim();
    if (!name) return;
    setCurriculums((rows) =>
      rows.map((row) =>
        row.id === manageTarget.id
          ? { ...row, name, status: manageStatus, updated: 'Just now' }
          : row
      )
    );
    setManageTarget(null);
    toast.success('Curriculum updated');
  }

  return (
    <>
      <Table
        data={filtered}
        columns={COLUMNS}
        variant="compact"
        getRowId={(row) => row.id}
        onRowClick={openManage}
        actions={(row) => [
          { label: 'Manage', icon: 'pencil-edit', onClick: () => openManage(row) },
          { label: 'Delete', icon: 'delete', onClick: () => setDeleteTarget(row) },
        ]}
        showSearch
        searchPlaceholder="Search curriculums..."
        onSearchChange={handleSearchChange}
        quickFilters={quickFilters}
        showAddFilter={false}
        emptyTitle="No curriculums found"
        emptyDescription="Try changing your search or filters, or upload a curriculum document."
        emptyActions={[
          {
            children: 'Clear filters',
            variant: 'outline',
            onClick: () => {
              setSearch('');
              setStatusFilter('');
            },
          },
          {
            children: 'Upload curriculum',
            variant: 'primary',
            icon: 'upload',
            onClick: openUpload,
          },
        ]}
        customActions={
          <Button icon="upload" onClick={openUpload}>
            Upload curriculum
          </Button>
        }
      />

      <Dialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        title="Upload curriculum"
        description="Upload a course curriculum document. It is added as a draft you can review and publish."
        submitButtonText="Upload"
        submitButtonDisabled={!file || !uploadName.trim()}
        onSubmit={handleUpload}
      >
        <Box display="flex" direction="column" gap={10} py={4}>
          <FileUpload
            selectedFile={file}
            onFileSelect={(selected) => {
              setFile(selected);
              if (selected) setUploadName(stripExtension(selected.name));
            }}
            primaryText="Drag & drop a curriculum document"
            secondaryText="PDF or DOCX, up to 10 MB"
            acceptedTypes={ACCEPTED_TYPES}
            maxSize={MAX_FILE_SIZE}
          />
          <Input
            label="Curriculum name"
            value={uploadName}
            onChange={(event) => setUploadName(event.target.value)}
            placeholder="e.g. Mathematics — Class 10 (2026 syllabus)"
          />
        </Box>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title="Delete curriculum"
        description={
          deleteTarget
            ? `“${deleteTarget.name}” will be removed. This cannot be undone.`
            : undefined
        }
        submitButtonText="Delete"
        submitButtonVariant="destructive"
        onSubmit={handleDelete}
      />

      <Dialog
        open={manageTarget !== null}
        onOpenChange={(open) => {
          if (!open) setManageTarget(null);
        }}
        title="Manage curriculum"
        description="Rename the curriculum or change its status."
        submitButtonText="Save changes"
        submitButtonDisabled={!manageName.trim()}
        onSubmit={handleManageSave}
      >
        <Box display="flex" direction="column" gap={10} py={4}>
          <Input
            label="Curriculum name"
            value={manageName}
            onChange={(event) => setManageName(event.target.value)}
          />
          <Select
            label="Status"
            options={STATUS_OPTIONS}
            value={manageStatus}
            onValueChange={(value) => setManageStatus(value as CurriculumStatus)}
          />
          {manageTarget && (
            <Text variant="body-sm" tone="tertiary">
              {[
                manageTarget.board,
                manageTarget.classLevel,
                `${manageTarget.subjects} ${
                  manageTarget.subjects === 1 ? 'subject' : 'subjects'
                }`,
                `${manageTarget.chapters} ${
                  manageTarget.chapters === 1 ? 'chapter' : 'chapters'
                }`,
              ]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          )}
        </Box>
      </Dialog>
    </>
  );
}
