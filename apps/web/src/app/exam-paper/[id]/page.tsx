import type { Metadata } from 'next';
import { Suspense } from 'react';

import { PaperEditor } from '@/components/exam-paper/paper-editor';
import { MOCK_PAPER } from '@/components/exam-paper/mock-paper';

export const metadata: Metadata = {
  title: MOCK_PAPER.title,
};

// Prerenders the sample paper so the build exercises the editor render;
// other ids render on demand.
export function generateStaticParams() {
  return [{ id: MOCK_PAPER.id }];
}

/**
 * Exam paper editor: review and edit an AI-generated draft, section by
 * section, with inline metadata editing. Runs on a single mock paper
 * regardless of the id — the platform API does not exist yet — so every
 * paper in the list opens the same sample for now.
 */
export default function ExamPaperEditorPage() {
  return (
    <Suspense>
      <PaperEditor paper={MOCK_PAPER} />
    </Suspense>
  );
}
