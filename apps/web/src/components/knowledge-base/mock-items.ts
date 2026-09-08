/**
 * Mock knowledge base rows — the platform API does not exist yet, so the
 * knowledge base browses this list and the question bank's source step draws
 * its text books from the same one. 22 rows per kind so the paginated footer
 * is exercised (it renders once totalRows passes 20).
 */

import type { Kind, KnowledgeItem, Status, StatusEvent } from './types';

const STEPS: Record<Kind, string[]> = {
  textbook: ['Extracting text', 'Parsing chapters', 'Generating summary', 'Indexing'],
  paper: ['Scanning pages', 'Extracting questions', 'Classifying by topic', 'Indexing'],
};

const WINDOWS = [
  '11:54 PM – 11:54 PM (11s)',
  '11:59 PM – 12:01 AM (2m 16s)',
  '12:01 AM – 12:02 AM (42s)',
  '12:02 AM – 12:18 AM (16m 11s)',
];

function historyFor(kind: Kind, status: Status): StatusEvent[] {
  const steps = STEPS[kind];
  return steps.map((label, index) => ({
    label,
    state:
      index < steps.length - 1 || status === 'ready'
        ? 'completed'
        : status === 'processing'
          ? 'running'
          : 'failed',
    window: WINDOWS[index],
    ago: '21 hours ago',
  }));
}

type SeedRow = [
  name: string,
  meta: string,
  subject: string,
  klass: number,
  pages: number,
  chapters: number,
  status: Status,
  createdAt: string,
];

function seed(kind: Kind, rows: SeedRow[]): KnowledgeItem[] {
  return rows.map(([name, meta, subject, klass, pages, chapters, status, createdAt], index) => ({
    id: `${kind}-${index}`,
    kind,
    name,
    meta,
    subject,
    class: klass,
    pages,
    chapters,
    status,
    createdAt,
    history: historyFor(kind, status),
  }));
}

// Mock seed — the platform API does not exist yet. 22 rows per tab so the
// paginated footer is exercised (it renders once totalRows passes 20).
export const MOCK_ITEMS: KnowledgeItem[] = [
  ...seed('textbook', [
    ['Mathematics', 'English', 'Mathematics', 10, 264, 15, 'ready', '7 Sep 2026'],
    ['Science', 'English', 'Science', 10, 286, 16, 'ready', '7 Sep 2026'],
    ['Mathematics', 'Hindi', 'Mathematics', 9, 240, 12, 'processing', '6 Sep 2026'],
    ['Physics', 'English', 'Physics', 11, 298, 15, 'ready', '5 Sep 2026'],
    ['Chemistry', 'English', 'Chemistry', 11, 272, 14, 'ready', '5 Sep 2026'],
    ['Biology', 'English', 'Biology', 11, 312, 19, 'failed', '4 Sep 2026'],
    ['Mathematics', 'English', 'Mathematics', 12, 320, 13, 'ready', '4 Sep 2026'],
    ['Physics', 'English', 'Physics', 12, 336, 15, 'ready', '3 Sep 2026'],
    ['Chemistry', 'English', 'Chemistry', 12, 318, 16, 'ready', '3 Sep 2026'],
    ['Biology', 'English', 'Biology', 12, 342, 16, 'processing', '3 Sep 2026'],
    ['Flamingo', 'English', 'English', 12, 208, 8, 'ready', '2 Sep 2026'],
    ['Sparsh', 'Hindi', 'Hindi', 10, 196, 7, 'ready', '2 Sep 2026'],
    ['Social Science', 'English', 'Social Science', 10, 272, 20, 'ready', '1 Sep 2026'],
    ['Our Pasts — III', 'English', 'History', 8, 184, 10, 'ready', '31 Aug 2026'],
    ['Resources and Development', 'English', 'Geography', 8, 168, 11, 'ready', '31 Aug 2026'],
    ['Social and Political Life — III', 'English', 'Civics', 8, 148, 10, 'ready', '31 Aug 2026'],
    ['Mathematics', 'English', 'Mathematics', 8, 252, 16, 'ready', '24 Aug 2026'],
    ['Science', 'English', 'Science', 8, 232, 18, 'ready', '24 Aug 2026'],
    ['Mathematics', 'English', 'Mathematics', 6, 216, 14, 'ready', '24 Aug 2026'],
    ['Science', 'English', 'Science', 6, 204, 15, 'ready', '24 Aug 2026'],
    ['Computer Applications', 'English', 'Computer Applications', 9, 188, 9, 'ready', '17 Aug 2026'],
    ['Indian Economic Development', 'English', 'Economics', 11, 224, 12, 'failed', '17 Aug 2026'],
  ]),
  ...seed('paper', [
    ['2026 Board Paper', 'Set 1', 'Mathematics', 10, 32, 15, 'ready', '7 Sep 2026'],
    ['2026 Board Paper', 'Set 2', 'Science', 10, 36, 16, 'ready', '7 Sep 2026'],
    ['2026 Board Paper', 'Set 1', 'Physics', 12, 38, 15, 'ready', '5 Sep 2026'],
    ['2026 Board Paper', 'Set 3', 'Chemistry', 12, 40, 16, 'ready', '5 Sep 2026'],
    ['2026 Board Paper', 'Set 2', 'Mathematics', 12, 42, 13, 'processing', '4 Sep 2026'],
    ['2026 Board Paper', 'Set 1', 'Biology', 12, 44, 16, 'ready', '4 Sep 2026'],
    ['2026 Board Paper', 'Set 1', 'English', 10, 24, 8, 'ready', '3 Sep 2026'],
    ['2026 Board Paper', 'Set 2', 'Social Science', 10, 34, 20, 'ready', '3 Sep 2026'],
    ['2026 Specimen', '', 'Mathematics', 10, 28, 12, 'ready', '2 Sep 2026'],
    ['2026 Specimen', '', 'Physics', 10, 30, 11, 'ready', '2 Sep 2026'],
    ['2026 Specimen', '', 'Chemistry', 10, 30, 12, 'failed', '1 Sep 2026'],
    ['2025 Annual', '', 'Mathematics', 9, 26, 14, 'ready', '31 Aug 2026'],
    ['2025 Annual', '', 'Science', 9, 30, 15, 'ready', '31 Aug 2026'],
    ['2026 Half-Yearly', '', 'Mathematics', 8, 22, 16, 'ready', '31 Aug 2026'],
    ['2026 Half-Yearly', '', 'Science', 8, 24, 18, 'ready', '31 Aug 2026'],
    ['2026 Board Paper', 'Set 1', 'English', 12, 26, 8, 'ready', '24 Aug 2026'],
    ['2025 Annual', '', 'Physics', 11, 32, 15, 'ready', '24 Aug 2026'],
    ['2025 Annual', '', 'Chemistry', 11, 34, 14, 'ready', '24 Aug 2026'],
    ['2025 Annual', '', 'Mathematics', 11, 36, 14, 'ready', '17 Aug 2026'],
    ['2026 Specimen', '', 'Biology', 10, 32, 16, 'ready', '17 Aug 2026'],
    ['2026 Board Paper', 'Set 3', 'Hindi', 10, 26, 7, 'processing', '17 Aug 2026'],
    ['2026 Annual', '', 'Mathematics', 6, 18, 14, 'ready', '10 Aug 2026'],
  ]),
];

// TEMPORARY, DELETE ME — a hardcoded cover preview so the shelf can be judged
// with a real book on it. `public/dev/ncert-class-10-science-cover.jpg` is page
// one of a local NCERT Class 10 Science PDF, rasterised by hand. Remove this
// block and that file once ingest renders covers for real.
const DEV_COVERS: Record<string, string> = {
  'textbook-1': '/dev/ncert-class-10-science-cover.jpg',
};

for (const item of MOCK_ITEMS) {
  const cover = DEV_COVERS[item.id];
  if (cover) item.coverUrl = cover;
}
/**
 * Chapter labels for a book or paper. The mock rows carry a chapter *count*
 * and nothing else — no table of contents is modelled, and none is invented
 * here — so a chapter is identified by its number until an ingest API returns
 * real ones.
 */
export function chapterLabels(item: KnowledgeItem): string[] {
  return Array.from({ length: item.chapters }, (_, index) => `Chapter ${index + 1}`);
}
