'use client';

import { Suspense } from 'react';
import { toast } from '@sarvam/tatva';

import { PageShell } from '@/components/shell/page-shell';
import { ExamPaperManager } from './exam-paper-manager';

/** Exam papers page frame; the create action lives in the header. */
export function ExamPaperView() {
  return (
    <PageShell
      left={{ title: 'Exam Paper' }}
      actions={[
        {
          label: 'New exam paper',
          icon: 'plus',
          variant: 'primary',
          onClick: () => toast.info('Exam paper creation is coming soon'),
        },
      ]}
    >
      <Suspense>
        <ExamPaperManager />
      </Suspense>
    </PageShell>
  );
}
