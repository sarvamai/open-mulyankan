import type { Metadata } from 'next';

import { ExamPaperView } from '@/components/exam-paper/exam-paper-view';

export const metadata: Metadata = {
  title: 'Exam Paper',
};

/**
 * Exam paper: create new papers, view them and export. The manager
 * runs on mock data — the platform API does not exist yet — and reads its
 * filters and pagination from the URL, so it suspends until search params
 * are available during prerendering.
 */
export default function ExamPaperPage() {
  return <ExamPaperView />;
}
